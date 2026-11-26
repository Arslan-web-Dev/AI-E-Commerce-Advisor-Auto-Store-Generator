'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import CompetitorMap from '@/components/feasibility/CompetitorMap';
import RentBudgetGauge from '@/components/feasibility/RentBudgetGauge';
import SaturationMeter from '@/components/feasibility/SaturationMeter';
import TrendChart from '@/components/feasibility/TrendChart';
import CompetitorTable from '@/components/feasibility/CompetitorTable';
import { Project } from '@/types/project';
import { DemandTrendPoint, DemandTrendRecord } from '@/types/data-collection';
import { getRegion } from '@/lib/geo/pakistan-geography';
import { isUsableDemandTrend } from '@/lib/data-processing/trend-validity';
import type { RentMapPayload } from '@/lib/visualization/rent-map';

interface FeasibilityRun {
  id?: string;
  score_value?: number | null;
  classification?: string;
  risk_level?: 'low' | 'moderate' | 'high' | 'critical' | null;
  scoring_mode?: string;
  model_version?: string | null;
  threshold_version?: string | null;
  disclaimer?: string | null;
  evaluation_metrics?: { status?: string; reason?: string } | null;
  training_provenance?: Record<string, unknown> | null;
}

interface ProjectFeatures {
  competitor_density_per_km2?: number | null;
  competitors_count?: number | null;
  avg_competitor_rating?: number | null;
  rent_per_sqft?: number | null;
  estimated_monthly_rent?: number | null;
  rent_to_budget_ratio?: number | null;
  saturation_index?: number | null;
  demand_score?: number | null;
  user_budget?: number | null;
  currency?: 'PKR' | 'USD' | string;
  total_estimated_monthly_cost?: number | null;
}

interface FeasibilityCompetitor {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  distance_km?: number;
  rating?: number;
  review_count?: number;
  category?: string;
  address?: string;
}

const LIMITED_DATA_DISCLAIMER = 'Estimate based on a model trained on limited data';

/** Formats a nullable metric without ever substituting a synthetic value. */
function displayMetric(value: number | null | undefined, digits = 2, prefix = ''): string {
  if (value == null || !Number.isFinite(Number(value))) return 'N/A';
  return `${prefix}${Number(value).toFixed(digits)}`;
}

