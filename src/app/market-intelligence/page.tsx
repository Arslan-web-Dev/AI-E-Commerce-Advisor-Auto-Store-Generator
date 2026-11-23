'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';

interface DistrictBenchmark {
  district: string;
  division: string;
  population_total: number;
  population_urban: number;
  urbanization_rate: number;
  literacy_rate: number;
  commercial_rent_sqft_min: number;
  commercial_rent_sqft_max: number;
  commercial_rent_sqft_avg: number;
  purchasing_power_index: number;
  retail_density_score: number;
  primary_commercial_hubs: string[];
  economic_drivers: string[];
}

export default function MarketIntelligencePage() {
  const [activeTab, setActiveTab] = useState<'trends' | 'regional' | 'calculator'>('trends');

  // Trends state
  const [keywordsInput, setKeywordsInput] = useState('lawn suits, pret wear, mens fashion');
  const [geo, setGeo] = useState('PK');
  const [timeframe, setTimeframe] = useState('today 12-m');
  const [fetchingTrends, setFetchingTrends] = useState(false);
  const [trendsData, setTrendsData] = useState<any>(null);

  // Regional benchmarks state
  const [districts, setDistricts] = useState<DistrictBenchmark[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictBenchmark | null>(null);

  // Demand calculator state
  const [calcKeyword, setCalcKeyword] = useState('lawn suits');
  const [calcDistrict, setCalcDistrict] = useState('Lahore');
  const [calculating, setCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState<any>(null);

  // Fetch regional benchmarks
  useEffect(() => {
    async function loadDistricts() {
      try {
        const res = await fetch('/api/market/regional');
        if (res.ok) {
          const data = await res.json();
          setDistricts(data.districts || []);
          if (data.districts?.length > 0) {
            setSelectedDistrict(data.districts[0]);
          }
        }
      } catch {
        // ignore
      }
    }
    loadDistricts();
  }, []);

  // Fetch trends
  const handleFetchTrends = useCallback(async () => {
    setFetchingTrends(true);
    try {
      const kwEncoded = encodeURIComponent(keywordsInput);
      const res = await fetch(`/api/market/trends?keywords=${kwEncoded}&geo=${geo}&timeframe=${timeframe}`);
      if (res.ok) {
        const data = await res.json();
        setTrendsData(data.trends);
      } else {
        const err = await res.json();
        alert(`Failed to fetch trends: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setFetchingTrends(false);
    }
  }, [keywordsInput, geo, timeframe]);

  // Initial fetch for trends
  useEffect(() => {
    handleFetchTrends();
  }, [handleFetchTrends]);

  // Handle demand calculation
  const handleCalculateDemand = async () => {
    setCalculating(true);
    try {
      const res = await fetch('/api/market/demand-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_keyword: calcKeyword,
          district: calcDistrict
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCalcResult(data.analysis);
      } else {
        const err = await res.json();
        alert(`Calculation failed: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setCalculating(false);
    }
  };

  // Helper for color palettes in multi-line SVG chart
  const lineColors = ['#4edea3', '#4cd7f6', '#f59e0b', '#ec4899', '#a855f7'];

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans pb-16">
      {/* Top Header */}
      <header className="border-b border-[#2d3449] bg-[#0b1326]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/ml"
              className="w-9 h-9 rounded-xl bg-[#171f33] border border-[#2d3449] flex items-center justify-center text-[#bbcabf] hover:text-[#dae2fd] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#4cd7f6]/10 text-[#4cd7f6] font-bold">
                  MODULE B
                </span>
                <span className="text-[12px] font-mono text-[#bbcabf]">Market Intelligence</span>
              </div>
              <h1 className="text-[16px] font-bold text-[#dae2fd] leading-tight">
                Google Trends &amp; Punjab Regional Market Analysis
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/ml"
              className="px-3 py-1.5 rounded-xl bg-[#171f33] hover:bg-[#222a3d] border border-[#2d3449] text-[12px] font-semibold text-[#4edea3] flex items-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">model_training</span>
              <span>ML Pipeline Studio</span>
            </Link>
            <div className="px-3 py-1 rounded-full bg-[#4cd7f6]/15 text-[#4cd7f6] text-[11px] font-semibold font-mono border border-[#4cd7f6]/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4cd7f6] animate-pulse"></span>
              <span>PBS 2023 Census Synced</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#2d3449] mb-6 overflow-x-auto gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-2.5 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'trends'
                ? 'border-[#4cd7f6] text-[#4cd7f6]'
                : 'border-transparent text-[#bbcabf] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">insights</span>
            <span>Google Trends Explorer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('regional')}
            className={`px-4 py-2.5 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'regional'
                ? 'border-[#4cd7f6] text-[#4cd7f6]'
                : 'border-transparent text-[#bbcabf] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">location_city</span>
            <span>Punjab District Demographics &amp; Rent</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[#171f33] text-[#bbcabf]">
              {districts.length} Districts
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('calculator')}
            className={`px-4 py-2.5 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'calculator'
                ? 'border-[#4cd7f6] text-[#4cd7f6]'
                : 'border-transparent text-[#bbcabf] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">calculate</span>
            <span>Composite Demand Feasibility Index</span>
          </button>
        </div>

        {/* ================= TAB 1: GOOGLE TRENDS EXPLORER ================= */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            {/* Search Controls */}
            <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-6">
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Search Keywords (up to 5, comma-separated)
                  </label>
                  <input
                    type="text"
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                    placeholder="e.g. lawn suits, pret wear, mens fashion"
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3.5 py-2 text-[13px] text-[#dae2fd] focus:border-[#4cd7f6] outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Geography
                  </label>
                  <select
                    value={geo}
                    onChange={(e) => setGeo(e.target.value)}
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[13px] text-[#dae2fd] focus:border-[#4cd7f6] outline-none"
                  >
                    <option value="PK">Pakistan (Entire)</option>
                    <option value="PK-PB">Punjab Province</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Timeframe
                  </label>
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[13px] text-[#dae2fd] focus:border-[#4cd7f6] outline-none"
                  >
                    <option value="today 12-m">Past 12 Months</option>
                    <option value="today 3-m">Past 3 Months</option>
                    <option value="today 5-y">Past 5 Years</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={handleFetchTrends}
                    disabled={fetchingTrends}
                    className="w-full py-2 rounded-xl bg-[#4cd7f6] hover:bg-[#38bdf8] text-[#002f3a] font-bold text-[13px] flex items-center justify-center gap-1.5 transition-all shadow-md"
                  >
                    {fetchingTrends ? (
                      <div className="w-4 h-4 border-2 border-[#002f3a] border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">search</span>
                    )}
                    <span>{fetchingTrends ? 'Analyzing...' : 'Explore'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Trajectory Analytics Cards */}
            {trendsData?.analytics && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(trendsData.analytics).map(([kw, meta]: [string, any], idx) => (
                  <div
                    key={kw}
                    className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-5 shadow-lg relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: lineColors[idx % lineColors.length] }}
                    ></div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[11px] font-mono uppercase text-[#bbcabf]">Keyword Momentum</span>
                        <h4 className="text-[17px] font-bold text-[#dae2fd] mt-0.5">{kw}</h4>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                          meta.trend_direction.includes('rising')
                            ? 'bg-[#10b981]/20 text-[#4edea3]'
                            : meta.trend_direction.includes('falling')
                            ? 'bg-[#ef4444]/20 text-[#f87171]'
                            : 'bg-[#bbcabf]/20 text-[#bbcabf]'
                        }`}
                      >
                        {meta.trend_direction.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[#2d3449] text-[12px] font-mono">
                      <div>
                        <span className="text-[#bbcabf]">Avg Interest:</span>
                        <div className="text-[16px] font-bold text-[#dae2fd]">{meta.average_interest}/100</div>
                      </div>
                      <div>
                        <span className="text-[#bbcabf]">Peak Month:</span>
                        <div className="text-[16px] font-bold text-[#4cd7f6]">{meta.peak_month}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Interest Over Time Interactive Curve (SVG) */}
            {trendsData?.interest_over_time?.length > 0 && (
              <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[16px] font-bold text-[#dae2fd]">Search Interest Over Time</h3>
                    <p className="text-[12px] text-[#bbcabf]">
                      Relative search volume scaled 0-100 across target Pakistan geography.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-[12px] font-mono">
                    {trendsData.keywords.map((kw: string, i: number) => (
                      <div key={kw} className="flex items-center gap-1.5">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: lineColors[i % lineColors.length] }}
                        ></span>
                        <span>{kw}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SVG Visualizer */}
                <div className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl p-4 overflow-x-auto">
                  <svg viewBox="0 0 800 240" className="w-full h-56">
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map((level) => {
                      const y = 200 - (level / 100) * 180;
                      return (
                        <g key={level}>
                          <line x1="40" y1={y} x2="780" y2={y} stroke="#2d3449" strokeDasharray="3 3" />
                          <text x="10" y={y + 4} fill="#bbcabf" fontSize="10" fontFamily="monospace">
                            {level}
                          </text>
                        </g>
                      );
                    })}

                    {/* Data Lines */}
                    {trendsData.keywords.map((kw: string, kwIdx: number) => {
                      const points = trendsData.interest_over_time
                        .map((entry: any, ptIdx: number) => {
                          const x = 50 + (ptIdx / (trendsData.interest_over_time.length - 1)) * 720;
                          const val = Number(entry[kw] || 0);
                          const y = 200 - (val / 100) * 180;
                          return `${x},${y}`;
                        })
                        .join(' ');

                      return (
                        <polyline
                          key={kw}
                          fill="none"
                          stroke={lineColors[kwIdx % lineColors.length]}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points}
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}

            {/* Related Queries Matrix */}
            {trendsData?.related_queries && (
              <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 space-y-4">
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Consumer Search Queries &amp; Rising Breakouts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(trendsData.related_queries).map(([kw, val]: [string, any]) => (
                    <div key={kw} className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-4 space-y-3">
                      <h4 className="font-bold text-[14px] text-[#4cd7f6]">{kw}</h4>
                      <div>
                        <span className="text-[11px] font-mono uppercase text-[#bbcabf] font-semibold">
                          Top Search Queries
                        </span>
                        <div className="mt-1 space-y-1">
                          {val.top?.slice(0, 3).map((q: any, i: number) => (
                            <div key={i} className="flex justify-between text-[12px] font-mono text-[#dae2fd]">
                              <span className="truncate pr-2">{q.query}</span>
                              <span className="text-[#4edea3]">{q.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {val.rising?.length > 0 && (
                        <div className="pt-2 border-t border-[#2d3449]">
                          <span className="text-[11px] font-mono uppercase text-[#bbcabf] font-semibold">
                            Rising Demand Breakouts
                          </span>
                          <div className="mt-1 space-y-1">
                            {val.rising?.slice(0, 2).map((q: any, i: number) => (
                              <div key={i} className="flex justify-between text-[12px] font-mono text-[#dae2fd]">
                                <span className="truncate pr-2">{q.query}</span>
                                <span className="text-[#f59e0b]">+{q.value}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: REGIONAL BENCHMARKS ================= */}
        {activeTab === 'regional' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: District List */}
            <div className="lg:col-span-4 space-y-3">
              <h4 className="text-[12px] font-mono uppercase text-[#bbcabf] font-semibold">
                Major Commercial Districts (Punjab)
              </h4>
              <div className="space-y-2">
                {districts.map((d) => (
                  <div
                    key={d.district}
                    onClick={() => setSelectedDistrict(d)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedDistrict?.district === d.district
                        ? 'bg-[#1e273d] border-[#4cd7f6] shadow-md'
                        : 'bg-[#171f33] border-[#2d3449] hover:border-[#3c4a42]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-bold text-[14px] text-[#dae2fd]">{d.district}</h5>
                        <p className="text-[11px] text-[#bbcabf] font-mono">
                          Division: {d.division} &bull; Pop: {(d.population_total / 1000000).toFixed(2)}M
                        </p>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-[#4cd7f6]/15 text-[#4cd7f6] font-mono font-semibold">
                        Avg Rent: {d.commercial_rent_sqft_avg} PKR
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: District Deep Dive */}
            <div className="lg:col-span-8">
              {selectedDistrict && (
                <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#2d3449] gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#4cd7f6]/15 text-[#4cd7f6] font-bold">
                          {selectedDistrict.division} Division
                        </span>
                        <span className="text-[12px] font-mono text-[#bbcabf]">PBS 2023 Census</span>
                      </div>
                      <h3 className="font-bold text-[22px] text-[#dae2fd] mt-0.5">
                        {selectedDistrict.district} Commercial Profile
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCalcDistrict(selectedDistrict.district);
                        setActiveTab('calculator');
                      }}
                      className="px-4 py-2 rounded-xl bg-[#4cd7f6] hover:bg-[#38bdf8] text-[#002f3a] font-bold text-[13px] flex items-center gap-1.5 shadow-md"
                    >
                      <span className="material-symbols-outlined text-[18px]">calculate</span>
                      <span>Calculate Demand for {selectedDistrict.district}</span>
                    </button>
                  </div>

                  {/* Key Indicator Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                      <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Total Population</span>
                      <div className="text-[17px] font-bold text-[#dae2fd] mt-1">
                        {selectedDistrict.population_total.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                      <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Urbanization Rate</span>
                      <div className="text-[17px] font-bold text-[#4cd7f6] mt-1">
                        {selectedDistrict.urbanization_rate}%
                      </div>
                    </div>

                    <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                      <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Purchasing Power (PPI)</span>
                      <div className="text-[17px] font-bold text-[#4edea3] mt-1">
                        {selectedDistrict.purchasing_power_index}/100
                      </div>
                    </div>

                    <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                      <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Commercial Rent (Avg)</span>
                      <div className="text-[17px] font-bold text-[#dae2fd] mt-1">
                        PKR {selectedDistrict.commercial_rent_sqft_avg}/sqft
                      </div>
                    </div>
                  </div>

                  {/* Commercial Rent Spectrum */}
                  <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-[12px] font-mono">
                      <span className="text-[#bbcabf]">Rent Spectrum (PKR/sqft/month):</span>
                      <span className="text-[#dae2fd]">
                        Min: PKR {selectedDistrict.commercial_rent_sqft_min} &bull; Max: PKR {selectedDistrict.commercial_rent_sqft_max}
                      </span>
                    </div>
                    <div className="w-full bg-[#1e273d] h-2 rounded-full overflow-hidden relative">
                      <div
                        className="bg-[#4cd7f6] h-full"
                        style={{
                          width: `${(selectedDistrict.commercial_rent_sqft_avg / 500) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Commercial Hubs & Economic Drivers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h5 className="text-[13px] font-bold text-[#dae2fd]">Primary Retail &amp; Commercial Hubs</h5>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDistrict.primary_commercial_hubs.map((hub, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-[#131b2e] border border-[#2d3449] text-[11px] text-[#dae2fd]"
                          >
                            {hub}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h5 className="text-[13px] font-bold text-[#dae2fd]">Major Economic Drivers</h5>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedDistrict.economic_drivers.map((drv, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-[#131b2e] border border-[#4edea3]/20 text-[11px] text-[#4edea3]"
                          >
                            {drv}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: DEMAND CALCULATOR ================= */}
        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Composite Demand Calculator</h3>
                <p className="text-[12px] text-[#bbcabf]">
                  Synthesizes Google Trends consumer intent, PBS purchasing power, and commercial rent overhead.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Primary Retail Keyword
                  </label>
                  <input
                    type="text"
                    value={calcKeyword}
                    onChange={(e) => setCalcKeyword(e.target.value)}
                    placeholder="e.g. lawn suits"
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3.5 py-2 text-[13px] text-[#dae2fd]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Target District
                  </label>
                  <select
                    value={calcDistrict}
                    onChange={(e) => setCalcDistrict(e.target.value)}
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[13px] text-[#dae2fd]"
                  >
                    {districts.map((d) => (
                      <option key={d.district} value={d.district}>
                        {d.district}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCalculateDemand}
                    disabled={calculating}
                    className="w-full py-2.5 rounded-xl bg-[#4cd7f6] hover:bg-[#38bdf8] text-[#002f3a] font-bold text-[13px] flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    {calculating ? (
                      <div className="w-4 h-4 border-2 border-[#002f3a] border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">calculate</span>
                    )}
                    <span>{calculating ? 'Analyzing Market Room...' : 'Calculate Demand Index'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Results Output */}
            <div className="lg:col-span-7 bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Market Feasibility Index</h3>
                <p className="text-[12px] text-[#bbcabf]">
                  Evaluates whether consumer demand velocity balances against local retail occupancy costs.
                </p>
              </div>

              {calcResult ? (
                <div className="space-y-6">
                  {/* Score Hero */}
                  <div className="p-5 rounded-xl bg-[#131b2e] border border-[#4cd7f6]/40 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono uppercase text-[#bbcabf]">Composite Demand Index</span>
                      <div className="text-[32px] font-bold text-[#4cd7f6]">
                        {calcResult.composite_demand_index} / 100
                      </div>
                      <p className="text-[12px] text-[#bbcabf] mt-0.5">{calcResult.recommendation}</p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-[12px] font-bold uppercase font-mono border ${
                        calcResult.status === 'favorable'
                          ? 'bg-[#10b981]/15 text-[#4edea3] border-[#4edea3]/30'
                          : calcResult.status === 'moderate'
                          ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30'
                          : 'bg-[#ef4444]/15 text-[#f87171] border-[#f87171]/30'
                      }`}
                    >
                      {calcResult.status}
                    </span>
                  </div>

                  {/* Component Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                      <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Search Intent</span>
                      <div className="text-[18px] font-bold text-[#dae2fd] mt-1">
                        {calcResult.score_breakdown.search_score} / 35
                      </div>
                    </div>

                    <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                      <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Demographics &amp; PPI</span>
                      <div className="text-[18px] font-bold text-[#dae2fd] mt-1">
                        {calcResult.score_breakdown.demographic_score} / 35
                      </div>
                    </div>

                    <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                      <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Market Room</span>
                      <div className="text-[18px] font-bold text-[#dae2fd] mt-1">
                        {calcResult.score_breakdown.market_room_score} / 30
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-12 text-center text-[#bbcabf] text-[13px]">
                  Select a keyword and district on the left and click &quot;Calculate Demand Index&quot; to review the composite score.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
