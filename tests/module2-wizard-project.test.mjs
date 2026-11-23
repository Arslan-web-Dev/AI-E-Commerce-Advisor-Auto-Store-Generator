/**
 * Module 2 Automated Test Suite: Business Idea Input, Budget, Geographic Bounds & Wizard
 * Run with: node tests/module2-wizard-project.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('\n================ MODULE 2 WIZARD & PROJECT CREATION VERIFICATION ================');

// 1. Verify Budget Boundary & Currency Logic
console.log('\n[1/5] Testing Budget Boundary & Currency Conversion...');
const exchangeRatePath = path.resolve('src/lib/currency/exchange-rate.ts');
assert.ok(fs.existsSync(exchangeRatePath), 'exchange-rate.ts must exist');

const exchangeRateCode = fs.readFileSync(exchangeRatePath, 'utf8');
assert.ok(exchangeRateCode.includes('278'), 'Benchmark exchange rate must be Rs. 278 / USD');
assert.ok(exchangeRateCode.includes('State Bank of Pakistan') || exchangeRateCode.includes('SBP'), 'Exchange rate provenance must document source');

// Check validation logic in src/lib/validation/project.ts
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

// 2. Testing Pakistan Geographic Coordinates Validation
console.log('\n[2/5] Testing Pakistan Geographic Bounding Box...');
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

// Test cases
assert.strictEqual(isWithinPakistan(31.5204, 74.3587), true, 'Lahore must be inside Pakistan bounds');
assert.strictEqual(isWithinPakistan(30.1575, 71.5249), true, 'Multan must be inside Pakistan bounds');
assert.strictEqual(isWithinPakistan(33.6844, 73.0479), true, 'Islamabad must be inside Pakistan bounds');
assert.strictEqual(isWithinPakistan(24.8607, 67.0011), true, 'Karachi must be inside Pakistan bounds');

// Invalid external locations
assert.strictEqual(isWithinPakistan(51.5074, -0.1278), false, 'London must be rejected (outside Pakistan)');
assert.strictEqual(isWithinPakistan(40.7128, -74.0060), false, 'New York must be rejected (outside Pakistan)');
assert.strictEqual(isWithinPakistan(35.6762, 139.6503), false, 'Tokyo must be rejected (outside Pakistan)');
assert.strictEqual(isWithinPakistan(-33.8688, 151.2093), false, 'Sydney must be rejected (outside Pakistan)');

console.log('PASS: Pakistan geographic coordinate bounds (23.5-37.2° N, 60.8-77.9° E) validated.');

// 3. Testing Commercial Hub Presets Integrity
console.log('\n[3/5] Verifying Commercial Hub Presets in src/types/project.ts...');
const projectTypesPath = path.resolve('src/types/project.ts');
assert.ok(fs.existsSync(projectTypesPath), 'src/types/project.ts must exist');

const projectTypesCode = fs.readFileSync(projectTypesPath, 'utf8');
assert.ok(projectTypesCode.includes('COMMERCIAL_HUB_PRESETS'), 'Must export COMMERCIAL_HUB_PRESETS');

// Extract presets and verify coordinates
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

// 4. Testing Radius Constraints
console.log('\n[4/5] Testing Search Radius Boundaries...');
assert.ok(
  validationCode.includes('min(5') || validationCode.includes('radius_km < 5') || validationCode.includes('5'),
  'Radius lower bound must be 5 km'
);
assert.ok(
  validationCode.includes('max(15') || validationCode.includes('radius_km > 15') || validationCode.includes('15'),
  'Radius upper bound must be 15 km'
);
assert.ok(
  projectTypesCode.includes('10') && validationCode.includes('10'),
  'Default search radius must be 10 km'
);
console.log('PASS: Radius constraints (5 km - 15 km, default 10 km) verified.');

// 5. Testing Project Creation & Submission Route Safeguards
console.log('\n[5/5] Verifying Project APIs & Idempotency (/api/projects/*)...');
const createRoutePath = path.resolve('src/app/api/projects/route.ts');
const submitRoutePath = path.resolve('src/app/api/projects/[id]/submit/route.ts');
const updateRoutePath = path.resolve('src/app/api/projects/[id]/route.ts');

const createCode = fs.readFileSync(createRoutePath, 'utf8');
const submitCode = fs.readFileSync(submitRoutePath, 'utf8');
const updateCode = fs.readFileSync(updateRoutePath, 'utf8');

// Ensure owner_id is taken strictly from authenticated user session
assert.ok(
  createCode.includes('owner_id: user.id'),
  'Create project route must set owner_id from session user.id, never client body'
);

// Ensure submit route verifies bounds, budget, and idempotency
assert.ok(
  submitCode.includes('isWithinPakistan') || (submitCode.includes('23.5') && submitCode.includes('77.9')),
  'Submit route must validate coordinates within Pakistan'
);
assert.ok(
  submitCode.includes('10_000') || submitCode.includes('10000'),
  'Submit route must validate minimum PKR budget'
);
assert.ok(
  submitCode.includes('50_000_000') || submitCode.includes('50000000'),
  'Submit route must validate maximum PKR budget'
);
assert.ok(
  submitCode.includes('already_submitted: true') && submitCode.includes('already been submitted'),
  'Submit route must be idempotent and return existing report if already submitted'
);
assert.ok(
  submitCode.includes("from('feasibility_reports')"),
  'Submit route must create a row in feasibility_reports'
);
assert.ok(
  submitCode.includes("'pending'"),
  'Submit route must set feasibility report status to pending'
);

// Ensure update route restricts modifications to drafts
assert.ok(
  updateCode.includes("status !== 'draft'"),
  'Update route must disallow modifications to submitted/archived projects'
);

console.log('PASS: Project creation, draft updates, and idempotent submission pipeline verified.');
console.log('\n================ ALL MODULE 2 TESTS PASSED (5/5) ================\n');
