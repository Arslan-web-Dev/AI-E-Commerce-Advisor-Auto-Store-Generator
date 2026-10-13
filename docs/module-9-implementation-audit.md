# Module 9 Implementation Audit: Generated Store Analytics, Customer Behavior, Traffic Insights, and Reports

**Audit Date:** October 2026  
**Auditor:** AntiGravity Automated Verification Engine  
**Target Repository:** `AI-E-Commerce-Advisor-Auto-Store-Generator`  
**Current Branch:** `main` (clean working tree post-Module 8)  
**SRS Reference:** `SRS_AI_ECommerce_Advisor.docx` / `docs/SRS.md` (§4.13)  

---

## 1. System Context & Architecture Baseline

### 1.1 Stack & Framework Conventions
- **Framework:** Next.js 16.3.8 (App Router, Turbopack, React 19)
- **Database & Auth:** PostgreSQL with Row Level Security (RLS) via Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- **Styling & Aesthetics:** Dark glassmorphism palette (`#0b1326`, `#131b2e`, `#171f33`, borders `#2d3449`, emerald `#4edea3`, cyan `#4cd7f6`, text `#dae2fd`)
- **Currency Convention:** Integer Pakistani Rupee (`bigint` PKR) to eliminate floating-point rounding errors
- **Security Invariant:** Forced RLS on all tenant tables using the `can_manage_store(store_id)` PostgreSQL security definer function (`stores.owner_id = auth.uid()`)

### 1.2 Store Lifecycle & Deployment Status
- **Module 7 Storefront Compiler:** Compiles deterministic JSON manifests (`store_draft_versions`, `store_wizard_sessions`). Stores reside in `draft` mode behind the project approval gate.
- **Store Traffic Capability:** Stores are multi-tenant and hosted within the Next.js runtime. Production stores awaiting custom domain deployment do not receive external organic web traffic automatically.
- **Traffic Reality Constraint:** **No third-party analytics provider (Google Analytics, Mixpanel, PostHog) is pre-configured or active.** Fabricating production metrics or claiming live internet visitor traffic without event collection would violate data integrity.

---

## 2. Existing Data Models & Contracts Audit

| Entity / Dimension | Existing Source (Module 8) | Status for Analytics (Module 9) |
| :--- | :--- | :--- |
| **Stores** | `public.stores` (`id`, `project_id`, `owner_id`, `name`, `status`) | Implemented & verified. Tenant boundary anchor. |
| **Products** | `public.products` (`id`, `store_id`, `name`, `slug`, `price_pkr`, `stock`) | Implemented & verified. Product view and sales target. |
| **Orders** | `public.orders` (`id`, `store_id`, `total_pkr`, `status`, `created_at`) | Implemented & verified. Base source for sales, revenue, and AOV. |
| **Order Items** | `public.order_items` (`id`, `order_id`, `product_id`, `quantity`, `total_price_pkr`) | Implemented & verified. Base source for product revenue and units sold. |
| **Customers** | `public.customers` (`id`, `store_id`, `total_orders`, `lifetime_spend_pkr`) | Implemented & verified. Directory of transacting customers. |
| **Event Collection** | *None in database prior to Module 9* | **Missing**. Must be created as a first-party, privacy-safe event schema. |
| **Sessions / Visitors** | *None* | **Missing**. Requires pseudonymous session hash pipeline. |
| **Funnel & Cart Abandonment**| *None* | **Missing**. Requires `add_to_cart`, `begin_checkout`, `purchase` tracking. |
| **Referrers & UTM Tracking** | *None* | **Missing**. Requires safe referrer and UTM parameter capture. |
| **Analytics Reporting (PDF)** | *Invoice HTML exists in M8* | **Missing for Analytics**. Needs print-ready and downloadable PDF analytics reports. |

---

## 3. Area Status & Concrete Evidence Matrix

| Area | Status | File Paths / Evidence | Notes / Constraints |
| :--- | :--- | :--- | :--- |
| **Store Ownership & Auth Guards** | **Implemented & Verified** | `supabase/migrations/20261006060000_module8_store_management_schema.sql`<br>`src/lib/store-management/` | All API routes enforce `getUser()` and `can_manage_store(store_id)` (403 on mismatch). |
| **Order & Sales Aggregation** | **Partial** | `src/app/api/stores/[id]/overview/route.ts` | Provides basic count and gross total, but lacks date-range filters, trend intervals, and cancellation/refund breakdown. |
| **Event Ingestion Pipeline** | **Missing** | To be added in `supabase/migrations/20261006070000_module9_analytics_schema.sql` | Needs first-party ingestion route with rate-limiting, strict payload validation, and no personal data capture. |
| **Customer Behavior & Funnel** | **Missing** | To be implemented in `src/lib/analytics/` | Funnel metrics (`page_view` → `product_view` → `add_to_cart` → `begin_checkout` → `purchase`) and abandonment rate. |
| **Traffic Sources & UTMs** | **Missing** | To be implemented in `src/lib/analytics/` | Categorization: Direct, Organic Search, Social Media, Referral, UTM campaigns. |
| **PDF Analytics Report** | **Missing** | To be implemented in `src/app/api/stores/[id]/analytics/reports/` | Must be server-scoped, printable with `@media print`, XSS-safe, and truthful about data coverage. |
| **UI Dashboard** | **Partial** | `src/app/projects/[id]/store/page.tsx` | M8 has a 6-tab merchant panel. Needs a dedicated **Analytics Tab** or integrated analytics views with time series charts and behavior breakdowns. |

