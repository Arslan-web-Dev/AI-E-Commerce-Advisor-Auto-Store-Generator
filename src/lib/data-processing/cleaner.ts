import type {
  CompetitorRecord,
  MarketObservation,
  DemandTrendRecord,
  CostEstimateRecord,
  DataProvenance,
} from '@/types/data-collection';
import type { Project } from '@/types/project';
import type {
  DomainCompletenessSummary,
  ProvenanceBreakdown,
  DataCompleteness,
} from '@/types/feature-processing';
import { isUsableDemandTrend } from './trend-validity';

export interface CleanedDataset {
  competitors: CompetitorRecord[];
  population: number | null;
  /** Null when no in-range observation exists; never silently benchmark-filled. */
  internet_penetration_pct: number | null;
  ecommerce_growth_rate_pct: number | null;
  demand_trend: DemandTrendRecord | null;
  /** PKR/sq.ft from a labelled rent_cache record; null means no sourced rent. */
  rent_per_sqft: number | null;
  /** False when the rent cost row is explicitly unavailable or invalid. */
  rent_available: boolean;
  costs: {
    setup: number | null;
    rent_monthly: number | null;
    marketing_initial: number | null;
    logistics_per_order: number | null;
    currency: 'USD' | 'PKR';
  };
  quality_score: number;
  data_completeness: DataCompleteness;
  imputations_count: number;
  domain_completeness: DomainCompletenessSummary;
  provenance_summary: ProvenanceBreakdown;
}

const PKR_TO_USD_RATE = 278;
type TrendProject = Pick<Project, 'city' | 'district' | 'region' | 'lat' | 'lng' | 'target_location'>;

function finiteInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function validCostMidpoint(record: CostEstimateRecord | undefined): number | null {
  if (!record) return null;
  const { amount_min, amount_max } = record;
  if (!finiteInRange(amount_min, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (!finiteInRange(amount_max, 0, Number.MAX_SAFE_INTEGER)) return null;
  if (amount_min > amount_max) return null;
  return (amount_min + amount_max) / 2;
}

export function cleanAndValidateData(
  competitors: CompetitorRecord[],
  observations: MarketObservation[],
  trends: DemandTrendRecord | null,
  costs: CostEstimateRecord[],
  targetCurrency: 'USD' | 'PKR' = 'PKR',
  project: TrendProject | null = null
): CleanedDataset {
  let imputations_count = 0;
  let score = 0;

  // 1. Process Competitors Domain (Max 25 pts)
  const validCompetitors = competitors.filter(
    (c) => typeof c.lat === 'number' && typeof c.lng === 'number' && Boolean(c.name)
  );
  const compMissingFields: string[] = [];
  if (validCompetitors.length === 0) compMissingFields.push('competitors_empty');

  const competitorsQuality = validCompetitors.length > 0 ? 25 : 5;
  score += competitorsQuality;

  // 2. Process Regional Demographics Domain (Max 25 pts)
  const popObs = observations.find((o) => o.metric_name === 'population');
  const netObs = observations.find((o) => o.metric_name === 'internet_penetration_pct');
  const ecomObs = observations.find((o) => o.metric_name === 'ecommerce_growth_rate_pct');

  const demoMissingFields: string[] = [];
  let population: number | null = null;
  if (popObs && finiteInRange(popObs.metric_value, 1, Number.MAX_SAFE_INTEGER)) {
    population = Math.round(popObs.metric_value);
    score += 15;
  } else {
    demoMissingFields.push('population_missing');
  }

  let internet_penetration_pct: number | null = null;
  if (netObs && finiteInRange(netObs.metric_value, 0, 100)) {
    internet_penetration_pct = netObs.metric_value;
    score += 5;
  } else {
    imputations_count++;
    demoMissingFields.push('internet_penetration_unavailable');
  }

  let ecommerce_growth_rate_pct: number | null = null;
  if (ecomObs && finiteInRange(ecomObs.metric_value, 0, 100)) {
    ecommerce_growth_rate_pct = ecomObs.metric_value;
    score += 5;
  } else {
    imputations_count++;
    demoMissingFields.push('ecommerce_growth_unavailable');
  }

  // 3. Process Demand Trends Domain (Max 25 pts). Stale and cross-region
  // observations are retained for audit but score no quality points.
  const trendsMissingFields: string[] = [];
  let trendsQuality = 0;
  const usableTrend = isUsableDemandTrend(trends, project);
  if (usableTrend && trends && trends.trend_series && trends.trend_series.length >= 6) {
    trendsQuality = 25;
  } else if (usableTrend && trends) {
    trendsQuality = 15;
    trendsMissingFields.push('trend_series_short');
  } else if (trends) {
    trendsMissingFields.push('demand_trend_unusable_scope_or_freshness');
  } else {
    trendsMissingFields.push('demand_trend_unavailable');
  }
  score += trendsQuality;

  // 4. Process Costs Domain (Max 25 pts)
  const costsMissingFields: string[] = [];
  const setupRecord = costs.find((c) => c.cost_type === 'setup');
  const rentRecord = costs.find((c) => c.cost_type === 'rent_monthly');
  const mktRecord = costs.find((c) => c.cost_type === 'marketing_initial');
  const logRecord = costs.find((c) => c.cost_type === 'logistics_per_order');

  const setupMidpoint = validCostMidpoint(setupRecord);
  const rentMidpoint = validCostMidpoint(rentRecord);
  const mktMidpoint = validCostMidpoint(mktRecord);
  const logMidpoint = validCostMidpoint(logRecord);

  let costsQuality = 0;
  if (setupMidpoint !== null) costsQuality += 8; else costsMissingFields.push('setup_missing_or_invalid');
  if (rentMidpoint !== null) costsQuality += 9; else costsMissingFields.push('rent_missing_or_invalid');
  if (mktMidpoint !== null) costsQuality += 4; else costsMissingFields.push('marketing_missing_or_invalid');
  if (logMidpoint !== null) costsQuality += 4; else costsMissingFields.push('logistics_missing_or_invalid');
  score += costsQuality;

  // Helper to convert valid cost amounts to the target currency. Invalid and
  // missing amounts stay null; no benchmark is substituted as a local cost.
  const convertAmount = (midpoint: number | null, currency: CostEstimateRecord['currency'] | undefined): number | null => {
    if (midpoint === null || !currency) return null;
    if (currency === targetCurrency) return midpoint;
    if (currency === 'USD' && targetCurrency === 'PKR') return midpoint * PKR_TO_USD_RATE;
    if (currency === 'PKR' && targetCurrency === 'USD') return midpoint / PKR_TO_USD_RATE;
    return null;
  };

  const normalizedCosts = {
    setup: convertAmount(setupMidpoint, setupRecord?.currency),
    rent_monthly: convertAmount(rentMidpoint, rentRecord?.currency),
    marketing_initial: convertAmount(mktMidpoint, mktRecord?.currency),
    logistics_per_order: convertAmount(logMidpoint, logRecord?.currency),
    currency: targetCurrency,
  };

  // Rent provenance must remain explicit. The BenchmarkCostEstimateProvider
  // embeds the sourced PKR/sq.ft value in the rent cost assumptions. Parsing it
  // keeps the feature traceable to rent_cache rather than inventing a rate.
  const rentPerSqftMatch = rentRecord?.assumptions?.match(
    /Rs\.\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*sq\.?\s*ft/i
  );
  const rentPerSqftPkr = rentPerSqftMatch ? Number(rentPerSqftMatch[1]) : null;
  // The parsed cache rate is PKR/sq.ft. Keep the whole feature record in one
  // currency so the UI never labels a PKR number as USD.
  const rentPerSqft =
    rentPerSqftPkr !== null && targetCurrency === 'USD'
      ? rentPerSqftPkr / PKR_TO_USD_RATE
      : rentPerSqftPkr;
  const rentAvailable = Boolean(
    rentMidpoint !== null &&
    rentMidpoint > 0 &&
    rentRecord &&
    rentRecord.freshness !== 'unavailable'
  );

  // Compute Provenance Breakdown
  const provenances: DataProvenance[] = [
    ...competitors.map((c) => c.provenance),
    ...observations.map((o) => o.provenance),
    ...(trends ? [trends.provenance] : []),
    ...costs.map((c) => c.provenance),
  ];

  const breakdown: ProvenanceBreakdown = {
    external_api_count: provenances.filter((p) => p === 'external_api').length,
    synthetic_demo_count: provenances.filter((p) => p === 'synthetic_demo').length,
    licensed_dataset_count: provenances.filter((p) => p === 'licensed_dataset').length,
    manual_estimate_count: provenances.filter((p) => p === 'manual_estimate').length,
    primary_source: provenances.length > 0 ? 'external_api' : 'unavailable',
  };

  const maxProvenance = Math.max(
    breakdown.external_api_count,
    breakdown.synthetic_demo_count,
    breakdown.licensed_dataset_count,
    breakdown.manual_estimate_count
  );

  if (provenances.length === 0) breakdown.primary_source = 'unavailable';
  else if (maxProvenance === breakdown.synthetic_demo_count) breakdown.primary_source = 'synthetic_demo';
  else if (maxProvenance === breakdown.licensed_dataset_count) breakdown.primary_source = 'licensed_dataset';
  else if (maxProvenance === breakdown.manual_estimate_count) breakdown.primary_source = 'manual_estimate';
  else breakdown.primary_source = 'external_api';

  // Overall completeness assessment
  let completeness: DataCompleteness = 'unavailable';
  if (score >= 80 && population !== null) {
    completeness = 'complete';
  } else if (score >= 40) {
    completeness = 'partial';
  }

  const domain_completeness: DomainCompletenessSummary = {
    competitors: {
      available: validCompetitors.length > 0,
      item_count: validCompetitors.length,
      provenance: validCompetitors[0]?.provenance || 'unavailable',
      quality_pct: Math.round((competitorsQuality / 25) * 100),
      missing_fields: compMissingFields,
    },
    regional_stats: {
      available: observations.length > 0,
      item_count: observations.length,
      provenance: popObs?.provenance || 'unavailable',
      quality_pct: Math.round(
        (((population !== null ? 15 : 0) +
          (internet_penetration_pct !== null ? 5 : 0) +
          (ecommerce_growth_rate_pct !== null ? 5 : 0)) / 25) * 100
      ),
      missing_fields: demoMissingFields,
    },
    trends: {
      available: Boolean(trends),
      item_count: trends?.trend_series?.length || 0,
      provenance: trends?.provenance || 'unavailable',
      quality_pct: Math.round((trendsQuality / 25) * 100),
      missing_fields: trendsMissingFields,
    },
    costs: {
      available: costs.length > 0,
      item_count: costs.length,
      provenance: costs[0]?.provenance || 'unavailable',
      quality_pct: Math.round((costsQuality / 25) * 100),
      missing_fields: costsMissingFields,
    },
  };

  // Any missing or invalid cost component was not imputed from a benchmark.
  imputations_count += costsMissingFields.length;

  return {
    competitors: validCompetitors,
    population,
    internet_penetration_pct,
    ecommerce_growth_rate_pct,
    demand_trend: trends,
    rent_per_sqft: rentPerSqft,
    rent_available: rentAvailable,
    costs: normalizedCosts,
    quality_score: Math.min(100, Math.max(0, score)),
    data_completeness: completeness,
    imputations_count,
    domain_completeness,
    provenance_summary: breakdown,
  };
}
