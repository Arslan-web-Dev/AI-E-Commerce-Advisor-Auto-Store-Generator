/**
 * ML & Punjab Market Intelligence Service Client
 * Provides resilient communication with the local Python FastAPI ML microservice.
 */

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
const ML_SERVICE_API_KEY = process.env.ML_SERVICE_API_KEY || 'internal-dev-ml-secret-key-2026';

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
    target_analysis?: any;
  };
  is_sample: boolean;
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

export interface ModelLeaderboardEntry {
  algorithm_key: string;
  name: string;
  description: string;
  rank_score: number;
  cv_score: number;
  test_metrics: Record<string, any>;
  hyperparameters: Record<string, any>;
}

export interface RegisteredModelSummary {
  model_id: string;
  name: string;
  algorithm_key: string;
  problem_type: string;
  target_col: string;
  metrics: Record<string, any>;
  is_active: boolean;
  file_size_bytes: number;
  file_name: string;
}

export interface PredictionFactor {
  factor: string;
  impact: 'positive' | 'negative';
  strength: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface PredictionResponse {
  model_id: string;
  model_name: string;
  algorithm: string;
  problem_type: string;
  prediction: string | number;
  confidence_score: number | null;
  class_probabilities: Record<string, number>;
  local_explanation_factors: PredictionFactor[];
  top_global_drivers: Array<{ feature: string; importance: number; raw_weight: number }>;
}

export interface GoogleTrendsResult {
  source: 'live_google_trends' | 'empirical_market_baseline';
  geo: string;
  timeframe: string;
  keywords: string[];
  interest_over_time: Array<Record<string, any>>;
  related_queries: Record<string, { top: any[]; rising: any[] }>;
  analytics: Record<string, {
    average_interest: number;
    trend_slope: number;
    trend_direction: 'rising' | 'falling' | 'stable' | 'rapidly_rising' | 'rapidly_falling';
    peak_month: string;
    peak_value: number;
    latest_value: number;
  }>;
  is_cached: boolean;
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
        'x-api-key': ML_SERVICE_API_KEY,
        ...options.headers,
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
  } catch (err: any) {
    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
      throw new Error(
        `Python ML Service unreachable at ${ML_SERVICE_URL}. Please ensure the ML service process is running (uvicorn main:app).`
      );
    }
    throw err;
  }
}

export const mlClient = {
  async getHealth() {
    return requestML<{ status: string; active_model_id: string | null; datasets_count: number; artifacts_count: number }>('/');
  },

  async listDatasets(): Promise<DatasetInfo[]> {
    return requestML<DatasetInfo[]>('/datasets');
  },

  async getDataset(id: string): Promise<DatasetInfo> {
    return requestML<DatasetInfo>(`/datasets/${id}`);
  },

  async generateSampleDataset(): Promise<DatasetInfo> {
    return requestML<DatasetInfo>('/datasets/generate-sample', { method: 'POST' });
  },

  async uploadDataset(formData: FormData): Promise<DatasetInfo> {
    const url = `${ML_SERVICE_URL}/datasets/upload`;
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        'x-api-key': ML_SERVICE_API_KEY,
      },
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || 'Dataset upload failed.');
    }
    return res.json();
  },

  async startTraining(payload: TrainingJobRequest) {
    return requestML<any>('/train', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getTrainingJob(jobId: string) {
    return requestML<any>(`/train/${jobId}`);
  },

  async listModels(): Promise<RegisteredModelSummary[]> {
    return requestML<RegisteredModelSummary[]>('/models');
  },

  async getModelDetails(modelId: string) {
    return requestML<any>(`/models/${modelId}`);
  },

  async activateModel(modelId: string) {
    return requestML<{ status: string; active_model_id: string; model_name: string }>(`/models/${modelId}/activate`, {
      method: 'POST',
    });
  },

  async predict(inputFeatures: Record<string, any>, modelId?: string): Promise<PredictionResponse> {
    return requestML<PredictionResponse>('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: modelId,
        input_features: inputFeatures,
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
    districtData?: Record<string, any>
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