export default function FeasibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [run, setRun] = useState<FeasibilityRun | null>(null);
  const [features, setFeatures] = useState<ProjectFeatures | null>(null);
  const [latestProcessingRunId, setLatestProcessingRunId] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<FeasibilityCompetitor[]>([]);
  const [competitorTotal, setCompetitorTotal] = useState(0);
  const [rentMap, setRentMap] = useState<RentMapPayload | null>(null);
  const [rentMapError, setRentMapError] = useState('');
  const [trendSeries, setTrendSeries] = useState<DemandTrendPoint[]>([]);
  const [trendProvenance, setTrendProvenance] = useState<string | null>(null);
  const [demandTrend, setDemandTrend] = useState<DemandTrendRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setProjectId(p.id);
    });
  }, [params]);

  useEffect(() => {
    if (!projectId) return;

    async function loadFeasibilityData() {
      try {
        setLoading(true);
        // 1. Fetch project info through the ownership-checked project API.
        let resolvedProject: Project | null = null;
        const projRes = await fetch(`/api/projects/${projectId}`);
        if (projRes.ok) {
          const projData = await projRes.json();
          resolvedProject = projData.project || projData;
          setProject(resolvedProject);
        }

        // 2. Fetch latest feasibility run (null when the project has not been scored).
        const res = await fetch(`/api/projects/${projectId}/feasibility`);
        if (res.ok) {
          const data = await res.json();
          setRun(data.data || null);
        }

        // 3. Fetch engineered features and the processing run they came from.
        //    These are real stored values; unavailable sources remain N/A.
        const featRes = await fetch(`/api/projects/${projectId}/features`);
        if (featRes.ok) {
          const featData = await featRes.json();
          setFeatures(featData.features || null);
          setLatestProcessingRunId(featData.latest_run?.id ?? null);
        }

        // 4. Fetch real demand trend observations when present. No embedded
        //    Lahore/Punjab sample is ever used as a stand-in for project data.
        const marketRes = await fetch(`/api/projects/${projectId}/market-data`);
        if (marketRes.ok) {
          const marketData = await marketRes.json();
          const trend: DemandTrendRecord | null = marketData.demand_trend ?? null;
          setDemandTrend(trend);
          // Stale or cross-region observations are kept in storage for audit,
          // but are never displayed as project-local demand evidence.
          const usable = isUsableDemandTrend(trend, resolvedProject);
          setTrendSeries(usable && Array.isArray(trend?.trend_series) ? trend!.trend_series : []);
          setTrendProvenance(
            usable && trend
              ? `${trend.provider ?? 'unknown'} · ${trend.actual_geo_scope ?? 'scope unknown'}`
              : null
          );
        } else {
          setDemandTrend(null);
          setTrendSeries([]);
          setTrendProvenance(null);
        }

        // 5. Fetch every stored competitor page. Filtering, sorting and
        //    pagination in the table must use the real stored set, not page 1.
        const pageSize = 50;
        const firstCompRes = await fetch(`/api/projects/${projectId}/competitors?page=1&limit=${pageSize}`);
        if (firstCompRes.ok) {
          const firstCompData = await firstCompRes.json();
          const parsedPages = Number(firstCompData.pagination?.total_pages ?? 1);
          const totalPages = Number.isFinite(parsedPages) ? Math.max(1, Math.floor(parsedPages)) : 1;
          const remaining = await Promise.all(
            Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
              fetch(`/api/projects/${projectId}/competitors?page=${index + 2}&limit=${pageSize}`).then(async (res) => {
                if (!res.ok) throw new Error(`Competitor page ${index + 2} could not be loaded.`);
                return res.json();
              })
            )
          );
          const allRows = [firstCompData, ...remaining].flatMap((payload) =>
            Array.isArray(payload?.competitors) ? payload.competitors : []
          );
          setCompetitors(allRows);
          setCompetitorTotal(Number(firstCompData.pagination?.total ?? allRows.length));
        } else {
          setCompetitors([]);
          setCompetitorTotal(0);
        }

        // 6. Read the stored rent-cache overlay through the owner-protected
        //    route. No live rent provider is called from this page.
        const rentRes = await fetch(`/api/projects/${projectId}/rent-map`);
        if (rentRes.ok) {
          setRentMap(await rentRes.json());
          setRentMapError('');
        } else {
          const rentError = await rentRes.json().catch(() => ({}));
          setRentMap(null);
          setRentMapError(rentError.error || 'Stored rent overlay could not be loaded.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load feasibility details.');
      } finally {
        setLoading(false);
      }
    }

    loadFeasibilityData();
  }, [projectId]);

  const handleScore = async () => {
    if (!latestProcessingRunId) {
      setError('No completed processing run is available. Process this project’s data before scoring.');
      return;
    }
    setScoring(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/feasibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processing_run_id: latestProcessingRunId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scoring failed');
      setRun(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScoring(false);
    }
  };

  const regionInfo = getRegion(project?.region ?? null);
  const regionLabel = regionInfo?.name ?? project?.region ?? null;
  // Coordinates are only used when the project actually has them. No Lahore
  // fallback: an unknown location must not be mapped as another region.
  const centerLat =
    project?.lat != null && Number.isFinite(Number(project.lat)) ? Number(project.lat) : null;
  const centerLng =
    project?.lng != null && Number.isFinite(Number(project.lng)) ? Number(project.lng) : null;
  const parsedRadius = project?.radius_km == null ? null : Number(project.radius_km);
  const radiusKm =
    parsedRadius != null && Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : null;
  const projectCurrency = project?.budget_currency ?? 'PKR';
  const budgetAmount = Number(project?.budget_amount);
  const budgetLabel =
    Number.isFinite(budgetAmount) && budgetAmount > 0
      ? `${projectCurrency} ${budgetAmount.toLocaleString('en-PK')}`
      : 'N/A';

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dae2fd' }}>
        <p>Loading Feasibility Intelligence...</p>
      </div>
    );
  }

  // No synthetic fallback: an unscored project explicitly shows N/A.
  const hasScore = run?.score_value != null && Number.isFinite(Number(run.score_value));
  const scoreVal = hasScore ? Number(run!.score_value) : null;
  const classification = run?.classification ?? (hasScore ? 'Classification unavailable' : 'Not scored');
  const scoringMode = run?.scoring_mode ?? 'not_scored';
  const modeLabel =
    scoringMode === 'provisional_mcda'
      ? 'Provisional MCDA'
      : scoringMode === 'supervised_model'
        ? 'Supervised ML'
        : scoringMode === 'unavailable'
          ? 'Unavailable'
          : 'Not scored';
  const saturationPer100k =
    features?.saturation_index != null &&
    Number.isFinite(Number(features.saturation_index)) &&
    Number(features.saturation_index) >= 0
      ? Number(features.saturation_index)
      : null;
  const monthlyRent =
    features?.estimated_monthly_rent != null && Number.isFinite(Number(features.estimated_monthly_rent))
      ? Number(features.estimated_monthly_rent)
      : null;
  const featureBudget =
    features?.user_budget != null &&
    Number.isFinite(Number(features.user_budget)) &&
    Number(features.user_budget) > 0
      ? Number(features.user_budget)
      : null;
  const featureCurrency = features?.currency ?? projectCurrency;
  const gaugeCurrency: 'PKR' | 'USD' = featureCurrency === 'USD' ? 'USD' : 'PKR';
  const matchedRent = rentMap?.matchedRent?.status === 'found' ? rentMap.matchedRent : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b1326', color: '#dae2fd', padding: '2rem 1.5rem' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <Link href={`/projects/${projectId}`} style={{ color: '#4edea3', textDecoration: 'none' }}>
              ← Back to Project
            </Link>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{ fontWeight: 600 }}>Feasibility Analysis</span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleScore}
              disabled={scoring || !latestProcessingRunId}
              title={latestProcessingRunId ? undefined : 'Process the project data first'}
              style={{
                backgroundColor: '#171f33',
                border: '1px solid #2d3449',
                color: '#dae2fd',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                cursor: scoring || !latestProcessingRunId ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: latestProcessingRunId ? 1 : 0.5,
              }}
            >
              {scoring ? 'Recalculating...' : 'Recalculate Score'}
            </button>
            <Link
              href={`/projects/${projectId}/advisory`}
              style={{
                backgroundColor: '#4edea3',
                color: '#0b1326',
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.875rem',
              }}
            >
              View AI Advisory →
            </Link>
          </div>
        </div>

        {error && (
          <div style={{ padding: '1rem', backgroundColor: '#ef444422', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#fca5a5' }}>
            {error}
          </div>
        )}

        {/* Header / Score Banner */}
        <div style={{ backgroundColor: '#171f33', border: '1px solid #2d3449', borderRadius: '1rem', padding: '1.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4cd7f6', fontWeight: 700 }}>
              Location Feasibility Score
            </span>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0 0.5rem', color: '#dae2fd' }}>
              {project?.title || 'Retail Venture'}
            </h1>
            <p style={{ opacity: 0.7, fontSize: '0.875rem', margin: 0 }}>
              Target Area: <strong>{project?.target_location || project?.city || 'Not specified'}</strong> · Radius: {radiusKm ?? 'N/A'} km
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', padding: '1rem 1.5rem', backgroundColor: '#0d1829', borderRadius: '0.75rem', border: '1px solid #2d3449' }}>
              <span style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase' }}>Feasibility Index</span>
              <div style={{ fontSize: '2.25rem', fontWeight: 900, color: hasScore ? '#4edea3' : '#94a3b8', lineHeight: 1.2 }}>
                {hasScore ? `${Math.round(scoreVal! * 100)}%` : 'N/A'}
              </div>
              <span style={{ fontSize: '0.75rem', color: hasScore ? '#4edea3' : '#94a3b8', fontWeight: 700 }}>{classification}</span>
            </div>

            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', opacity: 0.85 }}>
              <div>Mode: <strong style={{ color: '#4cd7f6' }}>{modeLabel}</strong></div>
              <div>Risk band: <strong>{run?.risk_level ?? 'N/A'}</strong></div>
              <div>Model: <strong>{run?.model_version ?? 'N/A'}</strong></div>
              <div>Thresholds: <strong>{run?.threshold_version ?? 'N/A'}</strong></div>
              <div>Budget: <strong>{budgetLabel}</strong></div>
              <div>Geography: <strong>{regionLabel ? `${regionLabel}, Pakistan` : 'Pakistan'}</strong></div>
            </div>
          </div>
        </div>

        {/* Limited Data Disclaimer */}
        <div style={{ padding: '0.875rem 1.25rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b44', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#f59e0b', lineHeight: 1.5 }}>
          ⚠️ <strong>Limited Data Advisory:</strong>{' '}
          <strong>{LIMITED_DATA_DISCLAIMER}</strong>.{' '}
          {run?.disclaimer ?? ''}{' '}
          {regionInfo?.analysis_enabled
            ? 'Punjab is the verified coverage region. Nationwide OpenStreetMap competition indicators are shown with their own scope and are never relabelled as local observations. The score is a provisional MCDA index, not a calibrated supervised-model probability.'
            : `${regionLabel ? regionLabel : 'This region'} is recognised nationally, but verified local benchmarks are not yet available. Punjab benchmarks are never substituted as local evidence.`}{' '}
          Always verify on-ground lease terms before committing capital.
        </div>

        {/* 2-Column Analytics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Map */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Location & Competitor Radar</h2>
            <CompetitorMap
              centerLat={centerLat}
              centerLng={centerLng}
              radiusKm={radiusKm}
              competitors={competitors}
              rentAreas={rentMap?.areas ?? []}
              height="360px"
            />
            {rentMapError && (
              <p role="status" style={{ fontSize: '0.74rem', color: '#fca5a5', margin: 0, lineHeight: 1.5 }}>
                Stored rent overlay unavailable: {rentMapError}
              </p>
            )}
            {rentMap && rentMap.status !== 'coverage' && (
              <p style={{ fontSize: '0.74rem', opacity: 0.75, margin: 0, lineHeight: 1.5 }}>
                Rent overlay: no in-scope stored area points ({rentMap.summary.status}). {rentMap.matchedRent.notes || 'No unrelated city or province was substituted.'}
              </p>
            )}
            {rentMap && rentMap.summary.staleCount > 0 && (
              <p style={{ fontSize: '0.72rem', color: '#f59e0b', margin: 0 }}>
                {rentMap.summary.staleCount} stored rent area(s) are stale; {rentMap.summary.manualEstimateCount} are manual estimates.
              </p>
            )}
          </div>

          {/* Gauges & Meters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Market Signals & Economics</h2>
            <RentBudgetGauge
              monthlyRent={monthlyRent}
              budget={featureBudget}
              rentMin={matchedRent?.rent_min_pkr ?? null}
              rentMax={matchedRent?.rent_max_pkr ?? null}
              rentAvg={matchedRent?.rent_avg_pkr ?? null}
              area={project?.target_location || project?.city || undefined}
              currency={gaugeCurrency}
              rentCurrency={gaugeCurrency}
              budgetCurrency={gaugeCurrency}
              confidence={matchedRent?.confidence ?? null}
              provenance={matchedRent ? String(matchedRent.provenance) : null}
              freshness={matchedRent?.freshness ?? null}
              retrievedAt={matchedRent?.retrieved_at ?? null}
            />
            <SaturationMeter
              saturationPer100k={saturationPer100k}
              competitorDensityPerKm2={
                features?.competitor_density_per_km2 != null &&
                Number.isFinite(Number(features.competitor_density_per_km2))
                  ? Number(features.competitor_density_per_km2)
                  : null
              }
              competitorCount={
                features?.competitors_count != null && Number.isFinite(Number(features.competitors_count))
                  ? Number(features.competitors_count)
                  : null
              }
              radiusKm={radiusKm}
            />
          </div>
        </div>

        {/* Trend Analysis Chart */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Search Interest Trend</h2>
            <span style={{ fontSize: '0.72rem', opacity: 0.65 }}>
              {trendProvenance
                ? `Source: ${trendProvenance}`
                : demandTrend
                  ? 'A stored demand trend is stale or out of scope; it is not used as local evidence.'
                  : 'No in-scope demand trend observations are stored for this project.'}
            </span>
          </div>
          <TrendChart
            trendSeries={trendSeries}
            category={project?.category || 'Retail'}
            slope={demandTrend?.trend_slope ?? null}
            sourceIsUsable={isUsableDemandTrend(demandTrend, project)}
            isCached={demandTrend?.freshness === 'cached'}
            isStale={demandTrend?.is_stale === true}
            cachedAt={demandTrend?.cache_retrieved_at}
            retrievedAt={demandTrend?.retrieved_at}
            provider={demandTrend?.provider}
            scope={demandTrend?.actual_geo_scope}
            provenance={demandTrend ? String(demandTrend.provenance) : null}
            freshness={demandTrend?.freshness ?? null}
          />
        </div>

        {/* Competitor Breakdown Table */}
        <div>
          <CompetitorTable competitors={competitors} projectName={project?.title ?? undefined} totalCount={competitorTotal} />
        </div>

        {/* FR-4.1 engineered feature provenance */}
        <div style={{ border: '1px solid #2d3449', borderRadius: '0.5rem', backgroundColor: '#171f33', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>Engineered Features (FR-4.1)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', fontSize: '0.78rem' }}>
            <div>Competitor density: <strong>{displayMetric(features?.competitor_density_per_km2, 4)} / km²</strong></div>
            <div>Avg competitor rating: <strong>{displayMetric(features?.avg_competitor_rating, 2)} / 5</strong></div>
            <div>Rent rate: <strong>{displayMetric(features?.rent_per_sqft, 2, `${featureCurrency} `)} / ft²</strong></div>
            <div>Est. monthly rent: <strong>{displayMetric(features?.estimated_monthly_rent, 2, `${featureCurrency} `)}</strong></div>
            <div>Feature budget: <strong>{displayMetric(features?.user_budget, 2, `${featureCurrency} `)}</strong></div>
            <div>Rent / budget: <strong>{displayMetric(features?.rent_to_budget_ratio, 4)}</strong></div>
            <div>Demand score: <strong>{displayMetric(features?.demand_score, 2)} / 100</strong></div>
            <div>Saturation index: <strong>{displayMetric(features?.saturation_index, 2)} / 100k residents</strong></div>
          </div>
          <p style={{ fontSize: '0.72rem', opacity: 0.65, margin: '0.75rem 0 0 0' }}>
            N/A means the source was unavailable or out of scope; no value was imputed for display.
          </p>
        </div>
      </div>
    </div>
  );
}
