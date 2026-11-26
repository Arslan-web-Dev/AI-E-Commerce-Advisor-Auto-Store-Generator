# Module 8 implementation gap report

**Task:** Task 9 — Module 8: multi-tenant store deployment, customer storefront, SEO and admin dashboard.  
**Expected baseline:** `5cedf4f03e636f46b37e16f00b9b14abe766bf72` (Task 8 acceptance commit).  
**Actual baseline:** `c1d72c40461692dbebda364d9d4880b1683f1a70` (`main`, local and remote matched after `git fetch origin main`).  
**Baseline difference:** the single intervening commit `c1d72c4 update code` is evidence-only: SDD text extracts, sample images, evidence ZIP, screenshots, evidence-capture scripts and Python bytecode. It contains **no Module 8 source change**. This report therefore uses `c1d72c4` as the actual baseline and preserves that evidence.  
**Worktree at start:** clean. No unrelated dirty files were present after the baseline fetch.  
**Method:** read-only source, schema, migration, API, UI, test, documentation, CI and deployment-configuration audit before edits. No live Groq/Vercel/Supabase/browser/deployment call was made.  
**Authority note:** `docs/FINAL_DELIVERY_BASELINE.md:7` names a user-supplied October 2026 SRS/SDD v1.0 PDF as authoritative and states that the PDF is not checked in. No `*.pdf` exists in the repository. `final_sdd/_uni_sdd_text.txt` contains a university-format SDD text extract, including high-level Module 8 workflow statements at lines 267-272 and 331-337, but not the enumerated advanced FR/SEO source. This pass therefore uses `docs/FINAL_DELIVERY_BASELINE.md` together with the only checked-in enumerated registry, `docs/SRS.md:278-315` (FR-8.1–FR-8.12, SEO-1–SEO-5), and records the unresolved PDF-text conflict here. No missing requirement is invented.

## 1. Existing implementation found

### Merchant foundations (partial, reusable)
- Additive schema exists in `supabase/migrations/20261006060000_module8_store_management_schema.sql`: `products`, `orders`, `order_items`, `customers`, `inventory_logs`, `store_payment_settings`, `can_manage_store()`, `ENABLE`/`FORCE ROW LEVEL SECURITY` and owner/admin policies. Later hardening in `20261119030000_audit_storage_and_hardening.sql` adds published/unbanned public product reads and private attachments.
- Merchant APIs exist under `src/app/api/stores/[id]/**` for products, inventory, orders, customers, overview and payments. Most routes explicitly check `store.owner_id === user.id || is_admin()`.
- Merchant UI exists at `src/app/projects/[id]/store/page.tsx` with tabs, modals, KPI cards, product table, stock controls and order transitions.
- Order state-machine helpers exist in `src/lib/store-management/orders.ts`; inventory helpers, invoice escaping/generator and truthful payment-provider metadata exist in the same library.
- AI description API skeleton exists at `src/app/api/stores/[id]/products/[productId]/description/route.ts` and uses the governed gateway with `requiresReview: true`.

### Public storefront foundations (partial, schema-blocked)
- Eight pages exist under `src/app/[slug]/`: home, catalogue, product detail, cart, checkout, confirmation, about and contact.
- Public APIs exist at `src/app/api/storefront/[slug]/products/route.ts` and `orders/route.ts`.
- Tenant-themed layout, partial metadata, Store/Product JSON-LD, sitemap and robots files exist.
- Module 7 strict theme schema exists in `src/lib/theme/schema.ts`; current storefront layout reads older flat keys and does not map `theme.v1`.

### Deployment/admin foundations (partial, insecure or mock)
- Merchant publish route exists at `src/app/api/stores/[id]/publish/route.ts`.
- Admin route group exists under `src/app/api/admin/stores/**` and `src/app/admin/page.tsx`.
- `RESERVED_SLUGS` and `isValidSlug()` exist in `src/app/api/admin/stores/route.ts` but are never called.
- No `vercel.json`, root-domain environment variable or Vercel token/project variables exist.

## 2. Confirmed critical defects

