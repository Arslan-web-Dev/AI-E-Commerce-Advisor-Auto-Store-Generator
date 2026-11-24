/**
 * Task 3 Automated Regression Suite: Complete Three-Step Business Feasibility Wizard
 * Run with: node tests/task3-wizard-feasibility.test.mjs
 *
 * These are static source/migration assertions. They verify that the Task 3
 * requirements are present in the code and migrations; they do not replace
 * runtime database testing on a live Supabase instance.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('\n================ TASK 3 THREE-STEP WIZARD VERIFICATION ================');

const TASK3_CATEGORIES = [
  'Grocery / General Stores',
  'Clothing / Footwear',
  'Mobile Phones / Accessories',
  'Restaurants / Cafes',
  'Pharmacies / Medical Stores',
];

// 1. Exactly three wizard steps with the Task 3 titles
console.log('\n[1/8] Verifying the three-step wizard structure...');
const wizardCode = fs.readFileSync(path.resolve('src/components/wizard/BusinessIdeaWizard.tsx'), 'utf8');
assert.ok(
  wizardCode.includes('Step 01 — Profile & Location') &&
  wizardCode.includes('Step 02 — Finance & Operations') &&
  wizardCode.includes('Step 03 — Review & Submission'),
  'Wizard must present exactly three steps: Profile & Location, Finance & Operations, Review & Submission'
);
assert.ok(
  wizardCode.includes('Step 1 — Business Profile &') &&
  wizardCode.includes('Step 2 — Financial &') &&
  wizardCode.includes('Step 3 — Review &'),
  'Each step panel must be labeled with the Task 3 step heading'
);
console.log('PASS: Wizard is a strict three-step flow with the mandated titles.');

// 2. Five approved categories consistent across every layer
console.log('\n[2/8] Verifying the five approved categories across all layers...');
const projectTypesCode = fs.readFileSync(path.resolve('src/types/project.ts'), 'utf8');
for (const cat of TASK3_CATEGORIES) {
  assert.ok(
    projectTypesCode.includes(`'${cat}'`),
    `src/types/project.ts must define the approved category "${cat}"`
  );
}
const categoryBlock = projectTypesCode.slice(
  projectTypesCode.indexOf('export const PREDEFINED_CATEGORIES'),
  projectTypesCode.indexOf('export const PUNJAB_PROVINCE')
);
const categoryCount = (categoryBlock.match(/name: '/g) || []).length;
assert.strictEqual(categoryCount, 5, 'There must be exactly five predefined categories');

const overpassCode = fs.readFileSync(path.resolve('src/lib/providers/competitors/overpass.ts'), 'utf8');
const trendsCode = fs.readFileSync(path.resolve('src/lib/providers/trends/google-trends.ts'), 'utf8');
const demoCode = fs.readFileSync(path.resolve('src/lib/providers/competitors/demo.ts'), 'utf8');
for (const cat of TASK3_CATEGORIES) {
  assert.ok(overpassCode.includes(`'${cat}'`), `Overpass CATEGORY_TAG_MAP must be keyed by "${cat}"`);
  assert.ok(trendsCode.includes(`'${cat}'`), `Trends CATEGORY_TREND_CURVES must be keyed by "${cat}"`);
  assert.ok(demoCode.includes(`'${cat}'`), `Demo CATEGORY_SAMPLE_NAMES must be keyed by "${cat}"`);
}
console.log('PASS: All five categories are consistent across types, validation and every provider.');

// 3. Legacy six-category taxonomy must be fully retired in application code
console.log('\n[3/8] Verifying the legacy category taxonomy is retired...');
const legacyNames = [
  'Apparel & Fashion',
  'Consumer Electronics',
  'Cosmetics & Skincare',
  'Grocery & Gourmet Food',
  'Home Decor & Living',
  'Other Niche Venture',
];
const appFiles = [
  'src/types/project.ts',
  'src/lib/validation/project.ts',
  'src/lib/providers/competitors/overpass.ts',
  'src/lib/providers/competitors/demo.ts',
  'src/lib/providers/trends/google-trends.ts',
  'src/components/wizard/BusinessIdeaWizard.tsx',
];
for (const file of appFiles) {
  const code = fs.readFileSync(path.resolve(file), 'utf8');
  for (const legacy of legacyNames) {
    assert.ok(
      !code.includes(legacy),
      `${file} must not reference the retired category "${legacy}"`
    );
  }
}
assert.ok(
  !demoCode.includes("CATEGORY_SAMPLE_NAMES['Other Niche Venture']"),
  'Demo provider must not fall back to a removed category key'
);
console.log('PASS: Legacy six-category keys no longer appear in application source.');

// 4. Punjab-only district/city dataset with server-side membership checks
console.log('\n[4/8] Verifying Punjab district/city dataset and validation...');
assert.ok(projectTypesCode.includes('PUNJAB_PROVINCE'), 'Must export PUNJAB_PROVINCE');
assert.ok(projectTypesCode.includes('PUNJAB_DISTRICTS'), 'Must export PUNJAB_DISTRICTS');
assert.ok(projectTypesCode.includes('PUNJAB_CITIES'), 'Must export PUNJAB_CITIES');
assert.ok(
  projectTypesCode.includes("district: string | null") && projectTypesCode.includes("district: string"),
  'Project and ProjectFormData must both carry a district field'
);

const validationCode = fs.readFileSync(path.resolve('src/lib/validation/project.ts'), 'utf8');
assert.ok(
  validationCode.includes('ALLOWED_CATEGORY_NAMES') && validationCode.includes('ALLOWED_DISTRICT_NAMES'),
  'Validation must derive allowed categories and districts from the canonical datasets'
);
assert.ok(
  validationCode.includes('does not belong to district'),
  'Validation must reject a city that does not belong to the selected district'
);
assert.ok(
  validationCode.includes('lat < 23.5 || lat > 37.2 || lng < 60.8 || lng > 77.9'),
  'Validation must enforce the Pakistan coordinate bounding box'
);
assert.ok(
  validationCode.includes('Only Punjab province is supported'),
  'Validation must restrict the province to Punjab'
);
console.log('PASS: District/city are validated against the Punjab dataset, including membership.');

// 5. Canonical PKR budget with strict numeric validation
console.log('\n[5/8] Verifying canonical PKR budget validation...');
assert.ok(
  validationCode.includes('Number.isFinite(budget)'),
  'Budget validation must reject NaN/Infinity'
);
assert.ok(
  validationCode.includes('Budget cannot be negative'),
  'Budget validation must reject negative values'
);
assert.ok(
  validationCode.includes('10_000') && validationCode.includes('50_000_000'),
  'Budget validation must enforce the Rs. 10,000 – Rs. 50,000,000 PKR range'
);
assert.ok(
  validationCode.includes('budget_pkr') || validationCode.includes("currency === 'USD'"),
  'Validation must handle the USD benchmark conversion path'
);
const exchangeRateCode = fs.readFileSync(path.resolve('src/lib/currency/exchange-rate.ts'), 'utf8');
assert.ok(exchangeRateCode.includes('278'), 'Benchmark FX rate must be Rs. 278 / USD');
assert.ok(
  exchangeRateCode.includes('State Bank of Pakistan') || exchangeRateCode.includes('SBP'),
  'FX provenance must cite the State Bank of Pakistan'
);
console.log('PASS: Canonical PKR budget is validated server-side with the SBP benchmark rate.');

// 6. Server-side validation on both draft routes and ownership enforcement
console.log('\n[6/8] Verifying draft persistence, ownership and server validation...');
const createRouteCode = fs.readFileSync(path.resolve('src/app/api/projects/route.ts'), 'utf8');
const updateRouteCode = fs.readFileSync(path.resolve('src/app/api/projects/[id]/route.ts'), 'utf8');

assert.ok(
  createRouteCode.includes('validateProjectFields(body)') &&
  updateRouteCode.includes('validateProjectFields(body)'),
  'Both POST and PATCH must validate every supplied field server-side'
);
assert.ok(
  createRouteCode.includes('owner_id: user.id'),
  'POST must derive owner_id from the authenticated session, never from the body'
);
assert.ok(
  updateRouteCode.includes('delete updates.owner_id'),
  'PATCH must never accept a client-supplied owner_id'
);
assert.ok(
  updateRouteCode.includes('existingProject.owner_id !== user.id') &&
  updateRouteCode.includes('Access denied'),
  'PATCH must enforce project ownership server-side'
);
assert.ok(
  updateRouteCode.includes('updates.district = body.district'),
  'PATCH must persist the wizard district field'
);
assert.ok(
  createRouteCode.includes('district: body.district'),
  'POST must persist the wizard district field'
);
console.log('PASS: Drafts persist securely; owner_id is server-derived and ownership is enforced.');

// 7. Wizard draft persistence, resume and submission wiring
console.log('\n[7/8] Verifying wizard autosave, resume and submission wiring...');
assert.ok(
  wizardCode.includes('autosaveTimerRef') && wizardCode.includes('1500'),
  'Wizard must debounce autosave (1500 ms)'
);
assert.ok(
  wizardCode.includes("fetch('/api/projects'") && wizardCode.includes('method: \'PATCH\''),
  'Wizard must create and update drafts via the REST routes'
);
assert.ok(
  wizardCode.includes('/api/projects/${initialProjectId}'),
  'Wizard must resume an existing draft by id'
);
assert.ok(
  wizardCode.includes("district: p.district || ''"),
  'Wizard must restore the saved district when resuming a draft'
);
assert.ok(
  wizardCode.includes("fetch(`/api/projects/${currentProjId}/submit`"),
  'Wizard must submit only through the secure submit route'
);
assert.ok(
  wizardCode.includes('validateCompleteProject(formData)'),
  'Wizard must run complete validation before submission'
);
assert.ok(
  !wizardCode.includes("category || 'Grocery & Gourmet Food'"),
  'Wizard must not inject a fabricated default category'
);
console.log('PASS: Wizard autosaves, resumes drafts, and submits through the secure route.');

// 8. Forward-only district migration and combined schema parity
console.log('\n[8/8] Verifying forward-only migration and schema parity...');
const migrationPath = path.resolve('supabase/migrations/20261124020000_module2_wizard_district.sql');
assert.ok(fs.existsSync(migrationPath), 'The wizard district migration must exist');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
assert.ok(
  migrationSql.includes('add column if not exists district text'),
  'Migration must add the district column forward-only (idempotent)'
);
assert.ok(
  !/drop table/i.test(migrationSql) && !/drop column/i.test(migrationSql),
  'Migration must not drop tables or columns (forward-only)'
);
const combinedSchema = fs.readFileSync(path.resolve('supabase/combined_schema.sql'), 'utf8');
assert.ok(
  /create table if not exists public\.projects[\s\S]*?district\s+text/.test(combinedSchema),
  'combined_schema.sql must include the district column in public.projects'
);
console.log('PASS: District column is added forward-only and matches the combined schema.');

console.log('\n================ ALL TASK 3 TESTS PASSED (8/8) ================\n');
