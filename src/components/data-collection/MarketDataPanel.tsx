'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CompetitorRecord,
  MarketObservation,
  DemandTrendRecord,
  CostEstimateRecord,
  CollectionRun,
} from '@/types/data-collection';

interface MarketDataPanelProps {
  projectId: string;
  isSubmitted: boolean;
}

export default function MarketDataPanel({ projectId, isSubmitted }: MarketDataPanelProps) {
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [latestRun, setLatestRun] = useState<CollectionRun | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorRecord[]>([]);
  const [observations, setObservations] = useState<MarketObservation[]>([]);
  const [demandTrend, setDemandTrend] = useState<DemandTrendRecord | null>(null);
  const [costEstimates, setCostEstimates] = useState<CostEstimateRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'competitors' | 'demographics' | 'trends' | 'costs'>('competitors');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch collection run status
      const statusRes = await fetch(`/api/projects/${projectId}/collection`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setLatestRun(statusData.latest_run);
      }

      // 2. Fetch competitors
      const compRes = await fetch(`/api/projects/${projectId}/competitors?limit=25`);
      if (compRes.ok) {
        const compData = await compRes.json();
        setCompetitors(compData.competitors || []);
      }

      // 3. Fetch market & trends
      const marketRes = await fetch(`/api/projects/${projectId}/market-data`);
      if (marketRes.ok) {
        const marketData = await marketRes.json();
        setObservations(marketData.observations || []);
        setDemandTrend(marketData.demand_trend || null);
      }

      // 4. Fetch costs
      const costRes = await fetch(`/api/projects/${projectId}/costs`);
      if (costRes.ok) {
        const costData = await costRes.json();
        setCostEstimates(costData.costs || []);
      }
    } catch {
      showToast('Error loading aggregated market data', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isSubmitted) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [projectId, isSubmitted, loadData]);

  const handleTriggerCollection = async (forceDemo = false) => {
    try {
      setCollecting(true);
      const res = await fetch(`/api/projects/${projectId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_demo: forceDemo }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Data collection failed', 'error');
      } else {
        showToast(data.message, 'success');
        await loadData();
      }
    } catch {
      showToast('Network error during data collection', 'error');
    } finally {
      setCollecting(false);
    }
  };

  if (!isSubmitted) return null;

  const hasData = competitors.length > 0 || observations.length > 0 || demandTrend !== null || costEstimates.length > 0;
  const isDemo = competitors.some((c) => c.provenance === 'synthetic_demo') || latestRun?.providers_status?.competitors?.provenance === 'synthetic_demo';

  const renderProvenanceBadge = (prov: string) => {
    switch (prov) {
      case 'external_api':
        return (
          <span className="bg-[#4edea3]/15 text-[#4edea3] border border-[#4edea3]/30 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
            <span>Live External API</span>
          </span>
        );
      case 'synthetic_demo':
        return (
          <span className="bg-[#d97706]/15 text-[#d97706] border border-[#d97706]/30 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]"></span>
            <span>Demo Data</span>
          </span>
        );
      case 'licensed_dataset':
        return (
          <span className="bg-[#4cd7f6]/15 text-[#4cd7f6] border border-[#4cd7f6]/30 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4cd7f6]"></span>
            <span>Census Open Data</span>
          </span>
        );
      default:
        return (
          <span className="bg-[#bbcabf]/15 text-[#bbcabf] border border-[#2d3449] px-2 py-0.5 rounded text-[10px] font-semibold">
            Benchmark Model
          </span>
        );
    }
  };

  return (
    <div className="w-full bg-[#131b2e] border border-[#2d3449]/70 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col gap-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 border ${
            toast.type === 'success'
              ? 'bg-[#171f33] border-[#4edea3] text-[#4edea3]'
              : 'bg-[#171f33] border-[#ffb4ab] text-[#ffb4ab]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="text-[13px] font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2d3449]/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4cd7f6]/20 text-[#4cd7f6] flex items-center justify-center border border-[#4cd7f6]/40 shrink-0">
            <span className="material-symbols-outlined text-[24px]">dataset</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] md:text-[20px] font-bold text-[#dae2fd]">
                Module 3: Aggregated Market Intelligence
              </h2>
              {latestRun && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    latestRun.status === 'completed'
                      ? 'bg-[#4edea3]/20 text-[#4edea3] border border-[#4edea3]/30'
                      : latestRun.status === 'partial'
                      ? 'bg-[#d97706]/20 text-[#d97706] border border-[#d97706]/30'
                      : 'bg-[#4cd7f6]/20 text-[#4cd7f6] border border-[#4cd7f6]/30'
                  }`}
                >
                  {latestRun.status}
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#bbcabf]">
              OpenStreetMap Overpass POIs • PBS Census Demographics • Google Trends • SME Rent Model
            </p>
          </div>
        </div>

        {/* Action Triggers */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => handleTriggerCollection(false)}
            disabled={collecting}
            className="bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-4 py-2 rounded-xl text-[12px] font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {collecting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[#003824] border-t-transparent rounded-full animate-spin"></div>
                <span>Ingesting Data...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>{hasData ? 'Refresh Live Data' : 'Run Data Ingestion'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTriggerCollection(true)}
            disabled={collecting}
            className="bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] px-3.5 py-2 rounded-xl text-[12px] font-semibold border border-[#2d3449] transition-all flex items-center gap-1 disabled:opacity-50"
            title="Trigger deterministic synthetic demo provider for testing"
          >
            <span className="material-symbols-outlined text-[16px] text-[#d97706]">science</span>
            <span>Force Demo Mode</span>
          </button>
        </div>
      </div>

      {/* Provider Status Telemetry Strip */}
      {latestRun?.providers_status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#bbcabf] uppercase">Competitors (OSM)</span>
              {renderProvenanceBadge(latestRun.providers_status.competitors?.provenance || 'external_api')}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[20px] font-bold text-[#dae2fd]">
                {latestRun.providers_status.competitors?.item_count || competitors.length}
              </span>
              <span className="text-[11px] text-[#bbcabf]">businesses found</span>
            </div>
            {latestRun.providers_status.competitors?.latency_ms && (
              <span className="text-[10px] text-[#86948a] font-mono">
                Latency: {latestRun.providers_status.competitors.latency_ms}ms
              </span>
            )}
          </div>

          <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#bbcabf] uppercase">Demographics (PBS)</span>
              {renderProvenanceBadge(latestRun.providers_status.regional_stats?.provenance || 'licensed_dataset')}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[20px] font-bold text-[#dae2fd]">
                {observations.length}
              </span>
              <span className="text-[11px] text-[#bbcabf]">regional metrics</span>
            </div>
            <span className="text-[10px] text-[#86948a] font-mono">2023 Digital Census</span>
          </div>

          <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#bbcabf] uppercase">Search Trends</span>
              {renderProvenanceBadge(latestRun.providers_status.trends?.provenance || 'external_api')}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[20px] font-bold text-[#dae2fd]">
                {demandTrend ? `${demandTrend.avg_interest}/100` : '—'}
              </span>
              <span className="text-[11px] text-[#bbcabf] capitalize">({demandTrend?.trend_slope || 'N/A'})</span>
            </div>
            <span className="text-[10px] text-[#86948a] font-mono">12-Mo Google Trends</span>
          </div>

          <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#bbcabf] uppercase">Cost Baseline</span>
              {renderProvenanceBadge(latestRun.providers_status.costs?.provenance || 'manual_estimate')}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[20px] font-bold text-[#dae2fd]">{costEstimates.length}</span>
              <span className="text-[11px] text-[#bbcabf]">cost categories</span>
            </div>
            <span className="text-[10px] text-[#86948a] font-mono">Rent Cache &amp; COD Model</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#2d3449]/60 pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('competitors')}
          className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'competitors'
              ? 'bg-[#4edea3] text-[#003824] shadow-sm'
              : 'text-[#bbcabf] hover:text-[#dae2fd] hover:bg-[#171f33]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">storefront</span>
          <span>Nearby Competitors ({competitors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('demographics')}
          className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'demographics'
              ? 'bg-[#4edea3] text-[#003824] shadow-sm'
              : 'text-[#bbcabf] hover:text-[#dae2fd] hover:bg-[#171f33]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">groups</span>
          <span>Regional Demographics ({observations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trends')}
          className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'trends'
              ? 'bg-[#4edea3] text-[#003824] shadow-sm'
              : 'text-[#bbcabf] hover:text-[#dae2fd] hover:bg-[#171f33]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">trending_up</span>
          <span>12-Month Search Trends</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('costs')}
          className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'costs'
              ? 'bg-[#4edea3] text-[#003824] shadow-sm'
              : 'text-[#bbcabf] hover:text-[#dae2fd] hover:bg-[#171f33]'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">payments</span>
          <span>Cost Estimates ({costEstimates.length})</span>
        </button>
      </div>

      {/* Tab 1: Competitors Table */}
      {activeTab === 'competitors' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-[12px] text-[#bbcabf]">
            <span>
              Showing {competitors.length} competitor businesses matching commercial shop categories.
            </span>
            <span className="font-mono text-[11px]">Source: {competitors[0]?.provider || 'Overpass OSM'}</span>
          </div>

          {competitors.length === 0 ? (
            <div className="p-8 text-center bg-[#060e20] rounded-xl border border-[#2d3449] text-[#bbcabf] text-[13px]">
              No competitor records collected yet. Click &quot;Run Data Ingestion&quot; above to query OpenStreetMap.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#2d3449]">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#171f33] text-[#bbcabf] uppercase text-[10px] tracking-wider border-b border-[#2d3449]">
                  <tr>
                    <th className="py-3 px-4">Business Name</th>
                    <th className="py-3 px-4">Category Tag</th>
                    <th className="py-3 px-4">Distance</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4">Price Level</th>
                    <th className="py-3 px-4">Provenance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3449]/60">
                  {competitors.map((c, i) => (
                    <tr key={i} className="hover:bg-[#171f33]/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#dae2fd]">
                        <div className="flex flex-col">
                          <span>{c.name}</span>
                          {c.address && <span className="text-[11px] text-[#86948a] font-normal">{c.address}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[12px] text-[#4cd7f6]">{c.category}</td>
                      <td className="py-3 px-4 font-bold text-[#4edea3]">{c.distance_km} km</td>
                      <td className="py-3 px-4 text-[#dae2fd]">
                        {c.rating ? `⭐ ${c.rating}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-[#bbcabf]">{c.price_level || 'Moderate'}</td>
                      <td className="py-3 px-4">{renderProvenanceBadge(c.provenance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Regional Demographics */}
      {activeTab === 'demographics' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {observations.map((obs, i) => {
            const formattedVal =
              obs.unit === 'percentage'
                ? `${obs.metric_value}%`
                : obs.metric_value.toLocaleString();

            const title =
              obs.metric_name === 'population'
                ? 'Regional Population'
                : obs.metric_name === 'internet_penetration_pct'
                ? 'Broadband / Digital Penetration'
                : obs.metric_name === 'ecommerce_growth_rate_pct'
                ? 'Annual E-Commerce Growth Rate'
                : obs.metric_name;

            return (
              <div key={i} className="bg-[#171f33] p-5 rounded-xl border border-[#2d3449] flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#bbcabf] uppercase tracking-wider">{title}</span>
                  {renderProvenanceBadge(obs.provenance)}
                </div>
                <div>
                  <span className="text-[32px] font-bold text-[#dae2fd]">{formattedVal}</span>
                  <p className="text-[12px] text-[#bbcabf] mt-1">Geography: {obs.geography}</p>
                </div>
                {obs.source_citation && (
                  <p className="text-[10px] text-[#86948a] italic border-t border-[#2d3449]/60 pt-2 font-mono">
                    Citation: {obs.source_citation}
                  </p>
                )}
              </div>
            );
          })}
          {observations.length === 0 && (
            <div className="col-span-3 p-8 text-center bg-[#060e20] rounded-xl border border-[#2d3449] text-[#bbcabf] text-[13px]">
              No regional statistics collected yet.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Demand Trends */}
      {activeTab === 'trends' && (
        <div className="bg-[#171f33] p-6 rounded-xl border border-[#2d3449] flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h3 className="text-[16px] font-bold text-[#dae2fd]">
                12-Month Search Trajectory (Pakistan)
              </h3>
              <p className="text-[12px] text-[#bbcabf]">
                Normalized relative interest index (0–100) for {demandTrend?.category || 'selected vertical'}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#bbcabf]">Trajectory:</span>
              <span className="bg-[#4edea3]/20 text-[#4edea3] text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize">
                {demandTrend?.trend_slope || 'Stable'}
              </span>
              {demandTrend && renderProvenanceBadge(demandTrend.provenance)}
            </div>
          </div>

          {/* Bar Chart Visualization */}
          {demandTrend?.trend_series && (
            <div className="flex flex-col gap-2 pt-2">
              <div className="grid grid-cols-12 gap-2 items-end h-40 bg-[#060e20] p-4 rounded-xl border border-[#2d3449]">
                {demandTrend.trend_series.map((pt, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[10px] font-mono text-[#4edea3] opacity-0 group-hover:opacity-100 transition-opacity">
                      {pt.index}
                    </span>
                    <div
                      className="w-full bg-[#4edea3]/80 hover:bg-[#6ffbbe] rounded-t-sm transition-all"
                      style={{ height: `${pt.index}%` }}
                      title={`${pt.month}: Interest Index ${pt.index}/100`}
                    ></div>
                    <span className="text-[9px] text-[#86948a] font-mono whitespace-nowrap">
                      {pt.month.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-[#86948a] px-1 font-mono">
                <span>12 Months Ago</span>
                <span>Average Index: {demandTrend.avg_interest}/100</span>
                <span>Current Month</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Cost Estimates */}
      {activeTab === 'costs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {costEstimates.map((cost, i) => {
            const prefix = cost.currency === 'PKR' ? 'Rs. ' : '$ ';
            const title =
              cost.cost_type === 'setup'
                ? 'Physical Fitout & Setup'
                : cost.cost_type === 'rent_monthly'
                ? 'Commercial Monthly Rent'
                : cost.cost_type === 'marketing_initial'
                ? 'Launch Marketing Budget'
                : 'Courier Logistics per Order';

            return (
              <div key={i} className="bg-[#171f33] p-5 rounded-xl border border-[#2d3449] flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#bbcabf] uppercase tracking-wider">{title}</span>
                  {renderProvenanceBadge(cost.provenance)}
                </div>
                <div>
                  <div className="text-[20px] font-bold text-[#4edea3]">
                    {prefix}{cost.amount_min.toLocaleString()} – {prefix}{cost.amount_max.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-[#bbcabf] capitalize">Basis: {cost.period_or_unit}</span>
                </div>
                {cost.assumptions && (
                  <p className="text-[11px] text-[#bbcabf] leading-snug border-t border-[#2d3449]/60 pt-2">
                    {cost.assumptions}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Factual Integrity & Data Provenance Notice */}
      <div className="p-4 rounded-xl bg-[#060e20] border border-[#2d3449] flex items-center justify-between text-[12px] text-[#bbcabf]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#4edea3] text-[18px]">verified</span>
          <span>
            Data records stored in PostgreSQL with verifiable provenance. {isDemo ? '⚠️ Demo mode active.' : 'Authoritative open data active.'}
          </span>
        </div>
        <span className="font-mono text-[11px] text-[#86948a]">Ready for Module 4 (Feature Engineering)</span>
      </div>
    </div>
  );
}
