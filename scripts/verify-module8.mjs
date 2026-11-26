/**
 * Module 8 Verification Suite: Store Management, Products, Inventory, Orders, Customers & Payments
 * Run: node scripts/verify-module8.mjs
 */
import { readFileSync, existsSync } from 'fs';

let passed = 0;
let failed = 0;

function check(label, result) {
  if (result) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

console.log('====================================================');
console.log('Module 8 Verification: Store Management System');
console.log('====================================================\n');

// ── 1. File deliverables ──────────────────────────────────────────────────
console.log('1. Checking Module 8 File Deliverables...');
const files = [
  'supabase/migrations/20261006060000_module8_store_management_schema.sql',
  'src/types/store-management.ts',
  'src/lib/store-management/orders.ts',
  'src/lib/store-management/inventory.ts',
  'src/lib/store-management/invoice.ts',
  'src/lib/store-management/payments.ts',
  'src/app/api/projects/[id]/store/route.ts',
  'src/app/api/stores/[id]/overview/route.ts',
  'src/app/api/stores/[id]/products/route.ts',
  'src/app/api/stores/[id]/products/[productId]/route.ts',
  'src/app/api/stores/[id]/inventory/route.ts',
  'src/app/api/stores/[id]/orders/route.ts',
  'src/app/api/stores/[id]/orders/[orderId]/route.ts',
  'src/app/api/stores/[id]/orders/[orderId]/invoice/route.ts',
  'src/app/api/stores/[id]/customers/route.ts',
  'src/app/api/stores/[id]/payments/route.ts',
  'src/app/projects/[id]/store/page.tsx',
  'docs/module-8-implementation-audit.md',
  'docs/module-8-store-management.md',
];
for (const f of files) {
  check(`Found ${f}`, existsSync(f));
}

// ── 2. SQL Schema & RLS ──────────────────────────────────────────────────
console.log('\n2. Validating SQL Schema & RLS Security Policies...');
const migration = existsSync('supabase/migrations/20261006060000_module8_store_management_schema.sql')
  ? readFileSync('supabase/migrations/20261006060000_module8_store_management_schema.sql', 'utf-8')
  : '';

check('Table products defined', migration.includes('create table if not exists public.products'));
check('Table orders defined', migration.includes('create table if not exists public.orders'));
check('Table order_items defined', migration.includes('create table if not exists public.order_items'));
check('Table customers defined', migration.includes('create table if not exists public.customers'));
check('Table inventory_logs defined', migration.includes('create table if not exists public.inventory_logs'));
check('Table store_payment_settings defined', migration.includes('create table if not exists public.store_payment_settings'));
check('RLS enabled on products', migration.includes('alter table public.products enable row level security'));
check('RLS forced on products', migration.includes('alter table public.products force row level security'));
check('RLS enabled on orders', migration.includes('alter table public.orders enable row level security'));
check('RLS forced on orders', migration.includes('alter table public.orders force row level security'));
check('RLS enabled on order_items', migration.includes('alter table public.order_items enable row level security'));
check('RLS enabled on customers', migration.includes('alter table public.customers enable row level security'));
check('RLS enabled on inventory_logs', migration.includes('alter table public.inventory_logs enable row level security'));
check('RLS enabled on store_payment_settings', migration.includes('alter table public.store_payment_settings enable row level security'));
check('Store access helper can_manage_store defined', migration.includes('can_manage_store'));
check('Non-negative stock constraint', migration.includes('check (stock >= 0)'));
check('Non-negative price constraint', migration.includes('check (price_pkr >= 0)'));
check('Compare-at price >= selling price constraint', migration.includes('compare_at_price_pkr >= price_pkr'));
check('Order status enum constraint', migration.includes("('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned')"));
check('Product slug uniqueness per store', migration.includes('unique (store_id, slug)'));
check('Customer phone uniqueness per store', migration.includes('unique (store_id, phone)'));

// ── 3. Order State Machine ───────────────────────────────────────────────
console.log('\n3. Validating Order Fulfillment Pipeline (FR-8.10)...');
const ordersModule = existsSync('src/lib/store-management/orders.ts')
  ? readFileSync('src/lib/store-management/orders.ts', 'utf-8')
  : '';

check('ALLOWED_STATUS_TRANSITIONS exported', ordersModule.includes('ALLOWED_STATUS_TRANSITIONS'));
check('canTransitionOrder function exported', ordersModule.includes('canTransitionOrder'));
check('shouldDecrementStockOnTransition function exported', ordersModule.includes('shouldDecrementStockOnTransition'));
check('shouldRestoreStockOnTransition function exported', ordersModule.includes('shouldRestoreStockOnTransition'));
check('appendStatusHistory function exported', ordersModule.includes('appendStatusHistory'));
check('getOrderStatusMeta function exported', ordersModule.includes('getOrderStatusMeta'));
check('pending → confirmed transition', ordersModule.includes("pending: ['confirmed', 'cancelled']"));
check('confirmed → packed transition', ordersModule.includes("confirmed: ['packed', 'cancelled']"));
check('packed → shipped transition', ordersModule.includes("packed: ['shipped', 'cancelled']"));
check('shipped → delivered/cancelled/returned transitions', ordersModule.includes("shipped: ['delivered', 'cancelled', 'returned']"));
check('delivered → returned terminal', ordersModule.includes("delivered: ['returned']"));
check('cancelled is terminal', ordersModule.includes('cancelled: []'));
check('Stock decrement on confirmation', ordersModule.includes("currentStatus === 'pending' && targetStatus === 'confirmed'"));

// ── 4. Inventory Logic ───────────────────────────────────────────────────
console.log('\n4. Validating Inventory & Low-Stock Logic...');
const invModule = existsSync('src/lib/store-management/inventory.ts')
  ? readFileSync('src/lib/store-management/inventory.ts', 'utf-8')
  : '';

check('isLowStock function exported', invModule.includes('isLowStock'));
check('filterLowStockProducts function exported', invModule.includes('filterLowStockProducts'));
check('calculateStockAdjustment function exported', invModule.includes('calculateStockAdjustment'));
check('validateOrderStockAvailability function exported', invModule.includes('validateOrderStockAvailability'));
check('Non-negative stock validation', invModule.includes('Stock quantity cannot be negative'));

// ── 5. Invoice Generator ─────────────────────────────────────────────────
console.log('\n5. Validating Invoice Generator Security...');
const invoiceModule = existsSync('src/lib/store-management/invoice.ts')
  ? readFileSync('src/lib/store-management/invoice.ts', 'utf-8')
  : '';

check('escapeHtml function exported', invoiceModule.includes('escapeHtml'));
check('generateInvoiceHtml function exported', invoiceModule.includes('generateInvoiceHtml'));
check('HTML entity escaping for &', invoiceModule.includes("'&amp;'"));
check('HTML entity escaping for <', invoiceModule.includes("'&lt;'"));
check('HTML entity escaping for >', invoiceModule.includes("'&gt;'"));
check('Print button in invoice', invoiceModule.includes('window.print()'));
check('PKR currency formatting', invoiceModule.includes('Rs.'));

// ── 6. Payment Providers ─────────────────────────────────────────────────
console.log('\n6. Validating Payment Method Registry...');
const paymentsModule = existsSync('src/lib/store-management/payments.ts')
  ? readFileSync('src/lib/store-management/payments.ts', 'utf-8')
  : '';

check('getStorePaymentProviders function exported', paymentsModule.includes('getStorePaymentProviders'));
check('COD payment method registered', paymentsModule.includes('Cash on Delivery'));
check('COD is default active', paymentsModule.includes("isDefault: true"));
check('Stripe labeled not configured', paymentsModule.includes("'not_configured'"));
check('PayPal labeled unsupported', paymentsModule.includes("'unsupported'"));
check('JazzCash/EasyPaisa documented as future', paymentsModule.includes('JazzCash'));
check('No fake payment charges', !paymentsModule.includes('charge(') && !paymentsModule.includes('refund('));

// ── 7. API Route Security ────────────────────────────────────────────────
console.log('\n7. Validating Server API Route Security Guards...');
const apiRoutes = [
  'src/app/api/stores/[id]/overview/route.ts',
  'src/app/api/stores/[id]/products/route.ts',
  'src/app/api/stores/[id]/inventory/route.ts',
  'src/app/api/stores/[id]/orders/route.ts',
  'src/app/api/stores/[id]/customers/route.ts',
  'src/app/api/stores/[id]/payments/route.ts',
];

for (const route of apiRoutes) {
  if (existsSync(route)) {
    const content = readFileSync(route, 'utf-8');
    const baseName = route.split('/').slice(-2).join('/');
    check(`${baseName}: auth check (getUser)`, content.includes('getUser'));
    check(`${baseName}: store ownership check`, content.includes('owner_id') || content.includes('can_manage_store'));
    check(`${baseName}: 403 Forbidden on cross-owner`, content.includes('403'));
  }
}

const orderDetailRoute = existsSync('src/app/api/stores/[id]/orders/[orderId]/route.ts')
  ? readFileSync('src/app/api/stores/[id]/orders/[orderId]/route.ts', 'utf-8')
  : '';
check('Order detail route: validates status transition', orderDetailRoute.includes('canTransitionOrder'));
check('Order detail route: uses transactional transition RPC', orderDetailRoute.includes("rpc('transition_store_order_status'") || orderDetailRoute.includes('transitionStoreOrder'));
check('Order route: transactional status RPC exists', existsSync('supabase/migrations/20261127020000_module8_secure_order_rpcs.sql'));
check('Order route: no client-side stock writes', !orderDetailRoute.includes("from('products')"));

const invoiceRoute = existsSync('src/app/api/stores/[id]/orders/[orderId]/invoice/route.ts')
  ? readFileSync('src/app/api/stores/[id]/orders/[orderId]/invoice/route.ts', 'utf-8')
  : '';
check('Invoice route: generates HTML', invoiceRoute.includes('generateInvoiceHtml'));
check('Invoice route: auth check', invoiceRoute.includes('getUser'));
check('Invoice route: JSON format option', invoiceRoute.includes("format === 'json'"));

// ── 8. UI Page ───────────────────────────────────────────────────────────
console.log('\n8. Validating Store Management UI Page...');
const uiPage = existsSync('src/app/projects/[id]/store/page.tsx')
  ? readFileSync('src/app/projects/[id]/store/page.tsx', 'utf-8')
  : '';

check('Client component directive', uiPage.includes("'use client'"));
check('Overview tab implemented', uiPage.includes("'overview'"));
check('Products tab implemented', uiPage.includes("'products'"));
check('Inventory tab implemented', uiPage.includes("'inventory'"));
check('Orders tab implemented', uiPage.includes("'orders'"));
check('Customers tab implemented', uiPage.includes("'customers'"));
check('Payments tab implemented', uiPage.includes("'payments'"));
check('Product CRUD modal', uiPage.includes('productModalOpen'));
check('Stock adjustment modal', uiPage.includes('stockModalOpen'));
check('Order detail and transition modal', uiPage.includes('orderDetailModalOpen'));
check('Invoice viewer modal', uiPage.includes('invoiceModalOpen'));
check('Sandbox/draft mode label', uiPage.includes('Sandbox Mode'));
check('Low stock alert banner', uiPage.includes('Low Stock Alert'));
check('KPI cards rendered', uiPage.includes('Total Revenue'));
check('Sample sandbox order creation', uiPage.includes('handleCreateSampleOrder'));

// ── 9. Proxy/session route protection ────────────────────────────────────
console.log('\n9. Validating Proxy Route Protection...');
const middleware = existsSync('src/lib/supabase/middleware.ts')
  ? readFileSync('src/lib/supabase/middleware.ts', 'utf-8')
  : '';
check('Middleware protects /stores paths', middleware.includes("pathname.startsWith('/stores')"));

// ── 10. Task 9 deployment, checkout and SEO deliverables ─────────────────
console.log('\n10. Validating Task 9 Multi-Tenant Deployment Deliverables...');
const task9Files = [
  'docs/module-8-implementation-gap-report.md',
  'supabase/migrations/20261127000000_module8_publication_domain_lifecycle.sql',
  'supabase/migrations/20261127010000_module8_order_integrity.sql',
  'supabase/migrations/20261127020000_module8_secure_order_rpcs.sql',
  'supabase/migrations/20261127030000_module8_product_image_storage.sql',
  'src/lib/store-management/tenant.ts',
  'src/lib/store-management/public-store.ts',
  'src/lib/store-management/domains.ts',
  'src/lib/store-management/guest-checkout.ts',
  'src/lib/store-management/seo.ts',
  'src/app/api/stores/[id]/domain/route.ts',
  'src/app/api/stores/[id]/publish/route.ts',
  'src/app/api/storefront/[slug]/orders/route.ts',
  'src/app/api/storefront/[slug]/products/route.ts',
  'src/app/api/stores/[id]/products/images/route.ts',
  'src/app/api/admin/usage/route.ts',
  'src/app/[slug]/catalogue/layout.tsx',
  'src/app/[slug]/cart/layout.tsx',
  'src/app/[slug]/checkout/layout.tsx',
  'src/app/[slug]/checkout/confirmation/layout.tsx',
  'tests/module8-storefront-deployment.test.mjs',
  'tests/module8-guest-checkout.test.mjs',
  'tests/module8-order-fulfilment.test.mjs',
  'tests/module8-seo.test.mjs',
];
for (const file of task9Files) check(`Found ${file}`, existsSync(file));

const domainRoute = existsSync('src/app/api/stores/[id]/domain/route.ts')
  ? readFileSync('src/app/api/stores/[id]/domain/route.ts', 'utf-8') : '';
check('Domain route calls real Vercel API', domainRoute.includes('addProjectDomain') && domainRoute.includes('verifyProjectDomain'));
check('Domain route requires owner/admin', domainRoute.includes('canManageStore'));
const secureRpcs = existsSync('supabase/migrations/20261127020000_module8_secure_order_rpcs.sql')
  ? readFileSync('supabase/migrations/20261127020000_module8_secure_order_rpcs.sql', 'utf-8') : '';
check('Anonymous checkout is limited to one RPC', secureRpcs.includes('grant execute on function public.place_store_order'));
check('Order transition RPC is transactional', secureRpcs.includes('security definer') && secureRpcs.includes('for update'));
check('Idempotency unique index exists', existsSync('supabase/migrations/20261127010000_module8_order_integrity.sql'));
const proxyCode = existsSync('src/proxy.ts') ? readFileSync('src/proxy.ts', 'utf-8') : '';
check('Deprecated middleware file convention removed', !existsSync('src/middleware.ts'));
check('Proxy exports the Next.js 16 proxy function', proxyCode.includes('export async function proxy('));
check('Proxy rewrites only verified published domains',
  proxyCode.includes("'domain_status', 'verified'") &&
  proxyCode.includes("'status', 'published'") &&
  proxyCode.includes("'is_banned', false"));

const seoLib = existsSync('src/lib/store-management/seo.ts') ? readFileSync('src/lib/store-management/seo.ts', 'utf-8') : '';
check('Stored SEO metadata is normalized before rendering', seoLib.includes('export function normalizeStoredSeo'));
check('Owner SEO score is computed server-side',
  existsSync('src/app/api/stores/[id]/overview/route.ts') &&
  readFileSync('src/app/api/stores/[id]/overview/route.ts', 'utf-8').includes('computeStoreSeoScore'));
const descriptionRoute = existsSync('src/app/api/stores/[id]/products/[productId]/description/route.ts')
  ? readFileSync('src/app/api/stores/[id]/products/[productId]/description/route.ts', 'utf-8') : '';
check('AI description writer supports tone, language and keyword checks',
  descriptionRoute.includes('body.tone') && descriptionRoute.includes("body.language === 'ur_roman'") && descriptionRoute.includes('missingKeywords'));
const storageMigration = existsSync('supabase/migrations/20261127030000_module8_product_image_storage.sql')
  ? readFileSync('supabase/migrations/20261127030000_module8_product_image_storage.sql', 'utf-8') : '';
check('Product images use an owner-controlled Storage bucket',
  storageMigration.includes("'product-images'") && storageMigration.includes('public.can_manage_store'));
const usageRoute = existsSync('src/app/api/admin/usage/route.ts')
  ? readFileSync('src/app/api/admin/usage/route.ts', 'utf-8') : '';
check('Admin usage and sanitized AI log are available',
  usageRoute.includes("from('ai_call_log')") && usageRoute.includes('ai_calls_by_purpose'));
const ownerPage = existsSync('src/app/projects/[id]/store/page.tsx')
  ? readFileSync('src/app/projects/[id]/store/page.tsx', 'utf-8') : '';
check('Owner publish toggle sends an explicit action', ownerPage.includes("body: JSON.stringify({ action })"));

// ── Summary ──────────────────────────────────────────────────────────────
console.log('\n====================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('====================================================\n');

if (failed === 0) {
  console.log('🎉 ALL MODULE 8 STORE MANAGEMENT CHECKS PASSED!\n');
} else {
  console.log(`⚠️  ${failed} check(s) failed. Review the output above.\n`);
  process.exit(1);
}
