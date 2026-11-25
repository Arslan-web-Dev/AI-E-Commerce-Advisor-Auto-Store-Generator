import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProviderBundle, DemoCompetitorProvider } from '@/lib/providers';
import {
  CollectionRun,
  CompetitorRecord,
  MarketObservation,
  DemandTrendRecord,
  CostEstimateRecord,
  CoverageUnavailableError,
  DataFreshness,
  ProviderStatusDetail,
} from '@/types/data-collection';
import { PAKISTAN_COUNTRY_CODE } from '@/lib/geo/pakistan-geography';
import { getCompetitorsWithCache } from '@/lib/data-collection/competitor-cache';
import { OVERPASS_ATTRIBUTION, clampRadiusKm } from '@/lib/providers/competitors/overpass';

const STUCK_RUNNING_MS = 5 * 60 * 1000;
const ACTIVE_RUN_GUARD_MS = 40 * 1000;

export interface OrchestrationResult {
  success: boolean;
  run_id: string;
  status: 'completed' | 'partial' | 'failed';
  providers_status: CollectionRun['providers_status'];
  summary: {
    competitor_count: number;
    market_metric_count: number;
    has_trend_data: boolean;
    cost_estimate_count: number;
  };
  error?: string;
}

function asStatusDetail(partial: ProviderStatusDetail): ProviderStatusDetail {
  return partial;
}

