import { createClient } from '@/lib/supabase/server';
import { getProviderBundle, DemoCompetitorProvider } from '@/lib/providers';
import {
  CollectionRun,
  CompetitorRecord,
  MarketObservation,
  DemandTrendRecord,
  CostEstimateRecord,
  ProviderStatusDetail,
} from '@/types/data-collection';

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

  // 2. Concurrency / Idempotency Guard
  const { data: existingRuns } = await supabase
    .from('project_collection_runs')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1);

  if (existingRuns && existingRuns.length > 0) {
    const activeRun = existingRuns[0];
    const startedAt = new Date(activeRun.started_at).getTime();
    const now = Date.now();
    // If running for less than 40 seconds, don't duplicate
    if (now - startedAt < 40000) {
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
  }

  // 3. Create new collection run record
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

  const runId = run.id;
  const providers = getProviderBundle(options?.forceDemo);

  const providersStatus: CollectionRun['providers_status'] = {};

  let competitors: CompetitorRecord[] = [];
  let marketObservations: MarketObservation[] = [];
  let demandTrend: DemandTrendRecord | null = null;
  let costEstimates: CostEstimateRecord[] = [];

  // 4. Concurrently execute independent providers with individual failure handling
  const [compResult, regionalResult, trendResult, costResult] = await Promise.allSettled([
    // A. Competitors (with auto-fallback to demo on live network/API failure)
    (async () => {
      const start = Date.now();
      try {
        const records = await providers.competitorProvider.getCompetitors({
          category: project.category,
          lat: Number(project.lat || 31.5204),
          lng: Number(project.lng || 74.3587),
          radiusKm: Number(project.radius_km || 10),
          city: project.city || 'Lahore',
        });
        return {
          records,
          provider: providers.competitorProvider.name,
          provenance: providers.competitorProvider.provenance,
          latency: Date.now() - start,
        };
      } catch (err: unknown) {
        // Fallback to Demo Competitor Provider if live external provider fails
        const demoComp = new DemoCompetitorProvider();
        const demoRecords = await demoComp.getCompetitors({
          category: project.category,
          lat: Number(project.lat || 31.5204),
          lng: Number(project.lng || 74.3587),
          radiusKm: Number(project.radius_km || 10),
          city: project.city || 'Lahore',
        });
        return {
          records: demoRecords,
          provider: demoComp.name,
          provenance: demoComp.provenance,
          latency: Date.now() - start,
          warning: `Live provider failed (${err instanceof Error ? err.message : String(err)}). Reverted to demo provider.`,
        };
      }
    })(),

    // B. Regional Demographics
    (async () => {
      const start = Date.now();
      const records = await providers.regionalStatsProvider.getRegionalStats({
        city: project.city || 'Lahore',
        region: project.region || undefined,
        country: project.country || 'Pakistan',
      });
      return {
        records,
        provider: providers.regionalStatsProvider.name,
        provenance: providers.regionalStatsProvider.provenance,
        latency: Date.now() - start,
      };
    })(),

    // C. Demand & Search Trends
    (async () => {
      const start = Date.now();
      const record = await providers.demandTrendProvider.getDemandTrends({
        category: project.category,
        region: 'PK',
      });
      return {
        record,
        provider: providers.demandTrendProvider.name,
        provenance: providers.demandTrendProvider.provenance,
        latency: Date.now() - start,
      };
    })(),

    // D. Cost Estimates
    (async () => {
      const start = Date.now();
      const records = await providers.costEstimateProvider.getCostEstimates({
        category: project.category,
        city: project.city || 'Lahore',
        area: project.target_location,
        footprint: project.storefront_footprint || 'boutique',
        budgetAmount: Number(project.budget_amount) || 15000,
        budgetCurrency: project.budget_currency || 'USD',
      });
      return {
        records,
        provider: providers.costEstimateProvider.name,
        provenance: providers.costEstimateProvider.provenance,
        latency: Date.now() - start,
      };
    })(),
  ]);

  // Process Competitor Result
  if (compResult.status === 'fulfilled') {
    competitors = compResult.value.records.map((c) => ({
      ...c,
      project_id: projectId,
      run_id: runId,
    }));
    providersStatus.competitors = {
      status: 'completed',
      provider: compResult.value.provider,
      provenance: compResult.value.provenance,
      item_count: competitors.length,
      latency_ms: compResult.value.latency,
      error: compResult.value.warning,
    };
  } else {
    providersStatus.competitors = {
      status: 'failed',
      provider: providers.competitorProvider.name,
      provenance: providers.competitorProvider.provenance,
      item_count: 0,
      error: compResult.reason?.message || 'Competitor provider failed',
    };
  }

  // Process Regional Result
  if (regionalResult.status === 'fulfilled') {
    marketObservations = regionalResult.value.records.map((m) => ({
      ...m,
      project_id: projectId,
      run_id: runId,
    }));
    providersStatus.regional_stats = {
      status: 'completed',
      provider: regionalResult.value.provider,
      provenance: regionalResult.value.provenance,
      item_count: marketObservations.length,
      latency_ms: regionalResult.value.latency,
    };
  } else {
    providersStatus.regional_stats = {
      status: 'failed',
      provider: providers.regionalStatsProvider.name,
      provenance: providers.regionalStatsProvider.provenance,
      item_count: 0,
      error: regionalResult.reason?.message || 'Regional stats provider failed',
    };
  }

  // Process Demand Trend Result
  if (trendResult.status === 'fulfilled') {
    demandTrend = {
      ...trendResult.value.record,
      project_id: projectId,
      run_id: runId,
    };
    providersStatus.trends = {
      status: 'completed',
      provider: trendResult.value.provider,
      provenance: trendResult.value.provenance,
      item_count: demandTrend.trend_series.length,
      latency_ms: trendResult.value.latency,
    };
  } else {
    providersStatus.trends = {
      status: 'failed',
      provider: providers.demandTrendProvider.name,
      provenance: providers.demandTrendProvider.provenance,
      item_count: 0,
      error: trendResult.reason?.message || 'Demand trend provider failed',
    };
  }

  // Process Cost Estimate Result
  if (costResult.status === 'fulfilled') {
    costEstimates = costResult.value.records.map((e) => ({
      ...e,
      project_id: projectId,
      run_id: runId,
    }));
    providersStatus.costs = {
      status: 'completed',
      provider: costResult.value.provider,
      provenance: costResult.value.provenance,
      item_count: costEstimates.length,
      latency_ms: costResult.value.latency,
    };
  } else {
    providersStatus.costs = {
      status: 'failed',
      provider: providers.costEstimateProvider.name,
      provenance: providers.costEstimateProvider.provenance,
      item_count: 0,
      error: costResult.reason?.message || 'Cost estimate provider failed',
    };
  }

  // 5. Persist records in PostgreSQL
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

    // 6. Sync summary into linked feasibility_reports row if exists
    if (project.report_id) {
      const qualityScore =
        (competitors.length > 0 ? 0.35 : 0) +
        (marketObservations.length > 0 ? 0.25 : 0) +
        (demandTrend ? 0.25 : 0) +
        (costEstimates.length > 0 ? 0.15 : 0);

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

  // 7. Compute overall run outcome
  const successfulCount = [
    providersStatus.competitors?.status === 'completed',
    providersStatus.regional_stats?.status === 'completed',
    providersStatus.trends?.status === 'completed',
    providersStatus.costs?.status === 'completed',
  ].filter(Boolean).length;

  const runOutcome: 'completed' | 'partial' | 'failed' =
    successfulCount === 4 ? 'completed' : successfulCount > 0 ? 'partial' : 'failed';

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
