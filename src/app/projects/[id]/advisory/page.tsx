'use client';

import { useState, useEffect } from 'react';

type Language = 'en' | 'ur';

export default function AdvisoryPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lang, setLang] = useState<Language>('en');

  // Budget states
  const [allocations, setAllocations] = useState<any>(null);

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    async function fetchReport() {
      try {
        const res = await fetch(`/api/projects/${projectId}/advisory`);
        if (!res.ok) throw new Error('Failed to fetch advisory report');
        const data = await res.json();
        if (data.data) {
          setReport(data.data);
          setAllocations(data.data.budget_allocations);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [projectId]);

  const handleGenerate = async () => {
    const mockRunId = prompt("Enter a valid feasibility_run_id from Module 5:");
    if (!mockRunId) return;

    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/advisory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feasibility_run_id: mockRunId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.data);
      setAllocations(data.data.budget_allocations);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleAllocationChange = (key: string, value: number) => {
    if (!allocations) return;
    setAllocations({ ...allocations, [key]: value });
  };

  if (loading) return <div className="p-8">Loading Advisory...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {lang === 'en' ? 'Strategic Advisory' : 'Hikmat-e-Amli (Strategy)'}
        </h1>
        
        {/* Language Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button 
            className={`px-3 py-1 text-sm font-medium rounded-md ${lang === 'en' ? 'bg-white shadow' : 'text-gray-500'}`}
            onClick={() => setLang('en')}
          >
            English
          </button>
          <button 
            className={`px-3 py-1 text-sm font-medium rounded-md ${lang === 'ur' ? 'bg-white shadow' : 'text-gray-500'}`}
            onClick={() => setLang('ur')}
          >
            Roman Urdu
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}

      {!report && !error && (
        <div className="p-12 bg-gray-50 border rounded-xl text-center">
          <p className="text-gray-500 mb-4">No advisory report generated for this project.</p>
          <button 
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 font-medium"
          >
            {generating ? 'Generating...' : 'Generate Advisory Report'}
          </button>
        </div>
      )}

      {report && (
        <>
          {/* Overview Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white border rounded-xl shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Project Overview</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Category</span>
                  <span className="font-medium text-gray-900">{report.projects?.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Region</span>
                  <span className="font-medium text-gray-900">{report.projects?.target_location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Feasibility</span>
                  <span className={`font-bold ${report.project_feasibility_runs?.classification === 'High Feasibility' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {report.project_feasibility_runs?.classification}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <span className="text-gray-600 text-sm">Mode</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {report.project_feasibility_runs?.scoring_mode === 'provisional_mcda' ? 'Provisional MCDA' : 'Model'}
                  </span>
                </div>
              </div>
            </div>

            {/* Budget Allocation Section */}
            <div className="p-6 bg-white border rounded-xl shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                {lang === 'en' ? 'Budget Allocation (Scenario)' : 'Budget Ki Taqseem'}
              </h2>
              
              <div className="mb-4 text-2xl font-bold text-gray-900">
                {report.budget_total.toLocaleString()} <span className="text-lg font-medium text-gray-500">{report.budget_currency}</span>
              </div>
              
              <div className="space-y-4">
                {['inventory', 'marketing', 'operations', 'contingency'].map((cat) => (
                  <div key={cat}>
                    <div className="flex justify-between text-sm font-medium mb-1">
                      <span className="capitalize">{cat}</span>
                      <span>{allocations?.[cat]?.toLocaleString()} {report.budget_currency}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max={report.budget_total} 
                      value={allocations?.[cat] || 0}
                      onChange={(e) => handleAllocationChange(cat, Number(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-gray-500">
                * {lang === 'en' ? 'This is an illustrative planning scenario, not a guaranteed optimized limit.' : 'Yeh sirf ek andaza hai, hatmi guarantee nahi.'}
              </p>
            </div>
          </div>

          {/* Strategic Insights */}
          <div className="p-6 bg-white border rounded-xl shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6">
              {lang === 'en' ? 'Strategic Insights' : 'Khaas Maloomat'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Strengths */}
              <div>
                <h3 className="text-sm font-bold text-green-700 uppercase tracking-wider mb-3">Strengths</h3>
                <div className="space-y-4">
                  {report.insights.strengths?.map((item: any, i: number) => (
                    <div key={i} className="p-4 bg-green-50 rounded-lg border border-green-100">
                      <div className="font-semibold text-green-900 mb-1">{item.title[lang]}</div>
                      <div className="text-sm text-green-800">{item.description[lang]}</div>
                    </div>
                  ))}
                  {!report.insights.strengths?.length && <div className="text-sm text-gray-500">No major strengths found.</div>}
                </div>
              </div>

              {/* Risks */}
              <div>
                <h3 className="text-sm font-bold text-red-700 uppercase tracking-wider mb-3">Risks</h3>
                <div className="space-y-4">
                  {report.insights.risks?.map((item: any, i: number) => (
                    <div key={i} className="p-4 bg-red-50 rounded-lg border border-red-100">
                      <div className="font-semibold text-red-900 mb-1">{item.title[lang]}</div>
                      <div className="text-sm text-red-800">{item.description[lang]}</div>
                    </div>
                  ))}
                  {!report.insights.risks?.length && <div className="text-sm text-gray-500">No major risks identified.</div>}
                </div>
              </div>

              {/* Actions */}
              <div>
                <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-3">Immediate Actions</h3>
                <div className="space-y-4">
                  {report.insights.immediate_actions?.map((item: any, i: number) => (
                    <div key={i} className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="font-semibold text-blue-900 mb-1">{item.title[lang]}</div>
                      <div className="text-sm text-blue-800">{item.description[lang]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Location Recommendations */}
          <div className="p-6 bg-white border rounded-xl shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {lang === 'en' ? 'Location Recommendations' : 'Jagah Ki Tajweez'}
            </h2>
            <div className="p-4 bg-gray-50 border rounded-lg text-sm text-gray-700">
              {report.location_recommendations?.status === 'unavailable' ? (
                report.location_recommendations.reason[lang]
              ) : (
                JSON.stringify(report.location_recommendations)
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
