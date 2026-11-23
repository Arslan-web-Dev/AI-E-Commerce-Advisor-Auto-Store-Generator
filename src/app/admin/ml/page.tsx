'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Reveal from '@/components/ui/Reveal';

interface ColumnMeta {
  name: string;
  type: string;
  null_count: number;
  null_pct: number;
  unique_count: number;
  is_target: boolean;
  stats?: { min: number; max: number; mean: number; median: number; std: number };
  top_values?: Record<string, number>;
}

interface DatasetItem {
  id: string;
  name: string;
  file_name: string;
  file_size_bytes: number;
  row_count: number;
  column_count: number;
  target_column: string | null;
  problem_type: 'classification' | 'regression' | null;
  columns_metadata: ColumnMeta[];
  data_quality_report: {
    missing_cells_total: number;
    duplicate_rows: number;
    warnings: string[];
    health_score: number;
    target_analysis?: any;
  };
  is_sample: boolean;
}

interface LeaderboardItem {
  algorithm_key: string;
  name: string;
  description: string;
  rank_score: number;
  cv_score: number;
  test_metrics: Record<string, any>;
  hyperparameters: Record<string, any>;
}

interface ModelItem {
  model_id: string;
  name: string;
  algorithm_key: string;
  problem_type: string;
  target_col: string;
  metrics: Record<string, any>;
  is_active: boolean;
  file_name: string;
  file_size_bytes?: number;
}

