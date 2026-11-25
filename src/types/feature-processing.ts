import type { DataProvenance } from './data-collection';

export type FeatureProcessingStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed';

export type DataCompleteness = 'complete' | 'partial' | 'unavailable';

export interface DeduplicationStats {
  raw_count: number;
  unique_count: number;
  duplicates_removed: number;
}

export interface DomainCompletenessDetail {
  available: boolean;
  item_count: number;
  provenance: DataProvenance | 'unavailable';
  quality_pct: number;
  missing_fields: string[];
}

export interface DomainCompletenessSummary {
  competitors: DomainCompletenessDetail;
  regional_stats: DomainCompletenessDetail;
  trends: DomainCompletenessDetail;
  costs: DomainCompletenessDetail;
}

export interface ProvenanceBreakdown {
  external_api_count: number;
  synthetic_demo_count: number;
  licensed_dataset_count: number;
  manual_estimate_count: number;
  primary_source: DataProvenance | 'unavailable';
}

export interface EngineeredVector {
  // Bounded 0.0 - 1.0 numerical representations for downstream ML consumption (Module 5)
  norm_competitors_density: number;       // Scaled competitor footprint
  norm_category_saturation: number | null;// competitors / population (null if population unknown)
  norm_budget_ratio: number | null;       // user_budget / total_cost clamped [0, 2] -> [0, 1]
  norm_avg_demand: number | null;         // 0.0 - 1.0 from an in-scope 0-100 search index
  trend_slope_score: number | null;       // -1.0 (declining), 0.0 (stable), +1.0 (growing)
  norm_internet_penetration: number | null;// 0.0 - 1.0
  norm_ecommerce_growth: number | null;   // Scaled growth rate
  
  // Categorical encodings
  footprint_scale: number;                // 1 (kiosk), 2 (boutique), 3 (outlet), 4 (flagship)
  channel_type: number;                   // 1 (d2c), 2 (hybrid), 3 (b2b)
}

export interface ProjectFeatureRecord {
  id?: string;
  project_id: string;
  processing_run_id: string;
  competitors_count: number;
  category_saturation: number | null;
  /** Competitors divided by the search area in square kilometres. */
  competitor_density_per_km2: number | null;
  /** Mean of available competitor ratings (0-5); null when none are available. */
  avg_competitor_rating: number | null;
  /** Sourced PKR per square foot; null when no labelled rent record exists. */
  rent_per_sqft: number | null;
  /** Monthly rent in the feature currency; null when rent is unavailable. */
  estimated_monthly_rent: number | null;
  /** Legacy annual budget/cost ratio retained for the v1.0 MCDA index. */
  budget_ratio: number | null;
  rent_to_budget_ratio: number | null;
  budget_to_setup_cost_ratio: number | null;
  demand_score: number | null;
  /** Competitors per 100,000 residents; null when population is unavailable. */
  saturation_index: number | null;
  avg_demand_index: number | null;
  trend_slope: 'growing' | 'stable' | 'declining' | null;
  trend_slope_score: number | null;
  population: number | null;
  internet_penetration_pct: number | null;
  ecommerce_growth_rate_pct: number | null;
  total_estimated_setup_cost: number | null;
  total_estimated_monthly_cost: number | null;
  total_estimated_annual_cost: number | null;
  user_budget: number | null;
  currency: string;
  engineered_vector: EngineeredVector;
  feature_version: string;
  created_at: string;
}

export interface ProcessingRunRecord {
  id: string;
  project_id: string;
  collection_run_id: string | null;
  status: FeatureProcessingStatus;
  quality_score: number;
  data_completeness: DataCompleteness;
  imputations_count: number;
  deduplication_stats: DeduplicationStats;
  domain_completeness: DomainCompletenessSummary;
  provenance_summary: ProvenanceBreakdown;
  error_log?: string | null;
  started_at: string;
  completed_at?: string | null;
  created_at: string;
}

export interface FeatureProcessingResult {
  run: ProcessingRunRecord;
  features: ProjectFeatureRecord;
}
