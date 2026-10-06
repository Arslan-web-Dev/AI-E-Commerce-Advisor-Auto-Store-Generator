import { Project } from '@/types/project';
import { CleanedDataset } from './cleaner';
import { ProjectFeatureRecord, EngineeredVector } from '@/types/feature-processing';

export function engineerFeatures(
  project: Project,
  dataset: CleanedDataset,
  runId: string
): ProjectFeatureRecord {
  const { competitors, population, internet_penetration_pct, ecommerce_growth_rate_pct, demand_trend, costs } = dataset;

  // 1. Competitors Count (FR-4.1)
  const competitors_count = competitors.length;

  // 2. Category Saturation (FR-4.1: competitors_count / population)
  // If population is null, zero or geography is incompatible, must be strictly null
  let category_saturation: number | null = null;
  if (population !== null && population > 0) {
    category_saturation = Number((competitors_count / population).toFixed(8));
  }

  // 3. Cost Calculations
  const setup_cost = costs.setup;
  const monthly_cost = costs.rent_monthly;
  const annual_cost = setup_cost + monthly_cost * 12 + costs.marketing_initial;

  // 4. Budget Ratio (FR-4.1: user_budget / estimated_total_cost)
  // Ensure user budget is in the same currency as costs
  let user_budget = project.budget_amount;
  if (project.budget_currency !== costs.currency) {
    if (project.budget_currency === 'USD' && costs.currency === 'PKR') {
      user_budget = user_budget * 278;
    } else if (project.budget_currency === 'PKR' && costs.currency === 'USD') {
      user_budget = user_budget / 278;
    }
  }

  let budget_ratio: number | null = null;
  if (annual_cost > 0 && user_budget > 0) {
    budget_ratio = Number((user_budget / annual_cost).toFixed(4));
  }

  // 5. Demand Trend Features
  let avg_demand_index: number | null = null;
  let trend_slope: 'growing' | 'stable' | 'declining' | null = null;
  let trend_slope_score: number | null = null;

  if (demand_trend) {
    avg_demand_index = demand_trend.avg_interest;
    trend_slope = demand_trend.trend_slope;
    trend_slope_score =
      trend_slope === 'growing' ? 1.0 : trend_slope === 'declining' ? -1.0 : 0.0;
  }

  // 6. Categorical Encodings
  const footprintScaleMap: Record<string, number> = {
    kiosk: 1,
    boutique: 2,
    commercial: 3,
    flagship: 4,
  };
  const footprint_scale = project.storefront_footprint
    ? footprintScaleMap[project.storefront_footprint] || 2
    : 2;

  const channelMap: Record<string, number> = {
    d2c: 1,
    hybrid: 2,
    physical: 3,
  };
  const channel_type = project.business_model
    ? channelMap[project.business_model] || 1
    : 1;

  // 7. Engineered ML-Ready Vector (FR-4.1)
  const norm_competitors_density = Number(Math.min(1.0, competitors_count / 30).toFixed(4));
  const norm_category_saturation =
    category_saturation !== null
      ? Number(Math.min(1.0, category_saturation * 100000).toFixed(4)) // Scaled per 100,000 population
      : null;
  const norm_budget_ratio =
    budget_ratio !== null
      ? Number(Math.min(1.0, Math.max(0, budget_ratio / 2.0)).toFixed(4)) // 1.0 reached at 2.0x coverage
      : null;
  const norm_avg_demand =
    avg_demand_index !== null ? Number((avg_demand_index / 100).toFixed(4)) : 0.5;
  const norm_internet_penetration = Number(
    (internet_penetration_pct / 100).toFixed(4)
  );
  const norm_ecommerce_growth = Number(
    Math.min(1.0, ecommerce_growth_rate_pct / 40).toFixed(4)
  );

  const engineered_vector: EngineeredVector = {
    norm_competitors_density,
    norm_category_saturation,
    norm_budget_ratio,
    norm_avg_demand,
    trend_slope_score: trend_slope_score ?? 0.0,
    norm_internet_penetration,
    norm_ecommerce_growth,
    footprint_scale,
    channel_type,
  };

  return {
    project_id: project.id,
    processing_run_id: runId,
    competitors_count,
    category_saturation,
    budget_ratio,
    avg_demand_index,
    trend_slope,
    trend_slope_score,
    population,
    internet_penetration_pct,
    ecommerce_growth_rate_pct,
    total_estimated_setup_cost: Math.round(setup_cost),
    total_estimated_monthly_cost: Math.round(monthly_cost),
    total_estimated_annual_cost: Math.round(annual_cost),
    user_budget: Math.round(user_budget),
    currency: costs.currency,
    engineered_vector,
    feature_version: 'v1.0',
    created_at: new Date().toISOString(),
  };
}
