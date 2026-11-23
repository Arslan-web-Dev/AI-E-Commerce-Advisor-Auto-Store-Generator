# Implementation Progress

**Working branch:** `feat/complete-fyp-modules`  
**Base:** `main` at `6d07fa2`  
**Latest implementation commit:** `d0854445d5794bf64bee249433492530f08e98e0`

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
- Grants execution to the `anon` and `authenticated` roles; the function itself does not accept client-supplied prices, payment method, shipping fee, tax, or totals.

## Important integration gap

This is a database foundation, not a completed checkout flow. The existing `src/app/api/stores/[id]/orders/route.ts` is still an authenticated merchant order-creation route and its current POST implementation trusts client-submitted prices. A public storefront route must call the new RPC, and the merchant route must be separated from guest checkout. The existing order confirmation/status route also updates stock through multiple non-transactional calls; it must be replaced with an atomic, concurrency-safe database transition function before stock/order handling can be accepted.

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
| Migration committed to working branch | Yes |
| Migration applied to Supabase | Not run |
| SQL syntax / migration-from-empty test | Not run |
| Public guest checkout endpoint | Not implemented yet |
| Existing merchant price-trust vulnerability removed | Not yet |
| Atomic confirmation/cancellation stock transition | Not implemented yet |
| RLS / tenant isolation tests | Not run |
| Lint / typecheck / build | Not run |
| End-to-end browser test | Not run |
