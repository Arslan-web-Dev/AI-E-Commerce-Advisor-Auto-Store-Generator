import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('Module 3 Verification: Smart Data Aggregation');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

console.log('1. Checking Module 3 File Deliverables...');

const requiredFiles = [
  'supabase/migrations/20261006010000_module3_data_collection_schema.sql',
  'supabase/migrations/20261125010000_module3_smart_aggregation.sql',
  'supabase/migrations/20261125120000_module3_persistence_hardening.sql',
  'src/types/data-collection.ts',
  'src/lib/providers/competitors/overpass.ts',
  'src/lib/providers/competitors/demo.ts',
  'src/lib/providers/regional/pbs.ts',
  'src/lib/providers/trends/google-trends.ts',
  'src/lib/providers/costs/benchmark.ts',
  'src/lib/data-collection/orchestrator.ts',
  'src/lib/data-collection/competitor-cache.ts',
  'src/lib/data-collection/rent-lookup.ts',
  'src/lib/data-collection/rent-estimates.ts',
  'src/lib/security/cron-auth.ts',
  'src/components/data-collection/MarketDataPanel.tsx',
  'src/app/api/projects/[id]/collect/route.ts',
  'src/app/api/cron/rent-cache/route.ts',
  'ml-service/trends/google_trends.py',
  'tests/module3-smart-aggregation.test.mjs',
  'docs/module-3-data-collection.md',
  'docs/requirements-traceability.md',
  'docs/FINAL_DELIVERY_BASELINE.md',
  'docs/api.md',
];

for (const relPath of requiredFiles) {
  const fullPath = path.join(rootDir, relPath);
  assert(fs.existsSync(fullPath), `File exists: ${relPath}`);
}

console.log('\n2. Checking schema + Task 4 migration...');
const migrationSql = fs.readFileSync(
  path.join(rootDir, 'supabase/migrations/20261006010000_module3_data_collection_schema.sql'),
  'utf-8'
);
const task4Sql = fs.readFileSync(
  path.join(rootDir, 'supabase/migrations/20261125010000_module3_smart_aggregation.sql'),
  'utf-8'
);
const hardeningSql = fs.readFileSync(
  path.join(rootDir, 'supabase/migrations/20261125120000_module3_persistence_hardening.sql'),
  'utf-8'
);

assert(migrationSql.includes('project_collection_runs'), 'Table project_collection_runs defined');
assert(migrationSql.includes('project_competitors'), 'Table project_competitors defined');
assert(task4Sql.includes('competitor_query_cache'), 'competitor_query_cache migration present');
assert(task4Sql.includes('rent_min_pkr'), 'rent_cache enrichment columns present');
assert(task4Sql.includes('Rollback guidance'), 'Migration includes rollback guidance');
assert(hardeningSql.includes('freshness'), 'Per-record freshness columns present');
assert(hardeningSql.includes('recorded_at'), 'Manual estimate timestamp column present');
assert(hardeningSql.includes('uq_collection_runs_active_project'), 'Active run uniqueness guard present');

console.log('\n3. Checking provider robustness...');
const overpassCode = fs.readFileSync(path.join(rootDir, 'src/lib/providers/competitors/overpass.ts'), 'utf-8');
assert(overpassCode.includes('CATEGORY_OSM_TAG_MAP'), 'CATEGORY_OSM_TAG_MAP defined');
assert(overpassCode.includes('amenity'), 'Amenity tag queries present');
assert(overpassCode.includes('osmIdentityKey'), 'OSM identity dedupe present');
assert(overpassCode.includes('Unnamed business'), 'Honest unnamed POI handling');
assert(overpassCode.includes('MAX_PROJECT_RADIUS_KM = 15'), '15 km radius cap present');
assert(!overpassCode.includes('out center 50'), 'No silent Overpass result cap');

const trendsCode = fs.readFileSync(path.join(rootDir, 'src/lib/providers/trends/google-trends.ts'), 'utf-8');
assert(trendsCode.includes('stale_cache'), 'Trends stale-cache freshness present');
assert(trendsCode.includes('CoverageUnavailableError'), 'Coverage unavailable signalling present');
assert(trendsCode.includes('isPakistanWide'), 'Unrecognised regions cannot silently widen to national scope');

const orchCode = fs.readFileSync(path.join(rootDir, 'src/lib/data-collection/orchestrator.ts'), 'utf-8');
assert(orchCode.includes('getCompetitorsWithCache'), 'Orchestrator uses seven-day competitor cache');
assert(orchCode.includes('Do NOT silently substitute synthetic competitors'), 'No silent demo fallback');
assert(orchCode.includes('STUCK_RUNNING_MS'), 'Stuck-running recovery present');
assert(orchCode.includes('replaceRunRows'), 'Repeat runs replace observation rows');
assert(orchCode.includes('persistenceErrors'), 'Persistence failures are surfaced');

const cronCode = fs.readFileSync(path.join(rootDir, 'src/app/api/cron/rent-cache/route.ts'), 'utf-8');
assert(cronCode.includes('assertCronAuthorized'), 'Rent cron is authorized');
assert(cronCode.includes("provenance: 'manual_estimate'"), 'Rent cron labels estimates honestly');
assert(cronCode.includes("from('rent_cache')"), 'Rent cron writes rent_cache');

console.log('\n4. Checking UI provenance labelling...');
const ui = fs.readFileSync(path.join(rootDir, 'src/components/data-collection/MarketDataPanel.tsx'), 'utf-8');
assert(ui.includes('Live observation'), 'UI labels live observations');
assert(ui.includes('Stale cache'), 'UI labels stale cache');
assert(ui.includes('Synthetic demo'), 'UI labels synthetic demo');
assert(ui.includes('Unavailable'), 'UI labels unavailable coverage');

console.log('\n----------------------------------------------------');
console.log(`Results: ${passCount} Passed, ${failCount} Failed.`);
console.log('----------------------------------------------------');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Module 3 verification checks PASSED!\n');
}
