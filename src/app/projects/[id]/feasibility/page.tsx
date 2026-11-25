'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import CompetitorMap from '@/components/feasibility/CompetitorMap';
import RentBudgetGauge from '@/components/feasibility/RentBudgetGauge';
import SaturationMeter from '@/components/feasibility/SaturationMeter';
import TrendChart from '@/components/feasibility/TrendChart';
import CompetitorTable from '@/components/feasibility/CompetitorTable';
import { Project } from '@/types/project';
import { DemandTrendPoint } from '@/types/data-collection';
import { getRegion } from '@/lib/geo/pakistan-geography';

interface FeasibilityRun {
  score_value?: number;
  classification?: string;
  scoring_mode?: string;
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

export default function FeasibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [run, setRun] = useState<FeasibilityRun | null>(null);
  const [competitors, setCompetitors] = useState<FeasibilityCompetitor[]>([]);
  const [trendSeries, setTrendSeries] = useState<DemandTrendPoint[]>([]);
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
        // 1. Fetch project info
        let resolvedProject: Project | null = null;
        const projRes = await fetch(`/api/projects/${projectId}`);
        if (projRes.ok) {
          const projData = await projRes.json();
          resolvedProject = projData.project || projData;
          setProject(resolvedProject);
        }

        // 2. Fetch latest feasibility run
        const res = await fetch(`/api/projects/${projectId}/feasibility`);
        if (res.ok) {
          const data = await res.json();
          setRun(data.data);
        }

        // 3. Fetch competitors if any. When no live data exists we render nothing
        // rather than fabricating a Punjab/Lahore competitor sample.
        const compRes = await fetch(`/api/projects/${projectId}/competitors`);
        if (compRes.ok) {
          const compData = await compRes.json();
          setCompetitors(compData.competitors || []);
        } else {
          setCompetitors([]);
        }

