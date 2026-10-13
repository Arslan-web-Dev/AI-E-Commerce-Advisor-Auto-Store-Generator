'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AnalyticsKpiSummary,
  AnalyticsTimeSeriesPoint,
  ProductPerformanceItem,
  FunnelStageItem,
  TrafficSourceItem,
  CartAbandonmentAnalysis,
  AnalyticsDateRangePreset,
} from '@/types/analytics';

interface AnalyticsPanelProps {
  storeId: string;
  storeName: string;
  currency?: string;
  isSandbox?: boolean;
}

export default function AnalyticsPanel({
  storeId,
  storeName,
  currency = 'PKR',
  isSandbox = false,
}: AnalyticsPanelProps) {
  const [dateRange, setDateRange] = useState<AnalyticsDateRangePreset>('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analytics states
  const [kpis, setKpis] = useState<AnalyticsKpiSummary | null>(null);
  const [trends, setTrends] = useState<AnalyticsTimeSeriesPoint[]>([]);
  const [products, setProducts] = useState<ProductPerformanceItem[]>([]);
  const [funnel, setFunnel] = useState<FunnelStageItem[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSourceItem[]>([]);
  const [abandonment, setAbandonment] = useState<CartAbandonmentAnalysis | null>(null);

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [simulatingEvent, setSimulatingEvent] = useState(false);
  const [simulationSuccess, setSimulationSuccess] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, trendsRes, productsRes, behaviorRes] = await Promise.all([
        fetch(`/api/stores/${storeId}/analytics/overview?range=${dateRange}`),
        fetch(`/api/stores/${storeId}/analytics/trends?range=${dateRange}`),
        fetch(`/api/stores/${storeId}/analytics/products?range=${dateRange}`),
        fetch(`/api/stores/${storeId}/analytics/behavior?range=${dateRange}`),
      ]);

      if (!overviewRes.ok) {
        const err = await overviewRes.json();
        throw new Error(err.error || 'Failed to fetch analytics overview');
      }

      const overviewData = await overviewRes.json();
      setKpis(overviewData.kpis);

      if (trendsRes.ok) {
        const trendsData = await trendsRes.json();
        setTrends(trendsData.trends || []);
      }

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData.products || []);
      }

      if (behaviorRes.ok) {
        const behaviorData = await behaviorRes.json();
        setFunnel(behaviorData.funnel || []);
        setTrafficSources(behaviorData.trafficSources || []);
        setAbandonment(behaviorData.cartAbandonment || null);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading store analytics.');
    } finally {
      setLoading(false);
    }
  }, [storeId, dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handler for simulating a sandbox event to test telemetry pipeline
  const handleSimulateEvent = async (eventType: string) => {
    try {
      setSimulatingEvent(true);
      setSimulationSuccess(null);

      const pseudoSessionId = 'sandbox_sess_' + Math.random().toString(36).substring(2, 9);
      const res = await fetch(`/api/stores/${storeId}/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          event_type: eventType,
          session_id: pseudoSessionId,
          referrer: 'https://instagram.com/p/sample-campaign',
          utm_source: 'instagram',
          utm_medium: 'story',
          utm_campaign: 'summer_launch',
        }),
      });

      if (!res.ok) throw new Error('Failed to record simulation event');

      setSimulationSuccess(`Simulated '${eventType}' event recorded successfully.`);
      fetchAnalytics();
      setTimeout(() => setSimulationSuccess(null), 4000);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulatingEvent(false);
    }
  };

  const currencySymbol = currency === 'PKR' ? 'Rs. ' : '$';

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      {/* Analytics Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#131b2e] p-5 rounded-2xl border border-[#2d3449]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-bold text-[#dae2fd]">Store Analytics &amp; Customer Insights</h2>
            {isSandbox && (
              <span className="bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Sandbox Telemetry
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#bbcabf] mt-0.5">
            Real performance calculated from persisted orders and verified session telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="bg-[#171f33] p-1 rounded-xl border border-[#2d3449] flex items-center">
            {(['7d', '30d', '90d'] as const).map((rng) => (
              <button
                key={rng}
                onClick={() => setDateRange(rng)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  dateRange === rng
                    ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                    : 'text-[#bbcabf] hover:text-[#dae2fd]'
                }`}
              >
                {rng === '7d' ? '7 Days' : rng === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          {/* Download / Print PDF Report Button */}
          <button
            onClick={() => setReportModalOpen(true)}
            className="bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] border border-[#4cd7f6]/40 px-3.5 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            <span>Executive Report</span>
          </button>
        </div>
      </div>

      {simulationSuccess && (
        <div className="bg-[#10b981]/20 border border-[#10b981]/50 text-[#4edea3] px-4 py-2.5 rounded-xl text-[12px] flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>{simulationSuccess}</span>
        </div>
      )}

      {error && (
        <div className="bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#ffb4ab] p-4 rounded-xl text-[13px]">
          {error}
        </div>
      )}

      {loading && !kpis ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#bbcabf]">
          <div className="w-8 h-8 border-2 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[13px]">Compiling Store Analytics...</span>
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Gross Sales */}
            <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[12px] uppercase font-semibold text-[#bbcabf]">Gross Sales</span>
                <span className="material-symbols-outlined text-[#4edea3] text-[20px]">payments</span>
              </div>
              <div className="mt-3">
                <div className="text-[24px] font-bold text-[#dae2fd]">
                  {currencySymbol}{kpis?.grossSalesPkr.toLocaleString() || 0}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                  {kpis?.delta && kpis.delta.grossSalesDeltaPercent >= 0 ? (
                    <span className="text-[#4edea3] font-semibold">+{kpis.delta.grossSalesDeltaPercent}%</span>
                  ) : (
                    <span className="text-[#ffb4ab] font-semibold">{kpis?.delta?.grossSalesDeltaPercent}%</span>
                  )}
                  <span className="text-[#86948a]">vs previous period</span>
                </div>
              </div>
            </div>

            {/* Net Revenue */}
            <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[12px] uppercase font-semibold text-[#bbcabf]">Net Revenue</span>
                <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">account_balance</span>
              </div>
              <div className="mt-3">
                <div className="text-[24px] font-bold text-[#4cd7f6]">
                  {currencySymbol}{kpis?.netRevenuePkr.toLocaleString() || 0}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                  <span className="text-[#bbcabf]">Deducts returns &amp; cancels</span>
                </div>
              </div>
            </div>

            {/* Total Orders & AOV */}
            <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[12px] uppercase font-semibold text-[#bbcabf]">Orders / AOV</span>
                <span className="material-symbols-outlined text-[#f59e0b] text-[20px]">shopping_bag</span>
              </div>
              <div className="mt-3">
                <div className="text-[24px] font-bold text-[#dae2fd]">
                  {kpis?.totalOrders.toLocaleString() || 0}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#bbcabf]">
                  <span>AOV:</span>
                  <span className="text-[#dae2fd] font-semibold">
                    {currencySymbol}{kpis?.averageOrderValuePkr.toLocaleString() || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Visitors & Conversion */}
            <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[12px] uppercase font-semibold text-[#bbcabf]">Visitors &amp; Conv.</span>
                <span className="material-symbols-outlined text-[#a78bfa] text-[20px]">group</span>
              </div>
              <div className="mt-3">
                <div className="text-[24px] font-bold text-[#dae2fd]">
                  {kpis?.visitorsCount.toLocaleString() || 0}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                  <span className="text-[#bbcabf]">Conv. Rate:</span>
                  <span className="text-[#4edea3] font-semibold">{kpis?.conversionRatePercent || 0}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Time Series Trends Visualization */}
          <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Sales &amp; Revenue Trends</h3>
                <p className="text-[12px] text-[#bbcabf]">Daily transaction cadence across the selected period</p>
              </div>
              <div className="flex items-center gap-4 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#4edea3]"></span>
                  <span className="text-[#bbcabf]">Gross Sales</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#4cd7f6]"></span>
                  <span className="text-[#bbcabf]">Net Revenue</span>
                </div>
              </div>
            </div>

            {/* Trend Chart Bars */}
            <div className="mt-4 flex items-end gap-2 h-44 border-b border-[#2d3449] pb-2 pt-6">
              {trends.map((pt, idx) => {
                const maxVal = Math.max(1, ...trends.map((t) => t.grossSalesPkr));
                const grossHeightPercent = Math.max(4, Math.round((pt.grossSalesPkr / maxVal) * 100));
                const netHeightPercent = Math.max(2, Math.round((pt.netRevenuePkr / maxVal) * 100));

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-12 bg-[#0b1326] border border-[#2d3449] text-[11px] text-[#dae2fd] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      <div>{pt.label}</div>
                      <div className="text-[#4edea3] font-bold">Gross: {currencySymbol}{pt.grossSalesPkr.toLocaleString()}</div>
                      <div className="text-[#4cd7f6]">Net: {currencySymbol}{pt.netRevenuePkr.toLocaleString()}</div>
                      <div className="text-[#bbcabf]">Orders: {pt.orders} | Visits: {pt.visitors}</div>
                    </div>

                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      <div
                        style={{ height: `${grossHeightPercent}%` }}
                        className="w-full max-w-[14px] bg-[#4edea3] rounded-t-sm transition-all group-hover:brightness-110"
                      ></div>
                      <div
                        style={{ height: `${netHeightPercent}%` }}
                        className="w-full max-w-[14px] bg-[#4cd7f6] rounded-t-sm transition-all group-hover:brightness-110"
                      ></div>
                    </div>
                    <span className="text-[10px] text-[#86948a] truncate max-w-full">{pt.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Two-Column Grid: Funnel & Cart Abandonment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Conversion Funnel */}
            <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[16px] font-bold text-[#dae2fd]">Customer Conversion Funnel</h3>
                  <span className="material-symbols-outlined text-[#4edea3] text-[20px]">filter_alt</span>
                </div>
                <p className="text-[12px] text-[#bbcabf] mb-4">
                  Step-by-step conversion dropoff from store visits to completed orders.
                </p>

                <div className="flex flex-col gap-3">
                  {funnel.map((f, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex justify-between text-[12px]">
                        <span className="font-semibold text-[#dae2fd]">{f.stage}</span>
                        <div className="flex gap-2">
                          <span className="text-[#4edea3] font-mono">{f.count.toLocaleString()}</span>
                          <span className="text-[#bbcabf]">({f.conversionFromFirstPercent}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-[#171f33] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.max(2, f.conversionFromFirstPercent)}%` }}
                          className="h-full bg-gradient-to-r from-[#4edea3] to-[#4cd7f6] rounded-full"
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sandbox Simulation Trigger */}
              {isSandbox && (
                <div className="mt-6 pt-4 border-t border-[#2d3449] flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-[#bbcabf]">Test funnel in sandbox:</span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={simulatingEvent}
                      onClick={() => handleSimulateEvent('page_view')}
                      className="bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd] px-2.5 py-1 rounded-lg border border-[#2d3449] text-[11px]"
                    >
                      + Visit
                    </button>
                    <button
                      disabled={simulatingEvent}
                      onClick={() => handleSimulateEvent('add_to_cart')}
                      className="bg-[#171f33] hover:bg-[#222a3d] text-[#f59e0b] px-2.5 py-1 rounded-lg border border-[#2d3449] text-[11px]"
                    >
                      + Cart
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Cart Abandonment & Traffic Sources */}
            <div className="flex flex-col gap-6">
              {/* Cart Abandonment Card */}
              <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[16px] font-bold text-[#dae2fd]">Cart Abandonment Rate</h3>
                  <span className="material-symbols-outlined text-[#f59e0b] text-[20px]">remove_shopping_cart</span>
                </div>
                {abandonment?.isAvailable ? (
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <div className="text-[28px] font-bold text-[#f59e0b]">
                        {abandonment.abandonmentRatePercent}%
                      </div>
                      <p className="text-[12px] text-[#bbcabf] mt-1">
                        {abandonment.cartsAbandoned} of {abandonment.cartsStarted} cart sessions abandoned
                      </p>
                    </div>
                    <div className="text-[12px] text-right text-[#86948a]">
                      <div>Purchased: {abandonment.cartsPurchased}</div>
                      <div>Abandoned: {abandonment.cartsAbandoned}</div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center text-[#86948a] text-[13px] bg-[#171f33] rounded-xl border border-[#2d3449]/60 mt-2">
                    {abandonment?.notes || 'No cart additions recorded in this period.'}
                  </div>
                )}
              </div>

              {/* Traffic Sources Breakdown */}
              <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-6 shadow-sm flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[16px] font-bold text-[#dae2fd]">Traffic &amp; Referrer Sources</h3>
                  <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">travel_explore</span>
                </div>
                {trafficSources.length > 0 ? (
                  <div className="flex flex-col gap-2.5 mt-2">
                    {trafficSources.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[12px]">
                        <span className="text-[#dae2fd]">{t.source}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#bbcabf] font-mono">{t.count} visits</span>
                          <span className="text-[#4cd7f6] font-semibold">({t.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-[#86948a] text-[13px] bg-[#171f33] rounded-xl border border-[#2d3449]/60">
                    No external traffic telemetry detected.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Performing Products Table */}
          <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Top Performing Products</h3>
                <p className="text-[12px] text-[#bbcabf]">Catalog engagement, units sold, and revenue</p>
              </div>
              <span className="text-[12px] text-[#86948a]">Sorted by Revenue</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[#2d3449] text-[#bbcabf] text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-3">Product Name</th>
                    <th className="py-3 px-3 text-right">Views</th>
                    <th className="py-3 px-3 text-right">Units Sold</th>
                    <th className="py-3 px-3 text-right">Revenue</th>
                    <th className="py-3 px-3 text-right">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3449]/60">
                  {products.length > 0 ? (
                    products.map((p, idx) => (
                      <tr key={idx} className="hover:bg-[#171f33]/60 transition-colors">
                        <td className="py-3 px-3 font-semibold text-[#dae2fd]">{p.productName}</td>
                        <td className="py-3 px-3 text-right text-[#bbcabf] font-mono">{p.views.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-semibold text-[#dae2fd] font-mono">
                          {p.unitsSold.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-[#4edea3] font-mono">
                          {currencySymbol}{p.revenuePkr.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right text-[#bbcabf] font-mono">{p.conversionRatePercent}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#86948a]">
                        No product transaction data recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Executive Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#000000]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between p-5 border-b border-[#2d3449] bg-[#0b1326]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[22px]">description</span>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">
                  Executive Analytics Report — {storeName}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/stores/${storeId}/analytics/reports?range=${dateRange}&format=html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#059669] hover:bg-[#047857] text-white px-3 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Print / Save PDF</span>
                </a>
                <button
                  onClick={() => setReportModalOpen(false)}
                  className="text-[#bbcabf] hover:text-[#dae2fd] p-1.5 rounded-lg hover:bg-[#171f33]"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 p-0 overflow-y-auto bg-white">
              <iframe
                src={`/api/stores/${storeId}/analytics/reports?range=${dateRange}&format=html`}
                className="w-full h-[650px] border-none"
                title="Executive Report Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