export async function runDataCollection(
  projectId: string,
  userId: string,
  options?: { forceDemo?: boolean; isAdmin?: boolean }
): Promise<OrchestrationResult> {
  const supabase = await createClient();

  // 1. Fetch project and verify ownership
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    throw new Error(projectError?.message || 'Project not found');
  }

  if (project.owner_id !== userId && !options?.isAdmin) {
    throw new Error('Access denied: You do not own this project');
  }

  // 2. Concurrency / idempotency: reclaim stuck runs, avoid duplicate active work
  const { data: existingRuns } = await supabase
    .from('project_collection_runs')
    .select('*')
    .eq('project_id', projectId)
    .in('status', ['running', 'pending'])
    .order('started_at', { ascending: false })
    .limit(5);

  const now = Date.now();
  let runId: string | null = null;

  if (existingRuns && existingRuns.length > 0) {
    for (const activeRun of existingRuns) {
      const startedAt = new Date(activeRun.started_at || activeRun.created_at).getTime();
      const age = now - startedAt;

      if (activeRun.status === 'running' && age < ACTIVE_RUN_GUARD_MS) {
        return {
          success: true,
          run_id: activeRun.id,
          status: 'partial',
          providers_status: activeRun.providers_status || {},
          summary: {
            competitor_count: 0,
            market_metric_count: 0,
            has_trend_data: false,
            cost_estimate_count: 0,
          },
        };
      }

      if (activeRun.status === 'running' && age >= STUCK_RUNNING_MS) {
        await supabase
          .from('project_collection_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            providers_status: {
              ...(activeRun.providers_status || {}),
              _system: {
                status: 'failed',
                provider: 'orchestrator',
                provenance: 'manual_estimate',
                item_count: 0,
                error: 'Collection run marked failed after exceeding the stuck-running timeout.',
              },
            },
          })
          .eq('id', activeRun.id);
        continue;
      }

      // Claim the newest pending (or reclaimable running) run created by submit RPC.
      if (!runId && (activeRun.status === 'pending' || activeRun.status === 'running')) {
        runId = activeRun.id;
        await supabase
          .from('project_collection_runs')
          .update({
            status: 'running',
            started_at: new Date().toISOString(),
            providers_status: {},
          })
          .eq('id', runId);
      }
    }
  }

  if (!runId) {
    const { data: run, error: runError } = await supabase
      .from('project_collection_runs')
      .insert({
        project_id: projectId,
        status: 'running',
        providers_status: {},
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (runError || !run) {
      throw new Error(`Failed to initialize collection run: ${runError?.message}`);
    }
    runId = run.id;
  }

  const providers = getProviderBundle(options?.forceDemo);

  const regionName: string | null = project.region || null;
  const lat = project.lat != null ? Number(project.lat) : NaN;
  const lng = project.lng != null ? Number(project.lng) : NaN;
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  const locationLabel = project.city || project.district || 'this location';
  const radiusKm = clampRadiusKm(Number(project.radius_km || 10));

  const providersStatus: CollectionRun['providers_status'] = {};

  let competitors: CompetitorRecord[] = [];
  let marketObservations: MarketObservation[] = [];
  let demandTrend: DemandTrendRecord | null = null;
  let costEstimates: CostEstimateRecord[] = [];

  // Shared competitor cache writes use the admin client when available;
  // cache outages must not break live collection.
  let cacheClient: ReturnType<typeof createAdminClient> | null = null;
  try {
    cacheClient = createAdminClient();
  } catch {
    cacheClient = null;
  }

  const [compResult, regionalResult, trendResult, costResult] = await Promise.allSettled([
    // A. Competitors
    (async () => {
      const start = Date.now();
      if (!hasCoordinates) {
        return {
          records: [] as CompetitorRecord[],
          provider: providers.competitorProvider.name,
          provenance: providers.competitorProvider.provenance,
          freshness: 'unavailable' as DataFreshness,
          latency: Date.now() - start,
          unavailable: true,
          warning: `No verified coordinates are available for ${locationLabel}. The nationwide OpenStreetMap POI radar requires coordinates; no other region's coordinates were substituted.`,
          attribution: OVERPASS_ATTRIBUTION,
          requested_geo_scope: locationLabel,
          actual_geo_scope: 'none',
          retrieved_at: new Date().toISOString(),
        };
      }

      const queryInput = {
        category: project.category,
        lat,
        lng,
        radiusKm,
        city: project.city || undefined,
      };

      if (options?.forceDemo) {
        const demoComp = new DemoCompetitorProvider();
        const demoRecords = await demoComp.getCompetitors(queryInput);
        return {
          records: demoRecords.map((r) => ({ ...r, freshness: 'synthetic_demo' as const })),
          provider: demoComp.name,
          provenance: demoComp.provenance,
          freshness: 'synthetic_demo' as DataFreshness,
          latency: Date.now() - start,
          unavailable: false,
          warning: 'Explicit demo mode enabled. Results are synthetic_demo.',
          attribution: undefined as string | undefined,
          requested_geo_scope: `${lat.toFixed(4)},${lng.toFixed(4)} r=${radiusKm}km`,
          actual_geo_scope: `${lat.toFixed(4)},${lng.toFixed(4)}`,
          retrieved_at: new Date().toISOString(),
          cache_retrieved_at: undefined as string | undefined,
        };
      }

      try {
        const hit = await getCompetitorsWithCache(
          cacheClient as never,
          queryInput,
          (input) => providers.competitorProvider.getCompetitors(input)
        );
        return {
          records: hit.records,
          provider: providers.competitorProvider.name,
          provenance: providers.competitorProvider.provenance,
          freshness: hit.freshness,
          latency: Date.now() - start,
          unavailable: false,
          warning: undefined as string | undefined,
          attribution: OVERPASS_ATTRIBUTION,
          requested_geo_scope: `${lat.toFixed(4)},${lng.toFixed(4)} r=${radiusKm}km`,
          actual_geo_scope: `${lat.toFixed(4)},${lng.toFixed(4)}`,
          retrieved_at: hit.retrieved_at,
          cache_retrieved_at: hit.cache_retrieved_at,
        };
      } catch (err: unknown) {
        // Do NOT silently substitute synthetic competitors for a live failure.
        return {
          records: [] as CompetitorRecord[],
          provider: providers.competitorProvider.name,
          provenance: providers.competitorProvider.provenance,
          freshness: 'unavailable' as DataFreshness,
          latency: Date.now() - start,
          unavailable: false,
          failed: true,
          warning: err instanceof Error ? err.message : String(err),
          attribution: OVERPASS_ATTRIBUTION,
          requested_geo_scope: `${lat.toFixed(4)},${lng.toFixed(4)} r=${radiusKm}km`,
          actual_geo_scope: 'none',
          retrieved_at: new Date().toISOString(),
          cache_retrieved_at: undefined as string | undefined,
        };
      }
    })(),

    // B. Regional demographics
    (async () => {
      const start = Date.now();
      const records = await providers.regionalStatsProvider.getRegionalStats({
        city: project.city || project.district || 'Pakistan',
        region: regionName || undefined,
        country: project.country || 'Pakistan',
      });
      return {
        records,
        provider: providers.regionalStatsProvider.name,
        provenance: providers.regionalStatsProvider.provenance,
        freshness: providers.regionalStatsProvider.provenance === 'manual_estimate'
          ? ('manual_estimate' as DataFreshness)
          : ('verified_benchmark' as DataFreshness),
        latency: Date.now() - start,
        requested_geo_scope: regionName || project.city || 'Pakistan',
        actual_geo_scope: records[0]?.geography || regionName || 'Pakistan',
        retrieved_at: new Date().toISOString(),
      };
    })(),

    // C. Demand trends
    (async () => {
      const start = Date.now();
      const record = await providers.demandTrendProvider.getDemandTrends({
        category: project.category,
        region: regionName || PAKISTAN_COUNTRY_CODE,
      });
      return {
        record,
        provider: record.provider || providers.demandTrendProvider.name,
        provenance: record.provenance,
        freshness: record.freshness || (record.provenance === 'external_api' ? 'live' : 'synthetic_demo'),
        latency: Date.now() - start,
        requested_geo_scope: record.requested_geo_scope || regionName || PAKISTAN_COUNTRY_CODE,
        actual_geo_scope: record.actual_geo_scope || record.region,
        retrieved_at: record.retrieved_at,
        cache_retrieved_at: record.cache_retrieved_at,
      };
    })(),

    // D. Cost estimates (rent_cache read only)
    (async () => {
      const start = Date.now();
      const records = await providers.costEstimateProvider.getCostEstimates({
        category: project.category,
        city: project.city || '',
        area: project.target_location,
        district: project.district || project.city || undefined,
        province: regionName || undefined,
        lat: hasCoordinates ? lat : undefined,
        lng: hasCoordinates ? lng : undefined,
        footprint: project.storefront_footprint || 'boutique',
        budgetAmount: Number(project.budget_amount) || 15000,
        budgetCurrency: project.budget_currency || 'PKR',
      });
      return {
        records,
        provider: providers.costEstimateProvider.name,
        provenance: providers.costEstimateProvider.provenance,
        freshness: 'manual_estimate' as DataFreshness,
        latency: Date.now() - start,
        requested_geo_scope: `${project.city || ''}|${project.district || ''}|${regionName || ''}`,
        actual_geo_scope: records.find((r) => r.cost_type === 'rent_monthly')?.assumptions?.includes('Source geography')
          ? 'rent_cache'
          : 'estimate_model',
        retrieved_at: new Date().toISOString(),
      };
    })(),
  ]);

  // Process Competitor Result — preserve successful data independently
  if (compResult.status === 'fulfilled') {
    const comp = compResult.value as {
      records: CompetitorRecord[];
      provider: string;
      provenance: CompetitorRecord['provenance'];
      freshness: DataFreshness;
      latency: number;
      unavailable?: boolean;
      failed?: boolean;
      warning?: string;
      attribution?: string;
      requested_geo_scope: string;
      actual_geo_scope: string;
      retrieved_at: string;
      cache_retrieved_at?: string;
    };

    if (comp.unavailable) {
      providersStatus.competitors = asStatusDetail({
        status: 'unavailable',
        provider: comp.provider,
        provenance: comp.provenance,
        freshness: 'unavailable',
        item_count: 0,
        latency_ms: comp.latency,
        error: comp.warning,
        attribution: comp.attribution,
        requested_geo_scope: comp.requested_geo_scope,
        actual_geo_scope: comp.actual_geo_scope,
        retrieved_at: comp.retrieved_at,
      });
    } else if (comp.failed) {
      providersStatus.competitors = asStatusDetail({
        status: 'failed',
        provider: comp.provider,
        provenance: comp.provenance,
        freshness: 'unavailable',
        item_count: 0,
        latency_ms: comp.latency,
        error: comp.warning,
        attribution: comp.attribution,
        requested_geo_scope: comp.requested_geo_scope,
        actual_geo_scope: comp.actual_geo_scope,
        retrieved_at: comp.retrieved_at,
      });
    } else {
      competitors = comp.records.map((c) => ({
        ...c,
        project_id: projectId,
        run_id: runId!,
      }));
      providersStatus.competitors = asStatusDetail({
        status: 'completed',
        provider: comp.provider,
        provenance: comp.provenance,
        freshness: comp.freshness,
        item_count: competitors.length,
        latency_ms: comp.latency,
        warning: comp.warning,
        attribution: comp.attribution,
        requested_geo_scope: comp.requested_geo_scope,
        actual_geo_scope: comp.actual_geo_scope,
        retrieved_at: comp.retrieved_at,
        cache_retrieved_at: comp.cache_retrieved_at,
      });
    }
  } else {
    providersStatus.competitors = asStatusDetail({
      status: 'failed',
      provider: providers.competitorProvider.name,
      provenance: providers.competitorProvider.provenance,
      freshness: 'unavailable',
      item_count: 0,
      error: compResult.reason?.message || 'Competitor provider failed',
    });
  }

  if (regionalResult.status === 'fulfilled') {
    marketObservations = regionalResult.value.records.map((m) => ({
      ...m,
      project_id: projectId,
      run_id: runId!,
      freshness: regionalResult.value.freshness,
    }));
    providersStatus.regional_stats = asStatusDetail({
      status: 'completed',
      provider: regionalResult.value.provider,
      provenance: regionalResult.value.provenance,
      freshness: regionalResult.value.freshness,
      item_count: marketObservations.length,
      latency_ms: regionalResult.value.latency,
      requested_geo_scope: regionalResult.value.requested_geo_scope,
      actual_geo_scope: regionalResult.value.actual_geo_scope,
      retrieved_at: regionalResult.value.retrieved_at,
    });
  } else {
    providersStatus.regional_stats = asStatusDetail({
      status: 'failed',
      provider: providers.regionalStatsProvider.name,
      provenance: providers.regionalStatsProvider.provenance,
      item_count: 0,
      error: regionalResult.reason?.message || 'Regional stats provider failed',
    });
  }

  if (trendResult.status === 'fulfilled') {
    demandTrend = {
      ...trendResult.value.record,
      project_id: projectId,
      run_id: runId!,
    };
    providersStatus.trends = asStatusDetail({
      status: 'completed',
      provider: trendResult.value.provider,
      provenance: trendResult.value.provenance,
      freshness: trendResult.value.freshness,
      item_count: demandTrend.trend_series.length,
      latency_ms: trendResult.value.latency,
      requested_geo_scope: trendResult.value.requested_geo_scope,
      actual_geo_scope: trendResult.value.actual_geo_scope,
      retrieved_at: trendResult.value.retrieved_at,
      cache_retrieved_at: trendResult.value.cache_retrieved_at,
      warning:
        trendResult.value.provenance === 'synthetic_demo'
          ? 'Synthetic/demo trend series — not a live Google Trends observation.'
          : undefined,
    });
  } else if (trendResult.reason instanceof CoverageUnavailableError) {
    providersStatus.trends = asStatusDetail({
      status: 'unavailable',
      provider: providers.demandTrendProvider.name,
      provenance: providers.demandTrendProvider.provenance,
      freshness: 'unavailable',
      item_count: 0,
      error: trendResult.reason.message,
    });
  } else {
    providersStatus.trends = asStatusDetail({
      status: 'failed',
      provider: providers.demandTrendProvider.name,
      provenance: providers.demandTrendProvider.provenance,
      freshness: 'unavailable',
      item_count: 0,
      error: trendResult.reason?.message || 'Demand trend provider failed',
    });
  }

  if (costResult.status === 'fulfilled') {
    costEstimates = costResult.value.records.map((e) => ({
      ...e,
      project_id: projectId,
      run_id: runId!,
    }));
    const rentRow = costEstimates.find((e) => e.cost_type === 'rent_monthly');
    const rentUnavailable = rentRow?.freshness === 'unavailable';
    providersStatus.costs = asStatusDetail({
      status: rentUnavailable ? 'partial' : 'completed',
      provider: costResult.value.provider,
      provenance: costResult.value.provenance,
      freshness: rentRow?.freshness || costResult.value.freshness,
      item_count: costEstimates.length,
      latency_ms: costResult.value.latency,
      requested_geo_scope: costResult.value.requested_geo_scope,
      actual_geo_scope: costResult.value.actual_geo_scope,
      retrieved_at: costResult.value.retrieved_at,
      warning: rentUnavailable ? rentRow?.assumptions : undefined,
    });
  } else {
    providersStatus.costs = asStatusDetail({
      status: 'failed',
      provider: providers.costEstimateProvider.name,
      provenance: providers.costEstimateProvider.provenance,
      item_count: 0,
      error: costResult.reason?.message || 'Cost estimate provider failed',
    });
  }

  // 5. Persist successful provider data independently
  try {
    if (competitors.length > 0) {
      await supabase.from('project_competitors').insert(competitors);
    }
    if (marketObservations.length > 0) {
      await supabase.from('project_market_observations').insert(marketObservations);
    }
    if (demandTrend) {
      await supabase.from('project_demand_trends').insert(demandTrend);
    }
    if (costEstimates.length > 0) {
      await supabase.from('project_cost_estimates').insert(costEstimates);
    }

    if (project.report_id) {
      const qualityScore =
        (competitors.length > 0 ? 0.35 : 0) +
        (marketObservations.length > 0 ? 0.25 : 0) +
        (demandTrend ? 0.25 : 0) +
        (costEstimates.some((c) => c.cost_type === 'rent_monthly' && c.freshness !== 'unavailable')
          ? 0.15
          : 0);

      await supabase
        .from('feasibility_reports')
        .update({
          competitors: competitors.slice(0, 30),
          trend_series: demandTrend ? demandTrend.trend_series : [],
          data_quality: Math.round(qualityScore * 100) / 100,
        })
        .eq('id', project.report_id);
    }
  } catch (persistErr) {
    console.error('Error persisting data collection records:', persistErr);
  }

  const providerOutcomes = [
    providersStatus.competitors?.status,
    providersStatus.regional_stats?.status,
    providersStatus.trends?.status,
    providersStatus.costs?.status,
  ];

  const completedCount = providerOutcomes.filter((s) => s === 'completed').length;
  const usableCount = providerOutcomes.filter((s) => s === 'completed' || s === 'partial').length;

  // Preserve successful provider data even when another provider is unavailable/failed.
  const runOutcome: 'completed' | 'partial' | 'failed' =
    completedCount === 4 ? 'completed' : usableCount > 0 ? 'partial' : 'failed';

  await supabase
    .from('project_collection_runs')
    .update({
      status: runOutcome,
      providers_status: providersStatus,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);

  return {
    success: runOutcome !== 'failed',
    run_id: runId,
    status: runOutcome,
    providers_status: providersStatus,
    summary: {
      competitor_count: competitors.length,
      market_metric_count: marketObservations.length,
      has_trend_data: !!demandTrend,
      cost_estimate_count: costEstimates.length,
    },
  };
}
