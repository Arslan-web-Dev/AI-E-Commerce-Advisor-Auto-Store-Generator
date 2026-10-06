'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FeasibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scoring, setScoring] = useState(false);
  const router = useRouter();

  useEffect(() => {
    params.then((p) => {
      setProjectId(p.id);
    });
  }, [params]);

  useEffect(() => {
    if (!projectId) return;

    async function fetchLatestRun() {
      try {
        const res = await fetch(`/api/projects/${projectId}/feasibility`);
        if (!res.ok) throw new Error('Failed to fetch feasibility run');
        const data = await res.json();
        setRun(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchLatestRun();
  }, [projectId]);

  const handleScore = async () => {
    // In a real app, we'd pick the selected processing run ID from the UI.
    // For now, we mock or require the user to have a processing run.
    const mockRunId = prompt("Enter a valid processing_run_id from Module 4:");
    if (!mockRunId) return;

    setScoring(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/feasibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processing_run_id: mockRunId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRun(data.data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setScoring(false);
    }
  };

  if (loading) return <div className="p-8">Loading Feasibility Score...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Feasibility Prediction</h1>
      
      {error && <div className="p-4 bg-red-50 text-red-700 rounded-md">{error}</div>}

      {!run && !error && (
        <div className="p-8 bg-gray-50 border rounded-lg text-center">
          <p className="text-gray-500 mb-4">No feasibility score found for this project.</p>
          <button 
            onClick={handleScore}
            disabled={scoring}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            {scoring ? 'Scoring...' : 'Generate Provisional Score'}
          </button>
        </div>
      )}

      {run && (
        <div className="space-y-6">
          <div className="p-6 border rounded-xl shadow-sm bg-white">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Classification</h2>
                <div className={`text-2xl font-bold mt-1 ${
                  run.classification === 'High Feasibility' ? 'text-green-600' : 
                  run.classification === 'Medium Feasibility' ? 'text-yellow-600' :
                  run.classification === 'Low Feasibility' ? 'text-orange-600' :
                  'text-red-600'
                }`}>
                  {run.classification || 'Unavailable'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Score</div>
                <div className="text-3xl font-black text-gray-900">
                  {run.score_value !== null ? (run.score_value * 100).toFixed(1) + '%' : 'N/A'}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mb-6">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Mode: {run.scoring_mode === 'provisional_mcda' ? 'Provisional MCDA Index' : run.scoring_mode}
              </span>
              {run.explanations?.configuration_version && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  Version: {run.explanations.configuration_version}
                </span>
              )}
            </div>

            {run.scoring_mode === 'provisional_mcda' && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 mb-6">
                <strong>Important:</strong> {run.explanations?.disclaimer || "This score is a heuristic index, not a calibrated probability."}
              </div>
            )}

            {run.explanations?.factors && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Key Factors</h3>
                <div className="space-y-3">
                  {run.explanations.factors.map((factor: any, i: number) => (
                    <div key={i} className="flex flex-col p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="flex justify-between font-medium">
                        <span>{factor.feature}</span>
                        <span>{Math.round(factor.contribution * 100)} pts (Weight: {Math.round(factor.weight * 100)}%)</span>
                      </div>
                      <p className="text-gray-500 mt-1">{factor.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="text-right">
            <button 
              onClick={handleScore}
              disabled={scoring}
              className="text-sm text-emerald-600 hover:text-emerald-700"
            >
              Regenerate Score
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
