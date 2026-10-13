/**
 * Module 9 Verification Suite: Generated Store Analytics, Customer Behavior, Traffic Insights & Reports
 * Run: node scripts/verify-module9.mjs
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
console.log('Module 9 Verification: Store Analytics & Reports');
console.log('====================================================\n');

// ── 1. File Deliverables ──────────────────────────────────────────────────
console.log('1. Checking Module 9 File Deliverables...');
const files = [
  'supabase/migrations/20261006070000_module9_analytics_schema.sql',
  'src/types/analytics.ts',
  'src/lib/analytics/metrics.ts',
  'src/lib/analytics/events.ts',
  'src/lib/analytics/report.ts',
  'src/components/store-management/AnalyticsPanel.tsx',
  'src/app/api/stores/[id]/analytics/overview/route.ts',
  'src/app/api/stores/[id]/analytics/trends/route.ts',
  'src/app/api/stores/[id]/analytics/products/route.ts',
  'src/app/api/stores/[id]/analytics/behavior/route.ts',
  'src/app/api/stores/[id]/analytics/events/route.ts',
  'src/app/api/stores/[id]/analytics/reports/route.ts',
  'docs/module-9-implementation-audit.md',
  'docs/module-9-analytics.md',
];
for (const f of files) {
  check(`Found ${f}`, existsSync(f));
}

// ── 2. SQL Schema & RLS Policies ──────────────────────────────────────────
console.log('\n2. Validating Database Schema & RLS Security...');
const migration = existsSync('supabase/migrations/20261006070000_module9_analytics_schema.sql')
  ? readFileSync('supabase/migrations/20261006070000_module9_analytics_schema.sql', 'utf-8')
  : '';

check('Table store_analytics_events created', migration.includes('create table if not exists public.store_analytics_events'));
check('Event type check constraint defined', migration.includes("event_type in ('page_view', 'product_view', 'add_to_cart', 'remove_from_cart', 'begin_checkout', 'purchase')"));
check('Pseudonymous session_id column exists', migration.includes('session_id text not null'));
check('Store date index defined', migration.includes('idx_store_events_store_date'));
check('Event type index defined', migration.includes('idx_store_events_store_type'));
check('Product FK index defined', migration.includes('idx_store_events_product'));
check('RLS enabled on events table', migration.includes('alter table public.store_analytics_events enable row level security'));
check('RLS forced on events table', migration.includes('alter table public.store_analytics_events force row level security'));
check('can_manage_store owner policy for select', migration.includes('can_manage_store(store_id)'));
check('Public insert policy scoped to unbanned stores', migration.includes('is_banned = false'));

// ── 3. Metric Formula Verification ───────────────────────────────────────
console.log('\n3. Validating Metric Formulas (Sales, Revenue, AOV, Delta)...');
const metricsCode = existsSync('src/lib/analytics/metrics.ts')
  ? readFileSync('src/lib/analytics/metrics.ts', 'utf-8')
  : '';

check('calculateOrderMetrics exported', metricsCode.includes('export function calculateOrderMetrics'));
check('calculateDeltaPercent exported', metricsCode.includes('export function calculateDeltaPercent'));
check('generateDailyTrends exported', metricsCode.includes('export function generateDailyTrends'));
check('aggregateProductPerformance exported', metricsCode.includes('export function aggregateProductPerformance'));
check('computeFunnel exported', metricsCode.includes('export function computeFunnel'));
check('computeCartAbandonment exported', metricsCode.includes('export function computeCartAbandonment'));
check('computeTrafficSources exported', metricsCode.includes('export function computeTrafficSources'));

// Inspect math logic inside metrics.ts
check("Gross Sales excludes cancelled: o.status === 'cancelled'", metricsCode.includes("if (o.status === 'cancelled')"));
check("Net Revenue deducts returnedAmountPkr", metricsCode.includes('netRevenuePkr = Math.max(0, netRevenuePkr - returnedAmountPkr)'));
check("AOV divides by fulfilledCount with zero guard", metricsCode.includes('fulfilledCount > 0 ? Math.round(netRevenuePkr / fulfilledCount) : 0'));
check("Conversion rate uses distinct visitors with zero guard", metricsCode.includes('visitorsCount > 0'));
check("Cart abandonment isolates sessions without purchase", metricsCode.includes('!purchaseSessions.has(sid)'));
check("Delta percent handles zero previous safely", metricsCode.includes('if (previous <= 0)'));

// ── 4. Customer Behavior, Funnel & Abandonment Guardrails ────────────────
console.log('\n4. Validating Funnel & Abandonment Guardrails...');
check('Funnel defines 5 stages from Visitors to Purchased', metricsCode.includes("'Visitors'") && metricsCode.includes("'Product Views'") && metricsCode.includes("'Purchased'"));
check('Cart abandonment handles zero cart sessions honestly', metricsCode.includes("isAvailable: false") && metricsCode.includes('unavailable'));
check('Traffic sources categories: Direct, Google Search, Social Media', metricsCode.includes("'Google Search'") && metricsCode.includes("'Social Media (Instagram/TikTok)'"));

// ── 5. Event Ingestion Validation & Privacy ───────────────────────────────
console.log('\n5. Validating Event Ingestion & Privacy Sanitizer...');
const eventsCode = existsSync('src/lib/analytics/events.ts')
  ? readFileSync('src/lib/analytics/events.ts', 'utf-8')
  : '';

check('validateEventPayload exported', eventsCode.includes('export function validateEventPayload'));
check('Allowed event types allowlist defined', eventsCode.includes("ALLOWED_EVENT_TYPES"));
check('Bounded session_id truncation (slice 0, 128)', eventsCode.includes('slice(0, 128)'));
check('Bounded referrer truncation (slice 0, 500)', eventsCode.includes('slice(0, 500)'));
check('Bounded UTM truncation (slice 0, 100)', eventsCode.includes('slice(0, 100)'));
check('Strict validation for required store_id', eventsCode.includes('typeof p.store_id !== \'string\''));

// ── 6. Report Generation & XSS Escaping ───────────────────────────────────
console.log('\n6. Validating Executive Report Generator & Security...');
const reportCode = existsSync('src/lib/analytics/report.ts')
  ? readFileSync('src/lib/analytics/report.ts', 'utf-8')
  : '';

check('generateAnalyticsReportHtml exported', reportCode.includes('export function generateAnalyticsReportHtml'));
check('Imports escapeHtml from invoice library', reportCode.includes('escapeHtml'));
check('Escapes storeName to prevent XSS', reportCode.includes('escapeHtml(report.storeName'));
check('Escapes productName in top products table', reportCode.includes('escapeHtml(p.productName)'));
check('Print / Save as PDF button included', reportCode.includes('window.print()'));
check('Data Limitations and compliance section rendered', reportCode.includes('Data Limitations & Compliance Notes'));
check('Currency formatted in PKR', reportCode.includes('Rs. '));

// ── 7. Server API Route Security Guards ──────────────────────────────────
console.log('\n7. Validating API Route Security & Ownership Checks...');

const routes = [
  'src/app/api/stores/[id]/analytics/overview/route.ts',
  'src/app/api/stores/[id]/analytics/trends/route.ts',
  'src/app/api/stores/[id]/analytics/products/route.ts',
  'src/app/api/stores/[id]/analytics/behavior/route.ts',
  'src/app/api/stores/[id]/analytics/reports/route.ts',
];

for (const r of routes) {
  const content = readFileSync(r, 'utf-8');
  const name = r.split('/').slice(-2).join('/');
  check(`${name}: has getUser() session check`, content.includes('getUser()'));
  check(`${name}: has store ownership verification`, content.includes('store.owner_id !== user.id') || content.includes('can_manage_store'));
  check(`${name}: returns 403 on unauthorized access`, content.includes('403'));
}

const eventRoute = readFileSync('src/app/api/stores/[id]/analytics/events/route.ts', 'utf-8');
check('events route: validates event payload', eventRoute.includes('validateEventPayload'));
check('events route: verifies store not banned', eventRoute.includes('is_banned'));

// ── 8. UI Integration ────────────────────────────────────────────────────
console.log('\n8. Validating Merchant Control Panel UI Integration...');

const storePage = readFileSync('src/app/projects/[id]/store/page.tsx', 'utf-8');
check('ActiveTab includes analytics', storePage.includes("'analytics'"));
check('AnalyticsPanel imported', storePage.includes('AnalyticsPanel'));
check('Analytics tab button rendered', storePage.includes("label: 'Analytics & Reports'"));
check('AnalyticsPanel rendered on activeTab === analytics', storePage.includes("activeTab === 'analytics'"));

const panel = readFileSync('src/components/store-management/AnalyticsPanel.tsx', 'utf-8');
check('AnalyticsPanel is client component', panel.includes("'use client'"));
check('Date range selector implemented (7d, 30d, 90d)', panel.includes("'7d'") && panel.includes("'30d'") && panel.includes("'90d'"));
check('KPI cards rendered (Gross, Net, Orders, AOV)', panel.includes('Gross Sales') && panel.includes('Net Revenue'));
check('Time series trend chart rendered', panel.includes('Revenue Trends'));
check('Customer funnel rendered', panel.includes('Customer Conversion Funnel'));
check('Executive PDF Report preview modal implemented', panel.includes('reportModalOpen') && panel.includes('Print / Save PDF'));

// ── Summary ──────────────────────────────────────────────────────────────
console.log('\n====================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('====================================================\n');

if (failed === 0) {
  console.log('🎉 ALL MODULE 9 ANALYTICS & REPORTS CHECKS PASSED!\n');
} else {
  console.log(`⚠️  ${failed} check(s) failed. Review the output above.\n`);
  process.exit(1);
}
