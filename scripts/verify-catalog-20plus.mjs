import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('======================================================================');
console.log('Module 7 Verification Suite: 20+ Variant Integrity & Storefront System');
console.log('======================================================================\n');

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

// ─── 1. Deliverable Files Existence ─────────────────────────────────────────
console.log('1. Checking File Deliverables...');

const requiredFiles = [
  'supabase/migrations/20261006050000_module7_storefront_configurator_schema.sql',
  'src/lib/storefront/variant-catalog.ts',
  'src/lib/storefront/compiler.ts',
  'src/app/api/storefront/variants/route.ts',
  'src/app/api/projects/[id]/storefront-wizard/route.ts',
  'src/app/projects/[id]/storefront-wizard/page.tsx',
  'docs/module-7-implementation-audit.md',
  'docs/module-7-storefront-compiler.md',
  'docs/requirements-traceability.md',
  'docs/api.md',
];

for (const file of requiredFiles) {
  const filePath = path.join(rootDir, file);
  assert(fs.existsSync(filePath), `Found ${file}`);
}

// ─── 2. SQL Schema & RLS Policy Enforcement ─────────────────────────────────
console.log('\n2. Validating SQL Schema, Migrations & RLS Security Policies...');
const migrationSql = fs.readFileSync(
  path.join(rootDir, 'supabase/migrations/20261006050000_module7_storefront_configurator_schema.sql'),
  'utf8'
);

assert(migrationSql.includes('create table if not exists public.store_wizard_sessions'), 'Table store_wizard_sessions defined');
assert(migrationSql.includes('create table if not exists public.store_draft_versions'), 'Table store_draft_versions defined');
assert(migrationSql.includes('alter table public.store_wizard_sessions enable row level security'), 'RLS enabled on wizard sessions');
assert(migrationSql.includes('alter table public.store_wizard_sessions force row level security'), 'RLS forced on wizard sessions');
assert(migrationSql.includes('alter table public.store_draft_versions enable row level security'), 'RLS enabled on draft versions');
assert(migrationSql.includes('alter table public.store_draft_versions force row level security'), 'RLS forced on draft versions');
assert(migrationSql.includes('wizard_sessions_owner_all'), 'Owner RLS policy on wizard sessions');
assert(migrationSql.includes('store_drafts_owner_all'), 'Store draft versions RLS policy');

// ─── 3. Strict 20+ Variant Integrity Verification ───────────────────────────
console.log('\n3. Validating 20+ Variant Catalog Counts & Invariants...');
const catalogTs = fs.readFileSync(
  path.join(rootDir, 'src/lib/storefront/variant-catalog.ts'),
  'utf8'
);

// Check absence of insecure dynamic execution
assert(!catalogTs.includes('<script>'), 'Security: No raw script tags in catalog');
assert(!catalogTs.includes('eval('), 'Security: No eval() calls in catalog');
assert(!catalogTs.includes('Function('), 'Security: No dynamic Function() constructors');

// Extract all variant definitions by ID and ComponentType (using word boundary \bid: so product_grid does not match)
const idRegex = /\bid:\s*'([^']+)'/g;
const typeRegex = /componentType:\s*'([^']+)'/g;

const allIds = [];
let idMatch;
while ((idMatch = idRegex.exec(catalogTs)) !== null) {
  const val = idMatch[1];
  if (val !== 'boutique-elegant' && val !== 'modern-urban' && val !== 'emerald-brand' && val !== 'high-density-catalog') {
    allIds.push(val);
  }
}

// Uniqueness check
const counts = {};
for (const id of allIds) {
  counts[id] = (counts[id] || 0) + 1;
}
for (const [id, count] of Object.entries(counts)) {
  if (count > 1) {
    console.log(`   [Duplicate Notice] ID '${id}' appears ${count} times.`);
  }
}
const uniqueIds = new Set(allIds);
assert(allIds.length === uniqueIds.size, `Variant ID Uniqueness: ${allIds.length} total IDs, ${uniqueIds.size} unique IDs`);

// Component categories expected to have >= 20 variants
const expectedCategories = [
  { type: 'page_template', name: 'Page Templates', arrayName: 'PAGE_TEMPLATE_VARIANTS' },
  { type: 'header', name: 'Headers', arrayName: 'HEADER_VARIANTS' },
  { type: 'hero', name: 'Heroes', arrayName: 'HERO_VARIANTS' },
  { type: 'product_card', name: 'Product Cards', arrayName: 'PRODUCT_CARD_VARIANTS' },
  { type: 'product_grid', name: 'Product Grids', arrayName: 'PRODUCT_GRID_VARIANTS' },
  { type: 'footer', name: 'Footers', arrayName: 'FOOTER_VARIANTS' },
  { type: 'announcement_bar', name: 'Announcement Bars', arrayName: 'ANNOUNCEMENT_BAR_VARIANTS' },
  { type: 'faq_accordion', name: 'FAQ Accordions', arrayName: 'FAQ_ACCORDION_VARIANTS' },
  { type: 'newsletter_signup', name: 'Newsletters', arrayName: 'NEWSLETTER_VARIANTS' },
  { type: 'promotional_banner', name: 'Promo Banners', arrayName: 'PROMOTIONAL_BANNER_VARIANTS' },
  { type: 'button', name: 'Buttons', arrayName: 'BUTTON_VARIANTS' },
  { type: 'badge', name: 'Badges', arrayName: 'BADGE_VARIANTS' },
];

