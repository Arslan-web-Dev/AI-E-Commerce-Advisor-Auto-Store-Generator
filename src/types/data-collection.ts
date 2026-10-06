export type DataProvenance =
  | 'external_api'
  | 'synthetic_demo'
  | 'licensed_dataset'
  | 'manual_estimate';

export type ProviderRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'unavailable';

export interface CompetitorRecord {
  id?: string;
  project_id: string;
  run_id?: string;
  name: string;
  category: string;
  provider: string;
  provenance: DataProvenance;
  lat: number;
  lng: number;
  distance_km: number;
  rating?: number;
  review_count?: number;
  price_level?: string;
  address?: string;
  raw_data?: Record<string, unknown>;
  retrieved_at: string;
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
  retrieved_at: string;
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
  retrieved_at: string;
}

export interface ProviderStatusDetail {
  status: ProviderRunStatus;
  provider: string;
  provenance: DataProvenance;
  item_count: number;
  error?: string;
  latency_ms?: number;
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
  footprint: string;
  budgetAmount: number;
  budgetCurrency: 'USD' | 'PKR';
}

export interface ICostEstimateProvider {
  name: string;
  provenance: DataProvenance;
  getCostEstimates(input: CostEstimateQueryInput): Promise<CostEstimateRecord[]>;
}
