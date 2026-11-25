export type DataProvenance =
  | 'external_api'
  | 'synthetic_demo'
  | 'licensed_dataset'
  | 'manual_estimate';

/**
 * How the observation was obtained relative to a live request.
 * Never conflate synthetic/estimated values with live market observations.
 */
export type DataFreshness =
  | 'live'
  | 'cached'
  | 'stale_cache'
  | 'verified_benchmark'
  | 'manual_estimate'
  | 'synthetic_demo'
  | 'unavailable';

export type ProviderRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'unavailable';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export type RentMatchLevel = 'exact' | 'nearby' | 'city' | 'district' | 'estimated' | 'unavailable';

export interface CompetitorRecord {
  id?: string;
  project_id: string;
  run_id?: string;
  name: string;
  category: string;
  provider: string;
  provenance: DataProvenance;
  freshness?: DataFreshness;
  lat: number;
  lng: number;
  distance_km: number;
  rating?: number;
  review_count?: number;
  price_level?: string;
  address?: string;
  raw_data?: Record<string, unknown>;
  retrieved_at: string;
  cache_retrieved_at?: string;
  attribution?: string;
}

export interface MarketObservation {
  id?: string;
  project_id: string;
  run_id?: string;
  metric_name: 'population' | 'internet_penetration_pct' | 'ecommerce_growth_rate_pct' | string;
  metric_value: number;
  unit: 'count' | 'percentage' | 'index' | string;
  geography: string;
  period_year: number;
  provider: string;
  provenance: DataProvenance;
  freshness?: DataFreshness;
  source_citation?: string;
  retrieved_at: string;
}

export interface DemandTrendPoint {
  month: string; // e.g. "2025-10"
  index: number; // 0-100 relative search interest
}

export interface DemandTrendRecord {
  id?: string;
  project_id: string;
  run_id?: string;
  category: string;
  region: string;
  trend_series: DemandTrendPoint[];
  avg_interest: number;
  trend_slope: 'growing' | 'stable' | 'declining';
  provider: string;
  provenance: DataProvenance;
  freshness?: DataFreshness;
  requested_geo_scope?: string;
  actual_geo_scope?: string;
  retrieved_at: string;
  cache_retrieved_at?: string;
  is_stale?: boolean;
}

export interface CostEstimateRecord {
  id?: string;
  project_id: string;
  run_id?: string;
  cost_type: 'setup' | 'rent_monthly' | 'marketing_initial' | 'logistics_per_order';
  amount_min: number;
  amount_max: number;
  currency: 'USD' | 'PKR';
  period_or_unit: 'one-time' | 'per_month' | 'per_order';
  assumptions?: string;
  provider: string;
  provenance: DataProvenance;
  freshness?: DataFreshness;
  retrieved_at: string;
}

export interface RentLookupResult {
  status: 'found' | 'unavailable';
  match_level: RentMatchLevel;
  requested_geography: {
    city?: string;
    area?: string;
    district?: string;
    province?: string;
    lat?: number;
    lng?: number;
  };
  source_geography: {
    city?: string;
    area?: string;
    district?: string;
    province?: string;
    lat?: number;
    lng?: number;
  } | null;
  distance_km?: number;
  rent_per_sqft_pkr?: number;
  rent_min_pkr?: number;
  rent_max_pkr?: number;
  rent_avg_pkr?: number;
  currency: 'PKR';
  sample_size?: number;
  source?: string;
  provenance: DataProvenance | 'unavailable';
  freshness: DataFreshness;
  confidence: ConfidenceLevel;
  retrieved_at?: string;
  notes?: string;
}

export interface ProviderStatusDetail {
  status: ProviderRunStatus;
  provider: string;
  provenance: DataProvenance;
  freshness?: DataFreshness;
  item_count: number;
  error?: string;
  warning?: string;
  latency_ms?: number;
  requested_geo_scope?: string;
  actual_geo_scope?: string;
  retrieved_at?: string;
  cache_retrieved_at?: string;
  confidence?: ConfidenceLevel;
  attribution?: string;
}

/**
 * Consistent typed result envelope returned by every Module 3 provider path.
 */
export interface TypedProviderResult<T> {
  provider: string;
  status: ProviderRunStatus;
  provenance: DataProvenance;
  freshness: DataFreshness;
  requested_geo_scope: string;
  actual_geo_scope: string;
  retrieved_at: string;
  cache_retrieved_at?: string;
  item_count: number;
  latency_ms: number;
  confidence: ConfidenceLevel;
  error?: string;
  warning?: string;
  attribution?: string;
  data: T | null;
}

export interface CollectionRun {
  id: string;
  project_id: string;
  status: ProviderRunStatus;
  providers_status: {
    competitors?: ProviderStatusDetail;
    regional_stats?: ProviderStatusDetail;
    trends?: ProviderStatusDetail;
    costs?: ProviderStatusDetail;
  };
  started_at: string;
  completed_at?: string;
  created_at: string;
}

// Provider Interfaces
export interface CompetitorQueryInput {
  category: string;
  lat: number;
  lng: number;
  radiusKm: number;
  city?: string;
}

export interface ICompetitorProvider {
  name: string;
  provenance: DataProvenance;
  getCompetitors(input: CompetitorQueryInput): Promise<CompetitorRecord[]>;
}

export interface RegionalQueryInput {
  city: string;
  region?: string;
  country?: string;
}

export interface IRegionalStatsProvider {
  name: string;
  provenance: DataProvenance;
  getRegionalStats(input: RegionalQueryInput): Promise<MarketObservation[]>;
}

export interface DemandTrendQueryInput {
  category: string;
  region: string;
}

export interface IDemandTrendProvider {
  name: string;
  provenance: DataProvenance;
  getDemandTrends(input: DemandTrendQueryInput): Promise<DemandTrendRecord>;
}

export interface CostEstimateQueryInput {
  category: string;
  city: string;
  area?: string;
  district?: string;
  province?: string;
  lat?: number;
  lng?: number;
  footprint: string;
  budgetAmount: number;
  budgetCurrency: 'USD' | 'PKR';
}

export interface ICostEstimateProvider {
  name: string;
  provenance: DataProvenance;
  getCostEstimates(input: CostEstimateQueryInput): Promise<CostEstimateRecord[]>;
}

/**
 * Thrown by a provider when the requested geography has **no verified coverage**
 * and no legitimate substitute exists.
 *
 * Providers must throw this instead of substituting another region's data (for
 * example Punjab benchmarks / Lahore coordinates / Punjab seasonal trends for a
 * non-Punjab location). The data-collection orchestrator maps it to a
 * `ProviderRunStatus` of `'unavailable'` — distinct from `'failed'` — so the UI
 * can honestly label the gap instead of showing fabricated local evidence.
 */
export class CoverageUnavailableError extends Error {
  readonly code = 'coverage_unavailable';

  constructor(message: string) {
    super(message);
    this.name = 'CoverageUnavailableError';
  }
}
