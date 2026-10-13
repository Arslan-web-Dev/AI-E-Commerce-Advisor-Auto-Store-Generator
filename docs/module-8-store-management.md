# Module 8: Post-Launch Store Management

## Architecture Overview

Module 8 provides the **Merchant Control Panel** — a secure, tenant-isolated management interface for generated stores. It connects directly to the storefront compiled by Module 7, giving store owners full operational control over products, inventory, orders, customers, and payment methods.

### Technology Stack

| Layer | Technology | Notes |
| :--- | :--- | :--- |
| UI | React Client Component (`'use client'`) | Tabbed SPA at `/projects/[id]/store` |
| API | Next.js Route Handlers (App Router) | 10 RESTful endpoints under `/api/stores/[id]` |
| Database | PostgreSQL via Supabase | 6 tables with RLS + ownership helper |
| Auth | Supabase Auth (JWT cookie) | `can_manage_store()` SQL function |
| Currency | Integer PKR (`bigint`) | No floating-point rounding errors |

---

## Database Schema

### Tables Created

| Table | Purpose | Key Constraints |
| :--- | :--- | :--- |
| `products` | Product catalog per store | `price_pkr >= 0`, `stock >= 0`, unique `(store_id, slug)` |
| `orders` | Customer orders | Status enum, FK → `customers` |
| `order_items` | Line items per order | FK → `orders`, FK → `products` |
| `customers` | Customer directory per store | Unique `(store_id, phone)` |
| `inventory_logs` | Audit trail for stock changes | Reason + actor + timestamp |
| `store_payment_settings` | Payment method configuration | Provider enum + `is_enabled` |

### Row-Level Security (RLS)

All 6 tables have:
- `ENABLE ROW LEVEL SECURITY`
- `FORCE ROW LEVEL SECURITY`
- Ownership verified via `can_manage_store(store_id)` — checks `stores.owner_id = auth.uid()`
- Separate policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`

### Migration File

`supabase/migrations/20261006060000_module8_store_management_schema.sql`

---

## Domain Logic

### Order Fulfillment Pipeline

**File:** `src/lib/store-management/orders.ts`

```
┌─────────┐    ┌───────────┐    ┌────────┐    ┌─────────┐    ┌───────────┐
│ pending  │───▶│ confirmed │───▶│ packed │───▶│ shipped │───▶│ delivered │
└────┬─────┘    └─────┬─────┘    └───┬────┘    └────┬────┘    └─────┬─────┘
     │                │              │              │               │
     ▼                ▼              ▼              ▼               ▼
┌──────────┐   ┌──────────┐  ┌──────────┐   ┌──────────┐    ┌──────────┐
│cancelled │   │cancelled │  │cancelled │   │ returned │    │ returned │
└──────────┘   └──────────┘  └──────────┘   └──────────┘    └──────────┘
```

**Key rules:**
- Stock decrements on `pending → confirmed`
- Stock restores on `cancelled` or `returned`
- Each transition is recorded in `status_history` JSON array

### Inventory Rules

**File:** `src/lib/store-management/inventory.ts`

- **Low stock threshold:** Configurable per product (default: 10 units)
- **Non-negative invariant:** Stock can never go below 0
- **Adjustments:** Logged with reason, actor, and delta in `inventory_logs`

### Invoice Generator

**File:** `src/lib/store-management/invoice.ts`

- XSS-safe HTML generation with `escapeHtml()` for all dynamic values
- PKR currency formatting (`Rs. X,XXX`)
- Print-ready layout with `window.print()` button
- Supports JSON export format

### Payment Provider Registry

**File:** `src/lib/store-management/payments.ts`

| Provider | Status | Notes |
| :--- | :--- | :--- |
| Cash on Delivery (COD) | ✅ Active by default | No gateway needed |
| Stripe | ⚙️ Not configured | Requires API keys |
| PayPal | ❌ Unsupported | Region limitation |
| JazzCash / EasyPaisa | 🔜 Planned | Future integration |

> **No fake payment charges.** The registry is truthful about integration status.

---

## API Endpoints

### Project-to-Store Resolver

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/projects/[id]/store` | Resolves project → store; provisions draft if needed |

