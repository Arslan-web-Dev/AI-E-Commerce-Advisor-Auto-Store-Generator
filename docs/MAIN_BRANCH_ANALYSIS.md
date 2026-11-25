# Main Branch Analysis — AI-Powered Business Feasibility Advisor for Punjab, Pakistan

**Analysis date:** 2026-11-23  
**Branch analysed:** `main` (detached read-only worktree)  
**Commit:** `545c7c6162c841189a9805b714e556531a6722d1`  
**Remote check:** `origin/main` resolves to the same commit as local `main` (after `git fetch origin --prune`).  
**Repository:** `Arslan-web-Dev/AI-E-Commerce-Advisor-Auto-Store-Generator`  
**Working branch while writing this report:** `fix/complete-module-1-module-2` (report file only; no commits to `main`).

> Scope: factual audit of the committed `main` branch. It does **not** describe the uncommitted remediation work already present in the working tree. All statements below are tied to files at commit `545c7c6`.
>
> **Superseded for Task 4:** the Module 3 persistence/idempotency finding in §2.1 was addressed by `20261125120000_module3_persistence_hardening.sql` and the orchestrator hardening. See `docs/module-3-data-collection.md` for the current Module 3 status; the line numbers and conclusions below remain historical evidence for commit `545c7c6`.

---

## 1. Repository Inventory (measured)

| Item | Count |
|---|---:|
| Source/config/doc files (excluding `node_modules`, `.git`, `.next`, caches, datasets, artifacts) | 239 |
| TypeScript (`.ts`) files / lines | 107 / 14,703 |
| React TSX (`.tsx`) files / lines | 45 / 13,845 |
| SQL migrations / lines | 17 / 3,207 |
| Python files / lines | 11 / 1,518 |
| JavaScript test/script files (`.mjs`) / lines | 12 / 1,306 |
| Markdown documents / lines | 29 / 3,448 |

Top-level directories: `.github`, `docs`, `ml-service`, `public`, `scripts`, `src`, `supabase`, `tests`.

Recent history on `main`:

```
545c7c6 push code
71811f3 update code
bcbeeb1 Merge pull request #3 from .../feat/module-1-module-2-auth-wizard-hardening
c779906 update code
d5cc528 update code
...
```

---

## 2. Detailed Findings

### 2.1 Module 2 — Business idea input, wizard, drafts and project creation

**What works on `main`**

