# Implementation Progress

**Working branch:** `feat/complete-fyp-modules`  
**Base:** `main` at `6d07fa2`  
**Latest implementation commit:** `c2091d912c4cf7572e00757bbcea0dbb7a398e8c`

## Requirements authority

The advanced user-supplied October 2026 SRS/SDD v1.0, the revised November 2026 SRS, and the repository's `docs/FINAL_DELIVERY_BASELINE.md` are treated as cumulative project context. The eight source modules remain in scope. The revised SRS adds/clarifies requirements; it does not authorize silently removing modules or requirements from the advanced SRS. Where the sources conflict, record the exact conflict and follow the user's latest explicit direction; do not guess an unresolved product decision.

The repository baseline identifies the advanced October SRS/SDD as the requirements authority and contains the eight-module delivery sequence. The November Revised SRS adds clearer COD-only, Pakistan-first, scope and UX constraints. A formal clause-by-clause reconciliation remains required before marking the full project complete.

## Work started

### Security and Module 8 — checkout foundation

Added migration:
`supabase/migrations/20261123000000_secure_cod_checkout_and_private_attachments.sql`

Changes:
- Changes the `project-attachments` Supabase Storage bucket from public to private.
- Removes anonymous/public object reads for that bucket.
- Adds authenticated owner-folder read access consistent with the existing per-user folder convention.
- Adds `public.create_store_cod_order(...)`, a server-side PostgreSQL function for guest COD checkout.
- The function accepts product IDs and quantities, reads product names/SKUs/prices from the database, checks that the store is published and not banned, validates customer input, locks product rows, checks stock, and inserts the order and order items in one database transaction.
- Grants execution to the `anon` and `authenticated` roles; the function itself does not accept client-supplied prices, payment method, shipping fee, tax, or totals.\n- The merchant order POST route now validates product IDs/quantities and invokes the database function rather than accepting prices.\n- The merchant order PATCH route now invokes the atomic order transition function.\n- Added a COD-only database constraint for new/updated orders and disabled legacy online gateway settings.

### Atomic order-state foundation

Added migration `20261123010000_atomic_order_status_inventory.sql`:
- Adds `public.transition_store_order(...)` for authenticated store owners/admins.
- Validates the documented order state transitions.
- Locks the order, adjusts stock with guarded updates, writes inventory ledger rows, appends status history, and updates order fulfillment/payment fields in one transaction.
- Decrements stock when pending orders are confirmed; restores stock for eligible cancellations and returns.

This function is not yet connected to the existing PATCH route. Until that route is switched to the RPC and direct status mutation is removed, the existing non-transactional route remains a bypass and FR-8.10 is not accepted.

## Important integration gap

This is a database foundation, not a completed checkout flow. The authenticated merchant POST and PATCH routes are now wired to the database RPCs. However, the public guest storefront checkout route has not yet been added. The order status route's runtime behavior still needs testing against the deployed schema and real owner/admin sessions.

The migration has not been applied to a Supabase project. SQL execution, RLS behavior, concurrency tests, TypeScript checks, lint, build, browser checkout, and deployment have not been run. Do not report these as passed.

## Next implementation sequence

1. Read the installed Next.js 16.3.8 route-handler and data-mutation guides required by `AGENTS.md` before editing application routes.
2. Add a public tenant-slug checkout endpoint that invokes `create_store_cod_order`; keep owner-only order management protected.
3. Replace order status/stock mutations with a single database transaction and validate transitions, inventory, status history and audit rows.
4. Add integration tests for price tampering, cross-store product IDs, unpublished/banned stores, malformed quantities, concurrent checkout, and stock restoration.
5. Continue Modules 1–8 against the advanced SRS/SDD and revised SRS, updating the requirement traceability with actual acceptance evidence.

## Verification record

| Check | Status |
|---|---|
| Migrations committed to working branch | Yes |
| Migration applied to Supabase | Not run |
| SQL syntax / migration-from-empty test | Not run |
| Public guest checkout endpoint | Not implemented yet |
| Existing merchant price-trust vulnerability removed | Code now uses server-priced RPC; runtime verification pending |
| Atomic confirmation/cancellation stock transition | Database function connected to PATCH route; runtime verification pending |
| RLS / tenant isolation tests | Not run |
| Lint / typecheck / build | Not run |
| End-to-end browser test | Not run |

### Latest route and policy integration

- `src/app/api/stores/[id]/orders/route.ts`: authenticated merchant order creation now validates customer fields and accepts only product IDs plus integer quantities; database pricing and totals are authoritative.
- `src/app/api/stores/[id]/orders/[orderId]/route.ts`: owner/admin status changes now call the atomic transition RPC; status transitions are validated inside PostgreSQL.
- `20261123020000_enforce_cod_only_orders.sql`: adds a NOT VALID COD-only constraint (new and updated orders must use COD, historical non-COD rows are retained) and disables old Stripe/PayPal settings.
- Public guest checkout still needs a storefront-facing endpoint and UI integration. No Next.js runtime guide was available from the GitHub-only file interface; the repository's AGENTS.md requires reading the installed Next.js 16.3.8 guide before further Next route changes. This is an explicit tooling blocker for further Next.js route edits until a local project checkout is available.
