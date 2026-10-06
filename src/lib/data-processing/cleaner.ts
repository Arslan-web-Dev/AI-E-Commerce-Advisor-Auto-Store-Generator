import {
  CompetitorRecord,
  MarketObservation,
  DemandTrendRecord,
  CostEstimateRecord,
  DataProvenance,
} from '@/types/data-collection';
import {
  DomainCompletenessSummary,
  ProvenanceBreakdown,
  DataCompleteness,
} from '@/types/feature-processing';

export interface CleanedDataset {
  competitors: CompetitorRecord[];
  population: number | null;
  internet_penetration_pct: number;
  ecommerce_growth_rate_pct: number;
  demand_trend: DemandTrendRecord | null;
  costs: {
    setup: number;
    rent_monthly: number;
    marketing_initial: number;
    logistics_per_order: number;
    currency: 'USD' | 'PKR';
  };
  quality_score: number;
  data_completeness: DataCompleteness;
  imputations_count: number;
  domain_completeness: DomainCompletenessSummary;
  provenance_summary: ProvenanceBreakdown;
}

const DEFAULT_INTERNET_PENETRATION = 54.3; // PBS / PTA Pakistan Benchmark
const DEFAULT_ECOMMERCE_GROWTH = 18.5;     // State Bank / Commerce Ministry Benchmark
const PKR_TO_USD_RATE = 278;

export function cleanAndValidateData(
  competitors: CompetitorRecord[],
  observations: MarketObservation[],
  trends: DemandTrendRecord | null,
  costs: CostEstimateRecord[],
  targetCurrency: 'USD' | 'PKR' = 'PKR'
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
  if (popObs && popObs.metric_value > 0) {
    population = Math.round(popObs.metric_value);
    score += 15;
  } else {
    demoMissingFields.push('population_missing');
  }

  let internet_penetration_pct: number;
  if (netObs && netObs.metric_value > 0) {
    internet_penetration_pct = Number(netObs.metric_value);
    score += 5;
  } else {
    internet_penetration_pct = DEFAULT_INTERNET_PENETRATION;
    imputations_count++;
    demoMissingFields.push('internet_penetration_imputed');
  }

  let ecommerce_growth_rate_pct: number;
  if (ecomObs && ecomObs.metric_value > 0) {
    ecommerce_growth_rate_pct = Number(ecomObs.metric_value);
    score += 5;
  } else {
    ecommerce_growth_rate_pct = DEFAULT_ECOMMERCE_GROWTH;
    imputations_count++;
    demoMissingFields.push('ecommerce_growth_imputed');
  }

  // 3. Process Demand Trends Domain (Max 25 pts)
  const trendsMissingFields: string[] = [];
  let trendsQuality = 0;
  if (trends && trends.trend_series && trends.trend_series.length >= 6) {
    trendsQuality = 25;
  } else if (trends) {
    trendsQuality = 15;
    trendsMissingFields.push('trend_series_short');
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

  let costsQuality = 0;
  if (setupRecord) costsQuality += 8; else costsMissingFields.push('setup_missing');
  if (rentRecord) costsQuality += 9; else costsMissingFields.push('rent_missing');
  if (mktRecord) costsQuality += 4; else costsMissingFields.push('marketing_missing');
  if (logRecord) costsQuality += 4; else costsMissingFields.push('logistics_missing');
  score += costsQuality;

  // Helper to convert cost amounts to target currency
  const convertAmount = (rec?: CostEstimateRecord, fallbackDefault = 0): number => {
    if (!rec) {
      imputations_count++;
      return fallbackDefault;
    }
    const val = (rec.amount_min + rec.amount_max) / 2;
    if (rec.currency === targetCurrency) return val;
    if (rec.currency === 'USD' && targetCurrency === 'PKR') return val * PKR_TO_USD_RATE;
    if (rec.currency === 'PKR' && targetCurrency === 'USD') return val / PKR_TO_USD_RATE;
    return val;
  };

  const defaultSetup = targetCurrency === 'PKR' ? 350000 : 1250;
  const defaultRent = targetCurrency === 'PKR' ? 120000 : 450;
  const defaultMkt = targetCurrency === 'PKR' ? 80000 : 300;
  const defaultLog = targetCurrency === 'PKR' ? 350 : 1.5;

  const normalizedCosts = {
    setup: convertAmount(setupRecord, defaultSetup),
    rent_monthly: convertAmount(rentRecord, defaultRent),
    marketing_initial: convertAmount(mktRecord, defaultMkt),
    logistics_per_order: convertAmount(logRecord, defaultLog),
    currency: targetCurrency,
  };

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
    primary_source: 'external_api',
  };

  const maxProvenance = Math.max(
    breakdown.external_api_count,
    breakdown.synthetic_demo_count,
    breakdown.licensed_dataset_count,
    breakdown.manual_estimate_count
  );

  if (maxProvenance === breakdown.synthetic_demo_count) breakdown.primary_source = 'synthetic_demo';
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
      provenance: validCompetitors[0]?.provenance || 'synthetic_demo',
      quality_pct: Math.round((competitorsQuality / 25) * 100),
      missing_fields: compMissingFields,
    },
    regional_stats: {
      available: observations.length > 0,
      item_count: observations.length,
      provenance: popObs?.provenance || 'licensed_dataset',
      quality_pct: Math.round((((population ? 15 : 0) + 10) / 25) * 100),
      missing_fields: demoMissingFields,
    },
    trends: {
      available: Boolean(trends),
      item_count: trends?.trend_series?.length || 0,
      provenance: trends?.provenance || 'synthetic_demo',
      quality_pct: Math.round((trendsQuality / 25) * 100),
      missing_fields: trendsMissingFields,
    },
    costs: {
      available: costs.length > 0,
      item_count: costs.length,
      provenance: costs[0]?.provenance || 'manual_estimate',
      quality_pct: Math.round((costsQuality / 25) * 100),
      missing_fields: costsMissingFields,
    },
  };

  return {
    competitors: validCompetitors,
    population,
    internet_penetration_pct,
    ecommerce_growth_rate_pct,
    demand_trend: trends,
    costs: normalizedCosts,
    quality_score: Math.min(100, Math.max(0, score)),
    data_completeness: completeness,
    imputations_count,
    domain_completeness,
    provenance_summary: breakdown,
  };
}