### 2.1 Project-to-store association is wrong
`src/app/api/projects/[id]/store/route.ts:21-37` correctly checks that the project belongs to the caller/admin, but `:40-46` then selects the newest store by `owner_id` only and ignores `project_id`. Provisioning at `:52-68` inserts no `project_id`. Consequences:
- two projects owned by one user can resolve to one shared store;
- admin provisioning assigns the store to the admin rather than the project owner;
- Module 7 already uses the correct per-project lookup in `src/lib/theme/persistence.ts:127-169`; the store resolver does not;
- `src/app/api/projects/[id]/storefront-wizard/route.ts:272-317` repeats the owner-only lookup.

Required fix: one project → one store, via authoritative `project_id`, owner-or-admin authorization, idempotent provisioning and database uniqueness/advisory locking for concurrency.

### 2.2 Publishing is unauthorized and keyed to a non-existent column
`src/app/api/stores/[id]/publish/route.ts:12-38` requires only authentication; it never checks store ownership or admin role. Any authenticated user can publish/unpublish another user's store. It toggles `is_published`, but committed migrations define `stores.status public.store_status` and `is_banned`; no `is_published` column exists. The admin publish route has the same column error and additionally ignores update errors and banned status.

Required fix: explicit owner/admin authorization, banned-store rejection, validation of slug/storefront prerequisites, explicit publish/unpublish actions (not an accidental toggle), lifecycle audit, wildcard URL from configured root domain only after readiness, and preservation of data/domain/theme.

### 2.3 Custom-domain status is fabricated
`src/app/api/stores/[id]/domain/route.ts`:
- `GET` is unauthenticated;
- `POST` authenticates but never verifies store ownership/admin role;
- `status: 'verified'` is returned solely because `custom_domain` is non-empty;
- DNS records are hard-coded CNAME strings;
- no Vercel API call, TXT/DNS verification, polling, conflict handling or lifecycle metadata exists.

Required fix: server-only Vercel Domains API integration, real provider status, honest `pending`/`verified`/`failed`/`not_configured` states, real provider-returned DNS data only, owner/admin guards, uniqueness/conflict handling and audited domain changes.

### 2.4 Two conflicting product/order data models
Merchant code uses `products`, `orders`, `order_items`, `stock`, `shipping_address` and `stores.status`. Public storefront/admin code uses non-existent `store_products`, `store_orders`, `store_order_items`, `stock_quantity`, `delivery_address` and `is_published`. No checked-in migration defines the latter. Consequences:
- public catalogue silently returns `[]` when the query fails;
- guest checkout inserts into absent tables and cannot work;
- merchant dashboard never sees customer orders;
- admin store list selects absent relationships;
- public RLS policies keyed to `status='published'` deny reads even if `is_published` existed at runtime.

Required fix: one canonical model — the committed merchant schema — used by storefront, guest checkout, owner dashboard and admin. Remove legacy `store_*` reads/writes rather than adding a duplicate inventory system.

### 2.5 Checkout and inventory writes are non-atomic and oversell-prone
`src/app/api/storefront/[slug]/orders/route.ts` reads stock, computes totals, inserts an order, inserts items and decrements stock as separate writes. Item-insert errors are ignored. Quantity is not validated as a positive integer. No idempotency key or unique order number exists. Concurrent requests can both pass the stale stock check. Rate limiting is a process-local `Map` keyed on spoofable `x-forwarded-for`.

Merchant order creation, inventory adjustment and status transitions are similarly non-transactional. `Math.max(0, stock - qty)` logs a negative delta even when no stock was actually removed. Stock is decremented at guest checkout but only on `pending → confirmed` by the merchant state machine. `returned` does not restore stock.

Required fix: narrowly granted `SECURITY DEFINER` RPCs with row locks, integer PKR totals from database prices, atomic order/item/customer writes, conditional stock updates, idempotency, append-only status/inventory history and durable abuse protection.

## 3. Requirement-by-requirement gap summary