- Every projects route (`src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `.../submit/route.ts`, `.../upload/route.ts`, `.../[id]/attachments/route.ts`) verifies the session with `supabase.auth.getUser()` and derives `owner_id` from the session, never from the request body.
- RLS is enabled and forced on `public.projects`, with owner select/insert/update/delete policies and protection against modifying submitted projects (`supabase/migrations/20261006000000_module2_projects_wizard_schema.sql:78-113`).
- Step-boundary draft persistence and draft restoration exist (`BusinessIdeaWizard.tsx`); the initial form itself does not preselect coordinates.
- Submit hard-checks coordinates, city, country, radius and canonical PKR budget, and creates a `pending` `feasibility_reports` row (`src/app/api/projects/[id]/submit/route.ts:66-145`).
- Attachments use a private bucket, owner-scoped storage policies and 1-hour signed URLs (`supabase/migrations/20261123010000_storage_and_rbac_hardening.sql:11-79`; `src/app/api/projects/[id]/attachments/route.ts:55-75`).

**Confirmed issues on `main`**

| Severity | Issue | Evidence |
|---|---|---|
| Critical | New wizard is pre-filled with a fabricated business concept (honey/walnut oil, PKR 250,000, invented audience, product tags). A user can submit it unchanged. | `src/components/wizard/BusinessIdeaWizard.tsx:42-67`; `src/lib/validation/project.ts:29-33,125-143`; `docs/FINAL_DELIVERY_BASELINE.md:88` |
| Critical | Draft restoration silently injects Lahore coordinates (`31.5204, 74.3587`) when the saved draft has none. The same silent fallback exists in the Module 3 handoff (`lat || 31.5204`, `city || 'Lahore'`, `budget || 15000`). | `BusinessIdeaWizard.tsx:111-112`; `src/lib/data-collection/orchestrator.ts:112-113,128-129,147,179,182` |
| Critical | Attachment upload is broken end-to-end: the wizard reads `resData.file_url`, but the API returns `storage_path`; draft uploads are never associated with the created project; upload errors are swallowed and a success response is returned; "Remove Attachment" only clears React state. | `BusinessIdeaWizard.tsx:379,365,393-402`; `src/app/api/projects/upload/route.ts:97-98,108-142` |
| High | Submission is a read-then-write sequence, not atomic or concurrency-safe. Two concurrent POSTs can create two reports; a report insert followed by a failed project update leaves an orphan report. `failed` status is not covered by the idempotency guard. | `src/app/api/projects/[id]/submit/route.ts:44-52,123-164` |
| High | Radius conflict: UI/validation/API accept 5–15 km, but `feasibility_reports.radius_km` is `smallint check (between 10 and 15)`, so valid 5–9 km drafts fail with a 500 on report insert. | `BusinessIdeaWizard.tsx:961-963`; `src/lib/validation/project.ts:63-67`; `src/app/api/projects/[id]/submit/route.ts:96-104`; `supabase/migrations/20261004000000_module1_auth_rbac_schema.sql:101` |
| High | Wizard is 5 steps, while SRS/reconciliation/traceability require 3. Repository docs are self-contradictory (`module-2-business-idea.md` and `MODULE_2_HANDOFF.md` describe 5 steps). | `BusinessIdeaWizard.tsx:525-573,1890`; `docs/SRS.md:210`; `docs/RECONCILIATION_MODULE_1_MODULE_2.md:11`; `docs/requirements-traceability.md:14` |
| High | UI claims "Auto-saved to cloud", but there is no debounced field-level autosave; saves happen only on navigation/manual actions. | `BusinessIdeaWizard.tsx:75,1892` vs `:147-206,1901` |
| Medium | Server-side validation is conditional: create validates only when `category` is present; PATCH validates only when `current_step` is present. Invalid currency/enums reach the database and surface as 500s. | `src/app/api/projects/route.ts:62-65`; `src/app/api/projects/[id]/route.ts:110-115,158` |
| Medium | Punjab scope is inconsistent: hub presets include Karachi and Islamabad while the UI claims Punjab; manual location input clears coordinates; postal code has no input field. | `src/types/project.ts:155-158`; `BusinessIdeaWizard.tsx:288-300,768`; `docs/requirements-traceability.md:14` |
| Medium | Two independent exchange-rate constants; `getExchangeRateInfo()` provenance is never called or persisted; minimum USD amount differs across UI/validation (100 / 500 / 50). | `src/types/project.ts:200`; `src/lib/currency/exchange-rate.ts:17-35`; `BusinessIdeaWizard.tsx:311,1092`; `src/lib/validation/project.ts:80-81` |
| Medium | Module 3 handoff ignores Supabase persistence errors, uses a 40-second heuristic for duplicate-run suppression, and has no unique constraint on collection runs. | `src/lib/data-collection/orchestrator.ts:49-88,293-345`; `supabase/migrations/20261006010000_module3_data_collection_schema.sql:8-19` |
| Medium | UI correctness defects: `NaN°` coordinate rendering when values are `undefined`, repeated "Coordinates Confirmed" blocks, description limit 500 in UI vs 2000 in validation, `physical` business model accepted by DB but absent from UI, fabricated fixed budget-allocation percentages. | `BusinessIdeaWizard.tsx:894-896,904,1156-1160,1234-1283`; `src/lib/validation/project.ts:30` |
| Low | Verification artifacts are static source-string assertions; they never execute the wizard, autosave, APIs, submit atomicity, or radius/DB interaction, yet traceability marks Module 2 complete. | `tests/module2-wizard-project.test.mjs:14-156`; `scripts/verify-module2.mjs`; `docs/requirements-traceability.md:14` |

**Severity summary:** 3 critical, 4 high, 6 medium, 1 low.

### 2.2 Module 1 — Authentication, authorization, account security and application security

**Controls correctly implemented on `main`**

- `public.is_admin()` is `SECURITY DEFINER` with a pinned `search_path = public` (`supabase/migrations/20261004000000_module1_auth_rbac_schema.sql:36-49`).
- `handle_new_user()` hardcodes `role = 'owner'` and only accepts `full_name` from user metadata (`:53-77`); signup metadata cannot self-assign admin.
- All reviewed admin API routes (`/api/admin/sync`, `/api/admin/models`, `/api/admin/stores`, `/api/admin/stores/[id]/{suspend,publish}`, `/api/admin/ai-providers`) independently call `auth.getUser()` and verify `profile.role === 'admin'`.
- Middleware uses `supabase.auth.getUser()` (server-validated) rather than `getSession()`; cookie refresh propagation follows the `@supabase/ssr` pattern (`src/lib/supabase/middleware.ts:30-50`).
- FastAPI protects every endpoint except `/` and `/health` with `verify_api_key` using `secrets.compare_digest`; CORS is an explicit allowlist with no wildcard (`ml-service/main.py:38-61,134-413`).

**Confirmed issues on `main`**

| Severity | Issue | Evidence |
|---|---|---|
| High | Hard-coded ML API key `internal-dev-ml-secret-key-2026` in both the Python service and the Next.js client. It is rejected only when `ENVIRONMENT` is exactly `"production"`; the default is `"development"`, and no deployment manifest sets these variables. | `ml-service/config.py:16-20`; `src/lib/ml-client.ts:7`; `ml-service/railway.json:7`; `ml-service/Procfile:1`; `.env.example` has no `ML_SERVICE_*` documentation |
| High | Auth middleware fails **open** when Supabase URL/key configuration is missing or invalid — protected pages, including the admin shell, are served without server-side session validation. | `src/lib/supabase/middleware.ts:19-28` vs protected-path list `:54-61`; `src/app/admin/page.tsx:1,110-146` |
| High | Account deletion requires only a valid session and typing `DELETE`; no password check, MFA, or recent-authentication/reauthentication step. | `src/app/api/auth/delete-account/route.ts:5-31`; `src/app/account/security/page.tsx:168-196,695-744` |
| High | The documented one-shot setup (`supabase/combined_schema.sql`) creates the `project-attachments` bucket as **public** with a world-readable policy. Only the final migration makes it private; deployments using the documented one-shot path expose all uploaded business documents. | `supabase/combined_schema.sql:1407-1417,1444-1447`; `README.md:35`; `supabase/migrations/20261119030000_audit_storage_and_hardening.sql:106-116,143-146`; fixed only in `20261123010000_storage_and_rbac_hardening.sql:12-23,26,45-54` |
| Medium/High | Forced password change is not enforced on API routes (`!pathname.startsWith('/api/')`), and profile-query errors default to `must_change_password = false`, so a temporary-password account can call privileged APIs. | `src/lib/supabase/middleware.ts:80-90`; `scripts/seed-admin.mjs:106,119` |
| Medium | Contradiction in forced-password flow: `/update-password` clears `must_change_password` via a profile update, but the RLS `WITH CHECK` requires that field to remain unchanged, so ordinary owners can change the Auth password yet remain flagged and redirected forever. | `src/app/update-password/page.tsx:73-79`; `20261004000000_module1_auth_rbac_schema.sql:229-244`; `20261123010000_storage_and_rbac_hardening.sql:86-95` |
| Medium | Open redirect in OAuth callback: `?next=/\evil.com` starts with a single `/`, passes the guard, and WHATWG `new URL()` normalises it to `https://evil.com/`. `login/page.tsx` also forwards unvalidated `redirectTo` to `router.push()`. | `src/app/auth/callback/route.ts:9-14,58-59`; `src/app/login/page.tsx:14,77,106` |
| Medium | Project upload trusts client-declared MIME/extension without signature inspection and passes the client MIME to storage; storage upload errors are logged but a success response is still returned and `product_file_url` is written. | `src/app/api/projects/upload/route.ts:4-23,45-67,100-142` |
| Medium/High | ML dataset upload has no size enforcement (the 50 MB config constant is unused) and uses the client filename directly (`ds_id + file.filename`), permitting path traversal/file writes outside the dataset directory. | `ml-service/main.py:138-168`; `ml-service/config.py:26-27` |
| Low/Medium | `/api/cron/rent-cache` has no auth or `CRON_SECRET` gate and performs a mutating upsert; anon RLS is expected to block the write, but the endpoint is unauthenticated. | `src/app/api/cron/rent-cache/route.ts:7-42`; `supabase/migrations/20261123000000_ml_pipeline_and_market_intelligence.sql:264-276` |

**Requires runtime verification (not statically provable)**

1. Whether the self-referencing `WITH CHECK` subqueries in `profiles_update_own` actually recurse through the SELECT policies on a real Supabase instance. `is_admin()` is `SECURITY DEFINER`, so recursion is not expected under a standard migration owner, but owner/admin `UPDATE profiles` needs to be exercised against a test database.
2. Final deployed storage bucket state (`select public from storage.buckets where id='project-attachments'`) and absence of residual public policies — depends on whether the target DB used migrations or `combined_schema.sql`.
3. Whether production actually sets `ENVIRONMENT=production` and a unique `ML_SERVICE_API_KEY`; no production manifest containing either was found.
4. External navigation behavior of `router.push()` with a full URL from the unvalidated login `redirectTo` query parameter.
5. Whether signed URLs render attacker-supplied MIME types inline (content spoofing vs stored XSS) in the target browser/CDN.
6. Whether the unauthenticated cron endpoint's upsert actually succeeds under deployed RLS/grants.

### 2.3 Entire-project architecture and module map

**Runtime topology**

```text
Browser
 ├─ Next.js 16 App Router pages/components (wizard, projects, admin, public [slug] storefront)
 ├─ Next.js route handlers (projects, analysis, stores, admin, market, ML, auth, cron)
 ├─ Supabase (Auth + SSR cookies, Postgres + RLS, private project-attachments bucket)
 ├─ External AI providers (OpenAI, Gemini, Groq)
 ├─ Python FastAPI ML/market service (datasets, training, prediction, trends, demand)
 ├─ OpenStreetMap Overpass
 ├─ GitHub REST API (admin config sync)
 └─ Vercel domain flow — mock/status only
```

`next.config.ts` defines CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and referrer/permissions policies.

**Module coverage (observed code, not runtime-verified)**

| Module | Implementation evidence | Factual status |
|---|---|---|
| 1 — Auth/RBAC | SSR clients, middleware, OAuth callback, sign-out, account deletion, admin APIs, profile/project/store RLS, private storage policies | Foundation present; several confirmed security defects (§2.2) |
| 2 — Business input | `BusinessIdeaWizard.tsx`, `/api/projects*`, validation, budget conversion, attachment upload, submit | Functional path with critical correctness defects (§2.1) |
| 3 — Data collection | `src/lib/data-collection/orchestrator.ts`, Overpass/PBS/Trends/cost providers + demo fallbacks, collection tables | Partial; Overpass adapter exists, live PBS/Trends success not proven; provenance-aware |
| 4 — Processing | `src/lib/data-processing/*`, `src/lib/scoring/mcda.ts`, processing/features tables | Partial; provisional MCDA, not a verified supervised model |
| 5 — Feasibility UI | `src/app/projects/[id]/feasibility`, competitor map/table, rent gauge, saturation meter, trend chart | UI foundation; requirement-level runtime evidence absent |
| 6 — Advisory | Multi-provider AI gateway (OpenAI → Gemini → Groq), cache, quota, circuit breaker, `ai_call_log` | Code exists; provider keys required; cache/quota/circuit state is process-local |
| 7 — Theme configurator | `storefront-wizard` page/route, allowlisted variant catalog, draft manifest compiler | Partial foundation; draft configuration only |
| 8 — Storefront/ops | Store provisioning, merchant APIs, public `[slug]` pages, COD orders, admin controls | Not complete end-to-end (schema mismatch, mock domain verification) |
| 9 — Analytics | `20261006070000_module9_analytics_schema.sql`, metrics/events/report libs, analytics routes | Code exists but `FINAL_DELIVERY_BASELINE.md` says Module 9 is outside the source requirement |

**Cross-cutting architecture mismatches**

- Public storefront and admin code query `is_published`, `stores.project_id`, `store_products`, `store_orders`, and `store_order_items`. The checked-in migrations define `stores.status`, `stores.report_id`, `products`, `orders`, and `order_items`, with no views/aliases bridging them (`src/app/[slug]/*`, `src/app/api/storefront/[slug]/*`, `src/app/api/admin/stores/route.ts` vs `supabase/migrations/20261006060000_module8_store_management_schema.sql`; `supabase/combined_schema.sql`).
- Domain verification is explicitly a mock (`src/app/api/stores/[id]/domain/route.ts`); no Vercel provider integration exists.
- Scoring is `provisional_mcda`; `xgboost` and `shap` are absent from `ml-service/requirements.txt` and the candidate registry.
- AI gateway circuit breaker, quota, cache, and public-order IP rate limit are in-process `Map`s, not shared across serverless instances.
- ML service keeps datasets, jobs, and the active model in memory; training is called synchronously despite accepting a `BackgroundTasks` parameter (`ml-service/main.py`).
- Several data sources are synthetic/benchmarked and labelled as such (demand trends, regional estimates, rent cron `confidence: 'low'`). No runtime proof of live PBS or Google Trends success is present.
- `.env.example` omits `ML_SERVICE_URL`, `ML_SERVICE_API_KEY`, `ML_SERVICE_HOST`, `ML_SERVICE_PORT`, `ENVIRONMENT`, and `ALLOWED_ORIGINS`.

**Documentation contradiction**

`docs/requirements-traceability.md` marks Modules 1–8 complete, including public storefront, publish/unpublish, custom domains, XGBoost, live trends, and full RLS verification. `README.md` and `docs/FINAL_DELIVERY_BASELINE.md` describe those areas as partial/incomplete and explicitly say earlier "Verified" labels are not current evidence. The code evidence supports the README/baseline view, not the traceability claims.

### 2.4 Tests, CI, migrations and documentation (supplemental audit)

**CI/build gaps (confirmed statically)**

- `.github/workflows/ci.yml:15-23,41-49` uses `cache: 'pnpm'` and `pnpm install --frozen-lockfile`, while the repository has only `package-lock.json` (npm, lockfileVersion 3) and no `pnpm-lock.yaml`. The pnpm cache is also configured **before** `pnpm/action-setup@v3` in both jobs.
- CI runs only `typecheck`, `build`, and one Python script. `npm run lint`, `tests/module1-auth-rbac.test.mjs`, `tests/module2-wizard-project.test.mjs`, all `scripts/verify-*.mjs`, and `ml-service/test_auth_security.py` are never invoked. `package.json:5-10` has no `test` or `typecheck` script.
- The Python script CI does run, `ml-service/test_pipeline.py:6-58`, contains **no `assert` statements**; it prints calls and then prints `ALL MODULE A & MODULE B TESTS PASSED!` unconditionally. It can only fail on an exception. `ml-service/requirements.txt` omits `pytest`, and all dependencies use unpinned `>=` ranges.

**Test/verification quality (confirmed statically)**

- Both `.test.mjs` suites are `fs.readFileSync(...).includes(...)` source-text checks — e.g. `tests/module1-auth-rbac.test.mjs:14-34,39-63,73-90` treats strings like `401`, `403`, `role !== 'admin'`, and `3600` as proof of RBAC/signed-URL behavior. `tests/module2-wizard-project.test.mjs:94-105` falls back to `.includes('5')`, `.includes('15')`, `.includes('10')` for radius assertions.
- `scripts/verify-module4.mjs:50-96` reimplements distance/dedup/budget logic locally instead of importing production modules; `verify-catalog-20plus.mjs:77,120-121` counts `componentType:` source strings; `verify-module9.mjs` and `verify-module8.mjs` are almost entirely `content.includes(...)`. None are wired to `package.json` or CI.
- Several verification scripts read relative paths from `process.cwd()` (`verify-module4.mjs:7`, `verify-module8.mjs:60`, `verify-module9.mjs:49,137,144,150`) and have no working-directory guarantee.

**Migration/RLS issues (confirmed statically)**

- `20261006000000_module2_projects_wizard_schema.sql:95-104`: the `projects_owner_update` `USING` clause requires `status = 'draft'`, but its `WITH CHECK` requires only ownership/admin. Because `WITH CHECK` validates the **post-update** row, an owner can change a draft's `status` to a non-draft value in the same statement, bypassing the submit route's guards.
- `supabase/combined_schema.sql` is stale: it omits the final hardening migration `20261123010000_storage_and_rbac_hardening.sql` entirely, appends the ML pipeline migration content without a `-- MIGRATION FILE:` marker (`:1456-1731`), and contains mojibake at `:828` (`FR-7.1â€“FR-7.6`). Bootstrapping from it does not reproduce the final hardened state.
- Module 8/9 policies use plain `create policy` without `drop policy if exists` (`20261006060000...sql:185-201`; `20261006070000...sql:44-61`), so re-running them conflicts.
- Analytics event insert policy checks only `s.is_banned = false`, not `status = 'published'` (`20261006070000...sql:50-57`), so events can be written for draft/suspended stores.
- `public.orders` has `order_number text not null` but no `unique (store_id, order_number)` constraint (`20261006060000...sql:58-81`). `market_trend_queries` permits unrestricted authenticated inserts with `with check (true)` and has no dedupe constraint (`20261123000000...sql:88-89,258-262`).
- Store draft versions have asymmetric admin RLS: `USING` allows owner or admin but `WITH CHECK` allows only the owner (`20261006050000...sql:84-99`).
- `supabase/manual/ai_gateway_runtime.sql` defines durable cache/usage/provider-state tables and functions, but no production code references them; the live gateway remains process-local (`src/lib/ai/cache/response-cache.ts:5-7`, `src/lib/ai/gateway/resilience.ts:9-12`).
- Migration header in `20261119030000_audit_storage_and_hardening.sql:1-5` names a different file (`20261006080000_audit_storage_and_hardening.sql`).

**Documentation status (confirmed statically)**

- `docs/FINAL_DELIVERY_BASELINE.md:6` pins the repository baseline to `main@8ddd83a` plus uncommitted changes — an older snapshot than the audited `545c7c6`.
- `docs/module-2-business-idea.md:24,27,101` and `docs/MODULE_2_HANDOFF.md:9-15,115` describe radius 5–25 km, different PKR/USD bounds, and five steps, while `src/lib/validation/project.ts:63-90` enforces 5–15 km and PKR 10,000–50,000,000 / USD 50–200,000.
- `docs/module-9-analytics.md:5,148` claims "Implemented & Verified" and "38/38 checks passed" based on the unwired `scripts/verify-module9.mjs`; `docs/module-7-storefront-compiler.md:109-111` claims historical 68/68, 40/40 and clean `tsc` results that cannot be reproduced from the repository alone.
- `docs/api.md:28,55` still uses USD budget examples; section numbering jumps (2→4, 5→8); `:522` claims all store endpoints verify ownership despite the separate admin-only route at `src/app/api/admin/stores/route.ts:18-25`.
- `docs/requirements-traceability.md:27` claims strict CSP/HSTS, but `next.config.ts:9-10,16,19` has HSTS without `preload`, `script-src` with `'unsafe-inline'`/`'unsafe-eval'` and CDN origins, and `img-src ... https:` allowing arbitrary HTTPS images.

**Confirmed but runtime-dependent**

- `src/app/api/stores/[id]/analytics/events/route.ts:9-64` exists, but the only production caller found is a sandbox simulation button (`src/components/store-management/AnalyticsPanel.tsx:92-110`); no storefront page/cart/checkout telemetry was found.
- `src/app/api/storefront/[slug]/orders/route.ts:6-17,26-29` rate-limits checkout via a process-local `Map` and trusts `x-forwarded-for`; effectiveness under serverless/spoofing is unverified.
- Live `pytrends` calls are implemented (`ml-service/trends/google_trends.py:77-84`) with an empirical baseline fallback (`:107-113`), contradicting `FINAL_DELIVERY_BASELINE.md:53`; whether Google returns data at runtime is unverified.

**Repository hygiene:** generated Python bytecode (11 tracked `.pyc` files), four committed `.joblib` model artifacts, and `ml-service/data/cache/trends_cache.json` are tracked; `.gitignore:1-42` does not ignore `__pycache__/`, `*.pyc`, or `ml-service/artifacts/*.joblib`.

---

## 3. Consolidated Risk Register

### P0 — release-blocking (confirmed on `main`)

| # | Risk | Why it blocks Modules 1–2 completion | Primary evidence |
|---|---|---|---|
| 1 | Wizard pre-fills an invented business idea and can be submitted unchanged | Violates the "never invent business data" baseline; fabricated text flows into `feasibility_reports.idea_text` | `BusinessIdeaWizard.tsx:42-67`; `docs/FINAL_DELIVERY_BASELINE.md:88` |
| 2 | Silent Lahore coordinates on draft resume and on Module 3 handoff (`lat ?? 31.5204`, `city ?? 'Lahore'`, `budget ?? 15000`) | Directly contradicts "Zero Silent Defaults"; produces analysis for the wrong city | `BusinessIdeaWizard.tsx:111-112`; `orchestrator.ts:112-113,128-129,147,179,182` |
| 3 | Attachment upload contract broken (`file_url` vs `storage_path`), draft files never linked to the project, upload errors reported as success | Users can lose documents and receive false success confirmations | `BusinessIdeaWizard.tsx:365,379`; `projects/upload/route.ts:97-142` |
| 4 | Submit is read-then-write, non-atomic and racy; `failed` excluded from idempotency guard | Duplicate reports, orphan rows, duplicate collection runs | `projects/[id]/submit/route.ts:44-52,123-164` |
| 5 | Radius 5–9 km passes UI/API validation but violates `feasibility_reports.radius_km check (10..15)` | Valid input produces HTTP 500 at submission | `validation/project.ts:63-67`; `20261004000000_module1_auth_rbac_schema.sql:101` |
| 6 | Hard-coded ML service key + fail-open environment guard (`ENVIRONMENT` defaults to `development`) | Known key can grant full ML API access in any deployment that misses one env var | `ml-service/config.py:16-20`; `src/lib/ml-client.ts:7` |
| 7 | Middleware returns `NextResponse.next()` when Supabase config is missing/invalid | Protected pages (including admin shell) served without server-side auth | `src/lib/supabase/middleware.ts:19-28,54-61` |
| 8 | Documented one-shot schema creates a public attachments bucket with world-readable policy | Uploaded business documents exposed to anonymous users on that setup path | `combined_schema.sql:1407-1417,1444-1447`; `README.md:35` |
| 9 | Account deletion requires only a session + typed `DELETE` | Stolen/unattended session can permanently delete account and cascaded data | `api/auth/delete-account/route.ts:5-31` |
| 10 | OAuth callback open redirect (`/\evil.com` normalises to `https://evil.com/`); unvalidated login `redirectTo` | Post-login phishing vector | `auth/callback/route.ts:9-14,58-59`; `login/page.tsx:14,77,106` |
| 11 | Storefront/admin queries reference columns and tables absent from migrations (`is_published`, `stores.project_id`, `store_products`, `store_orders`, `store_order_items`) | Public storefront and admin store views cannot work against the committed schema | `src/app/[slug]/*`; `api/admin/stores/route.ts`; `20261006060000_module8_store_management_schema.sql` |
| 12 | RLS `projects_owner_update` checks `status = 'draft'` only in `USING`, not `WITH CHECK` | An owner can set a draft's status to a non-draft value in a single update, bypassing the submit route's validation and handoff | `20261006000000_module2_projects_wizard_schema.sql:95-104` |
| 13 | `supabase/combined_schema.sql` omits the final hardening migration and is otherwise stale | The repository's documented one-shot bootstrap does not reproduce the final private-bucket/policy state | `combined_schema.sql:1456-1731`; `20261123010000_storage_and_rbac_hardening.sql:11-54` |

### P1 — must fix before claiming completion

- **5-step wizard vs 3-step requirement** — SRS FR-2.1, reconciliation and baseline say 3; implementation and some docs say 5 (`BusinessIdeaWizard.tsx:525-573`; `docs/SRS.md:210`; `docs/RECONCILIATION_MODULE_1_MODULE_2.md:11`).
- **"Auto-saved to cloud" claim without debounced field-level autosave** — typed text is lost on refresh/tab close (`BusinessIdeaWizard.tsx:75,1892` vs `:147-206,1901`).
- **Forced-password bypass** — middleware excludes `/api/`, and profile errors default `must_change_password = false`; separately, RLS prevents ordinary users from clearing the flag after changing their password (`middleware.ts:80-90`; `update-password/page.tsx:73-79`; `20261004000000...sql:229-244`).
- **ML dataset upload path traversal/unbounded write** — client filename concatenated into the save path; 50 MB config constant unused (`ml-service/main.py:138-168`; `config.py:26-27`).
- **Conditional server validation** — create skips validation without `category`; PATCH skips it without `current_step`; bad currency/enums surface as 500s (`api/projects/route.ts:62-65`; `api/projects/[id]/route.ts:110-115,158`).
- **Unverified handoff** — collection orchestrator ignores Supabase errors, uses a 40-second duplicate-run heuristic, and no unique constraint protects `project_collection_runs` (`orchestrator.ts:49-88,293-345`).
- **FX provenance not persisted** — two independent rate constants, `getExchangeRateInfo()` unused, USD minimums disagree across three files; the reconciliation requires stored rate metadata (`src/types/project.ts:200`; `lib/currency/exchange-rate.ts:17-35`).
- **CI cannot install dependencies** — `cache: 'pnpm'` and `pnpm install --frozen-lockfile` with only `package-lock.json` checked in; pnpm cache is also configured before pnpm is installed (`.github/workflows/ci.yml:15-23,41-49`).
- **CI never runs lint or any JS/TS test** — `package.json` has no `test`/`typecheck` script; both `.test.mjs` suites and all verification scripts are unwired (`.github/workflows/ci.yml:9-64`; `package.json:5-10`).
- **The one Python script CI does run has no assertions** — `test_pipeline.py:6-58` prints results and an unconditional success message; `test_auth_security.py` and `pytest` are never used (`ml-service/requirements.txt`).
- **Analytics events accepted for draft/suspended stores; non-idempotent Module 8/9 policies; no `unique (store_id, order_number)`** (`20261006070000...sql:44-61`; `20261006060000...sql:58-81,185-201`).
- **Durable AI gateway SQL exists in `supabase/manual/` but is unused by production code**, so cache/quota/circuit state remains process-local (`ai_gateway_runtime.sql`; `response-cache.ts:5-7`; `resilience.ts:9-12`).

### P2 — quality/consistency

- UI renders `NaN°` when coordinates are `undefined`; "Coordinates Confirmed" block duplicated ~9 times; description limit 500 in UI vs 2000 in validation; fabricated fixed allocation percentages and rent figures presented as facts.
- Documentation contradiction: `docs/requirements-traceability.md` marks Modules 1–8 complete while `README.md` and `docs/FINAL_DELIVERY_BASELINE.md` call the same areas partial/incomplete; the code supports the latter.
- The two `.test.mjs` suites are `fs.readFileSync(...).includes(...)` source-string assertions, not behavior tests; `requirements-traceability.md` cites them as verification evidence.
- ML service state (datasets, jobs, active model) is in-memory; training runs synchronously; no XGBoost/SHAP in dependencies. AI cache/quota/circuit breaker and public-order rate limiting are process-local maps.
- Domain verification is a mock (`api/stores/[id]/domain/route.ts`); Vercel integration absent.
- `.env.example` omits all `ML_SERVICE_*`, `ENVIRONMENT`, and `ALLOWED_ORIGINS` variables used by the code; `NEXT_PUBLIC_APP_URL` has a leading space.
- Documentation drift: baseline pinned to `8ddd83a`; older Module 2 docs specify 5–25 km radius and conflicting budgets; Module 7/9 docs cite unwired source-string checkers as "38/38"/"68/68" verified results; `api.md` has stale USD examples and missing sections; traceability claims strict CSP/HSTS while `next.config.ts:9-10,16,19` permits `'unsafe-inline'`/`'unsafe-eval'`, CDN scripts, arbitrary HTTPS images, and HSTS without `preload`.
- Generated Python bytecode, four `.joblib` artifacts, and `trends_cache.json` are tracked, while `.gitignore` does not exclude them.

### Runtime verification still required (not statically provable)

1. RLS `WITH CHECK` behavior for `profiles_update_own` as owner vs admin (recursion and forced-password flag).
2. Actual deployed `project-attachments` bucket privacy and residual policies.
3. Production values of `ENVIRONMENT` / `ML_SERVICE_API_KEY`.
4. Live PBS / Google Trends provider success; synthetic fallbacks are confirmed in code.
5. Whether attacker-controlled MIME types render inline from signed URLs.
6. Whether the unauthenticated cron upsert succeeds under deployed RLS/grants.

---

## 4. Completion Decision (main branch only)

**Decision: `main` at `545c7c6` cannot be certified as complete for Module 1 or Module 2, and cannot be treated as a production-ready deployment.**

Rationale:

- Module 1 has four independent P0 security defects (hard-coded ML key + fail-open guard, fail-open middleware, public one-shot storage path, reauthentication-free account deletion), plus an open redirect, an RLS status-escalation loophole, and a stale one-shot schema that omits the final hardening migration. Any one of these is sufficient to block an auth/RBAC sign-off.
- Module 2 has four independent P0 correctness defects (fabricated prefill, silent coordinate defaults, broken attachment flow, non-atomic submit) plus a radius constraint conflict that turns valid input into a 500.
- The verification basis is unsound: the only JS tests compare source strings, CI uses a package manager with no matching lockfile, and no runtime/database evidence exists in the repository for RLS, submit atomicity, or provider integrations.
- Cross-module claims in `docs/requirements-traceability.md` (public storefront, publish lifecycle, XGBoost, live trends, full RLS verification) are contradicted by both the code and the repository's own `README.md` / `FINAL_DELIVERY_BASELINE.md`.

**Scope note:** this decision applies only to the committed `main` snapshot. The separate remediation work on `fix/complete-module-1-module-2` (commit `1980031`) is deliberately excluded from this report, as requested. No `main` files were modified, and nothing was committed or pushed as part of this analysis.

**Method and limitations:** read-only static inspection of the detached worktree at commit `545c7c6`, performed by four completed parallel code audits covering the architecture/module map, Module 1 security, Module 2 correctness, and tests/CI/docs. No build, runtime test, database, network, or deployment verification was executed; `node_modules` and a Supabase/FastAPI runtime were unavailable in the audited copy. Line numbers refer to that snapshot and may drift in later commits. Items in the "requires runtime verification" list are explicitly not treated as confirmed findings.
