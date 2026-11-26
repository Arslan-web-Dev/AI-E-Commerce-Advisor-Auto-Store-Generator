/**
 * ML & Punjab Market Intelligence Service Client
 * Provides resilient communication with the local Python FastAPI ML microservice.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

const DISALLOWED_DEFAULT_SECRETS = new Set([
  'internal-dev-ml-secret-key-2026',
  'change-me',
  'secret',
  'placeholder',
  'your-ml-api-key-here',
  'your-secure-ml-service-api-key-here',
  '123456',
]);

function getMlApiKey(): string {
  const key = process.env.ML_SERVICE_API_KEY?.trim() || '';
  if (!key) {
    throw new Error(
      'FAIL-CLOSED SECURITY ERROR: ML_SERVICE_API_KEY is not configured. ' +
      'Please configure a secure ML_SERVICE_API_KEY in your environment.'
    );
  }
  if (DISALLOWED_DEFAULT_SECRETS.has(key.toLowerCase())) {
    // Never echo the configured value back into logs or client-visible errors.
    throw new Error(
      'FAIL-CLOSED SECURITY ERROR: ML_SERVICE_API_KEY uses a known default placeholder. ' +
      'Please configure a secure, unique key in your environment.'
    );
  }
  return key;
}

export interface DatasetInfo {
  id: string;
  name: string;
  file_name: string;
  file_path: string;
  file_size_bytes: number;
  row_count: number;
  column_count: number;
  target_column: string | null;
  problem_type: 'classification' | 'regression' | null;
  columns_metadata: Array<{
    name: string;
    type: string;
    null_count: number;
    null_pct: number;
    unique_count: number;
    is_target: boolean;
    stats?: { min: number; max: number; mean: number; median: number; std: number };
    top_values?: Record<string, number>;
  }>;
  data_quality_report: {
    missing_cells_total: number;
    duplicate_rows: number;
    warnings: string[];
    health_score: number;
    target_analysis?: Record<string, unknown>;
    schema_validation?: Record<string, unknown> | null;
  };
  is_sample: boolean;
  data_source?: string;
  dataset_fingerprint?: string | null;
  dataset_version?: string | null;
  schema_version?: string | null;
  dataset_provenance?: Record<string, unknown>;
}

export interface CandidateSpec {
  name: string;
  description: string;
  family: string;
  library: string;
  library_version: string | null;
  hyperparameter_summary?: Record<string, unknown>;
  params: Record<string, unknown>;
  supports_class_weight: boolean;
  needs_sample_weight: boolean;
  uses_scale_pos_weight?: boolean;
  needs_label_encoding?: boolean;
  random_state: number;
  eligible: boolean;
  ineligibility_reason: string | null;
}

export interface TrainingJobRequest {
  dataset_id: string;
  target_column: string;
  problem_type: 'classification' | 'regression';
  candidate_algorithms?: string[];
  validation_strategy?: string;
  cv_folds?: number;
  test_size?: number;
}

export interface TrainingJobResponse {
  job_id: string;
  dataset_id: string;
  target_column: string;
  problem_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress_pct: number;
  current_step: string;
  best_model_id?: string | null;
  error_message?: string | null;
  storage_note?: string;
  results?: {
    best_model_id?: string;
    best_model_name?: string;
    best_algorithm?: string;
    artifact_version?: string;
    artifact_path?: string;
    comparison_report_path?: string;
    feature_columns?: string[];
    feature_schema_version?: string;
    training_mode?: 'production' | 'experimental_sandbox';
    approved_for_production?: boolean;
    label_approval_status?: 'BLOCKED' | 'APPROVED';
    leaderboard?: Array<{ algorithm_key: string; cv_score: number; rank_score: number; [key: string]: unknown }>;
    test_metrics?: Record<string, unknown>;
    cv_metrics?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ModelLeaderboardEntry {
  algorithm_key: string;
  name: string;
  description: string;
  rank_score: number;
  cv_score: number;
  test_metrics: Record<string, unknown>;
  hyperparameters: Record<string, unknown>;
}

export interface RegisteredModelSummary {
  model_id: string;
  name: string;
  algorithm_key: string;
  problem_type: string;
  target_col: string;
  metrics: Record<string, unknown>;
  is_active: boolean;
  file_size_bytes: number;
  file_name: string;
  artifact_version?: string | null;
  artifact_schema_version?: string | null;
  feature_schema_version?: string | null;
  cv_metrics?: Record<string, unknown>;
  label_approval_status?: 'BLOCKED' | 'APPROVED';
  training_mode?: 'production' | 'experimental_sandbox';
  approved_for_production?: boolean;
  dataset_fingerprint?: string | null;
  dataset_ref?: string | null;
  comparison_report_path?: string | null;
  serving_ready?: boolean;
}

export interface PredictionFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  strength: 'high' | 'medium' | 'low';
  explanation: string;
  method?: 'documented_rule_context' | 'disclosure';
  global_importance?: number;
}

export interface PredictionResponse {
  model_id: string;
  model_name: string;
  algorithm: string;
  problem_type: string;
  prediction: string | number;
  feasibility_score?: number | null;
  risk_level?: 'low' | 'moderate' | 'high' | 'critical' | null;
  confidence_score: number | null;
  class_probabilities: Record<string, number>;
  local_explanation_factors: PredictionFactor[];
  top_global_drivers: Array<{ feature: string; importance: number; raw_weight: number }>;
  artifact_version?: string | null;
  feature_schema_version?: string | null;
  threshold_version?: string;
  label_approval_status?: 'BLOCKED' | 'APPROVED';
  artifact_threshold_version?: string;
  serving_ready?: boolean;
  sandbox_only?: boolean;
  project_report_persisted?: boolean;
  disclaimer?: string;
}

export interface TrainingPolicyResponse {
  label_policy: {
    status: 'BLOCKED' | 'APPROVED';
    oi_id: string;
    reason: string;
    documented_proposal: string;
    oi6_validation?: {
      approved: boolean;
      reasons: string[];
      approved_by: string | null;
      approved_at: string | null;
      evidence_reference: string | null;
    };
  };
  approved_categories: string[];
  candidates: {
    classification: Record<string, CandidateSpec>;
    regression: Record<string, CandidateSpec>;
  };
  ineligible_candidates: Record<string, { problem_type: string; reason: string }>;
  xgboost: { available: boolean; version: string | null; required_by: string };
  feature_schema_version: string;
  random_seed: number;
  job_storage: string;
  risk_thresholds: {
    version: string;
    low_risk_min: number;
    moderate_risk_min: number;
    high_risk_min: number;
  };
  limited_data_disclaimer: string;
}

export interface GoogleTrendsResult {
  source: 'live_google_trends' | 'empirical_market_baseline';
  geo: string;
  timeframe: string;
  keywords: string[];
  interest_over_time: Array<Record<string, unknown>>;
  related_queries: Record<string, { top: unknown[]; rising: unknown[] }>;
  analytics: Record<string, {
    average_interest: number;
    trend_slope: number;
    trend_direction: 'rising' | 'falling' | 'stable' | 'rapidly_rising' | 'rapidly_falling';
    peak_month: string;
    peak_value: number;
    latest_value: number;
  }>;
  is_cached: boolean;
  /** True when a previously cached payload is returned after its TTL expired because live retrieval failed. */
  is_stale?: boolean;
  fetched_at: string;
}

