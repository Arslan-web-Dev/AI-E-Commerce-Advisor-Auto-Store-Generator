# Complete Repository Forensic Audit

- **Audit date:** 2026-11-26
- **Branch:** `main`
- **HEAD audited:** `1b0af8a6157ee029c85f69c135406afd18515147`
- **Remote:** `origin/main` == HEAD
- **Working tree:** clean at audit start; no untracked non-ignored files
- **Tracked files:** 401
- **Method:** read-only inspection of git metadata, all tracked/untracked inventory, dependencies, workflows, configuration, and source under `src/`, `ml-service/`, `supabase/`, `scripts/`, `tests/`, `.github/`, `docs/`, `final_sdd/`, `config/`, `public/` and `project-evidence/`.
- **Constraints honored:** no implementation, no code rewrite, no new migration, no SQL execution, no database modification, no commit, no push, no secret value displayed. The only files created are the seven audit documents requested after the audit completed.

## 1. Authority and evidence limitations

| Item | Finding | Status |
| --- | --- | --- |
| User-described advanced October 2026 SRS/SDD v1.0, 90 pages | Not checked into the repository; exact FR priority tags and full requirement wording cannot be verified. | **UNVERIFIED** |
| `docs/FINAL_DELIVERY_BASELINE.md` | Repository-declared current baseline and work order. | **IMPLEMENTED** as repository registry |
| `docs/requirements-traceability.md` | Source-aligned working registry with FR-1.1–FR-8.12, SEO-1–5, DAT-1–3, NFR groups. It is second-hand relative to the absent PDF. | **PARTIALLY IMPLEMENTED** |
| `docs/SRS.md` | Historical checked-in SRS v2.0; explicitly non-authoritative where it conflicts. Still the only locally enumerated exact text for most FR/NFR IDs. | **PARTIALLY IMPLEMENTED** |
| `final_sdd/_uni_sdd_text.txt` | 61-page university-format SDD extract, not the full advanced SRS; contains placeholders for screenshots, schema sign-off, deployment evidence and measured targets. | **UNVERIFIED** as authority |
| `final_sdd/_pdf_outline_extract.txt` | Contains a 40-page revised-SRS outline with module headings only; FR-1–FR-16 entries belong to an unrelated ride-sharing sample and must not be used as this project’s requirements. | **OUT OF SCOPE** |
| Git/CI evidence | HEAD check run `45831018355`: ESLint, TypeScript, Node tests, Next build and Python ML tests all succeeded. | **IMPLEMENTED** |

Conclusion: exact advanced-PDF wording was not invented. The requirement matrix uses only IDs and wording recoverable from checked-in docs, with explicit **UNVERIFIED** markers where authoritative text or live evidence is absent.

## 2. Repository and git forensics

| Item | Evidence | Status |
| --- | --- | --- |
| Branch/HEAD/remote | `main`, HEAD `1b0af8a`, `origin/main` same. | **IMPLEMENTED** |
| Recent history | `1b0af8a update code`; `a3c0d54 feat(module8): complete multi-tenant storefront and deployment`; `c1d72c4`; `5cedf4f`; `e73f2c5`. | **IMPLEMENTED** |
| Evidence-only commit | `git diff --stat a3c0d54 1b0af8a`: 21 files, 154 insertions/199 deletions; only evidence ZIP, PNGs and `scripts/master_evidence_capture.py`. No app source changed. | **IMPLEMENTED** |
| Tags | `v1.0.0-modules-1-2`. | **IMPLEMENTED** |
| Worktrees | main worktree, detached `main-branch-analysis` at `545c7c6`, prunable env setup worktree. | **IMPLEMENTED** |
| Remote branches | main plus historical feature/fix branches. | **IMPLEMENTED** |
| Dependencies | `next 16.3.8`, `react 19.2.8`, `@supabase/ssr`, `@supabase/supabase-js`, `three`; Python FastAPI/sklearn/XGBoost/Pytrends. | **IMPLEMENTED** |
| Workflows | one `.github/workflows/ci.yml`; no root Vercel/Docker/Render/Fly/Netlify config. | **IMPLEMENTED** |

