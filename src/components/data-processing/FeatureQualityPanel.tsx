'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProjectFeatureRecord, ProcessingRunRecord } from '@/types/feature-processing';

interface FeatureQualityPanelProps {
  projectId: string;
  isSubmitted: boolean;
}

export default function FeatureQualityPanel({ projectId, isSubmitted }: FeatureQualityPanelProps) {
  const [features, setFeatures] = useState<ProjectFeatureRecord | null>(null);
  const [latestRun, setLatestRun] = useState<ProcessingRunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVector, setShowVector] = useState(false);

  const loadFeatures = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/features`);
      if (res.ok) {
        const data = await res.json();
        setFeatures(data.features);
        setLatestRun(data.latest_run);
      } else {
        setError('Failed to fetch processed features.');
      }
    } catch {
      setError('Network error fetching feature records.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isSubmitted) {
      loadFeatures();
    } else {
      setLoading(false);
    }
  }, [isSubmitted, loadFeatures]);

  const handleProcessFeatures = async () => {
    try {
      setProcessing(true);
      setError(null);
      const res = await fetch(`/api/projects/${projectId}/process`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeatures(data.features);
        setLatestRun(data.run);
      } else {
        setError(data.error || 'Failed to process features.');
      }
    } catch {
      setError('Network error triggering feature processing pipeline.');
    } finally {
      setProcessing(false);
    }
  };

  if (!isSubmitted) {
    return null;
  }

  const getCompletenessBadge = (status?: string) => {
    switch (status) {
      case 'complete':
        return {
          bg: 'bg-[#10b981]/15 text-[#4edea3] border-[#10b981]/30',
          icon: 'check_circle',
          label: 'Complete Dataset',
        };
      case 'partial':
        return {
          bg: 'bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/30',
          icon: 'warning',
          label: 'Partial Dataset',
        };
      default:
        return {
          bg: 'bg-[#64748b]/15 text-[#94a3b8] border-[#64748b]/30',
          icon: 'pending',
          label: 'Awaiting Feature Pipeline',
        };
    }
  };

  const badge = getCompletenessBadge(latestRun?.data_completeness);

  return (
    <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-6 sm:p-7 shadow-xl flex flex-col gap-6">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2d3449]/70 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4edea3]/10 text-[#4edea3] flex items-center justify-center border border-[#4edea3]/20">
            <span className="material-symbols-outlined text-[24px]">hub</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[17px] font-bold text-[#dae2fd]">
                Module 4: Engineered Feature Set &amp; Data Quality
              </h2>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}
              >
                <span className="material-symbols-outlined text-[13px]">{badge.icon}</span>
                {badge.label}
              </span>
            </div>
            <p className="text-[12px] text-[#bbcabf] mt-0.5">
              Deterministic deduplication, metric imputation, and ML-ready vector extraction
            </p>
          </div>
        </div>

        {/* Trigger Button */}
        <button
          onClick={handleProcessFeatures}
          disabled={processing || loading}
          className="inline-flex items-center justify-center gap-2 bg-[#4edea3] hover:bg-[#3ec990] disabled:opacity-50 text-[#003822] font-semibold text-[13px] px-4 py-2.5 rounded-xl shadow-md transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-[#003822] border-t-transparent rounded-full animate-spin"></div>
              <span>Engineering Features...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">schema</span>
              <span>{features ? 'Re-engineer Features' : 'Run Feature Pipeline'}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 text-[#ffb4ab] px-4 py-3 rounded-xl text-[12px] flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-[#bbcabf]">
          <div className="w-8 h-8 border-2 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[12px] font-mono">Loading Engineered Feature Vectors...</span>
        </div>
      ) : !features ? (
        <div className="bg-[#0b1326] border border-[#2d3449] rounded-xl p-8 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[40px] text-[#4cd7f6]/60">query_stats</span>
          <h3 className="text-[15px] font-semibold text-[#dae2fd]">Feature Pipeline Not Yet Run</h3>
          <p className="text-[12px] text-[#bbcabf] max-w-md">
            Raw market data collected in Module 3 has not been transformed into engineered features. Click &quot;Run Feature Pipeline&quot; above to calculate category saturation, budget ratios, and the normalized ML vector.
          </p>
        </div>
      ) : (
        <>
          {/* Top Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Competitors Count */}
            <div className="bg-[#0b1326] border border-[#2d3449] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[#bbcabf] text-[11px] font-medium uppercase tracking-wider">
                <span>Deduplicated Competitors</span>
                <span className="material-symbols-outlined text-[16px] text-[#4cd7f6]">storefront</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-bold text-[#dae2fd]">
                  {features.competitors_count}
                </span>
                <span className="text-[11px] text-[#bbcabf]">unique POIs</span>
              </div>
              <div className="text-[11px] text-[#bbcabf]">
                {latestRun?.deduplication_stats?.duplicates_removed !== undefined &&
                latestRun.deduplication_stats.duplicates_removed > 0 ? (
                  <span className="text-[#4edea3]">
                    {latestRun.deduplication_stats.duplicates_removed} duplicate nodes merged
                  </span>
                ) : (
                  <span>No duplicate nodes detected</span>
                )}
              </div>
            </div>

            {/* 2. Category Saturation */}
            <div className="bg-[#0b1326] border border-[#2d3449] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[#bbcabf] text-[11px] font-medium uppercase tracking-wider">
                <span>Category Saturation</span>
                <span className="material-symbols-outlined text-[16px] text-[#4edea3]">donut_large</span>
              </div>
              <div className="flex items-baseline gap-2">
                {features.category_saturation !== null ? (
                  <>
                    <span className="text-[22px] font-bold text-[#dae2fd]">
                      {(features.category_saturation * 100000).toFixed(2)}
                    </span>
                    <span className="text-[11px] text-[#bbcabf]">per 100k pop</span>
                  </>
                ) : (
                  <span className="text-[16px] font-bold text-[#fbbf24]">Unavailable</span>
                )}
              </div>
              <div className="text-[11px] text-[#bbcabf] truncate">
                {features.population ? (
                  <span>Pop: {(features.population / 1_000_000).toFixed(1)}M residents</span>
                ) : (
                  <span className="text-[#fbbf24]">Population datum missing</span>
                )}
              </div>
            </div>

            {/* 3. Budget Ratio */}
            <div className="bg-[#0b1326] border border-[#2d3449] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[#bbcabf] text-[11px] font-medium uppercase tracking-wider">
                <span>Budget Ratio (Coverage)</span>
                <span className="material-symbols-outlined text-[16px] text-[#fcd34d]">account_balance_wallet</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-bold text-[#dae2fd]">
                  {features.budget_ratio !== null ? `${features.budget_ratio}x` : 'N/A'}
                </span>
                <span className="text-[11px] text-[#bbcabf]">of 1-yr cost</span>
              </div>
              <div className="text-[11px] text-[#bbcabf] truncate">
                <span>
                  Est. Annual: {features.currency} {features.total_estimated_annual_cost?.toLocaleString()}
                </span>
              </div>
            </div>

            {/* 4. Demand Trend & Quality */}
            <div className="bg-[#0b1326] border border-[#2d3449] rounded-xl p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[#bbcabf] text-[11px] font-medium uppercase tracking-wider">
                <span>Demand &amp; Quality</span>
                <span className="material-symbols-outlined text-[16px] text-[#a78bfa]">trending_up</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[26px] font-bold text-[#dae2fd]">
                  {features.avg_demand_index ?? 50}
                </span>
                <span className="text-[11px] text-[#bbcabf]">/ 100 interest</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span
                  className={`font-semibold capitalize ${
                    features.trend_slope === 'growing'
                      ? 'text-[#4edea3]'
                      : features.trend_slope === 'declining'
                      ? 'text-[#ffb4ab]'
                      : 'text-[#bbcabf]'
                  }`}
                >
                  Trend: {features.trend_slope || 'Stable'}
                </span>
                <span className="text-[#4cd7f6] font-mono">
                  {latestRun?.quality_score}% Quality
                </span>
              </div>
            </div>
          </div>

          {/* Data Quality & Imputation Audit Card */}
          <div className="bg-[#0b1326] border border-[#2d3449] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-[12px] font-semibold text-[#dae2fd]">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#4edea3]">verified</span>
                Audit Traceability &amp; Provenance
              </span>
              <span className="text-[#bbcabf] text-[11px] font-mono">
                Run ID: {latestRun?.id?.slice(0, 8)}... | Feature Schema: {features.feature_version}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
              <div className="bg-[#171f33] p-3 rounded-lg border border-[#2d3449]/50 flex flex-col gap-1">
                <span className="text-[#bbcabf] font-medium">Deduplication Details</span>
                <span className="text-[#dae2fd]">
                  Raw POIs: {latestRun?.deduplication_stats?.raw_count ?? features.competitors_count} → Unique: {features.competitors_count}
                </span>
              </div>

              <div className="bg-[#171f33] p-3 rounded-lg border border-[#2d3449]/50 flex flex-col gap-1">
                <span className="text-[#bbcabf] font-medium">Imputations Applied</span>
                <span className="text-[#dae2fd]">
                  {latestRun?.imputations_count === 0
                    ? '0 missing fields imputed'
                    : `${latestRun?.imputations_count} benchmark metric(s) imputed`}
                </span>
              </div>

              <div className="bg-[#171f33] p-3 rounded-lg border border-[#2d3449]/50 flex flex-col gap-1">
                <span className="text-[#bbcabf] font-medium">Primary Provenance</span>
                <span className="text-[#4edea3] font-mono capitalize">
                  {latestRun?.provenance_summary?.primary_source || 'external_api'}
                </span>
              </div>
            </div>
          </div>

          {/* ML Vector Accordion */}
          <div className="border border-[#2d3449] rounded-xl overflow-hidden bg-[#0b1326]">
            <button
              onClick={() => setShowVector(!showVector)}
              className="w-full px-4 py-3 bg-[#131b2e] hover:bg-[#1a233a] flex items-center justify-between text-[12px] font-medium text-[#dae2fd] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#4cd7f6]">code_blocks</span>
                <span>Engineered Machine Learning Vector (Normalized [0, 1])</span>
              </div>
              <div className="flex items-center gap-1 text-[#bbcabf]">
                <span>{showVector ? 'Hide' : 'Inspect Feature Vector'}</span>
                <span className="material-symbols-outlined text-[16px]">
                  {showVector ? 'expand_less' : 'expand_more'}
                </span>
              </div>
            </button>

            {showVector && (
              <div className="p-4 bg-[#060e20] font-mono text-[11px] text-[#bbcabf] border-t border-[#2d3449] overflow-x-auto">
                <pre className="text-[#4edea3]">
                  {JSON.stringify(features.engineered_vector, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
