/**
 * Geographic Architecture Regression Suite: nationwide Pakistan identity with
 * Punjab-first data coverage.
 * Run with: node tests/geography-pakistan.test.mjs
 *
 * Part A imports the real TypeScript dataset module at runtime (Node >= 22.18 /
 * 23.6 strips types by default) and exercises the actual helper functions.
 * Part B asserts the end-to-end "never substitute Punjab data for another
 * region" contract in the providers, orchestrator and APIs via source checks.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

console.log('\n================ PAKISTAN GEOGRAPHY VERIFICATION ================');

const geoRelative = 'src/lib/geo/pakistan-geography.ts';
const geoUrl = pathToFileURL(path.resolve(geoRelative)).href;
const geo = await import(geoUrl);

const {
  PAKISTAN_COUNTRY,
  PAKISTAN_BOUNDS,
  PAKISTAN_REGIONS,
  PAKISTAN_REGION_NAMES,
  PAKISTAN_REGION_CODES,
  getRegion,
  isRecognisedRegion,
  canonicalRegionName,
  getRegionForDistrict,
  isRecognisedDistrict,
  isRecognisedCity,
  buildCoverageSnapshot,
  getHubPresetsForRegion,
} = geo;

// 1. Every recognised province / administrative territory of Pakistan is present
console.log('\n[1/7] Verifying the national region registry...');
const EXPECTED_REGIONS = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Azad Jammu and Kashmir',
  'Gilgit-Baltistan',
];
assert.deepStrictEqual(
  [...PAKISTAN_REGION_NAMES].sort(),
  [...EXPECTED_REGIONS].sort(),
  'The dataset must recognise every province and administrative territory of Pakistan'
);
assert.strictEqual(PAKISTAN_REGIONS.length, 7, 'There must be exactly seven recognised regions');
assert.strictEqual(PAKISTAN_REGION_CODES.length, 7, 'Every region must carry an ISO 3166-2 code');
assert.ok(
  PAKISTAN_REGIONS.every((r) => /^PK-[A-Z]{2}$/.test(r.code)),
  'Every region code must follow the ISO 3166-2 "PK-XX" form'
);

for (const name of EXPECTED_REGIONS) {
  assert.ok(isRecognisedRegion(name), `isRecognisedRegion must accept "${name}"`);
  assert.strictEqual(getRegion(name)?.name, name, `getRegion must resolve "${name}"`);
}
for (const code of PAKISTAN_REGION_CODES) {
  assert.ok(isRecognisedRegion(code), `isRecognisedRegion must accept the code "${code}"`);
}
assert.strictEqual(canonicalRegionName('punjab'), 'Punjab', 'Region resolution must be case-insensitive');
assert.strictEqual(canonicalRegionName('PK-SD'), 'Sindh', 'Region resolution must accept ISO codes');
assert.strictEqual(canonicalRegionName('Atlantis'), null, 'Unrecognised regions must not resolve');
console.log('PASS: All seven provinces/territories are recognised nationally.');

// 2. Recognition is decoupled from coverage (non-Punjab stays selectable)
console.log('\n[2/7] Verifying recognition is decoupled from data coverage...');
const punjab = getRegion('Punjab');
assert.strictEqual(punjab.coverage, 'verified', 'Punjab must be the verified-coverage region');
assert.strictEqual(punjab.analysis_enabled, true, 'Punjab analysis providers must be enabled');
for (const name of EXPECTED_REGIONS.filter((r) => r !== 'Punjab')) {
  const region = getRegion(name);
  assert.strictEqual(region.coverage, 'none', `${name} must be recognised without claimed coverage`);
  assert.strictEqual(region.analysis_enabled, false, `${name} must not run Punjab-curated analysis`);
  assert.deepStrictEqual(region.supported_categories, [], `${name} must not inherit Punjab categories`);
}
// A recognised non-Punjab district/city is still accepted even without coverage.
assert.strictEqual(isRecognisedDistrict('Sindh', 'Karachi'), true, 'Karachi must be recognised under Sindh');
assert.strictEqual(isRecognisedCity('Sindh', 'Karachi', 'Karachi'), true, 'Karachi city must be recognised');
assert.strictEqual(
  isRecognisedDistrict('Balochistan', 'Somewhere Unlisted'),
  true,
  'A recognised region without a complete registry must accept user-provided districts'
);
console.log('PASS: Non-Punjab locations remain selectable without verified local coverage.');

// 3. Punjab registry membership is strict; district inference is region-aware
console.log('\n[3/7] Verifying Punjab registry membership and region inference...');
assert.strictEqual(isRecognisedDistrict('Punjab', 'Lahore'), true, 'Lahore must be a Punjab district');
assert.strictEqual(isRecognisedDistrict('Punjab', 'Nonsense'), false, 'Punjab rejects unknown districts');
assert.strictEqual(isRecognisedCity('Punjab', 'Lahore', 'Lahore'), true, 'Lahore city is valid in Lahore');
assert.strictEqual(
  isRecognisedCity('Punjab', 'Lahore', 'Karachi'),
  false,
  'A city from another region must not be accepted under a Punjab district'
);
assert.strictEqual(getRegionForDistrict('Karachi')?.name, 'Sindh', 'Karachi must infer Sindh');
assert.strictEqual(getRegionForDistrict('Quetta')?.name, 'Balochistan', 'Quetta must infer Balochistan');
assert.strictEqual(getRegionForDistrict('Atlantis'), null, 'Unknown districts must infer no region');
console.log('PASS: District/city membership and region inference behave correctly.');

// 4. Coverage snapshots separate identity from coverage
console.log('\n[4/7] Verifying coverage snapshots (identity vs coverage)...');
const sindhSnapshot = buildCoverageSnapshot({ region: 'PK-SD', district: 'Karachi', city: 'Karachi' });
assert.strictEqual(sindhSnapshot.country, PAKISTAN_COUNTRY, 'Snapshot country must be Pakistan');
assert.strictEqual(sindhSnapshot.region, 'Sindh', 'Snapshot must canonicalise the region name');
assert.strictEqual(sindhSnapshot.region_code, 'PK-SD', 'Snapshot must record the ISO code');
assert.strictEqual(sindhSnapshot.coverage, 'none', 'Sindh snapshot must record coverage: none');
assert.strictEqual(sindhSnapshot.analysis_enabled, false, 'Sindh snapshot must not enable Punjab analysis');
assert.strictEqual(sindhSnapshot.district, 'Karachi', 'Snapshot must retain the geographic identity');
assert.ok(!Number.isNaN(Date.parse(sindhSnapshot.captured_at)), 'Snapshot must record a valid timestamp');

const unknownSnapshot = buildCoverageSnapshot({ region: 'Nowhere' });
assert.strictEqual(unknownSnapshot.coverage, 'unrecognised', 'Unknown regions must be labelled unrecognised');
assert.strictEqual(unknownSnapshot.region_code, null, 'Unknown regions must not fabricate an ISO code');

const punjabSnapshot = buildCoverageSnapshot({ region: 'Punjab', district: 'Lahore', city: 'Lahore' });
assert.strictEqual(punjabSnapshot.coverage, 'verified', 'Punjab snapshot must record verified coverage');
console.log('PASS: Coverage snapshots keep geographic identity and coverage separate.');

// 5. Bounds and hub presets are coverage-backed (Punjab only)
console.log('\n[5/7] Verifying Pakistan bounds and coverage-backed hub presets...');
assert.deepStrictEqual(
  { ...PAKISTAN_BOUNDS },
  { minLat: 23.5, maxLat: 37.2, minLng: 60.8, maxLng: 77.9 },
  'Pakistan bounding box must cover national territory'
);
const punjabHubs = getHubPresetsForRegion('Punjab');
assert.ok(punjabHubs.length >= 7, 'Punjab must expose its verified commercial hub presets');
assert.ok(
  punjabHubs.every(
    (h) =>
      h.lat >= PAKISTAN_BOUNDS.minLat &&
      h.lat <= PAKISTAN_BOUNDS.maxLat &&
      h.lng >= PAKISTAN_BOUNDS.minLng &&
      h.lng <= PAKISTAN_BOUNDS.maxLng
  ),
  'Every hub preset must fall inside Pakistan territory'
);
assert.deepStrictEqual(getHubPresetsForRegion('Sindh'), [], 'No Punjab hub may leak into another region');
assert.deepStrictEqual(getHubPresetsForRegion('Atlantis'), [], 'Unknown regions must expose no hubs');
console.log('PASS: Bounds are national; hub presets are Punjab-coverage-backed only.');

// 6. The five approved categories stay in sync with the Punjab coverage list
console.log('\n[6/7] Verifying category sync between types and the coverage dataset...');
const projectTypesCode = fs.readFileSync(path.resolve('src/types/project.ts'), 'utf8');
const approvedBlock = projectTypesCode.slice(
  projectTypesCode.indexOf('export const PREDEFINED_CATEGORIES'),
  projectTypesCode.indexOf('export const AGE_GROUP_OPTIONS')
);
const approvedNames = [...approvedBlock.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
assert.strictEqual(approvedNames.length, 5, 'There must be exactly five approved categories');
assert.deepStrictEqual(
  [...punjab.supported_categories].sort(),
  [...approvedNames].sort(),
  'Punjab verified categories must stay in sync with PREDEFINED_CATEGORIES'
);
console.log('PASS: Punjab supported categories match the five approved Task 3 categories.');

// 7. Never substitute Punjab data for another region (providers/orchestrator/APIs)
console.log('\n[7/7] Verifying no silent Punjab substitution end-to-end...');
const dataCollectionCode = fs.readFileSync(path.resolve('src/types/data-collection.ts'), 'utf8');
assert.ok(
  dataCollectionCode.includes('class CoverageUnavailableError'),
  'A dedicated CoverageUnavailableError must exist for uncovered regions'
);
assert.ok(
  dataCollectionCode.includes("'unavailable'"),
  'ProviderRunStatus must include an "unavailable" state distinct from "failed"'
);

const trendsProviderCode = fs.readFileSync(path.resolve('src/lib/providers/trends/google-trends.ts'), 'utf8');
assert.ok(
  trendsProviderCode.includes('new CoverageUnavailableError'),
  'The trends provider must throw CoverageUnavailableError instead of substituting Punjab trends'
);
assert.ok(
  trendsProviderCode.includes('analysis_enabled'),
  'The trends provider must gate Punjab seasonal benchmarks behind verified coverage'
);
assert.ok(
  !trendsProviderCode.includes("'PK-PB'") && !trendsProviderCode.includes('"PK-PB"'),
  'The trends provider must not hard-code the Punjab ISO code as the geo default'
);

const orchestratorCode = fs.readFileSync(path.resolve('src/lib/data-collection/orchestrator.ts'), 'utf8');
assert.ok(
  orchestratorCode.includes('CoverageUnavailableError') && orchestratorCode.includes("'unavailable'"),
  'The orchestrator must map CoverageUnavailableError to the "unavailable" provider status'
);
assert.ok(
  !orchestratorCode.includes('31.5204') && !orchestratorCode.includes('74.3587'),
  'The orchestrator must not fall back to Lahore coordinates'
);

const demandRouteCode = fs.readFileSync(path.resolve('src/app/api/market/demand-analysis/route.ts'), 'utf8');
assert.ok(
  !demandRouteCode.includes('PUNJAB_DISTRICT_BENCHMARKS[0]'),
  'The demand-analysis API must not silently substitute the first Punjab district benchmark'
);

const regionalRouteCode = fs.readFileSync(path.resolve('src/app/api/market/regional/route.ts'), 'utf8');
assert.ok(
  regionalRouteCode.includes('coverage'),
  'The regional-market API must report a coverage status alongside its data'
);
console.log('PASS: Providers, orchestrator and APIs report unavailable coverage instead of Punjab data.');

console.log('\n================ ALL PAKISTAN GEOGRAPHY TESTS PASSED (7/7) ================\n');