export interface MarketDemandAnalysisResult {
  primary_keyword: string;
  geo: string;
  composite_demand_index: number;
  status: 'favorable' | 'moderate' | 'challenging';
  recommendation: string;
  search_momentum: {
    average_interest: number;
    trend_slope: number;
    trend_direction: string;
    peak_season: string;
  };
  score_breakdown: {
    search_score: number;
    demographic_score: number;
    market_room_score: number;
  };
  trends_data: GoogleTrendsResult;
}

async function requestML<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${ML_SERVICE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        // The trusted key is applied last so a caller cannot override it.
        'x-api-key': getMlApiKey(),
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      let errDetail = res.statusText;
      try {
        const errJson = await res.json();
        errDetail = errJson.detail || errJson.message || errDetail;
      } catch {
        // use default statusText
      }
      throw new Error(`ML Service Error (${res.status}): ${errDetail}`);
    }

    return await res.json() as T;
  } catch (err: unknown) {
    const errorObj = err as { cause?: { code?: string }; message?: string };
    if (errorObj?.cause?.code === 'ECONNREFUSED' || errorObj?.message?.includes('fetch failed')) {
      throw new Error(
        `Python ML Service unreachable at ${ML_SERVICE_URL}. Please ensure the ML service process is running (uvicorn main:app).`
      );
    }
    throw err;
  }
}

