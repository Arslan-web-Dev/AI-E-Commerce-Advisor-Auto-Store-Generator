# Final Remaining Work and Next Tasks

- **Audit date:** 2026-11-26
- **Repository HEAD:** `1b0af8a6157ee029c85f69c135406afd18515147`
- **Nature:** audit-only handoff. No implementation was started; no source, migration, database or git state was changed by this task.

## 1. Executive audit answers

1. **Is the repository complete?** No. It is a substantial code-backed FYP build, but several functional defects and missing live acceptance evidence remain. Overall status: **PASS WITH LIMITATIONS**.
2. **Is it production-ready?** No. Live Supabase/RLS, provider calls, browser/responsive/WCAG behavior, Vercel/DNS deployment, guest checkout runtime and performance targets are **UNVERIFIED**.
3. **What is the requirements authority?** The user-described advanced October 2026 SRS/SDD v1.0 PDF is not checked in. The repository baseline and traceability registry are used with that limitation; no missing wording was invented.
4. **Which modules are strongest?** Modules 3–7 have the most coherent local code plus mocked/behavioral tests. Module 8 has broad code coverage but real defects. Module 4 production serving is **BLOCKED** by OI-6.
5. **Is Groq real?** Yes. Groq is wired through the single server-only gateway, is Groq-only for theme, first for product descriptions and final fallback for advisory. Live success is **UNVERIFIED**.
6. **Is Supabase coherent?** Ordered migrations are largely coherent. `combined_schema.sql` is stale/**BROKEN** as a standalone artifact, and `projects.description` vs `product_description` is a real code/schema mismatch.
7. **Are integrations live?** No. Vercel domain, Overpass, Pytrends, GitHub REST, Gemini, Groq and deployed Supabase behavior are statically coded but not live-proven.
8. **Are tests/CI enough?** CI is **IMPLEMENTED** and passing for HEAD, but tests are mostly static/mocked. No live DB, browser, E2E, accessibility, performance or deployment job exists.
9. **What are the critical defects?** Callback open redirect, checkout idempotency omission, merchant order price trust, AI SEO check misuse, robots custom-domain host, combined schema, advisory ownership reliance on RLS, unauthenticated market upstream calls, non-atomic admin sync/model activation, and ML predict schema mismatch.
10. **What is the next task?** Fix the P0 security, schema and checkout blockers first, then run controlled live verification. The single prompt for that task is provided in the final response, not duplicated here.

## 2. Decisions carried forward

| Decision | Result | Status |
| --- | --- | --- |
| Advanced PDF authority | Not locally available; use baseline/traceability and checked-in SRS only where they agree. | **UNVERIFIED** |
| Evidence commit `1b0af8a` relative to `a3c0d54` | Evidence-only: screenshots/ZIP/capture script; no app source. | **IMPLEMENTED** |
| Module 8 completion | Code broadly present, but not end-to-end complete. | **PARTIALLY IMPLEMENTED** |
| Groq integration | Real gateway adapter, no duplicate client; live call unverified. | **IMPLEMENTED** code / **UNVERIFIED** live |
| Supabase canonical source | Ordered 30 migrations plus manual AI runtime SQL; not `combined_schema.sql`. | **IMPLEMENTED** |
| ML serving | OI-6 remains open; production serving intentionally blocked. | **BLOCKED** |
| Mocked/static tests | Local contract evidence only, not live acceptance. | **PARTIALLY IMPLEMENTED** |
| Final handover verdict | `PASS WITH LIMITATIONS`. | **IMPLEMENTED** audit conclusion |

## 3. P0 — must fix before live end-to-end verification

| ID | Task | Requirement IDs | Evidence / files | Acceptance evidence | Status |
| --- | --- | --- | --- | --- | --- |
| P0-1 | Fix OAuth callback open redirect by mirroring the stricter login guard: reject `/\`, backslashes, encoded separators and non-local URLs before `new URL()`. | FR-1.2, NFR-SEC1–SEC5 | `src/app/auth/callback/route.ts:9-14,59`; `src/app/login/page.tsx:14-18` | unit test with `/\evil.com`, `%5C`, `https://evil.com`, `javascript:`; local redirect test | **BROKEN** |
| P0-2 | Add explicit owner/admin predicates to feasibility/advisory/simulation/action routes instead of relying only on RLS. | FR-1.4, FR-6.5, FR-6.7, DAT-3 | `src/app/api/projects/[id]/feasibility/route.ts`, `advisory/route.ts`, `advisory/simulation/route.ts`, `advisory/actions/[actionId]/route.ts` | cross-owner denial tests against live/populated DB | **PARTIALLY IMPLEMENTED** |
| P0-3 | Send a stable idempotency key from checkout and wire the confirmation page to the existing order lookup. | FR-8.7, NFR-R5 | `src/app/[slug]/checkout/page.tsx:64-72`; `src/lib/store-management/guest-checkout.ts`; `src/app/api/storefront/[slug]/orders/[orderNumber]/route.ts`; `checkout/confirmation/page.tsx` | double-submit produces one order; confirmation renders server-verified masked status | **BROKEN** |
| P0-4 | Replace the merchant sample-order POST client-price path with DB-derived pricing or remove it from the owner UI. | FR-8.7, NFR-SEC3 | `src/app/api/stores/[id]/orders/route.ts:83-211`; `src/app/projects/[id]/store/page.tsx:407-447` | no client-submitted price affects persisted totals; inserts are atomic or fully removed | **BROKEN** |
| P0-5 | Fix the AI description SEO validator call and persist/validate only reviewed text. | FR-8.9, SEO-5 | `src/app/api/stores/[id]/products/[productId]/description/route.ts:84`; `src/lib/store-management/seo.ts` | title rules applied to title, description rules to description; UI guidance correct | **BROKEN** |
| P0-6 | Fix robots host for verified custom domains. | SEO-3 | `src/app/[slug]/robots.ts:16-20`; `src/lib/store-management/seo.ts:201-212`; `tenant.ts:152-164` | generated `Sitemap:` uses verified custom host; wildcard path unchanged | **BROKEN** |
| P0-7 | Regenerate or retire `combined_schema.sql`; do not rerun it as an install script. | DAT-3, NFR-M2 | `supabase/combined_schema.sql`; all 30 migrations | empty-database replay from ordered migrations; combined file either regenerated or explicitly deprecated | **BROKEN** |
| P0-8 | Reconcile `projects.description` vs `projects.product_description` in public-store reads. | FR-8.5, SEO-1 | `src/lib/store-management/public-store.ts:16` | public store read succeeds against full migrated schema | **BROKEN** |
| P0-9 | Add live RLS/cross-tenant attack tests and an empty-database migration replay gate to CI or a controlled verification run. | FR-1.4, DAT-3, NFR-SEC2 | `supabase/**`, `.github/workflows/ci.yml` | anonymous/owner/admin/other-owner matrix passes; migration replay succeeds | **UNVERIFIED** |
| P0-10 | Restrict anonymous analytics ingestion and authenticated trend-cache writes; add abuse controls. | NFR-SEC5, FR-3.6 | `20261006070000_module9_analytics_schema.sql`, `20261123000000_ml_pipeline_and_market_intelligence.sql`, `/api/stores/[id]/analytics/events/route.ts` | arbitrary cross-store event/cache insertion denied or rate-limited | **PARTIALLY IMPLEMENTED** |
| P0-11 | Fix admin sync failure path so DB fetch failure prevents export/overwrite and audit inserts are checked. | FR-1.6 | `src/app/api/admin/sync/route.ts:47-64,96-159` | failed config fetch yields non-2xx and no GitHub PUT | **BROKEN** |
| P0-12 | Resolve OI-6 or keep ML serving explicitly blocked; fix `/predict` feature vector and classification risk output. | FR-4.3–FR-4.7 | `ml-service/config/label_approval.json`, `main.py:583-705`, `src/app/admin/ml/page.tsx:223-237`, `/api/ml/predict/route.ts` | approved artifact or explicit blocked state; predict payload matches artifact schema and returns numeric risk | **BLOCKED / BROKEN** |

## 4. P1 — required before claiming full module acceptance

| ID | Task | Requirement IDs | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| P1-1 | Wire the custom-domain UI and fix provider failure/removal/switch state machine. | FR-8.3 | add/get/verify/remove buttons with DNS challenge display; provider-confirmed state only; no stale verified timestamp | **PARTIALLY IMPLEMENTED** |
| P1-2 | Move AI quota/circuit/cache to the existing shared runtime tables or document single-instance operation. | FR-6.2, NFR-R2, NFR-C5, NFR-C6 | multi-instance quota/circuit test or explicit accepted limitation | **PARTIALLY IMPLEMENTED** |
| P1-3 | Persist AI token usage and expose meaningful 80% quota warning. | NFR-C2, FR-6.2 | token counts in telemetry; admin/account warning at threshold | **PARTIALLY IMPLEMENTED** |
| P1-4 | Add auth and rate limits to market routes; verify edge handling of `x-forwarded-for`. | FR-3.6, NFR-SEC5 | anonymous abuse test; cache branch executes with service role or authenticated policy | **PARTIALLY IMPLEMENTED** |
| P1-5 | Block non-admin ML UI and remove swallowed errors from admin ML/market pages. | FR-1.3, FR-8.12 | non-admin sees no controls; API errors surfaced | **PARTIALLY IMPLEMENTED** |
| P1-6 | Make catalogue filter/search server-side before limit. | FR-8.5 | matching products beyond first 24 are returned | **PARTIALLY IMPLEMENTED** |
| P1-7 | Replace hardcoded SEO score signals with real checks. | SEO-5, FR-8.11 | canonical/JSON-LD/breadcrumb checks derived from rendered page data | **PARTIALLY IMPLEMENTED** |
| P1-8 | Add ML client timeouts and Python concurrency/rate limits. | NFR-R1, NFR-S3 | bounded request duration; queued jobs controlled | **BROKEN** |
| P1-9 | Validate product PATCH numeric fields, stock logs, and image MIME magic bytes. | FR-8.8, NFR-SEC3 | malformed price/stock returns 400; all stock changes logged | **PARTIALLY IMPLEMENTED** |
| P1-10 | Make admin model activation atomic or compensating. | FR-4.5, NFR-R5 | no Python/registry divergence after simulated failure | **PARTIALLY IMPLEMENTED** |

## 5. P2 — evidence and acceptance runs

| ID | Task | Requirement IDs | Acceptance evidence | Status |
| --- | --- | --- | --- | --- |
| P2-1 | Live Groq/Gemini provider smoke tests with values injected at runtime only. | FR-6.1–FR-6.4, FR-7.2 | sanitized logs showing provider, latency, success/fallback; no secret values | **UNVERIFIED** |
| P2-2 | Live Supabase populated database run of wizard → collect → process → feasibility → advisory. | FR-2.x–FR-6.x | run IDs, status transitions, stored provenance | **UNVERIFIED** |
| P2-3 | Browser E2E for eight storefront pages at 375 px and WCAG AA contrast. | FR-8.5, FR-8.6, UI | Playwright or manual signed record with screenshots | **UNVERIFIED** |
| P2-4 | Live guest COD order + owner status/inventory transition + idempotent replay. | FR-8.7, FR-8.10 | order numbers, status history, stock logs, single order after replay | **UNVERIFIED** |
| P2-5 | Live Vercel/DNS publish proof or explicit environment limitation. | FR-8.2, FR-8.3 | provider-confirmed verified domain and public URL | **UNVERIFIED** |
| P2-6 | Measure p90 feasibility, LCP, theme compile, concurrent users/stores. | NFR-P1–P4, NFR-S4 | recorded metrics and pass/fail against targets | **UNVERIFIED** |
| P2-7 | Wire all relevant `verify-*.mjs` scripts into CI and add security headers assertions. | CI, NFR-SEC5 | CI run with statuses | **PARTIALLY IMPLEMENTED** |
| P2-8 | Remove hardcoded operational claims from UI where live proof is absent. | UI, SI | UI labels reflect static vs live status | **PARTIALLY IMPLEMENTED** |

## 6. P3 — documentation and evidence hygiene

| ID | Task | Acceptance evidence | Status |
| --- | --- | --- | --- |
| P3-1 | Obtain or reconstruct the advanced October 2026 PDF and re-run the requirement matrix against exact wording/priorities. | updated traceability with source pages | **UNVERIFIED** |
| P3-2 | Reconcile `final_sdd` samples, `docs/SRS.md`, baseline, `requirements-traceability.md`, `MAIN_BRANCH_ANALYSIS.md` and evidence report contradictions. | one conflict register with decisions | **PARTIALLY IMPLEMENTED** |
| P3-3 | Remove hard-coded live URL/credentials from capture scripts and evidence report; rotate any exposed values. | env-driven scripts; no secrets in tracked files | **BROKEN** |
| P3-4 | Map `project-evidence/` screenshots to actual requirement IDs and distinguish demo-store proof from tenant/domain proof. | signed evidence index | **PARTIALLY IMPLEMENTED** |
| P3-5 | Document OI-1–OI-12 decisions with explicit open/accepted status. | decision register | **PARTIALLY IMPLEMENTED** |

## 7. P4 — cleanup and out-of-scope discipline

| ID | Task | Acceptance evidence | Status |
| --- | --- | --- | --- |
| P4-1 | Remove dead routes/components/helpers or label them explicitly as deprecated. | no unreferenced code in active module scope | **PARTIALLY IMPLEMENTED** |
| P4-2 | Remove tracked `__pycache__/*.pyc` artifacts. | clean tracked-file inventory | **PARTIALLY IMPLEMENTED** |
| P4-3 | Keep Module 9 analytics, coupons, reviews, PDF invoices and Stripe clearly out of completion gates. | baseline/limitations doc updated | **IMPLEMENTED** decision |
| P4-4 | Regenerate `docs/api.md` for the current route set, excluding dead/obsolete endpoints. | route inventory parity | **PARTIALLY IMPLEMENTED** |

## 8. Recommended execution order

1. P0-1 through P0-11 as one security/schema/checkout hardening pass, with no live deployment claims until tests pass.
2. P0-12 OI-6 decision: either keep serving **BLOCKED** with honest UI labels, or obtain approval before any production activation work.
3. P2-9 empty-database replay and RLS attack matrix in a controlled environment.
4. P1 domain/AI operational fixes.
5. P2 live evidence runs in a controlled deployment where secrets are injected by the platform.
6. P3/P4 documentation and cleanup.

## 9. Audit-only closing statement

This document records remaining work; it does not authorize or begin implementation. All seven audit documents were created only after the complete source, SQL, AI, integration, workflow, test and documentation review finished.