## 3. File inventory

| Area | Files | Status |
| --- | ---: | --- |
| `src/` | 213 | **IMPLEMENTED** inventory; source audited by section |
| `docs/` | 40 | **IMPLEMENTED** inventory; all `.md` reviewed |
| `supabase/` | 32 | **IMPLEMENTED** static SQL reconciliation |
| `ml-service/` | 31 | **IMPLEMENTED** source audit; `__pycache__` binaries noted but not decoded |
| `tests/` | 18 | **IMPLEMENTED** inventory; all test files reviewed |
| `scripts/` | 13 | **IMPLEMENTED** inventory; classified evidence/static/live utilities |
| `final_sdd/` | 13 | **IMPLEMENTED** inventory; extracts reviewed |
| `config/` | 2 | **IMPLEMENTED** |
| `public/` | 5 | **IMPLEMENTED** |
| `project-evidence/` | 21 | **IMPLEMENTED**; live claims remain **UNVERIFIED** |

## 4. Major source audit

Statuses describe functional confidence after code/trace review, not merely file existence.

### 4.1 UI pages and components

| File(s) | Purpose / requirement | Dependencies, DB/API, auth | UI/test findings | Status |
| --- | --- | --- | --- | --- |
| `src/app/page.tsx` | Marketing landing | no API; decorative 3D components | contradictory copy at `:399` vs `:470-473`; responsive grids | **PARTIALLY IMPLEMENTED** |
| `src/app/login/page.tsx`, `reset-password`, `update-password`, `src/app/auth/callback/route.ts` | FR-1.1/1.2/1.5/1.7 | browser Supabase auth, API password completion, profiles | callback rejects `//` but not `/\`; account deletion UI mismatch; live auth unverified | **PARTIALLY IMPLEMENTED** / callback **BROKEN** |
| `src/app/account/security/page.tsx` | profile/security/session/delete | direct Supabase + signout/delete APIs | phone/org not saved; hardcoded quota/location; possible null-role crash | **PARTIALLY IMPLEMENTED** |
| `src/app/admin/page.tsx` | FR-1.3, FR-8.12 admin center | admin gate, stores/usage/providers/sync APIs | wired; swallowed errors; static operational claims | **PARTIALLY IMPLEMENTED** |
| `src/app/admin/ml/page.tsx` | FR-4.x ML admin | six ML APIs | `isAdmin` detected but non-admin UI not blocked; `/predict` payload incompatible with artifacts | **PARTIALLY IMPLEMENTED** |
| `src/components/wizard/BusinessIdeaWizard.tsx` | FR-2.1–2.7 | projects APIs, upload/submit | wired 3-step flow, autosave, validation; live draft/provider proof absent | **PARTIALLY IMPLEMENTED** |
| `src/components/data-collection/MarketDataPanel.tsx` | FR-3.x | collection/competitors/market-data/costs/collect | provenance badges and demo disclosure; live run unverified | **PARTIALLY IMPLEMENTED** |
| `src/components/data-processing/FeatureQualityPanel.tsx` | FR-4.1/4.2 | features/process APIs | gated by submission; local wiring only | **PARTIALLY IMPLEMENTED** |
| `src/app/projects/[id]/feasibility/page.tsx` | FR-5.x | project/feasibility/features/market-data/competitors/rent-map APIs | honest unavailable labels; responsive; browser/live unverified | **PARTIALLY IMPLEMENTED** |
| `src/app/projects/[id]/advisory/page.tsx` | FR-6.x | advisory GET/POST/PATCH/simulation | wired; language/fallback labeling; mocked-only evidence | **PARTIALLY IMPLEMENTED** |
| `src/components/theme-configurator/ThemeConfigurator.tsx` | FR-7.1–7.6 | theme-configurator API | 4-step live preview, device widths; live Groq/RLS/browser unverified | **PARTIALLY IMPLEMENTED** |
| `src/app/projects/[id]/store/page.tsx` | FR-8.8–8.11 | owner store APIs | product/image/AI/inventory/order/publish wired; sample-order POST risky; alerts on errors | **PARTIALLY IMPLEMENTED** |
| `src/app/[slug]/**` | FR-8.5/8.6/8.7, SEO | server helpers plus storefront/checkout APIs | eight pages exist; confirmation trusts query param; checkout omits idempotency key | **PARTIALLY IMPLEMENTED** |
| `src/app/[slug]/sitemap.ts`, `robots.ts` | SEO-3 | getPublicStore/product query | sitemap works; robots uses wrong verified-host argument for custom domains | **PARTIALLY IMPLEMENTED** / robots **BROKEN** |
| `src/components/store-management/AnalyticsPanel.tsx` | FR-8.11 and out-of-scope analytics | six analytics APIs | wired; visitor analytics beyond source KPI scope | **PARTIALLY IMPLEMENTED** |
| `src/components/store-management/SeoScore.tsx`, `src/components/ui/AnimatedCounter.tsx` | SEO-5 / decorative | no callers found | dead components | **NOT IMPLEMENTED from UI perspective** |

### 4.2 API routes

| Area | Purpose / DB / external | Auth and wiring | Findings | Status |
| --- | --- | --- | --- | --- |
| `src/app/api/projects/**` | CRUD, collection, processing, features, costs, market data, attachments, submit, feasibility, advisory, theme, store, rent-map | mostly explicit owner/admin checks; some rely on RLS | submit coordinate mismatch; upload admin no-op; dead `storefront-wizard` and `processing-runs`; advisory ownership relies on RLS | **PARTIALLY IMPLEMENTED** |
| `src/app/api/auth/**` | signout, delete-account, password completion | session/service role | deletion UI mismatch; OAuth reauth gap; split 502 success state | **PARTIALLY IMPLEMENTED** |
| `src/app/api/ml/**` | policy, datasets, train/sync, models, predict | admin gate; ML upstream with fail-closed key | activation non-atomic; dataset insert errors unchecked; predict wired but unusable with real artifacts | **PARTIALLY IMPLEMENTED** |
| `src/app/api/market/**` | regional/trends/demand-analysis | no route auth; ML upstream | two cache/DB branches blocked by anonymous RLS; no rate limit | **BROKEN / PARTIALLY IMPLEMENTED** |
| `src/app/api/cron/rent-cache/route.ts` | rent seed upserts | `CRON_SECRET` bearer/header; service role | handler exists; no deployment scheduler; secret absent locally | **PARTIALLY IMPLEMENTED**; scheduling **UNVERIFIED** |
| `src/app/api/admin/**` | stores, usage, providers, sync, models, thresholds | admin role | store admin wired; sync can export empty config; models/thresholds have no UI caller | **PARTIALLY IMPLEMENTED** |
| `src/app/api/stores/**` | owner/admin store operations | owner/admin; Storage; RPCs | product validation gaps, domain state defects, merchant order POST trusts client prices | **PARTIALLY IMPLEMENTED** |
| `src/app/api/storefront/**` | public products, guest COD order, order lookup; variants | anon except variants | backend solid with DB-derived prices/idempotency; UI omits idempotency key; lookup unwired | **PARTIALLY IMPLEMENTED** |

### 4.3 Core libraries and AI

| File(s) | Purpose | Callers / dependencies | Findings | Status |
| --- | --- | --- | --- | --- |
| `src/lib/ai/gateway/execute.ts`, `router.ts`, `validate.ts`, `resilience.ts`, `response-cache.ts`, `prompt-hygiene.ts` | single server-only AI gateway | advisory, theme, description, dead wizard route | complete policy/validation/fallback; quota/circuit/cache process-local | **IMPLEMENTED** core / **PARTIALLY IMPLEMENTED** ops |
| `src/lib/ai/providers/{openai,gemini,groq}.ts` | provider adapters | gateway only | endpoints correct; no direct SDK bypass; OpenAI key empty locally | **IMPLEMENTED** code; OpenAI locally **BLOCKED** |
| `src/lib/advisory/**` | selection, risk, generator, simulation, action matrix | advisory routes | two-language grounded flow; ownership partly RLS-dependent | **PARTIALLY IMPLEMENTED** |
| `src/lib/ml-client.ts`, `ml-registry-sync.ts`, `ml/scoring-contract.ts` | ML HTTP client and registry sync | ML/admin routes | fail-closed key; no timeout; some dead methods | **PARTIALLY IMPLEMENTED** |
| `src/lib/data-collection/**`, `providers/**` | Overpass, regional, trends, costs, rent cache | collect route | honest provenance; live provider/caching not proven; demo paths disclosed | **PARTIALLY IMPLEMENTED** |
| `src/lib/data-processing/**`, `scoring/mcda.ts` | cleaning/features/provisional MCDA | process/feasibility/simulation | real formulas, no synthetic imputation; supervised scoring blocked | **PARTIALLY IMPLEMENTED** |
| `src/lib/store-management/**`, `storefront/**`, `theme/**`, `seo.ts` | tenant, domain, publication, orders, products, theme, SEO | store routes and public pages | domain API unwired; AI SEO check broken; robots host bug; strong transactional RPCs | **PARTIALLY IMPLEMENTED** |
| `src/lib/supabase/{server,client,admin,middleware}.ts`, `src/proxy.ts` | SSR clients, RBAC, redirects, tenant rewrite | nearly all routes | fail-closed admin; open-redirect guard in callback weaker; rewrite skips session refresh | **PARTIALLY IMPLEMENTED** |
| `src/lib/analytics/**`, `security/cron-auth.ts`, `currency/**`, `validation/project.ts` | analytics, cron auth, FX, validation | various routes | useful helpers; cron disabled locally; duplicated FX rate | **PARTIALLY IMPLEMENTED** |

### 4.4 ML service

| File(s) | Purpose | Findings | Status |
| --- | --- | --- | --- |
| `ml-service/main.py` | FastAPI endpoints, auth, jobs, models, predict, trends | 16 routes; process-local job/model state; no timeout/rate limit; predict schema mismatch | **PARTIALLY IMPLEMENTED** |
| `ml-service/config.py` | paths, thresholds, API key, CORS | fail-closed key/placeholders; standalone repo-root config path fragile | **PARTIALLY IMPLEMENTED** |
| `ml-service/datasets/*` | synthetic sample dataset and validation | rule-generated labels, explicitly not production evidence | **IMPLEMENTED** sandbox |
| `ml-service/models/*` | candidate models, preprocessing, trainer, evaluator, explainability, label policy | real 8×8 training/CV/metrics/joblib; OI-6 blocks serving; local factors are not SHAP | **IMPLEMENTED** sandbox / serving **BLOCKED** |
| `ml-service/trends/*` | Pytrends, cache, heuristic demand index | live path exists; committed cache expired/synthetic; no live tests | **PARTIALLY IMPLEMENTED** |
| `ml-service/test_pipeline.py`, `test_auth_security.py` | real Python assertions | strong local coverage; no live trends/production activation | **IMPLEMENTED** local |
| `ml-service/Procfile`, `railway.json` | deployment blueprints | missing env contract/config provisioning | **PARTIALLY IMPLEMENTED** |

### 4.5 Supabase SQL

Detailed in `docs/SUPABASE_SCHEMA_RECONCILIATION.md`. Headline: 30 ordered migrations form a coherent final state; `combined_schema.sql` is stale/broken; `projects.description` mismatch remains. **PARTIALLY IMPLEMENTED** overall; combined artifact **BROKEN**; live DB **UNVERIFIED**.

### 4.6 Tests, scripts, CI

| File group | What it actually does | Status |
| --- | --- | --- |
| `tests/module1-auth-rbac.test.mjs`, module2/task3 scripts | mostly source-string/file checks | **PARTIALLY IMPLEMENTED** evidence |
| `tests/module3-smart-aggregation.test.mjs` | real TS modules with mocked fetch/cache/ML | **IMPLEMENTED** local behavior |
| `tests/module4-feature-engineering.test.mjs`, ML Python suites | real formula/pipeline/auth assertions | **IMPLEMENTED** local |
| `tests/module5-*` | real helpers plus fake clients | **IMPLEMENTED** local |
| `tests/module6-ai-advisory.test.mjs`, `module7-theme-configurator.test.mjs` | mocked providers/Supabase | **IMPLEMENTED** local contract only |
| `tests/module8-*` | pure helpers plus many source-string assertions | **PARTIALLY IMPLEMENTED** |
| `scripts/verify-*.mjs` | static verifiers; only verify-module3 wired to CI; verify-module9 out of scope | **PARTIALLY IMPLEMENTED** |
| `scripts/capture_evidence.py`, `capture_project_evidence.py`, `master_evidence_capture.py`, diagnostics | live Playwright evidence capture; one mutates a live project; hard-coded URL/credentials present (values not reproduced) | **UNVERIFIED / NOT verification** |
| `.github/workflows/ci.yml` | lint, typecheck, Node tests, build, Python tests | **IMPLEMENTED**; no live DB/browser/E2E/perf/deploy |

## 5. Duplicates, dead code and obsolete paths

| Item | Finding | Status |
| --- | --- | --- |
| `/api/projects/[id]/storefront-wizard` duplicate of theme configurator | no UI caller | **NOT IMPLEMENTED from UI perspective** |
| `/api/projects/[id]/processing-runs`, `/api/admin/models`, `/api/admin/scoring-thresholds` | documented/tested but no direct UI caller | **PARTIALLY IMPLEMENTED** backend only |
| `SeoScore.tsx`, `AnimatedCounter.tsx` | no imports | **NOT IMPLEMENTED from UI perspective** |
| `mlClient.getHealth`, `getDataset`, `listTrainingJobs`; several currency/geo helpers | unused wrappers | **PARTIALLY IMPLEMENTED** library code |
| `AICircuitOpenError` | never thrown | **NOT IMPLEMENTED** |
| `combined_schema.sql` duplicate policies/headers | stale artifact | **BROKEN** |
| Module 9 analytics scripts/docs | not source requirement; existing code can remain | **OUT OF SCOPE** |
| `STRIPE_SECRET_KEY` template | COD-only requirement | **OUT OF SCOPE** |

## 6. Highest-risk defects

1. **BROKEN** — OAuth callback backslash open-redirect guard.
2. **BROKEN** — checkout UI omits idempotency key although backend supports it.
3. **BROKEN** — merchant order POST trusts client prices and ignores some DB errors.
4. **BROKEN** — AI description SEO length check passes description as title.
5. **BROKEN** — robots sitemap host for verified custom domains.
6. **BROKEN** — combined schema cannot be used as standalone install.
7. **BROKEN** — `projects.description` vs `product_description` mismatch.
8. **BROKEN** — admin `/predict` feature-schema mismatch; no active serving model while OI-6 open.
9. **BROKEN** — unauthenticated market routes can drive upstream ML/Pytrends; two DB/cache branches blocked by RLS.
10. **BROKEN** — admin sync can continue with empty config after fetch failure.
11. **PARTIALLY IMPLEMENTED** — public analytics event ingestion without rate limit.
12. **PARTIALLY IMPLEMENTED** — process-local AI quota/cache/circuit and Python job/model state.

## 7. Final forensic conclusion

The repository is a substantial, code-backed FYP implementation, not an empty scaffold. Modules 1–7 have coherent local implementations with mocked/source-level evidence; Module 8 has broad code coverage but several real functional defects and no live deployment proof. The AI/Groq integration is real and gateway-centralized. The ML service contains genuine training machinery but deliberately blocks production inference pending OI-6. Supabase SQL design is strong in ordered migrations but the combined artifact is stale and unsafe.

Overall handover status is **PASS WITH LIMITATIONS**: local CI and code evidence support continued development, but live Supabase/RLS, provider APIs, browser/responsive/WCAG behavior, domain provisioning, deployment runtime and performance targets remain **UNVERIFIED**.