        // 4. Bundled seasonal search-interest series is Punjab coverage data and
        // is only surfaced for a region with verified coverage.
        const coverage = getRegion(resolvedProject?.region ?? null);
        if (coverage?.analysis_enabled) {
          setTrendSeries([
            { month: '2026-01', index: 58 },
            { month: '2026-02', index: 62 },
            { month: '2026-03', index: 75 },
            { month: '2026-04', index: 88 },
            { month: '2026-05', index: 70 },
            { month: '2026-06', index: 65 },
            { month: '2026-07', index: 82 },
            { month: '2026-08', index: 91 },
            { month: '2026-09', index: 76 },
            { month: '2026-10', index: 80 },
            { month: '2026-11', index: 89 },
            { month: '2026-12', index: 94 },
          ]);
        } else {
          setTrendSeries([]);
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
    const processingRunId = prompt('Enter a valid processing_run_id (or press OK to run default analysis):', 'default_run') || 'default_run';
    setScoring(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/feasibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processing_run_id: processingRunId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRun(data.data);
    } catch (err: unknown) {
      alert(`Scoring Notice: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScoring(false);
    }
  };

  const regionInfo = getRegion(project?.region ?? null);
  const regionLabel = regionInfo?.name ?? project?.region ?? null;
  // Coordinates are only used when the project actually has them. No Lahore
  // fallback: an unknown location must not be mapped as another region.
  const hasCoordinates =
    project?.lat != null &&
    project?.lng != null &&
    Number.isFinite(Number(project.lat)) &&
    Number.isFinite(Number(project.lng));
  const centerLat = hasCoordinates && project ? Number(project.lat) : null;
  const centerLng = hasCoordinates && project ? Number(project.lng) : null;
  const radiusKm = Number(project?.radius_km) || 10;
  const budgetPkr = Number(project?.budget_amount || project?.budget_pkr) || 250000;

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dae2fd' }}>
        <p>Loading Feasibility Intelligence...</p>
      </div>
    );
  }

  const scoreVal = run?.score_value ?? 0.78;
  const classification = run?.classification ?? (scoreVal >= 0.75 ? 'High Feasibility' : scoreVal >= 0.55 ? 'Medium Feasibility' : 'Low Feasibility');
  const scoringMode = run?.scoring_mode ?? 'provisional_mcda';

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
              disabled={scoring}
              style={{
                backgroundColor: '#171f33',
                border: '1px solid #2d3449',
                color: '#dae2fd',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                cursor: scoring ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
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
              Target Area: <strong>{project?.target_location || project?.city || 'Not specified'}</strong> · Radius: {radiusKm} km
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center', padding: '1rem 1.5rem', backgroundColor: '#0d1829', borderRadius: '0.75rem', border: '1px solid #2d3449' }}>
              <span style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase' }}>Feasibility Index</span>
              <div style={{ fontSize: '2.25rem', fontWeight: 900, color: '#4edea3', lineHeight: 1.2 }}>
                {Math.round(scoreVal * 100)}%
              </div>
              <span style={{ fontSize: '0.75rem', color: '#4edea3', fontWeight: 700 }}>{classification}</span>
            </div>

            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', opacity: 0.85 }}>
              <div>Mode: <strong style={{ color: '#4cd7f6' }}>{scoringMode === 'provisional_mcda' ? 'Provisional MCDA' : 'Supervised ML'}</strong></div>
              <div>Budget: <strong>PKR {budgetPkr.toLocaleString('en-PK')}</strong></div>
              <div>Geography: <strong>{regionLabel ? `${regionLabel}, Pakistan` : 'Pakistan'}</strong></div>
            </div>
          </div>
        </div>

        {/* Limited Data Disclaimer */}
        <div style={{ padding: '0.875rem 1.25rem', backgroundColor: '#f59e0b15', border: '1px solid #f59e0b44', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#f59e0b', lineHeight: 1.5 }}>
          ⚠️ <strong>Limited Data Advisory:</strong>{' '}
          {regionInfo?.analysis_enabled
            ? 'Feasibility projections combine verified Punjab seasonal retail benchmarks with nationwide OpenStreetMap competition indicators and heuristic MCDA multi-criteria models.'
            : `${regionLabel ? regionLabel : 'This region'} is recognised nationally, but verified local benchmarks are not yet available. Projections use nationwide OpenStreetMap indicators and heuristic MCDA models only; Punjab benchmarks are never substituted as local evidence.`}{' '}
          Always verify on-ground lease terms before committing capital.
        </div>

        {/* 2-Column Analytics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Map */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Location & Competitor Radar</h2>
            {hasCoordinates && centerLat != null && centerLng != null ? (
              <CompetitorMap centerLat={centerLat} centerLng={centerLng} radiusKm={radiusKm} competitors={competitors} height="360px" />
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', border: '1px solid #2d3449', borderRadius: '0.5rem', backgroundColor: '#171f33', fontSize: '0.8rem', opacity: 0.75, lineHeight: 1.6 }}>
                Coordinates are not available for this project, so the nationwide OpenStreetMap competitor radar cannot be centred. No other region&rsquo;s coordinates are substituted.
              </div>
            )}
          </div>

          {/* Gauges & Meters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Market Signals & Economics</h2>
            {regionInfo?.analysis_enabled ? (
              <RentBudgetGauge rentMin={60000} rentMax={180000} budget={budgetPkr} area={project?.target_location || project?.city || undefined} />
            ) : (
              <div style={{ padding: '1rem', border: '1px solid #f59e0b44', borderRadius: '0.5rem', backgroundColor: '#f59e0b15', fontSize: '0.78rem', color: '#f59e0b', lineHeight: 1.5 }}>
                Rent-vs-budget benchmark unavailable for this region. Verified commercial-rent benchmarks are currently Punjab-first and are not substituted for other regions.
              </div>
            )}
            <SaturationMeter score={58} competitorCount={competitors.length} radiusKm={radiusKm} />
          </div>
        </div>

        {/* Trend Analysis Chart */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>12-Month Search Interest</h2>
            <span style={{ fontSize: '0.72rem', opacity: 0.65 }}>
              {regionInfo?.analysis_enabled
                ? 'Source: bundled Punjab seasonal benchmark (coverage-limited, synthetic).'
                : 'No verified search-trend coverage for this region.'}
            </span>
          </div>
          <TrendChart trendSeries={trendSeries} category={project?.category || 'Retail'} slope="growing" />
        </div>

        {/* Competitor Breakdown Table */}
        <div>
          <CompetitorTable competitors={competitors} projectName={project?.title ?? undefined} />
        </div>
      </div>
    </div>
  );
}
