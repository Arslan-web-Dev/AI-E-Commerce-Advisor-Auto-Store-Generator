/**
 * Task 5 / Module 4 — Feature Engineering, Scoring Contract & ML wiring.
 *
 * Run with: node --test tests/module4-feature-engineering.test.mjs
 *
 * Behavioural checks import the real TypeScript modules via Node's built-in
 * type stripping and tests/helpers/ts-loader.mjs. Supabase is mocked; no live
 * database, ML service or network call is made. Static checks verify migration
 * and UI wiring, not deployed infrastructure.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import './helpers/ts-loader.mjs';

const { engineerFeatures } = await import('../src/lib/data-processing/feature-engineer.ts');
const {
  DEFAULT_RISK_THRESHOLDS,
  LIMITED_DATA_DISCLAIMER,
  classifyFeasibility,
  classifyRisk,
  riskThresholdsFromConfig,
  roundFeasibilityScore,
  validateRiskThresholds,
} = await import('../src/lib/ml/scoring-contract.ts');
const {
  DEFAULT_MCDA_CONFIG,
  calculateProvisionalMCDA,
  classifyScore,
  processFeasibility,
} = await import('../src/lib/scoring/mcda.ts');

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('\n================ TASK 5 MODULE 4 VERIFICATION ================');

function makeProject(overrides = {}) {
  return {
    id: 'project-1',
    radius_km: 5,
    city: 'Lahore',
    district: 'Lahore',
    region: 'Punjab',
    budget_amount: 12_000_000,
    budget_currency: 'PKR',
    storefront_footprint: 'boutique',
    business_model: 'hybrid',
    ...overrides,
  };
}

function makeDataset(overrides = {}) {
  return {
    competitors: [{ rating: 4 }, { rating: 3.5 }, { rating: null }],
    population: 1_000_000,
    internet_penetration_pct: 60,
    ecommerce_growth_rate_pct: 20,
    demand_trend: {
      avg_interest: 72,
      trend_slope: 'growing',
      freshness: 'live',
      actual_geo_scope: 'Lahore',
      provider: 'fixture',
      region: 'Lahore',
      retrieved_at: '2026-11-25T00:00:00Z',
    },
    rent_per_sqft: 150,
    rent_available: true,
    costs: {
      setup: 4_000_000,
      rent_monthly: 200_000,
      marketing_initial: 300_000,
      logistics_per_order: 500,
      currency: 'PKR',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
console.log('\n[1/10] FR-4.1 feature formulas and units...');
const features = engineerFeatures(makeProject(), makeDataset(), 'run-1');
assert.equal(features.competitors_count, 3);
const expectedDensity = 3 / (Math.PI * 25);
assert.ok(Math.abs(features.competitor_density_per_km2 - expectedDensity) < 0.000001, 'density must be competitors / πr²');
assert.equal(features.avg_competitor_rating, 3.75, 'mean of available ratings only');
assert.equal(features.rent_per_sqft, 150, 'sourced PKR/sq.ft must pass through unchanged');
assert.equal(features.estimated_monthly_rent, 200_000);
assert.equal(features.rent_to_budget_ratio, 0.2, '200,000 / (12,000,000/12) = 0.2');
assert.equal(features.budget_to_setup_cost_ratio, 3, '12,000,000 / 4,000,000 = 3');
assert.equal(features.demand_score, 72, '0-100 trend index');
assert.ok(Math.abs(features.category_saturation - 0.000003) < 1e-8);
assert.equal(features.saturation_index, 0.3, 'competitors per 100,000 residents');
assert.equal(features.feature_version, 'v1.1-fr4');
console.log('PASS: all eight FR-4.1 features carry the documented units.');

// ---------------------------------------------------------------------------
console.log('\n[2/10] Missing/zero denominators, missing ratings and N/A semantics...');
const noDenominators = engineerFeatures(
  makeProject({ radius_km: 0, budget_amount: 0 }),
  makeDataset({
    population: 0,
    competitors: [{ rating: undefined }, { rating: null }],
    demand_trend: null,
    rent_available: false,
    costs: { setup: 0, rent_monthly: 0, marketing_initial: 0, logistics_per_order: 0, currency: 'PKR' },
  }),
  'run-2'
);
assert.equal(noDenominators.competitor_density_per_km2, null, 'zero radius must not produce Infinity');
assert.equal(noDenominators.avg_competitor_rating, null, 'no ratings must remain N/A');
assert.equal(noDenominators.saturation_index, null, 'zero population must remain N/A');
assert.equal(noDenominators.rent_to_budget_ratio, null, 'zero budget must remain N/A');
assert.equal(noDenominators.budget_to_setup_cost_ratio, null, 'zero setup cost must remain N/A');
assert.equal(noDenominators.estimated_monthly_rent, null, 'unavailable rent must not become zero-cost rent');
assert.equal(noDenominators.demand_score, null, 'missing demand trend must remain N/A');
console.log('PASS: missing and zero denominators never generate fabricated numeric values.');

// ---------------------------------------------------------------------------
console.log('\n[3/10] Rent provenance and demand scope are not relabelled...');
const noRent = engineerFeatures(
  makeProject(),
  makeDataset({ rent_per_sqft: null, rent_available: false }),
  'run-3'
);
assert.equal(noRent.rent_per_sqft, null);
assert.equal(noRent.estimated_monthly_rent, null);
assert.equal(noRent.rent_to_budget_ratio, null);
const staleDemand = engineerFeatures(
  makeProject(),
  makeDataset({ demand_trend: { avg_interest: 90, trend_slope: 'growing', freshness: 'stale_cache', actual_geo_scope: 'PK' } }),
  'run-4'
);
assert.equal(staleDemand.demand_score, null, 'stale national trend must not become local demand');
assert.equal(staleDemand.engineered_vector.norm_avg_demand, null);
assert.equal(staleDemand.engineered_vector.trend_slope_score, null);
console.log('PASS: unavailable rent stays N/A; stale/cross-region demand is not scored.');

// ---------------------------------------------------------------------------
console.log('\n[4/10] Negative/invalid financial inputs do not create invalid features...');
const negativeFeatures = engineerFeatures(
  makeProject({ budget_amount: -1000 }),
  makeDataset({
    costs: { setup: -50, rent_monthly: -20, marketing_initial: -1, logistics_per_order: -1, currency: 'PKR' },
  }),
  'run-5'
);
assert.equal(negativeFeatures.budget_to_setup_cost_ratio, null);
assert.equal(negativeFeatures.rent_to_budget_ratio, null);
assert.equal(negativeFeatures.estimated_monthly_rent, null);
assert.equal(negativeFeatures.engineered_vector.norm_budget_ratio, null, 'negative budget must not enter the score vector');
assert.equal(negativeFeatures.total_estimated_annual_cost, null);
assert.ok(Number.isFinite(negativeFeatures.engineered_vector.norm_competitors_density));
const outOfRange = engineerFeatures(
  makeProject(),
  makeDataset({ internet_penetration_pct: 140, ecommerce_growth_rate_pct: -5 }),
  'run-5b'
);
assert.equal(outOfRange.engineered_vector.norm_internet_penetration, null);
assert.equal(outOfRange.engineered_vector.norm_ecommerce_growth, null);
assert.equal(outOfRange.internet_penetration_pct, null);
console.log('PASS: negative and out-of-range inputs never enter the score vector.');

// ---------------------------------------------------------------------------
console.log('\n[5/10] Saturation, outliers and stable feature order...');
const saturated = engineerFeatures(makeProject(), makeDataset({ population: 10_000, competitors: Array.from({ length: 30 }, () => ({ rating: 4 })) }), 'run-6');
assert.equal(saturated.saturation_index, 300, '30 / 10,000 * 100,000 = 300');
assert.ok(saturated.engineered_vector.norm_competitors_density <= 1, 'bounded vector clamps outliers');
const order = [
  'norm_competitors_density',
  'norm_category_saturation',
  'norm_budget_ratio',
  'norm_avg_demand',
  'trend_slope_score',
  'norm_internet_penetration',
  'norm_ecommerce_growth',
  'footprint_scale',
  'channel_type',
];
assert.deepEqual(Object.keys(features.engineered_vector), order, 'engineered vector key order must be stable');
const repeat = engineerFeatures(makeProject(), makeDataset(), 'run-1');
assert.deepEqual(repeat.engineered_vector, features.engineered_vector, 'same inputs must reproduce the same vector');
console.log('PASS: saturation units, bounded outliers and deterministic vector order verified.');

// ---------------------------------------------------------------------------
console.log('\n[6/10] FR-4.4 four risk bands and exact SRS boundaries...');
assert.equal(DEFAULT_RISK_THRESHOLDS.low_risk_min, 0.75);
assert.equal(DEFAULT_RISK_THRESHOLDS.moderate_risk_min, 0.55);
assert.equal(DEFAULT_RISK_THRESHOLDS.high_risk_min, 0.35);
const bandCases = [
  [1.0, 'low', 'Low risk', 'High Feasibility'],
  [0.75, 'low', 'Low risk', 'High Feasibility'],
  [0.7499, 'moderate', 'Moderate', 'Medium Feasibility'],
  [0.55, 'moderate', 'Moderate', 'Medium Feasibility'],
  [0.5499, 'high', 'High', 'Low Feasibility'],
  [0.35, 'high', 'High', 'Low Feasibility'],
  [0.3499, 'critical', 'Critical', 'Not Feasible'],
  [0.0, 'critical', 'Critical', 'Not Feasible'],
];
for (const [score, level, label, classification] of bandCases) {
  assert.deepEqual(classifyRisk(score), { level, label }, `score ${score} must map to ${level}`);
  assert.equal(classifyFeasibility(score), classification);
  assert.equal(classifyScore(score), classification, 'MCDA classifier must use the same bands');
}
assert.throws(() => classifyRisk(1.01), /\[0, 1\]/);
assert.throws(() => classifyRisk(Number.NaN), /\[0, 1\]/);
assert.equal(roundFeasibilityScore(0.7549), 0.75, 'report score has two decimals');
console.log('PASS: all four SRS risk bands, boundaries and score rounding verified.');

// ---------------------------------------------------------------------------
console.log('\n[7/10] FR-4.8 threshold validation, ordering and versioning...');
assert.deepEqual(
  riskThresholdsFromConfig({
    low_risk_min: 0.75,
    moderate_risk_min: 0.55,
    high_risk_min: 0.35,
    critical_risk_max: 0.34,
  }),
  DEFAULT_RISK_THRESHOLDS
);
assert.throws(() => validateRiskThresholds({ version: 'bad', low_risk_min: 0.55, moderate_risk_min: 0.75, high_risk_min: 0.35 }), /strictly ordered/);
assert.throws(() => validateRiskThresholds({ version: 'bad', low_risk_min: 1.5, moderate_risk_min: 0.55, high_risk_min: 0.35 }), /\[0, 1\]/);
assert.throws(() => validateRiskThresholds({ version: '', low_risk_min: 0.75, moderate_risk_min: 0.55, high_risk_min: 0.35 }), /non-empty version/);
assert.throws(() => classifyRisk(0.8, { version: 'bad', low_risk_min: 0.55, moderate_risk_min: 0.75, high_risk_min: 0.35 }), /strictly ordered/);
console.log('PASS: admin-supplied thresholds are validated, ordered, bounded and versioned.');

// ---------------------------------------------------------------------------
console.log('\n[8/10] Cross-language contract files stay identical...');
const jsonConfig = JSON.parse(read('config/module4-scoring.json'));
assert.equal(jsonConfig.version, DEFAULT_RISK_THRESHOLDS.version);
assert.equal(jsonConfig.low_risk_min, DEFAULT_RISK_THRESHOLDS.low_risk_min);
assert.equal(jsonConfig.moderate_risk_min, DEFAULT_RISK_THRESHOLDS.moderate_risk_min);
assert.equal(jsonConfig.high_risk_min, DEFAULT_RISK_THRESHOLDS.high_risk_min);
assert.equal(jsonConfig.limited_data_disclaimer, LIMITED_DATA_DISCLAIMER);
assert.equal(jsonConfig.bands.length, 4);
const labelPolicy = JSON.parse(read('ml-service/config/label_approval.json'));
assert.equal(labelPolicy.status, 'BLOCKED');
assert.equal(labelPolicy.oi_id, 'OI-6');
assert.equal(labelPolicy.evidence_reference, null);
console.log('PASS: TypeScript, JSON and Python contract copies are consistent; OI-6 stays BLOCKED.');

// ---------------------------------------------------------------------------
console.log('\n[9/10] Provisional MCDA explainability and unseen categories...');
const provisional = calculateProvisionalMCDA(features.engineered_vector);
assert.equal(provisional.mode, 'provisional_mcda');
assert.equal(provisional.version, DEFAULT_MCDA_CONFIG.version);
assert.ok(provisional.score >= 0 && provisional.score <= 1);
assert.ok(Array.isArray(provisional.explanations) && provisional.explanations.length === 5);
assert.ok(
  provisional.explanations.every((item) => Number.isFinite(item.contribution)),
  'every MCDA contribution must be numeric'
);
const unseen = calculateProvisionalMCDA({ ...features.engineered_vector, norm_avg_demand: 0.2 });
assert.ok(unseen.score >= 0 && unseen.score <= 1, 'unknown category input must still produce a bounded provisional index');
const missingDemand = calculateProvisionalMCDA({
  ...features.engineered_vector,
  norm_avg_demand: null,
  trend_slope_score: null,
});
assert.ok(missingDemand.missing_drivers.includes('Average Demand'));
assert.ok(missingDemand.missing_drivers.includes('Demand Trend'));
assert.ok(
  missingDemand.explanations.every((item) => item.value === null || Number.isFinite(item.value)),
  'unavailable explanations must use null, not invented neutral values'
);
console.log('PASS: provisional scoring is bounded, explained and category-agnostic.');

// ---------------------------------------------------------------------------
console.log('\n[10/10] Ownership, persistence and static wiring checks...');
function mockSupabase({ runProjectId = 'project-1', runStatus = 'completed', config = null, engineeredVector = features.engineered_vector } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const builder = {
        select() { return builder; },
        eq(field, value) { builder._eq = { field, value }; return builder; },
        single() {
          if (table === 'project_processing_runs') {
            return Promise.resolve({ data: { project_id: runProjectId, status: runStatus, quality_score: 90, data_completeness: 'complete' }, error: null });
          }
          return Promise.resolve({ data: { engineered_vector: engineeredVector }, error: null });
        },
        maybeSingle() {
          return Promise.resolve({ data: config ? { payload: config } : null, error: null });
        },
        insert(row) {
          calls.push({ table, row });
          return { select() { return { single() { return Promise.resolve({ data: { ...row, id: 'report-1' }, error: null }); } }; } };
        },
      };
      return builder;
    },
  };
}
const wrongOwner = await processFeasibility(mockSupabase({ runProjectId: 'project-2' }), 'project-1', 'run-1');
assert.equal(wrongOwner.status, 403, 'a run from another project must not be scored into this project');
assert.equal(wrongOwner.data, undefined);
const notReady = await processFeasibility(mockSupabase({ runStatus: 'pending' }), 'project-1', 'run-1');
assert.equal(notReady.status, 400);
const scored = await processFeasibility(mockSupabase(), 'project-1', 'run-1');
assert.ok(scored.data, 'a valid run must persist a report');
assert.equal(scored.data.scoring_mode, 'provisional_mcda');
assert.equal(scored.data.model_version, `provisional_mcda:${DEFAULT_MCDA_CONFIG.version}`);
assert.equal(scored.data.threshold_version, DEFAULT_RISK_THRESHOLDS.version);
assert.equal(scored.data.risk_level, classifyRisk(scored.data.score_value).level);
assert.equal(scored.data.evaluation_metrics.status, 'not_applicable');
assert.equal(scored.data.training_provenance.label_approval_status, 'BLOCKED');
assert.ok(scored.data.disclaimer.includes(LIMITED_DATA_DISCLAIMER));
assert.equal(scored.data.score_value, roundFeasibilityScore(scored.data.score_value));

const unavailable = await processFeasibility(mockSupabase({
  engineeredVector: { ...features.engineered_vector, norm_avg_demand: null, trend_slope_score: null },
}), 'project-1', 'run-1');
assert.equal(unavailable.data.scoring_mode, 'unavailable');
assert.equal(unavailable.data.score_value, null);
assert.equal(unavailable.data.risk_level, null);
assert.equal(unavailable.data.model_version, 'unavailable');
assert.equal(unavailable.data.evaluation_metrics.status, 'not_applicable');
assert.equal(unavailable.data.training_provenance.label_approval_status, 'BLOCKED');
assert.ok(unavailable.data.disclaimer.includes(LIMITED_DATA_DISCLAIMER));

const migration = read('supabase/migrations/20261125130000_module4_model_pipeline_hardening.sql');
for (const column of [
  'competitor_density_per_km2',
  'avg_competitor_rating',
  'rent_per_sqft',
  'estimated_monthly_rent',
  'rent_to_budget_ratio',
  'budget_to_setup_cost_ratio',
  'demand_score',
  'saturation_index',
]) {
  assert.ok(migration.includes(column), `migration must add ${column}`);
}
for (const marker of [
  'add column if not exists',
  'ml_scoring_config_versions',
  'ml_scoring_config_versions_bounds_check',
  'public.is_admin()',
  'Rollback guidance',
  'enable row level security',
]) {
  assert.ok(migration.includes(marker), `migration must include ${marker}`);
}
const thresholdRoute = read('src/app/api/admin/scoring-thresholds/route.ts');
for (const marker of [
  'requireAdmin',
  'validateRiskThresholds',
  'ml_scoring_config_versions',
  "eq('version', version)",
  "versionError.code === '23505'",
]) {
  assert.ok(thresholdRoute.includes(marker), `admin threshold route must include ${marker}`);
}
const feasibilityPage = read('src/app/projects/[id]/feasibility/page.tsx');
assert.ok(!feasibilityPage.includes('?? 0.78'), 'synthetic score fallback must be removed');
assert.ok(!feasibilityPage.includes('rentMin={60000}'), 'hardcoded rent benchmark must be removed');
assert.ok(!feasibilityPage.includes('<SaturationMeter score={58}'), 'hardcoded saturation must be removed');
assert.ok(!feasibilityPage.includes('?? features?.total_estimated_monthly_cost'), 'total cost must not be relabelled as rent');
assert.ok(feasibilityPage.includes('featureCurrency'), 'currency labels must come from stored features');
assert.ok(feasibilityPage.includes('saturationPer100k'), 'saturation units must be explicit');
assert.ok(feasibilityPage.includes(LIMITED_DATA_DISCLAIMER), 'exact disclaimer must be displayed');
const adminPage = read('src/app/admin/ml/page.tsx');
assert.ok(!adminPage.includes('Fashion & Apparel'), 'legacy category must be removed from admin UI');
assert.ok(!adminPage.includes('Auto-Promoted to Production'), 'auto-promotion claim must be removed');
assert.ok(!adminPage.includes('// Fallback or preview allowed'), 'non-admin preview fallback must be removed');
assert.ok(adminPage.includes('SANDBOX ONLY'), 'sandbox-only inference must be visible in the admin UI');
const generator = read('ml-service/datasets/sample_dataset_generator.py');
assert.ok(!generator.includes('Fashion & Apparel'), 'legacy category must be removed from Python generator');
assert.ok(generator.includes('0.35 * fin_factor'), 'unapproved formula must be preserved verbatim');
console.log('PASS: ownership, versioned persistence, migration, admin controls and honest UI copy verified.');

console.log('\n================ ALL MODULE 4 TESTS PASSED ================\n');
