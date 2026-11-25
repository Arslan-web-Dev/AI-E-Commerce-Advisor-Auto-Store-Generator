import type { Project } from '@/types/project';
import type { CleanedDataset } from './cleaner';
import type { ProjectFeatureRecord, EngineeredVector } from '@/types/feature-processing';
import { isUsableDemandTrend } from './trend-validity';

const PKR_PER_USD = 278; // Disclosed SBP benchmark used throughout the wizard.

function finitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

export function engineerFeatures(
  project: Project,
  dataset: CleanedDataset,
  runId: string
): ProjectFeatureRecord {
  const {
    competitors,
    population,
    internet_penetration_pct,
    ecommerce_growth_rate_pct,
    demand_trend,
    rent_per_sqft,
    rent_available,
    costs,
  } = dataset;

  // FR-4.1: count of deduplicated, valid competitors.
  const competitors_count = competitors.length;

  // FR-4.1: competitors per square kilometre of the requested search area.
  // Radius is always 5-15 km in the validated project model; invalid values
  // remain N/A instead of silently using a Lahore/default radius.
  const radiusKm = project.radius_km;
  const competitor_density_per_km2 = finitePositive(radiusKm)
    ? round(competitors_count / (Math.PI * radiusKm * radiusKm), 6)
    : null;

  // FR-4.1: mean of available competitor ratings (0-5). Sparse OSM ratings are
  // omitted, not imputed to zero.
  const ratings = competitors
    .map((competitor) => competitor.rating)
    .filter((rating): rating is number =>
      typeof rating === 'number' && Number.isFinite(rating) && rating >= 0 && rating <= 5
    );
  const avg_competitor_rating = ratings.length > 0
    ? round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length, 2)
    : null;

  // FR-4.1: competitors / 100,000 residents. Null when population is absent,
  // zero or from an incompatible geography (no cross-region substitution).
  const category_saturation = finitePositive(population)
    ? round(competitors_count / population, 8)
    : null;
  const saturation_index = category_saturation !== null
    ? round(category_saturation * 100000, 4)
    : null;

  // Negative or non-finite amounts are rejected rather than propagated into
  // ratios. A null cost makes the derived annual cost N/A.
  const setup_cost = finiteNonNegative(costs.setup) ? costs.setup : null;
  const monthly_cost = finiteNonNegative(costs.rent_monthly) ? costs.rent_monthly : null;
  const marketing_initial = finiteNonNegative(costs.marketing_initial) ? costs.marketing_initial : null;
  const annual_cost =
    setup_cost !== null && monthly_cost !== null && marketing_initial !== null
      ? setup_cost + monthly_cost * 12 + marketing_initial
      : null;

  let user_budget = project.budget_amount;
  if (!finitePositive(user_budget)) user_budget = Number.NaN;
  if (project.budget_currency !== costs.currency) {
    if (project.budget_currency === 'USD' && costs.currency === 'PKR') {
      user_budget = user_budget * PKR_PER_USD;
    } else if (project.budget_currency === 'PKR' && costs.currency === 'USD') {
      user_budget = user_budget / PKR_PER_USD;
    }
  }
  const validBudget = finitePositive(user_budget) ? user_budget : null;

  const budget_ratio =
    annual_cost !== null && annual_cost > 0 && validBudget !== null
      ? round(validBudget / annual_cost, 4)
      : null;
  const budget_to_setup_cost_ratio =
    setup_cost !== null && setup_cost > 0 && validBudget !== null
      ? round(validBudget / setup_cost, 4)
      : null;

  // A monthly rent of zero with freshness 'unavailable' is a coverage gap, not
  // a free premises. Keep the derived ratios N/A and expose the raw sentinel.
  const estimated_monthly_rent =
    rent_available && monthly_cost !== null && monthly_cost > 0
      ? round(monthly_cost, 2)
      : null;
  const monthly_budget_share = validBudget !== null ? validBudget / 12 : null;
  const rent_to_budget_ratio =
    estimated_monthly_rent !== null && monthly_budget_share !== null && monthly_budget_share > 0
      ? round(estimated_monthly_rent / monthly_budget_share, 4)
      : null;

  // FR-4.1: demand score is the normalised 0-100 trend index. A stale or
  // cross-region trend is not local evidence, so every derived demand feature
  // stays N/A instead of being scored as a neutral value.
  const usableTrend = isUsableDemandTrend(demand_trend, project);
  const demand_score =
    usableTrend && demand_trend && inRange(demand_trend.avg_interest, 0, 100)
      ? round(demand_trend.avg_interest, 2)
      : null;
  const avg_demand_index = demand_score;
  const trend_slope = usableTrend ? demand_trend?.trend_slope ?? null : null;
  const trend_slope_score =
    trend_slope === 'growing' ? 1.0 : trend_slope === 'declining' ? -1.0 : trend_slope === 'stable' ? 0.0 : null;

  // Existing categorical encodings remain unchanged for backwards compatibility.
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
  const channel_type = project.business_model ? channelMap[project.business_model] || 1 : 1;

  // Bounded vector values are null when their source is unavailable. MCDA
  // excludes those drivers from the index instead of inventing neutral values.
  const norm_competitors_density = round(Math.min(1.0, competitors_count / 30), 4);
  const norm_category_saturation =
    category_saturation !== null ? round(Math.min(1.0, category_saturation * 100000), 4) : null;
  const norm_budget_ratio =
    budget_ratio !== null ? round(Math.min(1.0, Math.max(0, budget_ratio / 2.0)), 4) : null;
  const norm_avg_demand = avg_demand_index !== null ? round(avg_demand_index / 100, 4) : null;
  const norm_internet_penetration = inRange(internet_penetration_pct, 0, 100)
    ? round(internet_penetration_pct / 100, 4)
    : null;
  const norm_ecommerce_growth = inRange(ecommerce_growth_rate_pct, 0, 100)
    ? round(Math.min(1.0, ecommerce_growth_rate_pct / 40), 4)
    : null;

  const engineered_vector: EngineeredVector = {
    norm_competitors_density,
    norm_category_saturation,
    norm_budget_ratio,
    norm_avg_demand,
    trend_slope_score,
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
    competitor_density_per_km2,
    avg_competitor_rating,
    rent_per_sqft: rent_per_sqft ?? null,
    estimated_monthly_rent,
    rent_to_budget_ratio,
    budget_to_setup_cost_ratio,
    demand_score,
    saturation_index,
    budget_ratio,
    avg_demand_index,
    trend_slope,
    trend_slope_score,
    population,
    internet_penetration_pct: inRange(internet_penetration_pct, 0, 100) ? internet_penetration_pct : null,
    ecommerce_growth_rate_pct: inRange(ecommerce_growth_rate_pct, 0, 100) ? ecommerce_growth_rate_pct : null,
    total_estimated_setup_cost: setup_cost !== null ? Math.round(setup_cost) : null,
    total_estimated_monthly_cost: monthly_cost !== null ? Math.round(monthly_cost) : null,
    total_estimated_annual_cost: annual_cost !== null ? Math.round(annual_cost) : null,
    user_budget: validBudget !== null ? Math.round(validBudget) : null,
    currency: costs.currency,
    engineered_vector,
    feature_version: 'v1.1-fr4',
    created_at: new Date().toISOString(),
  };
}
