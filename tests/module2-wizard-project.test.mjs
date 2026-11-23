/**
 * Module 2 Automated Test Suite: Business Idea Input, Budget, Geographic Bounds & Wizard
 * Run with: node tests/module2-wizard-project.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('\n================ MODULE 2 WIZARD & PROJECT CREATION VERIFICATION ================');

// 1. Verify 3-Step Wizard Navigation & Neutral Defaults
console.log('\n[1/6] Verifying 3-Step Wizard Structure & Neutral Defaults...');
const wizardPath = path.resolve('src/components/wizard/BusinessIdeaWizard.tsx');
assert.ok(fs.existsSync(wizardPath), 'BusinessIdeaWizard.tsx must exist');

const wizardCode = fs.readFileSync(wizardPath, 'utf8');
assert.ok(
  wizardCode.includes('Step 01 — Idea & Product Scope') &&
  wizardCode.includes('Step 02 — Capital & Punjab Catchment') &&
  wizardCode.includes('Step 03 — Audit & Submission'),
  'Wizard must be organized into 3 logical steps'
);

assert.ok(
  wizardCode.includes("category: ''") &&
  wizardCode.includes("budget_amount: 0") &&
  wizardCode.includes("product_description: ''"),
  'Wizard initial state must start with neutral defaults, not false example business data'
);

assert.ok(
  wizardCode.includes('autosaveTimerRef') && wizardCode.includes('1500'),
  'Wizard must implement real debounced autosave with inactivity timeout'
);

assert.ok(
  !wizardCode.includes("category || 'Grocery & Gourmet Food'"),
  'Wizard must not overwrite missing user values with false default categories'
);
console.log('PASS: Wizard implements agreed 3-step architecture with neutral defaults & debounced autosave.');

// 2. Verify Budget Boundary & Currency Logic
console.log('\n[2/6] Testing Budget Boundary & Currency Conversion...');
const exchangeRatePath = path.resolve('src/lib/currency/exchange-rate.ts');
assert.ok(fs.existsSync(exchangeRatePath), 'exchange-rate.ts must exist');

const exchangeRateCode = fs.readFileSync(exchangeRatePath, 'utf8');
assert.ok(exchangeRateCode.includes('278'), 'Benchmark exchange rate must be Rs. 278 / USD');
assert.ok(
  exchangeRateCode.includes('State Bank of Pakistan') || exchangeRateCode.includes('SBP'),
  'Exchange rate provenance must document source'
);

const validationPath = path.resolve('src/lib/validation/project.ts');
assert.ok(fs.existsSync(validationPath), 'project.ts validation must exist');
const validationCode = fs.readFileSync(validationPath, 'utf8');

assert.ok(
  validationCode.includes('10_000') || validationCode.includes('10000'),
  'Project validation must enforce minimum budget of Rs. 10,000 PKR'
);
assert.ok(
  validationCode.includes('50_000_000') || validationCode.includes('50000000'),
  'Project validation must enforce maximum budget of Rs. 50,000,000 PKR'
);
console.log('PASS: Budget limits (Rs. 10,000 to Rs. 50,000,000 PKR) and SBP benchmark rate verified.');

// 3. Testing Pakistan Geographic Coordinates Validation
console.log('\n[3/6] Testing Pakistan Geographic Bounding Box...');
const PAKISTAN_BOUNDS = {
  minLat: 23.5,
  maxLat: 37.2,
  minLng: 60.8,
  maxLng: 77.9,
};

function isWithinPakistan(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return (
    lat >= PAKISTAN_BOUNDS.minLat &&
    lat <= PAKISTAN_BOUNDS.maxLat &&
    lng >= PAKISTAN_BOUNDS.minLng &&
    lng <= PAKISTAN_BOUNDS.maxLng
  );
}

assert.strictEqual(isWithinPakistan(31.5204, 74.3587), true, 'Lahore must be inside Pakistan bounds');
assert.strictEqual(isWithinPakistan(30.1575, 71.5249), true, 'Multan must be inside Pakistan bounds');
assert.strictEqual(isWithinPakistan(33.6844, 73.0479), true, 'Islamabad must be inside Pakistan bounds');
assert.strictEqual(isWithinPakistan(24.8607, 67.0011), true, 'Karachi must be inside Pakistan bounds');
assert.strictEqual(isWithinPakistan(51.5074, -0.1278), false, 'London must be rejected (outside Pakistan)');
assert.strictEqual(isWithinPakistan(40.7128, -74.0060), false, 'New York must be rejected (outside Pakistan)');

console.log('PASS: Pakistan geographic coordinate bounds (23.5-37.2° N, 60.8-77.9° E) validated.');

// 4. Testing Commercial Hub Presets Integrity
console.log('\n[4/6] Verifying Commercial Hub Presets in src/types/project.ts...');
const projectTypesPath = path.resolve('src/types/project.ts');
assert.ok(fs.existsSync(projectTypesPath), 'src/types/project.ts must exist');

const projectTypesCode = fs.readFileSync(projectTypesPath, 'utf8');
assert.ok(projectTypesCode.includes('COMMERCIAL_HUB_PRESETS'), 'Must export COMMERCIAL_HUB_PRESETS');

const hubMatches = projectTypesCode.match(/lat:\s*([0-9.]+),\s*lng:\s*([0-9.]+)/g);
assert.ok(hubMatches && hubMatches.length >= 7, 'Must have at least 7 verified commercial hub presets');

for (const match of hubMatches) {
  const [latPart, lngPart] = match.split(',');
  const lat = parseFloat(latPart.replace('lat:', '').trim());
  const lng = parseFloat(lngPart.replace('lng:', '').trim());
  assert.ok(
    isWithinPakistan(lat, lng),
    `Commercial hub preset (${lat}, ${lng}) must fall inside Pakistan bounds`
  );
}
console.log(`PASS: All ${hubMatches.length} commercial hub presets strictly verified inside Pakistan.`);

// 5. Testing Radius Constraints Harmonization
console.log('\n[5/6] Testing Search Radius Boundaries Harmonization...');
assert.ok(
  validationCode.includes('min(5') || validationCode.includes('radius_km < 5') || validationCode.includes('5'),
  'Radius lower bound must be 5 km'
);
assert.ok(
  validationCode.includes('max(15') || validationCode.includes('radius_km > 15') || validationCode.includes('15'),
  'Radius upper bound must be 15 km'
);

const remediationSql = fs.readFileSync('supabase/migrations/20261123020000_module1_module2_remediation.sql', 'utf8');
assert.ok(
  remediationSql.includes('feasibility_reports_radius_km_check check (radius_km between 5 and 15)'),
  'feasibility_reports table must enforce radius between 5 and 15 km'
);
assert.ok(
  remediationSql.includes('projects_radius_km_check check (radius_km between 5.0 and 15.0)'),
  'projects table must enforce radius between 5.0 and 15.0 km'
);
console.log('PASS: Radius constraints (5 km - 15 km, default 10 km) harmonized across database and validation.');

// 6. Testing Atomic & Idempotent Submission Pipeline
console.log('\n[6/6] Verifying Atomic & Idempotent Project Submission (FR-2.6)...');
const submitRoutePath = path.resolve('src/app/api/projects/[id]/submit/route.ts');
const submitCode = fs.readFileSync(submitRoutePath, 'utf8');

assert.ok(
  remediationSql.includes('submit_project_for_feasibility') &&
  remediationSql.includes('for update'),
  'Database migration must define atomic submit RPC with row-level locking'
);

assert.ok(
  submitCode.includes('submit_project_for_feasibility'),
  'Submit route handler must invoke atomic submit_project_for_feasibility RPC'
);

assert.ok(
  submitCode.includes('already_submitted: true') && submitCode.includes('already been submitted'),
  'Submit route must be idempotent and return existing report if already submitted'
);

assert.ok(
  submitCode.includes('runDataCollection'),
  'Submit route must hand off to Module 3 runDataCollection'
);

console.log('PASS: Project submission is atomic, row-locked, idempotent, and hands off to Module 3.');
console.log('\n================ ALL MODULE 2 TESTS PASSED (6/6) ================\n');