### Store Management APIs

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/stores/[id]/overview` | KPI dashboard: revenue, orders, low-stock count |
| `GET` | `/api/stores/[id]/products` | List all products |
| `POST` | `/api/stores/[id]/products` | Create a new product |
| `GET` | `/api/stores/[id]/products/[productId]` | Get single product |
| `PUT` | `/api/stores/[id]/products/[productId]` | Update product details |
| `DELETE` | `/api/stores/[id]/products/[productId]` | Soft-archive product |
| `GET` | `/api/stores/[id]/inventory` | Stock monitor with low-stock filter |
| `POST` | `/api/stores/[id]/inventory` | Atomic stock adjustment with audit log |
| `GET` | `/api/stores/[id]/orders` | List orders with status filter |
| `POST` | `/api/stores/[id]/orders` | Create new order |
| `GET` | `/api/stores/[id]/orders/[orderId]` | Order detail with line items |
| `PATCH` | `/api/stores/[id]/orders/[orderId]` | Status transition (state machine) |
| `GET` | `/api/stores/[id]/orders/[orderId]/invoice` | Printable HTML or JSON invoice |
| `GET` | `/api/stores/[id]/customers` | Customer directory with lifetime spend |
| `GET` | `/api/stores/[id]/payments` | Payment provider status list |
| `POST` | `/api/stores/[id]/payments` | Toggle payment provider enablement |

### Security

Every endpoint:
1. Validates `getUser()` from Supabase session
2. Verifies `store.owner_id === user.id` (403 on mismatch)
3. Returns standard JSON error envelopes

---

## User Interface

**Route:** `/projects/[id]/store`

### 6-Tab Layout

| Tab | Features |
| :--- | :--- |
| **Overview** | KPI cards (revenue, orders, products, customers), low-stock alerts, recent orders |
| **Products** | Product table, search, create/edit modal, soft-archive, slug auto-generation |
| **Inventory** | Stock level grid, low-stock filter, stock adjustment modal with reason |
| **Orders** | Order list with status badges, create sample order, detail drawer, status transitions |
| **Customers** | Customer directory with lifetime spend and order count |
| **Payments** | Payment method cards with enable/disable toggles, status indicators |

### Sandbox Mode

The UI operates in **Sandbox Mode** since stores start as drafts. A prominent banner indicates this status. Sample orders can be created directly for testing.

### Modals

- **Product Modal:** Create/edit form with name, slug, price, compare-at price, stock, description
- **Stock Adjustment Modal:** Quantity delta (positive/negative) with mandatory reason
- **Order Detail Modal:** Full order view with status transition buttons
- **Invoice Viewer:** Inline iframe rendering the printable HTML invoice

---

## SRS Requirement Coverage

| SRS Requirement | Implementation |
| :--- | :--- |
| FR-8.8: Product CRUD & Price/Stock | Products API + Products tab |
| FR-8.9: Low-stock alerts | Inventory monitor + KPI alerts |
| FR-8.10: Order management & status | Order API + state machine |
| FR-8.11: Customer profiles & history | Customers API + directory |
| FR-8.12: Payment method management | Payments API + provider registry |
| FR-8.10: Printable invoices | Invoice generator + API endpoint |

---

## Setup

### 1. Run Database Migration

```bash
npx supabase db push
```

### 2. Access Store Management

Navigate to any submitted project → click **"Manage Store"** → the system provisions a draft store automatically.

### 3. Verify Installation

```bash
node scripts/verify-module8.mjs
```

---

## File Inventory

```
supabase/migrations/20261006060000_module8_store_management_schema.sql
src/types/store-management.ts
src/lib/store-management/
  ├── inventory.ts
  ├── orders.ts
  ├── invoice.ts
  └── payments.ts
src/app/api/projects/[id]/store/route.ts
src/app/api/stores/[id]/
  ├── overview/route.ts
  ├── products/route.ts
  ├── products/[productId]/route.ts
  ├── inventory/route.ts
  ├── orders/route.ts
  ├── orders/[orderId]/route.ts
  ├── orders/[orderId]/invoice/route.ts
  ├── customers/route.ts
  └── payments/route.ts
src/app/projects/[id]/store/page.tsx
```