---

## 4. Integration Inventory

| Provider / Integration | Purpose | Actual Implementation | Status | Safe Verification Method |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL / Supabase** | Ingest orders, products, and first-party telemetry events | Direct SQL tables with RLS and indexed timestamps | **Ready** | SQL migration check and API integration tests. |
| **First-Party Telemetry** | Session tracking, page views, product views, cart events | Lightweight JSON API (`/api/stores/[id]/analytics/events`) | **To Implement** | Automated payload validation, rate-limiting, and idempotency tests. |
| **Google Analytics / Meta Pixel** | External ad/traffic tracking | None configured | **Unconfigured** | Label truthfully in docs; do not present mock Google Analytics data. |
| **Print / PDF Report Generator**| Executive summary report for store owners | Print-optimized HTML document with `@media print` CSS and window.print() + JSON export | **To Implement** | Automated DOM validation, XSS escaping, and format parity test. |

---

## 5. Metric Formulas & Anti-Corruption Rules

1. **Gross Sales:**
   $$\text{Gross Sales} = \sum \text{orders.total\_pkr} \quad \text{where status} \neq \text{'cancelled'}$$
2. **Net Revenue:**
   $$\text{Net Revenue} = \sum \text{orders.total\_pkr} \quad \text{where status} \in \{\text{'confirmed'}, \text{'packed'}, \text{'shipped'}, \text{'delivered'}\} - \sum \text{orders.total\_pkr} \quad \text{where status} = \text{'returned'}$$
3. **Cancelled Orders:** Count and PKR sum of orders where `status = 'cancelled'` (tracked separately).
4. **Returned / Refunded Orders:** Count and PKR sum of orders where `status = 'returned'` (deducted from net revenue).
5. **Average Order Value (AOV):**
   $$\text{AOV} = \begin{cases} \frac{\text{Net Revenue}}{\text{Fulfilled/Eligible Orders Count}} & \text{if count} > 0 \\ 0 & \text{if count} = 0 \end{cases}$$
6. **Visitors:**
   $$\text{Visitors} = \text{Count of distinct pseudonymous } \text{session\_id} \text{ within reporting period}$$
7. **Conversion Rate:**
   $$\text{Conversion Rate} = \begin{cases} \frac{\text{Total Completed Orders}}{\text{Visitors}} \times 100\% & \text{if Visitors} > 0 \\ 0\% & \text{if Visitors} = 0 \text{ (or marked unavailable)} \end{cases}$$
8. **Cart Abandonment Rate:**
   $$\text{Abandonment Rate} = \begin{cases} \frac{\text{Sessions with add\_to\_cart but no purchase}}{\text{Sessions with add\_to\_cart}} \times 100\% & \text{if Cart Sessions} > 0 \\ \text{Unavailable / 0\%} & \text{if Cart Sessions} = 0 \end{cases}$$

---

## 6. Implementation Sequence

1. **Database Migration (`supabase/migrations/20261006070000_module9_analytics_schema.sql`)**:
   - `store_analytics_events` table with privacy-safe pseudonymous session tracking, event type constraints, and indexes.
   - Forced RLS policy restricting reads to authorized store managers (`can_manage_store`).
2. **TypeScript Domain Models (`src/types/analytics.ts`)**:
   - Strict typing for analytics overview, time-series intervals (daily/weekly/monthly), product performance, funnel stages, traffic sources, and report documents.
3. **Analytics Domain Logic (`src/lib/analytics/`)**:
   - `metrics.ts`: Deterministic calculation of Gross Sales, Net Revenue, AOV, Conversion, and Abandonment with zero-division guards.
   - `events.ts`: Event ingestion validation, pseudonymous session hashing, and rate limiting.
   - `report.ts`: XSS-safe executive PDF/print report generator.
4. **Server API Routes (`src/app/api/stores/[id]/analytics/`)**:
   - `overview/route.ts`: KPI cards, summary metrics, comparison periods.
   - `trends/route.ts`: Daily/weekly/monthly time series (revenue, orders, visitors).
   - `products/route.ts`: Most-viewed and highest-converting products.
   - `behavior/route.ts`: Funnel visualization, cart abandonment, traffic source & UTM breakdown.
   - `events/route.ts`: First-party event ingestion endpoint.
   - `reports/route.ts`: Executive summary report generation (print-ready HTML/PDF + JSON).
5. **UI Dashboard Integration (`src/app/projects/[id]/store/page.tsx`)**:
   - Add **Analytics Tab** with date range selector (7D, 30D, 90D), summary KPI cards, trend charts, product ranking table, funnel visualization, traffic sources list, and one-click PDF Report download/preview modal.
   - Add honest "No events yet" state and an optional Sandbox Telemetry Simulation toggle.
6. **Documentation & Verification Suite**:
   - Create `docs/module-9-analytics.md`.
   - Update `docs/requirements-traceability.md` and `docs/api.md`.
   - Create automated verification script `scripts/verify-module9.mjs`.
