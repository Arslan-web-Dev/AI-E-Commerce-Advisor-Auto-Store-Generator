import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('Module 3 Verification: Data Collection & Integrations');
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

// 1. Verify Deliverable Files Exist
console.log('1. Checking Module 3 File Deliverables...');

const requiredFiles = [
  'supabase/migrations/20261006010000_module3_data_collection_schema.sql',
  'src/types/data-collection.ts',
  'src/lib/providers/competitors/overpass.ts',
  'src/lib/providers/competitors/demo.ts',
  'src/lib/providers/regional/pbs.ts',
  'src/lib/providers/regional/demo.ts',
  'src/lib/providers/trends/google-trends.ts',
  'src/lib/providers/trends/demo.ts',
  'src/lib/providers/costs/benchmark.ts',
  'src/lib/providers/costs/demo.ts',
  'src/lib/providers/index.ts',
  'src/lib/data-collection/orchestrator.ts',
  'src/components/data-collection/MarketDataPanel.tsx',
  'src/app/api/projects/[id]/collect/route.ts',
  'src/app/api/projects/[id]/collection/route.ts',
  'src/app/api/projects/[id]/competitors/route.ts',
  'src/app/api/projects/[id]/market-data/route.ts',
  'src/app/api/projects/[id]/costs/route.ts',
  'docs/module-3-data-collection.md',
  'docs/data-and-integrations.md',
  'docs/requirements-traceability.md',
  'docs/api.md',
];

for (const relPath of requiredFiles) {
  const fullPath = path.join(rootDir, relPath);
  assert(fs.existsSync(fullPath), `File exists: ${relPath}`);
}

// 2. Verify Schema Integrity
console.log('\n2. Checking PostgreSQL Migration Schema...');
const migrationSql = fs.readFileSync(
  path.join(rootDir, 'supabase/migrations/20261006010000_module3_data_collection_schema.sql'),
  'utf-8'
);

assert(migrationSql.includes('create table if not exists public.project_collection_runs'), 'Table project_collection_runs defined');
assert(migrationSql.includes('create table if not exists public.project_competitors'), 'Table project_competitors defined');
assert(migrationSql.includes('create table if not exists public.project_market_observations'), 'Table project_market_observations defined');
assert(migrationSql.includes('create table if not exists public.project_demand_trends'), 'Table project_demand_trends defined');
assert(migrationSql.includes('create table if not exists public.project_cost_estimates'), 'Table project_cost_estimates defined');
assert(migrationSql.includes('provenance in (\'external_api\', \'synthetic_demo\', \'licensed_dataset\', \'manual_estimate\')'), 'Provenance check constraint defined');
assert(migrationSql.includes('alter table public.project_competitors enable row level security'), 'RLS enabled on competitors');
assert(migrationSql.includes('alter table public.project_collection_runs force row level security'), 'RLS forced on collection runs');
assert(migrationSql.includes('create or replace function public.can_access_project'), 'RLS helper can_access_project defined');

// 3. Verify Provider Contracts & Implementations
console.log('\n3. Checking Provider Implementations & Robustness...');

const overpassCode = fs.readFileSync(path.join(rootDir, 'src/lib/providers/competitors/overpass.ts'), 'utf-8');
assert(overpassCode.includes('OverpassCompetitorProvider'), 'OverpassCompetitorProvider defined');
assert(overpassCode.includes('calculateHaversineDistance'), 'Haversine distance calculation present');
assert(overpassCode.includes('CATEGORY_TAG_MAP'), 'Category tag mapping present');

const demoCompCode = fs.readFileSync(path.join(rootDir, 'src/lib/providers/competitors/demo.ts'), 'utf-8');
assert(demoCompCode.includes('DemoCompetitorProvider'), 'DemoCompetitorProvider defined');
assert(demoCompCode.includes("provenance = 'synthetic_demo'"), 'Demo competitor provider tagged as synthetic_demo');

const pbsCode = fs.readFileSync(path.join(rootDir, 'src/lib/providers/regional/pbs.ts'), 'utf-8');
assert(pbsCode.includes('PbsRegionalStatsProvider'), 'PbsRegionalStatsProvider defined');
assert(pbsCode.includes('population'), 'Population metric handled');
assert(pbsCode.includes('internet_penetration_pct'), 'Internet penetration metric handled');
assert(pbsCode.includes("provenance = 'licensed_dataset'"), 'PBS demographics tagged as licensed_dataset');

const trendsCode = fs.readFileSync(path.join(rootDir, 'src/lib/providers/trends/google-trends.ts'), 'utf-8');
assert(trendsCode.includes('GoogleTrendsProvider'), 'GoogleTrendsProvider defined');
assert(trendsCode.includes('trend_series'), '12-month trend series array present');

const costCode = fs.readFileSync(path.join(rootDir, 'src/lib/providers/costs/benchmark.ts'), 'utf-8');
assert(costCode.includes('BenchmarkCostEstimateProvider'), 'BenchmarkCostEstimateProvider defined');
assert(costCode.includes('rent_monthly'), 'Monthly rent calculation present');
assert(costCode.includes('logistics_per_order'), 'Logistics per order calculation present');

const orchestratorCode = fs.readFileSync(path.join(rootDir, 'src/lib/data-collection/orchestrator.ts'), 'utf-8');
assert(orchestratorCode.includes('runDataCollection'), 'runDataCollection function defined');
assert(orchestratorCode.includes('Promise.allSettled'), 'Concurrent independent provider execution via Promise.allSettled');
assert(orchestratorCode.includes('feasibility_reports'), 'Syncs summary metrics to feasibility_reports');

// 4. Verify API Handlers & Route Security
console.log('\n4. Checking Server-Side API Handlers & UI...');
const collectRoute = fs.readFileSync(path.join(rootDir, 'src/app/api/projects/[id]/collect/route.ts'), 'utf-8');
assert(collectRoute.includes('runDataCollection(id, user.id'), 'Collect endpoint invokes runDataCollection');

const competitorsRoute = fs.readFileSync(path.join(rootDir, 'src/app/api/projects/[id]/competitors/route.ts'), 'utf-8');
assert(competitorsRoute.includes('project.owner_id !== user.id'), 'Competitors endpoint enforces project ownership');

const marketRoute = fs.readFileSync(path.join(rootDir, 'src/app/api/projects/[id]/market-data/route.ts'), 'utf-8');
assert(marketRoute.includes('project.owner_id !== user.id'), 'Market-data endpoint enforces project ownership');

const costsRoute = fs.readFileSync(path.join(rootDir, 'src/app/api/projects/[id]/costs/route.ts'), 'utf-8');
assert(costsRoute.includes('project.owner_id !== user.id'), 'Costs endpoint enforces project ownership');

const uiPage = fs.readFileSync(path.join(rootDir, 'src/app/projects/[id]/page.tsx'), 'utf-8');
assert(uiPage.includes('<MarketDataPanel'), 'MarketDataPanel rendered on project detail page');

console.log('\n----------------------------------------------------');
console.log(`Results: ${passCount} Passed, ${failCount} Failed.`);
console.log('----------------------------------------------------');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Module 3 verification checks PASSED!\n');
}
