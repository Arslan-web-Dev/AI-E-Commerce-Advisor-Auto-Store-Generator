import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('Module 7 Verification: Theme Configurator & Storefront Compiler');
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

// 1. File Deliverables
console.log('1. Checking Module 7 File Deliverables...');

const requiredFiles = [
  'supabase/migrations/20261006050000_module7_storefront_configurator_schema.sql',
  'src/lib/storefront/variant-catalog.ts',
  'src/lib/storefront/compiler.ts',
  'src/app/api/storefront/variants/route.ts',
  'src/app/api/projects/[id]/storefront-wizard/route.ts',
  'src/app/projects/[id]/storefront-wizard/page.tsx',
  'docs/module-7-storefront-compiler.md',
];

for (const file of requiredFiles) {
  const filePath = path.join(rootDir, file);
  assert(fs.existsSync(filePath), `Found ${file}`);
}

// 2. SQL Schema & RLS Policies
console.log('\n2. Validating SQL Schema & Security (Module 7 Migration)...');
const migrationSql = fs.readFileSync(
  path.join(rootDir, 'supabase/migrations/20261006050000_module7_storefront_configurator_schema.sql'),
  'utf8'
);

assert(migrationSql.includes('create table if not exists public.store_wizard_sessions'), 'store_wizard_sessions table defined');
assert(migrationSql.includes('create table if not exists public.store_draft_versions'), 'store_draft_versions table defined');
assert(migrationSql.includes('alter table public.store_wizard_sessions enable row level security'), 'RLS enabled on store_wizard_sessions');
assert(migrationSql.includes('alter table public.store_wizard_sessions force row level security'), 'RLS forced on store_wizard_sessions');
assert(migrationSql.includes('alter table public.store_draft_versions enable row level security'), 'RLS enabled on store_draft_versions');
assert(migrationSql.includes('alter table public.store_draft_versions force row level security'), 'RLS forced on store_draft_versions');
assert(migrationSql.includes('wizard_sessions_owner_all'), 'Owner RLS policy on wizard sessions');
assert(migrationSql.includes('store_drafts_owner_all'), 'Store draft versions RLS policy');

// 3. Variant Catalog Checks
console.log('\n3. Validating Variant Catalog Registry...');
const catalogTs = fs.readFileSync(
  path.join(rootDir, 'src/lib/storefront/variant-catalog.ts'),
  'utf8'
);

assert(catalogTs.includes('export const VARIANT_CATALOG: VariantDefinition[]'), 'VARIANT_CATALOG exported');
assert(catalogTs.includes('export const TEMPLATE_PRESETS'), 'TEMPLATE_PRESETS exported');
assert(catalogTs.includes('validateVariantId'), 'validateVariantId validator exported');
assert(catalogTs.includes('validateManifest'), 'validateManifest validator exported');
assert(catalogTs.includes('recommendTemplate'), 'recommendTemplate function exported');

// Check security invariant: no script tags or eval in catalog
assert(!catalogTs.includes('<script>'), 'Security: No raw script tags in catalog');
assert(!catalogTs.includes('eval('), 'Security: No eval() calls in catalog');

// Check key presets
const presets = ['modern-urban', 'boutique-elegant', 'high-density-catalog', 'emerald-brand'];
for (const p of presets) {
  assert(catalogTs.includes(`'${p}':`), `Template preset '${p}' defined in catalog`);
}

// 4. Manifest Compiler Checks
console.log('\n4. Validating Manifest Compiler...');
const compilerTs = fs.readFileSync(
  path.join(rootDir, 'src/lib/storefront/compiler.ts'),
  'utf8'
);

assert(compilerTs.includes('export interface WizardAnswers'), 'WizardAnswers interface defined');
assert(compilerTs.includes('export interface StoreManifest'), 'StoreManifest interface defined');
assert(compilerTs.includes('export function compileManifest('), 'compileManifest function exported');
assert(compilerTs.includes('validateManifest(mergedVariants)'), 'Compiler validates variant IDs against catalog allowlist');
assert(!compilerTs.includes('eval('), 'Security: No eval() calls in compiler');

// 5. API Routes & UI Wizard Page Checks
console.log('\n5. Validating API Routes & UI Wizard Page...');
const apiWizardTs = fs.readFileSync(
  path.join(rootDir, 'src/app/api/projects/[id]/storefront-wizard/route.ts'),
  'utf8'
);

assert(apiWizardTs.includes('export async function GET'), 'GET handler defined in wizard route');
assert(apiWizardTs.includes('export async function POST'), 'POST handler defined in wizard route');
assert(apiWizardTs.includes('ALLOWED_STYLE_PREFERENCES'), 'Strict MCQ answer allowlist validation');
assert(apiWizardTs.includes('validateVariantId'), 'Variant ID allowlist check on save/compile');
assert(apiWizardTs.includes("status: 'draft'"), 'Approval gate: drafts always saved in draft status');

const pageTsx = fs.readFileSync(
  path.join(rootDir, 'src/app/projects/[id]/storefront-wizard/page.tsx'),
  'utf8'
);

assert(pageTsx.includes("'use client'"), 'Client component directive present');
assert(pageTsx.includes('STEP_1_OPTIONS'), 'Multi-step wizard steps configured');
assert(pageTsx.includes('handleCompile'), 'Compile draft action implemented');
assert(pageTsx.includes('WireframePreview'), 'Live schematic preview component implemented');

// Summary
console.log('\n====================================================');
console.log(`Results: ${passCount} passed, ${failCount} failed`);
console.log('====================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Module 7 verification checks passed successfully!\n');
}