export const mlClient = {
  async getHealth() {
    return requestML<{
      status: string;
      active_model_id: string | null;
      datasets_count: number;
      artifact_count: number;
      label_approval_status: 'BLOCKED' | 'APPROVED';
    }>('/');
  },

  async getTrainingPolicy(): Promise<TrainingPolicyResponse> {
    return requestML<TrainingPolicyResponse>('/training-policy');
  },

  async listDatasets(): Promise<DatasetInfo[]> {
    return requestML<DatasetInfo[]>('/datasets');
  },

  async getDataset(id: string): Promise<DatasetInfo> {
    return requestML<DatasetInfo>(`/datasets/${id}`);
  },

  async generateSampleDataset(options: {
    num_samples?: number;
    random_seed?: number;
    missing_rate?: number;
  } = {}): Promise<DatasetInfo> {
    const form = new FormData();
    form.append('num_samples', String(options.num_samples ?? 5000));
    form.append('random_seed', String(options.random_seed ?? 42));
    form.append('missing_rate', String(options.missing_rate ?? 0.01));
    return requestML<DatasetInfo>('/datasets/generate-sample', { method: 'POST', body: form });
  },

  async uploadDataset(formData: FormData): Promise<DatasetInfo> {
    const url = `${ML_SERVICE_URL}/datasets/upload`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'x-api-key': getMlApiKey(),
      },
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || 'Dataset upload failed.');
    }
    return res.json();
  },

  async startTraining(payload: TrainingJobRequest): Promise<TrainingJobResponse> {
    return requestML<TrainingJobResponse>('/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getTrainingJob(jobId: string): Promise<TrainingJobResponse> {
    return requestML<TrainingJobResponse>(`/train/${jobId}`);
  },

  async listTrainingJobs(): Promise<{ jobs: TrainingJobResponse[]; storage_note: string }> {
    return requestML<{ jobs: TrainingJobResponse[]; storage_note: string }>('/jobs');
  },

  async listModels(): Promise<RegisteredModelSummary[]> {
    return requestML<RegisteredModelSummary[]>('/models');
  },

  async getModelDetails(modelId: string) {
    return requestML<Record<string, unknown>>(`/models/${modelId}`);
  },

  async activateModel(modelId: string) {
    return requestML<{ status: string; active_model_id: string; model_name: string }>(`/models/${modelId}/activate`, {
      method: 'POST',
    });
  },

  async predict(
    inputFeatures: Record<string, unknown>,
    modelId?: string,
    thresholds?: {
      version: string;
      low_risk_min: number;
      moderate_risk_min: number;
      high_risk_min: number;
    },
    featureSchemaVersion?: string
  ): Promise<PredictionResponse> {
    return requestML<PredictionResponse>('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: modelId,
        input_features: inputFeatures,
        // The Next.js route passes the live, admin-versioned contract so the
        // Python scorer applies the same bands as project reports.
        risk_thresholds: thresholds,
        feature_schema_version: featureSchemaVersion,
      }),
    });
  },

  async getTrends(keywords: string[], geo: string = 'PK', timeframe: string = 'today 12-m'): Promise<GoogleTrendsResult> {
    const kwParam = encodeURIComponent(keywords.join(','));
    const geoParam = encodeURIComponent(geo);
    const tfParam = encodeURIComponent(timeframe);
    return requestML<GoogleTrendsResult>(`/market/trends?keywords=${kwParam}&geo=${geoParam}&timeframe=${tfParam}`);
  },

  async getMarketDemandAnalysis(
    primaryKeyword: string,
    district: string,
    comparisonKeywords?: string[],
    districtData?: Record<string, unknown>
  ): Promise<MarketDemandAnalysisResult> {
    return requestML<MarketDemandAnalysisResult>('/market/demand-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primary_keyword: primaryKeyword,
        district,
        comparison_keywords: comparisonKeywords,
        district_data: districtData,
      }),
    });
  },
};