| Requirement | Pre-implementation classification | Evidence |
| --- | --- | --- |
| FR-8.1 | PARTIAL | DB regex/unique slug exists; reserved list unused; no owner slug editor or server validation route. |
| FR-8.2 | INSECURE / SCHEMA-BLOCKED | Unauthorized toggle; wrong column; no wildcard URL/provider readiness. |
| FR-8.3 | MOCK / INSECURE | Fake verified status; no Vercel integration; no auth/ownership on GET. |
| FR-8.4 | PARTIAL / INSECURE | Toggle exists but no explicit action, audit or correct schema field. |
| FR-8.5 | CODE-BACKED PAGES / SCHEMA-BLOCKED | Eight files exist; wrong tables/columns; no browser evidence. |
| FR-8.6 | PARTIAL | Flat legacy theme keys; no `theme.v1` mapping; no 375 px evidence. |
| FR-8.7 | PARTIAL / SCHEMA-BLOCKED | Server price re-read exists; writes to absent tables; weak rate limit. |
| FR-8.8 | PARTIAL | CRUD exists; no verified Storage bucket/upload/quota; public catalog disconnected. |
| FR-8.9 | PARTIAL API / UI GAP | Gateway route exists; no tone/language/keyword/length UI workflow evidence. |
| FR-8.10 | PARTIAL / BROKEN END TO END | State machine exists; non-atomic; no return restock; guest orders absent. |
| FR-8.11 | PARTIAL | KPIs exist; no SEO summary; no real guest order revenue. |
| FR-8.12 | PARTIAL | Admin list/suspend/provider health exist; absent columns, no usage/AI-log view, no audit. |
| SEO-1 | PARTIAL | Some metadata; no length validation on cart/checkout/confirmation/catalogue. |
| SEO-2 | PARTIAL | Store/Product JSON-LD; no BreadcrumbList; unsafe JSON injection. |
| SEO-3 | PARTIAL / HARDCODED | Sitemap/robots exist but use hardcoded `platform.pk` and absent tables. |
| SEO-4 | PARTIAL | OG/alt/headings exist; no canonical URLs. |
| SEO-5 | MOSTLY DOCUMENTATION-ONLY | AI route and unused score helper exist; no keyword/length enforcement or wired score. |

## 4. Documentation and evidence gaps
- `docs/requirements-traceability.md:20` labels Module 8 “Complete”; `docs/FINAL_DELIVERY_BASELINE.md:58` correctly says not complete end to end. The unsupported label must be replaced with code/test-backed evidence.
- `docs/module-8-store-management.md` mislabels FR-8.9/8.11/8.12 and describes only the merchant panel, not SRS Module 8.
- `docs/module-8-implementation-audit.md` is historical (old baseline `a72ae7d`) and must not be treated as current status.
- `docs/api.md` lacks publish/domain/public/SEO/admin contracts and incorrectly claims blanket store ownership verification.
- `docs/data-and-integrations.md` stops at Module 7.
- `.env.example` lacks root-domain and Vercel variables.
- No `tests/module8*.mjs` exists. `scripts/verify-module8.mjs` is a source-string checker; its `113 passed` result is not behavioural evidence.
- CI runs `node --test tests/*.mjs` but has no migration/RLS or Module 8 behavioural suite.

## 5. Implementation decisions for this task
1. Treat `products`, `orders`, `order_items`, `customers`, `inventory_logs`, `store_payment_settings` and `stores.status` as the single authoritative model.
2. Add only forward-only additive migrations: publication/domain lifecycle columns, order idempotency/history, rate-limit table, storage bucket/policies, and secure RPCs. Preserve Modules 1–7 objects and append-only theme history.
3. Fix project→store resolution with `project_id`, owner-or-admin checks, idempotent provisioning and DB uniqueness.
4. Replace fake domain verification with real Vercel API calls and honest provider states; no fabricated DNS records.
5. Move guest checkout and order transitions into transactional, narrowly granted RPCs; stock is decremented on `pending → confirmed` and restored on cancellation/return from a stock-applied state.
6. Keep wildcard-subdomain routing in one app deployment; resolve tenants from validated host/path and never trust arbitrary host headers or client store IDs.
7. Complete SEO using stored theme/SEO fields, safe JSON-LD serialization, canonical URLs, tenant sitemap/robots and a transparent score.
8. Add behavioural mocked tests for deployment, checkout, fulfilment and SEO; record live integrations as unverified.

## 6. Out of scope
No feasibility scoring, OI-6/model changes, Module 6 thresholds, Module 7 schema/history rewrite, online payment gateways, coupons, reviews, PDF invoices, visitor analytics, per-store Vercel builds or fabricated provider/deployment results.

## 7. Pre-implementation verdict
**Module 8 is NOT complete end to end at the actual baseline.** The confirmed defects above are addressed in this task with code-backed local evidence; live Supabase/RLS, Vercel, browser and deployed-runtime behavior will remain explicitly unverified unless a named check is actually run.
