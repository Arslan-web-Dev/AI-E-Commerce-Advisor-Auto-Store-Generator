# Module 9: Generated Store Analytics, Customer Behavior, Traffic Insights, and Reports

**Module:** Module 9 — Analytics for Generated Stores  
**SRS Reference:** `docs/SRS.md` (§4.13) / SRS v2.0  
**Status:** Implemented & Verified  

---

## 1. Overview & Architecture

Module 9 provides an end-to-end analytics and executive reporting engine for store owners on the **AI E-Commerce Advisor & Auto Store Generator** platform. It aggregates performance from real database records (orders, line items, products) and verified first-party session telemetry.

### Core Architecture Principles

1. **Truth in Metrics:** No fabricated traffic, synthetic orders, or guessed conversion numbers. Metrics are derived from persisted database records.
2. **Defensive Invariant Calculations:** Zero-division safe formulas for AOV, conversion rate, and cart abandonment rate.
3. **Multi-Tenant Security:** Forced PostgreSQL Row-Level Security (RLS) and server-side ownership verification (`can_manage_store(store_id)`).
4. **Privacy-Conscious First-Party Telemetry:** Pseudonymous session hashing, strict payload validation, and zero collection of personal identity or payment credentials.
5. **Print-Ready Executive PDF Reports:** Server-scoped, XSS-escaped, print-ready HTML/PDF generation with `@media print` typography and compliance disclosures.

---

## 2. Metric Definitions & Formulas

| Metric | Source | Mathematical Formula | Handling of Outliers / Edge Cases |
| :--- | :--- | :--- | :--- |
| **Gross Sales** | `public.orders` | $\sum \text{orders.total\_pkr}$ where `status != 'cancelled'` | Excludes cancelled orders entirely. |
| **Net Revenue** | `public.orders` | $\sum \text{orders.total\_pkr}$ (fulfilled) $- \sum \text{orders.total\_pkr}$ (returned) | Fulfilled includes `confirmed`, `packed`, `shipped`, `delivered`. Returns are deducted. Bounded at $\ge 0$. |
| **Cancelled Orders** | `public.orders` | Count & PKR sum of orders where `status = 'cancelled'` | Isolated in reporting to prevent double counting. |
| **Returned Orders** | `public.orders` | Count & PKR sum of orders where `status = 'returned'` | Tracked separately and deducted from net revenue. |
| **Average Order Value (AOV)**| Derived | $\frac{\text{Net Revenue}}{\text{Fulfilled Orders Count}}$ | Defaults safely to `0` if fulfilled orders count is `0`. |
| **Visitors** | `store_analytics_events` | Count of distinct pseudonymous `session_id` | De-duplicated per reporting period. |
| **Conversion Rate** | Derived | $\frac{\text{Fulfilled Orders Count}}{\text{Visitors Count}} \times 100\%$ | Defaults safely to `0.0%` if visitors count is `0`. |
| **Cart Abandonment Rate**| `store_analytics_events` | $\frac{\text{Sessions with add\_to\_cart but no purchase}}{\text{Total Sessions with add\_to\_cart}} \times 100\%$ | Explicitly marked **Unavailable** when `add_to_cart` events count is `0`. |

---

## 3. Database Schema & Privacy Architecture

### Schema Migration: `20261006070000_module9_analytics_schema.sql`

```sql
create table if not exists public.store_analytics_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id text not null, -- Pseudonymous session hash (privacy-safe, no personal data)
  event_type text not null check (
    event_type in ('page_view', 'product_view', 'add_to_cart', 'remove_from_cart', 'begin_checkout', 'purchase')
  ),
  product_id uuid references public.products(id) on delete set null,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### Privacy & Security Guarantees
- **No PII:** No user emails, names, phone numbers, or IP addresses are persisted in analytics telemetry.
- **Payload Sanitization:** String inputs are truncated (`session_id` $\le 128$ chars, `referrer` $\le 500$ chars, UTM params $\le 100$ chars) to prevent storage abuse.
- **Forced RLS:** Owners can only query events for their own stores (`can_manage_store(store_id)`). Public visitors can only insert events for valid, unbanned stores.

---

## 4. API Endpoints Reference

All endpoints are rooted at `/api/stores/[id]/analytics/` and enforce server-side session authentication (`getUser()`) and store ownership (`403 Forbidden` on mismatch).

### 1. `GET /api/stores/[id]/analytics/overview`
- **Query params:** `?range=7d|30d|90d|all`
- **Response:**
  ```json
  {
    "storeId": "s123",
    "storeName": "Organic Wild Honey Store",
    "currency": "PKR",
    "dateRange": { "preset": "7d", "startDate": "...", "endDate": "..." },
    "kpis": {
      "grossSalesPkr": 145000,
      "netRevenuePkr": 132000,
      "totalOrders": 18,
      "averageOrderValuePkr": 8250,
      "visitorsCount": 420,
      "pageViewsCount": 1850,
      "conversionRatePercent": 3.8,
      "cartAbandonmentRatePercent": 62.5,
      "cancelledOrdersCount": 2,
      "cancelledOrdersAmountPkr": 8000,
      "returnedOrdersCount": 1,
      "returnedOrdersAmountPkr": 5000,
      "delta": {
        "grossSalesDeltaPercent": 14.2,
        "netRevenueDeltaPercent": 11.5,
        "ordersDeltaPercent": 5.8,
        "aovDeltaPercent": 4.1
      }
    }
  }
  ```

### 2. `GET /api/stores/[id]/analytics/trends`
- **Query params:** `?range=7d|30d|90d`
- **Response:** Array of daily time series points (`date`, `label`, `grossSalesPkr`, `netRevenuePkr`, `orders`, `visitors`, `pageViews`).

### 3. `GET /api/stores/[id]/analytics/products`
- **Query params:** `?range=7d|30d|90d`
- **Response:** Array of products sorted by revenue (`productId`, `productName`, `views`, `unitsSold`, `revenuePkr`, `conversionRatePercent`).

### 4. `GET /api/stores/[id]/analytics/behavior`
- **Response:** Customer funnel stages, cart abandonment analysis, and traffic sources breakdown.

### 5. `POST /api/stores/[id]/analytics/events`
- **Payload:** `{ store_id, event_type, session_id, product_id?, referrer?, utm_source? }`
- **Public Ingestion:** Records first-party telemetry events safely.

### 6. `GET /api/stores/[id]/analytics/reports`
- **Query params:** `?range=30d&format=html|json`
- **Response:** Print-ready HTML document with `@media print` styles and `window.print()` trigger, or JSON export.

---

## 5. UI Integration

- **Route:** `/projects/[id]/store`
- **Tab:** **"Analytics & Reports"**
- **Features:**
  - Dynamic Date Range Switcher (7 Days, 30 Days, 90 Days)
  - 4 High-Impact KPI Summary Cards with comparison deltas
  - Interactive Daily Trend Bar Chart with hover tooltips
  - 5-Stage Customer Conversion Funnel (Visitors $\to$ Views $\to$ Cart $\to$ Checkout $\to$ Purchase)
  - Cart Abandonment Rate with honest fallback when events are missing
  - Traffic & UTM Attribution Channels
  - Top Performing Products Leaderboard
  - **One-Click Executive PDF Report Preview & Print Modal**
  - **Sandbox Telemetry Simulation Trigger** for developers to test events in draft stores

---

## 6. Verification

Run the verification test suite:
```bash
node scripts/verify-module9.mjs
```

**Results:** **38/38 checks passed.**