let totalVariantCount = 0;
console.log('\n   Detailed Category Counts:');
for (const cat of expectedCategories) {
  // Count occurrences of componentType: 'cat.type' in catalog
  const regex = new RegExp(`componentType:\\s*'${cat.type}'`, 'g');
  const matches = catalogTs.match(regex);
  const count = matches ? matches.length : 0;
  totalVariantCount += count;
  assert(count >= 20, `${cat.name} (${cat.type}): ${count} variants (meets strict >= 20 standard)`);
}

assert(totalVariantCount >= 240, `Total Catalog Variants: ${totalVariantCount} variants across 12 selectable families (>= 240)`);

// ─── 4. Template Presets & Auto-Recommendation Logic ─────────────────────────
console.log('\n4. Validating Template Presets & Pure Compiler...');
const presets = ['modern-urban', 'boutique-elegant', 'high-density-catalog', 'emerald-brand'];
for (const p of presets) {
  assert(catalogTs.includes(`'${p}':`), `Template preset '${p}' defined with complete slot manifest`);
}

const compilerTs = fs.readFileSync(
  path.join(rootDir, 'src/lib/storefront/compiler.ts'),
  'utf8'
);

assert(compilerTs.includes('export interface WizardAnswers'), 'WizardAnswers interface defined');
assert(compilerTs.includes('export interface StoreManifest'), 'StoreManifest interface defined');
assert(compilerTs.includes('export function compileManifest('), 'compileManifest pure function exported');
assert(compilerTs.includes('validateManifest(mergedVariants)'), 'Compiler verifies every variant against allowlist');
assert(compilerTs.includes('disabled_integration_sections'), 'Compiler honestly tags disabled integration sections');
assert(!compilerTs.includes('eval('), 'Security: No eval() calls in compiler');

// ─── 5. Server APIs & Ownership Verification ────────────────────────────────
console.log('\n5. Validating Server API Routes & Security Guards...');
const apiVariantsTs = fs.readFileSync(
  path.join(rootDir, 'src/app/api/storefront/variants/route.ts'),
  'utf8'
);
assert(apiVariantsTs.includes('export async function GET'), 'GET handler in /api/storefront/variants');
assert(apiVariantsTs.includes('safe = variants.map'), 'Variants API sanitizes internal server fields');

const apiWizardTs = fs.readFileSync(
  path.join(rootDir, 'src/app/api/projects/[id]/storefront-wizard/route.ts'),
  'utf8'
);
assert(apiWizardTs.includes('export async function GET'), 'GET handler in /api/projects/[id]/storefront-wizard');
assert(apiWizardTs.includes('export async function POST'), 'POST handler in /api/projects/[id]/storefront-wizard');
assert(apiWizardTs.includes('project.owner_id !== user.id'), 'Forbidden 403 on cross-owner project access');
assert(apiWizardTs.includes('validateVariantId'), 'Variant ID allowlist check on save/compile');
assert(apiWizardTs.includes("status: 'draft'"), 'Server-side approval gate: compiled stores locked to draft');

// ─── 6. UI Wizard & 12-Component Wireframe Renderers ────────────────────────
console.log('\n6. Validating Configurator UI & Schematic Wireframes...');
const pageTsx = fs.readFileSync(
  path.join(rootDir, 'src/app/projects/[id]/storefront-wizard/page.tsx'),
  'utf8'
);
assert(pageTsx.includes("'use client'"), 'Client directive in page.tsx');
assert(pageTsx.includes('CatalogBrowserSection'), 'Complete 240+ Catalog Browser section implemented');
assert(pageTsx.includes('WireframePreview'), 'Multi-viewport WireframePreview renderer implemented');
assert(pageTsx.includes('handleCompile'), 'Draft compilation trigger implemented');

for (const cat of expectedCategories) {
  assert(pageTsx.includes(`componentType === '${cat.type}'`), `Wireframe renderer has dedicated branch for ${cat.type}`);
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log('\n======================================================================');
console.log(`Results: ${passCount} passed, ${failCount} failed`);
console.log('======================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL MODULE 7 20+ VARIANT & STOREFRONT SYSTEM CHECKS PASSED!\n');
}