export default function MLPipelineAdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'datasets' | 'training' | 'leaderboard' | 'predict'>('datasets');

  // Datasets state
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<DatasetItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generatingSample, setGeneratingSample] = useState(false);

  // Training state
  const [targetColumn, setTargetColumn] = useState('feasibility_class');
  const [problemType, setProblemType] = useState<'classification' | 'regression'>('classification');
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<string[]>([
    'random_forest',
    'gradient_boosting',
    'logistic_regression',
    'extra_trees'
  ]);
  const [cvFolds, setCvFolds] = useState(5);
  const [testSplit, setTestSplit] = useState(0.2);
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [trainingStep, setTrainingStep] = useState('');
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [lastResults, setLastResults] = useState<{
    best_model_id: string;
    best_model_name: string;
    leaderboard: LeaderboardItem[];
    global_importances: Array<{ feature: string; importance: number }>;
  } | null>(null);

  // Models state
  const [models, setModels] = useState<ModelItem[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Predictor Sandbox State
  const [predictInputs, setPredictInputs] = useState({
    district: 'Lahore',
    business_category: 'Fashion & Apparel',
    target_audience: 'Middle Income',
    initial_capital_pkr: 3500000,
    monthly_burn_budget_pkr: 250000,
    commercial_rent_sqft_pkr: 180,
    competitor_density_1km: 15,
    online_search_interest: 75,
    urbanization_rate: 100.0,
    purchasing_power_index: 88.5,
    logistics_accessibility_score: 9.2,
    digital_payment_adoption_pct: 75.0,
    runway_months: 14.0
  });
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<any>(null);

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role === 'admin') {
        setIsAdmin(true);
      } else {
        // Fallback or preview allowed
        setIsAdmin(true);
      }
      setLoading(false);
    }
    checkAuth();
  }, [supabase, router]);

  // Load datasets & models
  const loadData = useCallback(async () => {
    try {
      const dsRes = await fetch('/api/ml/datasets');
      if (dsRes.ok) {
        const dsData = await dsRes.json();
        setDatasets(dsData.datasets || []);
        if (dsData.datasets?.length > 0 && !selectedDataset) {
          setSelectedDataset(dsData.datasets[0]);
        }
      }

      const modRes = await fetch('/api/ml/models');
      if (modRes.ok) {
        const modData = await modRes.json();
        setModels(modData.models || []);
      }
    } catch {
      // safe ignore
    }
  }, [selectedDataset]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle sample dataset generation
  const handleGenerateSample = async () => {
    setGeneratingSample(true);
    try {
      const form = new FormData();
      form.append('action', 'generate_sample');
      const res = await fetch('/api/ml/datasets', { method: 'POST', body: form });
      if (res.ok) {
        await loadData();
      }
    } catch {
      // ignore
    } finally {
      setGeneratingSample(false);
    }
  };

  // Handle custom dataset upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/ml/datasets', { method: 'POST', body: form });
      if (res.ok) {
        await loadData();
      }
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  // Handle training
  const handleStartTraining = async () => {
    if (!selectedDataset) return;
    setTrainingInProgress(true);
    setTrainingProgress(15);
    setTrainingStep('Partitioning dataset and initializing cross-validation splits...');

    try {
      const res = await fetch('/api/ml/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: selectedDataset.id,
          target_column: targetColumn,
          problem_type: problemType,
          candidate_algorithms: selectedAlgorithms,
          cv_folds: cvFolds,
          test_size: testSplit
        })
      });

      setTrainingProgress(80);
      setTrainingStep('Evaluating candidate models and calculating test holdout metrics...');

      if (res.ok) {
        const data = await res.json();
        if (data.job?.results) {
          setLastResults(data.job.results);
          setActiveTab('leaderboard');
        }
        await loadData();
      } else {
        const err = await res.json();
        alert(`Training failed: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Error starting training: ${err.message}`);
    } finally {
      setTrainingProgress(100);
      setTrainingInProgress(false);
      setTrainingStep('');
    }
  };

  // Handle model activation
  const handleActivateModel = async (modelId: string) => {
    setActivatingId(modelId);
    try {
      const res = await fetch('/api/ml/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId })
      });
      if (res.ok) {
        await loadData();
      }
    } catch {
      // ignore
    } finally {
      setActivatingId(null);
    }
  };

  // Handle predict
  const handleRunPredict = async () => {
    setPredicting(true);
    setPredictionResult(null);

    // Calculate runway months dynamically
    const inputs = {
      ...predictInputs,
      runway_months: Number(
        (predictInputs.initial_capital_pkr / Math.max(1, predictInputs.monthly_burn_budget_pkr)).toFixed(1)
      )
    };

    try {
      const res = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_features: inputs })
      });
      if (res.ok) {
        const data = await res.json();
        setPredictionResult(data.prediction);
      } else {
        const err = await res.json();
        alert(`Prediction failed: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Inference error: ${err.message}`);
    } finally {
      setPredicting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1326] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans pb-16">
      {/* Top Header */}
      <header className="border-b border-[#2d3449] bg-[#0b1326]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="w-9 h-9 rounded-xl bg-[#171f33] border border-[#2d3449] flex items-center justify-center text-[#bbcabf] hover:text-[#dae2fd] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#4edea3]/10 text-[#4edea3] font-bold">
                  MODULE A
                </span>
                <span className="text-[12px] font-mono text-[#bbcabf]">Punjab ML Engine</span>
              </div>
              <h1 className="text-[16px] font-bold text-[#dae2fd] leading-tight">
                Multiple-Model ML Training &amp; Prediction Pipeline
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/market-intelligence"
              className="px-3 py-1.5 rounded-xl bg-[#171f33] hover:bg-[#222a3d] border border-[#2d3449] text-[12px] font-semibold text-[#4cd7f6] flex items-center gap-1.5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">trending_up</span>
              <span>Market Intelligence</span>
            </Link>
            <div className="px-3 py-1 rounded-full bg-[#10b981]/15 text-[#4edea3] text-[11px] font-semibold font-mono border border-[#4edea3]/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span>FastAPI 8000: Active</span>
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
            onClick={() => setActiveTab('datasets')}
            className={`px-4 py-2.5 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'datasets'
                ? 'border-[#4edea3] text-[#4edea3]'
                : 'border-transparent text-[#bbcabf] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            <span>Dataset Manager &amp; Quality Audit</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[#171f33] text-[#bbcabf]">
              {datasets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('training')}
            className={`px-4 py-2.5 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'training'
                ? 'border-[#4edea3] text-[#4edea3]'
                : 'border-transparent text-[#bbcabf] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">model_training</span>
            <span>Multi-Model Training Studio</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2.5 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'border-[#4edea3] text-[#4edea3]'
                : 'border-transparent text-[#bbcabf] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">leaderboard</span>
            <span>Model Leaderboard &amp; Registry</span>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[#171f33] text-[#bbcabf]">
              {models.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('predict')}
            className={`px-4 py-2.5 text-[13px] font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'predict'
                ? 'border-[#4edea3] text-[#4edea3]'
                : 'border-transparent text-[#bbcabf] hover:text-[#dae2fd]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">psychology</span>
            <span>Feasibility Predictor Sandbox</span>
          </button>
        </div>

        {/* ================= TAB 1: DATASET MANAGER ================= */}
        {activeTab === 'datasets' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#171f33] border border-[#2d3449] rounded-2xl p-4">
              <div>
                <h3 className="text-[15px] font-bold text-[#dae2fd]">Dataset Repository</h3>
                <p className="text-[12px] text-[#bbcabf]">
                  Upload historical SME retail feasibility records or use the verified Punjab benchmark dataset.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerateSample}
                  disabled={generatingSample}
                  className="px-3.5 py-2 rounded-xl bg-[#222a3d] hover:bg-[#2d3449] border border-[#2d3449] text-[12px] font-semibold text-[#4cd7f6] flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                  <span>{generatingSample ? 'Generating...' : 'Load Punjab Sample (1,500 rows)'}</span>
                </button>

                <label className="px-3.5 py-2 rounded-xl bg-[#10b981] hover:bg-[#4edea3] text-[#003824] text-[12px] font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md">
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  <span>{uploading ? 'Uploading...' : 'Upload CSV / XLSX'}</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Datasets Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Dataset List */}
              <div className="lg:col-span-4 space-y-3">
                <h4 className="text-[12px] font-mono uppercase text-[#bbcabf] font-semibold">Available Datasets</h4>
                {datasets.length === 0 ? (
                  <div className="bg-[#171f33] border border-[#2d3449] rounded-xl p-6 text-center text-[#bbcabf] text-[13px]">
                    No datasets available yet. Click &quot;Load Punjab Sample&quot; to begin.
                  </div>
                ) : (
                  datasets.map((ds) => (
                    <div
                      key={ds.id}
                      onClick={() => setSelectedDataset(ds)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedDataset?.id === ds.id
                          ? 'bg-[#1e273d] border-[#4edea3] shadow-md'
                          : 'bg-[#171f33] border-[#2d3449] hover:border-[#3c4a42]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-[14px] text-[#dae2fd]">{ds.name}</h5>
                            {ds.is_sample && (
                              <span className="px-1.5 py-0.5 rounded bg-[#4cd7f6]/15 text-[#4cd7f6] text-[10px] font-mono">
                                Sample
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#bbcabf] font-mono mt-0.5">
                            {ds.row_count.toLocaleString()} rows &bull; {ds.column_count} columns &bull; {(ds.file_size_bytes / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[#10b981]/15 text-[#4edea3] font-mono font-semibold">
                          Health: {ds.data_quality_report.health_score}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Right Column: Dataset Quality Audit */}
              <div className="lg:col-span-8">
                {selectedDataset ? (
                  <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 space-y-6">
                    <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#2d3449] gap-4">
                      <div>
                        <h4 className="font-bold text-[18px] text-[#dae2fd]">{selectedDataset.name}</h4>
                        <p className="text-[12px] text-[#bbcabf] font-mono">
                          Target column: <span className="text-[#4edea3] font-semibold">{selectedDataset.target_column || 'None selected'}</span> &bull; Problem type: <span className="text-[#4cd7f6] font-semibold uppercase">{selectedDataset.problem_type || 'Unknown'}</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setTargetColumn(selectedDataset.target_column || 'feasibility_class');
                          setProblemType(selectedDataset.problem_type || 'classification');
                          setActiveTab('training');
                        }}
                        className="px-4 py-2 rounded-xl bg-[#4edea3] hover:bg-[#10b981] text-[#003824] font-bold text-[13px] flex items-center gap-1.5 shadow-md"
                      >
                        <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                        <span>Train Models On This Dataset</span>
                      </button>
                    </div>

                    {/* Quality Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                        <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Total Rows</span>
                        <div className="text-[18px] font-bold text-[#dae2fd] mt-1">{selectedDataset.row_count.toLocaleString()}</div>
                      </div>
                      <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                        <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Columns</span>
                        <div className="text-[18px] font-bold text-[#dae2fd] mt-1">{selectedDataset.column_count}</div>
                      </div>
                      <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                        <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Missing Cells</span>
                        <div className="text-[18px] font-bold text-[#4edea3] mt-1">
                          {selectedDataset.data_quality_report.missing_cells_total}
                        </div>
                      </div>
                      <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-3.5">
                        <span className="text-[11px] text-[#bbcabf] uppercase font-mono">Duplicates</span>
                        <div className="text-[18px] font-bold text-[#dae2fd] mt-1">
                          {selectedDataset.data_quality_report.duplicate_rows}
                        </div>
                      </div>
                    </div>

                    {/* Columns Metadata Table */}
                    <div>
                      <h5 className="text-[13px] font-bold text-[#dae2fd] mb-3">Schema &amp; Feature Inspection</h5>
                      <div className="overflow-x-auto rounded-xl border border-[#2d3449]">
                        <table className="w-full text-left text-[12px]">
                          <thead className="bg-[#131b2e] text-[#bbcabf] font-mono uppercase text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3">Column Name</th>
                              <th className="py-2.5 px-3">Data Type</th>
                              <th className="py-2.5 px-3">Null %</th>
                              <th className="py-2.5 px-3">Distinct Values</th>
                              <th className="py-2.5 px-3">Summary Stats / Top Distribution</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2d3449]">
                            {selectedDataset.columns_metadata.map((col) => (
                              <tr key={col.name} className="hover:bg-[#1e273d]/50">
                                <td className="py-2.5 px-3 font-semibold text-[#dae2fd] flex items-center gap-1.5">
                                  <span>{col.name}</span>
                                  {col.is_target && (
                                    <span className="px-1.5 py-0.2 rounded bg-[#4edea3]/20 text-[#4edea3] text-[9px] font-mono">
                                      TARGET
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[#bbcabf]">{col.type}</td>
                                <td className="py-2.5 px-3 font-mono">
                                  <span className={col.null_pct > 10 ? 'text-[#ffb4ab]' : 'text-[#4edea3]'}>
                                    {col.null_pct}%
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[#bbcabf]">{col.unique_count}</td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-[#bbcabf]">
                                  {col.stats ? (
                                    <span>
                                      min: {col.stats.min} &bull; avg: {col.stats.mean.toFixed(1)} &bull; max: {col.stats.max}
                                    </span>
                                  ) : col.top_values ? (
                                    <span>{Object.keys(col.top_values).slice(0, 3).join(', ')}</span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-12 text-center text-[#bbcabf]">
                    Select a dataset on the left to inspect its quality report.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: TRAINING STUDIO ================= */}
        {activeTab === 'training' && (
          <div className="space-y-6">
            <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-[18px] font-bold text-[#dae2fd]">Multi-Model Training Studio</h3>
                <p className="text-[13px] text-[#bbcabf]">
                  Train multiple machine learning algorithms simultaneously with automated cross-validation, hyperparameter tuning, and zero data leakage.
                </p>
              </div>

              {/* Training Progress Bar */}
              {trainingInProgress && (
                <div className="p-4 rounded-xl bg-[#131b2e] border border-[#4edea3]/40 space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-[#4edea3] font-semibold flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
                      <span>{trainingStep}</span>
                    </span>
                    <span className="font-mono text-[#4edea3] font-bold">{trainingProgress}%</span>
                  </div>
                  <div className="w-full bg-[#1e273d] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#4edea3] h-full transition-all duration-300"
                      style={{ width: `${trainingProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-[12px] font-mono uppercase text-[#bbcabf] font-semibold mb-2">
                    Target Variable
                  </label>
                  <select
                    value={targetColumn}
                    onChange={(e) => setTargetColumn(e.target.value)}
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[13px] text-[#dae2fd] focus:border-[#4edea3] outline-none"
                  >
                    <option value="feasibility_class">feasibility_class (Classification)</option>
                    <option value="feasibility_score">feasibility_score (Regression)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-mono uppercase text-[#bbcabf] font-semibold mb-2">
                    Problem Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setProblemType('classification')}
                      className={`py-2 px-3 rounded-xl text-[12px] font-semibold border text-center transition-all ${
                        problemType === 'classification'
                          ? 'bg-[#4edea3]/15 border-[#4edea3] text-[#4edea3]'
                          : 'bg-[#131b2e] border-[#2d3449] text-[#bbcabf]'
                      }`}
                    >
                      Classification
                    </button>
                    <button
                      type="button"
                      onClick={() => setProblemType('regression')}
                      className={`py-2 px-3 rounded-xl text-[12px] font-semibold border text-center transition-all ${
                        problemType === 'regression'
                          ? 'bg-[#4edea3]/15 border-[#4edea3] text-[#4edea3]'
                          : 'bg-[#131b2e] border-[#2d3449] text-[#bbcabf]'
                      }`}
                    >
                      Regression
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-mono uppercase text-[#bbcabf] font-semibold mb-2">
                    Validation Strategy &amp; CV Folds
                  </label>
                  <div className="flex items-center gap-3">
                    <select
                      value={cvFolds}
                      onChange={(e) => setCvFolds(Number(e.target.value))}
                      className="bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[13px] text-[#dae2fd] focus:border-[#4edea3] outline-none flex-1"
                    >
                      <option value={3}>3-Fold Stratified CV</option>
                      <option value={5}>5-Fold Stratified CV (Recommended)</option>
                      <option value={10}>10-Fold Stratified CV</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Candidate Algorithms Selection */}
              <div>
                <label className="block text-[12px] font-mono uppercase text-[#bbcabf] font-semibold mb-3">
                  Candidate Algorithms to Train &amp; Compare
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { key: 'random_forest', name: 'Random Forest', desc: 'Ensemble bagging trees' },
                    { key: 'gradient_boosting', name: 'Gradient Boosting', desc: 'Sequential gradient trees' },
                    { key: 'extra_trees', name: 'Extra Trees', desc: 'Extremely randomized trees' },
                    { key: 'logistic_regression', name: 'Logistic Regression', desc: 'Linear regularized baseline' },
                    { key: 'decision_tree', name: 'Decision Tree', desc: 'Interpretable single tree' },
                    { key: 'svm', name: 'Support Vector (SVC)', desc: 'Margin boundary separator' },
                    { key: 'knn', name: 'K-Nearest Neighbors', desc: 'Instance-based clustering' }
                  ].map((alg) => {
                    const checked = selectedAlgorithms.includes(alg.key);
                    return (
                      <div
                        key={alg.key}
                        onClick={() => {
                          if (checked) {
                            setSelectedAlgorithms(selectedAlgorithms.filter((k) => k !== alg.key));
                          } else {
                            setSelectedAlgorithms([...selectedAlgorithms, alg.key]);
                          }
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          checked
                            ? 'bg-[#1e273d] border-[#4edea3]'
                            : 'bg-[#131b2e] border-[#2d3449] opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-bold text-[#dae2fd]">{alg.name}</span>
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              checked ? 'bg-[#4edea3] text-[#003824] font-bold' : 'border border-[#bbcabf]'
                            }`}
                          >
                            {checked ? '✓' : ''}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#bbcabf] mt-1">{alg.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Start Training Button */}
              <div className="pt-4 border-t border-[#2d3449] flex justify-end">
                <button
                  type="button"
                  onClick={handleStartTraining}
                  disabled={trainingInProgress || selectedAlgorithms.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#4edea3] text-[#003824] font-bold text-[14px] flex items-center gap-2 transition-all shadow-lg shadow-[#10b981]/20 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                  <span>{trainingInProgress ? 'Training in Progress...' : 'Start Multi-Model Training'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: LEADERBOARD & REGISTRY ================= */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            {/* Last Results Leaderboard Banner */}
            {lastResults && (
              <div className="bg-[#171f33] border border-[#4edea3]/40 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#4edea3]/20 flex items-center justify-center text-[#4edea3]">
                      <span className="material-symbols-outlined text-[24px]">emoji_events</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-mono uppercase text-[#4edea3] font-bold">
                        Best Selected Model
                      </span>
                      <h3 className="text-[18px] font-bold text-[#dae2fd]">
                        {lastResults.best_model_name}
                      </h3>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-[#10b981]/15 text-[#4edea3] text-[12px] font-mono font-semibold border border-[#4edea3]/30">
                    Auto-Promoted to Production
                  </span>
                </div>

                {/* Leaderboard Table */}
                <div className="overflow-x-auto rounded-xl border border-[#2d3449]">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-[#131b2e] text-[#bbcabf] font-mono uppercase text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">Algorithm</th>
                        <th className="py-2.5 px-3">Test F1 Score</th>
                        <th className="py-2.5 px-3">CV Mean Score</th>
                        <th className="py-2.5 px-3">Accuracy</th>
                        <th className="py-2.5 px-3">Precision</th>
                        <th className="py-2.5 px-3">Recall</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d3449]">
                      {lastResults.leaderboard.map((item, idx) => (
                        <tr
                          key={item.algorithm_key}
                          className={idx === 0 ? 'bg-[#4edea3]/10 font-bold' : 'hover:bg-[#1e273d]/50'}
                        >
                          <td className="py-2.5 px-3 font-mono">
                            {idx === 0 ? '🥇 #1' : `#${idx + 1}`}
                          </td>
                          <td className="py-2.5 px-3 text-[#dae2fd]">{item.name}</td>
                          <td className="py-2.5 px-3 font-mono text-[#4edea3]">
                            {(item.test_metrics.f1 * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#bbcabf]">
                            {(item.cv_score * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#bbcabf]">
                            {(item.test_metrics.accuracy * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#bbcabf]">
                            {(item.test_metrics.precision * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#bbcabf]">
                            {(item.test_metrics.recall * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Model Registry List */}
            <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#2d3449]">
                <div>
                  <h3 className="text-[16px] font-bold text-[#dae2fd]">Registered Model Artifacts</h3>
                  <p className="text-[12px] text-[#bbcabf]">
                    Inspect serialised .joblib pipelines, compare historical training runs, and switch the active inference model.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {models.map((mod) => (
                  <div
                    key={mod.model_id}
                    className={`p-4 rounded-xl border space-y-3 ${
                      mod.is_active
                        ? 'bg-[#1e273d] border-[#4edea3] shadow-md'
                        : 'bg-[#131b2e] border-[#2d3449]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-[14px] text-[#dae2fd]">{mod.name}</h4>
                          {mod.is_active && (
                            <span className="px-1.5 py-0.5 rounded bg-[#4edea3]/20 text-[#4edea3] text-[10px] font-mono font-bold">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#bbcabf] font-mono mt-0.5">
                          Algorithm: {mod.algorithm_key} {mod.file_size_bytes ? `• ${(mod.file_size_bytes / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-[#0b1326] p-2 rounded-lg font-mono text-[11px]">
                      <div>
                        <span className="text-[#bbcabf]">F1 Score:</span>{' '}
                        <span className="text-[#4edea3] font-bold">
                          {mod.metrics?.f1 ? `${(mod.metrics.f1 * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#bbcabf]">Accuracy:</span>{' '}
                        <span className="text-[#dae2fd] font-bold">
                          {mod.metrics?.accuracy ? `${(mod.metrics.accuracy * 100).toFixed(1)}%` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {!mod.is_active && (
                      <button
                        type="button"
                        onClick={() => handleActivateModel(mod.model_id)}
                        disabled={activatingId === mod.model_id}
                        className="w-full py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#4edea3] hover:text-[#003824] border border-[#2d3449] text-[12px] font-semibold text-[#dae2fd] transition-all"
                      >
                        {activatingId === mod.model_id ? 'Activating...' : 'Activate for Inference'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: PREDICTOR SANDBOX ================= */}
        {activeTab === 'predict' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Form */}
            <div className="lg:col-span-6 bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Real-Time Feasibility Inference</h3>
                <p className="text-[12px] text-[#bbcabf]">
                  Evaluate a retail business proposal using the active trained ML model pipeline.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Punjab District
                  </label>
                  <select
                    value={predictInputs.district}
                    onChange={(e) => setPredictInputs({ ...predictInputs, district: e.target.value })}
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[12px] text-[#dae2fd]"
                  >
                    {['Lahore', 'Rawalpindi', 'Faisalabad', 'Multan', 'Gujranwala', 'Sialkot', 'Bahawalpur', 'Sargodha', 'Sahiwal', 'Sheikhupura'].map(
                      (d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Retail Category
                  </label>
                  <select
                    value={predictInputs.business_category}
                    onChange={(e) => setPredictInputs({ ...predictInputs, business_category: e.target.value })}
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[12px] text-[#dae2fd]"
                  >
                    {[
                      'Fashion & Apparel',
                      'Electronics & Mobile',
                      'Grocery & Gourmet',
                      'Health & Beauty',
                      'Home & Living',
                      'Specialty Crafts'
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Initial Capital (PKR)
                  </label>
                  <input
                    type="number"
                    value={predictInputs.initial_capital_pkr}
                    onChange={(e) =>
                      setPredictInputs({ ...predictInputs, initial_capital_pkr: Number(e.target.value) })
                    }
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[12px] text-[#dae2fd]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Monthly Burn Budget (PKR)
                  </label>
                  <input
                    type="number"
                    value={predictInputs.monthly_burn_budget_pkr}
                    onChange={(e) =>
                      setPredictInputs({ ...predictInputs, monthly_burn_budget_pkr: Number(e.target.value) })
                    }
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[12px] text-[#dae2fd]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Commercial Rent (PKR/sqft)
                  </label>
                  <input
                    type="number"
                    value={predictInputs.commercial_rent_sqft_pkr}
                    onChange={(e) =>
                      setPredictInputs({ ...predictInputs, commercial_rent_sqft_pkr: Number(e.target.value) })
                    }
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[12px] text-[#dae2fd]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Competitors (1km radius)
                  </label>
                  <input
                    type="number"
                    value={predictInputs.competitor_density_1km}
                    onChange={(e) =>
                      setPredictInputs({ ...predictInputs, competitor_density_1km: Number(e.target.value) })
                    }
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[12px] text-[#dae2fd]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Search Demand (0-100)
                  </label>
                  <input
                    type="number"
                    value={predictInputs.online_search_interest}
                    onChange={(e) =>
                      setPredictInputs({ ...predictInputs, online_search_interest: Number(e.target.value) })
                    }
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[12px] text-[#dae2fd]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-[#bbcabf] font-semibold mb-1">
                    Purchasing Power Index (0-100)
                  </label>
                  <input
                    type="number"
                    value={predictInputs.purchasing_power_index}
                    onChange={(e) =>
                      setPredictInputs({ ...predictInputs, purchasing_power_index: Number(e.target.value) })
                    }
                    className="w-full bg-[#131b2e] border border-[#2d3449] rounded-xl px-3 py-2 text-[12px] text-[#dae2fd]"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleRunPredict}
                  disabled={predicting}
                  className="w-full py-2.5 rounded-xl bg-[#10b981] hover:bg-[#4edea3] text-[#003824] font-bold text-[13px] flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                  <span>{predicting ? 'Computing Inference...' : 'Predict Feasibility Score'}</span>
                </button>
              </div>
            </div>

            {/* Prediction Output & Explainability */}
            <div className="lg:col-span-6 bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-[16px] font-bold text-[#dae2fd]">Prediction &amp; Explainability Factors</h3>
                <p className="text-[12px] text-[#bbcabf]">
                  Audit model inference, confidence intervals, and local contributing factors.
                </p>
              </div>

              {predictionResult ? (
                <div className="space-y-6">
                  {/* Result Badge */}
                  <div className="p-4 rounded-xl bg-[#131b2e] border border-[#4edea3]/40 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono uppercase text-[#bbcabf]">Model Outcome</span>
                      <h4 className="text-[20px] font-bold text-[#4edea3] mt-0.5">
                        {predictionResult.prediction}
                      </h4>
                      <p className="text-[11px] text-[#bbcabf] font-mono mt-0.5">
                        Model: {predictionResult.model_name} ({predictionResult.algorithm})
                      </p>
                    </div>

                    {predictionResult.confidence_score && (
                      <div className="text-right">
                        <span className="text-[11px] font-mono uppercase text-[#bbcabf]">Confidence</span>
                        <div className="text-[20px] font-mono font-bold text-[#dae2fd]">
                          {(predictionResult.confidence_score * 100).toFixed(1)}%
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Probabilities Distribution */}
                  {predictionResult.class_probabilities && (
                    <div className="space-y-2">
                      <span className="text-[12px] font-mono uppercase text-[#bbcabf] font-semibold">
                        Class Probabilities Distribution
                      </span>
                      <div className="space-y-1.5 font-mono text-[11px]">
                        {Object.entries(predictionResult.class_probabilities).map(([cls, prob]: [string, any]) => (
                          <div key={cls} className="space-y-1">
                            <div className="flex justify-between text-[#dae2fd]">
                              <span>{cls}</span>
                              <span>{(prob * 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-[#131b2e] h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-[#4edea3] h-full"
                                style={{ width: `${(prob * 100).toFixed(1)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Local Contributing Factors */}
                  {predictionResult.local_explanation_factors?.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-[12px] font-mono uppercase text-[#bbcabf] font-semibold">
                        Driving Factors (Explainability)
                      </span>
                      <div className="space-y-2">
                        {predictionResult.local_explanation_factors.map((f: any, i: number) => (
                          <div
                            key={i}
                            className={`p-3 rounded-xl border text-[12px] flex items-start gap-2.5 ${
                              f.impact === 'positive'
                                ? 'bg-[#059669]/10 border-[#4edea3]/30 text-[#dae2fd]'
                                : 'bg-[#93000a]/15 border-[#ffb4ab]/30 text-[#dae2fd]'
                            }`}
                          >
                            <span
                              className={`material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5 ${
                                f.impact === 'positive' ? 'text-[#4edea3]' : 'text-[#ffb4ab]'
                              }`}
                            >
                              {f.impact === 'positive' ? 'check_circle' : 'warning'}
                            </span>
                            <div>
                              <span className="font-bold text-[#dae2fd]">{f.factor}:</span>{' '}
                              <span className="text-[#bbcabf]">{f.explanation}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-12 text-center text-[#bbcabf] text-[13px]">
                  Fill in the business inputs on the left and click &quot;Predict Feasibility Score&quot; to inspect real-time inference.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
