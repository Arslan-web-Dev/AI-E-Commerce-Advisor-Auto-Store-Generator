# Complete Requirements Implementation Matrix

- **Audit date:** 2026-11-26
- **Repository HEAD:** `1b0af8a6157ee029c85f69c135406afd18515147`
- **Authority note:** the user-described advanced October 2026 SRS/SDD v1.0 PDF is not checked in. This matrix uses only IDs and wording recoverable from `docs/FINAL_DELIVERY_BASELINE.md`, `docs/requirements-traceability.md`, `docs/SRS.md`, `docs/task9-final-report.md` and the checked-in SDD extracts. Exact source priority tags and missing UI/SI/CI IDs are **UNVERIFIED**; no requirement text was invented.
- **Method:** static evidence review only. No live database, provider, browser, deployment or SQL execution was performed.

## Status vocabulary

Only these statuses are used: **IMPLEMENTED**, **PARTIALLY IMPLEMENTED**, **NOT IMPLEMENTED**, **BROKEN**, **UNVERIFIED**, **BLOCKED**, **OUT OF SCOPE**.

A status of **IMPLEMENTED** means code plus local behavioral/source evidence exists; it does not imply live deployment proof. **PARTIALLY IMPLEMENTED** is used when functionality is coded but has a material gap, dead UI path, or unverified runtime acceptance. **UNVERIFIED** is used where repository evidence cannot answer the requirement.

## Column shorthands

- **Tests:** `local` = mocked/static/local assertions; `python` = Python assertion suite; `ci` = passing GitHub Actions for HEAD; `live` = live runtime proof.
- **UI:** `wired`, `partial`, `dead`, `none`.
- **DB:** canonical tables/RPCs from ordered migrations; see `docs/SUPABASE_SCHEMA_RECONCILIATION.md`.
- **Integrations:** Supabase, FastAPI/ML, Overpass, Pytrends, AI gateway, Vercel, GitHub as applicable.

---

## Module 1 — Authentication and RBAC

| ID | Expected functionality | File(s) | Status | UI | DB deps | Integrations | Tests | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-1.1 | Email/password registration and login via Supabase Auth | `login/page.tsx`, `reset-password/page.tsx`, `src/lib/supabase/client.ts`, `auth/callback/route.ts` | **PARTIALLY IMPLEMENTED** | wired | `profiles` | Supabase Auth | local source checks | live signup/login/session proof |
| FR-1.2 | Google OAuth sign-in and verified-email account linking | `login/page.tsx:142-151`, `auth/callback/route.ts:23-59` | **PARTIALLY IMPLEMENTED** | wired | `profiles` | Supabase Auth/Google | local source checks | live OAuth; callback redirect guard is **BROKEN** |
| FR-1.3 | `owner`/`admin` roles; role changes admin-only | `profiles` RLS/trigger, `proxy.ts`, `admin/page.tsx`, admin API gates | **PARTIALLY IMPLEMENTED** | wired | `profiles`, trigger | Supabase | local/static | live role-escalation denial tests |
| FR-1.4 | Next route guards plus authoritative RLS | `src/lib/supabase/middleware.ts`, `src/proxy.ts`, RLS policies | **PARTIALLY IMPLEMENTED** | wired | all tenant tables | Supabase | local/static | live cross-tenant/RLS attack matrix |
| FR-1.5 | Env-seeded admin, forced password change | `scripts/seed-admin.mjs`, `complete-password-change`, `profiles.must_change_password` | **PARTIALLY IMPLEMENTED** | wired | `profiles` | Supabase service role | local/static | live seed/forced-change run |
| FR-1.6 | Admin GitHub REST config export, no PII/secrets | `src/app/api/admin/sync/route.ts`, `admin/page.tsx:201` | **PARTIALLY IMPLEMENTED** | wired | `system_config`, `rent_cache`, `config_sync_audit_log` | GitHub REST | local/static | live write; failure path **BROKEN** |
| FR-1.7 | Password reset, session refresh, sign-out everywhere | `reset-password`, `update-password`, `signout/route.ts`, `account/security/page.tsx` | **PARTIALLY IMPLEMENTED** | wired | `profiles` | Supabase Auth | local/static | live reset/global sign-out proof |
| FR-1.8 | Account deletion with owned-store/report cascades | `account/security/page.tsx:177-181`, `delete-account/route.ts` | **PARTIALLY IMPLEMENTED** | partial | FK cascades | Supabase service role | local/static | UI/API password mismatch; live cascade proof |
| FR-1.9 | Optional demo mode disabled in production | `FORCE_DEMO_DATA`, `providers/index.ts:23-33`, collect `force_demo` | **UNVERIFIED** | none | n/a | providers | local presence only | production-disabled evidence |

## Module 2 — Business idea and location wizard

| ID | Expected functionality | File(s) | Status | UI | DB deps | Integrations | Tests | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-2.1 | Three-step persisted draft wizard | `BusinessIdeaWizard.tsx`, `/api/projects`, `/api/projects/[id]` | **PARTIALLY IMPLEMENTED** | wired | `projects` | Supabase | local/task3 scripts | live autosave/restore proof |
| FR-2.2 | Predefined category plus free-text description | `BusinessIdeaWizard.tsx`, `validation/project.ts`, `types/project.ts` | **IMPLEMENTED** | wired | `projects.category`, `custom_category`, `product_description` | none | local | live validation matrix |
| FR-2.3 | Pakistan-only resolved location with seeded hub fallback | `geo/pakistan-geography.ts`, wizard map/hub chips | **PARTIALLY IMPLEMENTED** | wired | `projects.city/district/lat/lng`, metadata.geo | Places/Mapbox absent | local geography tests | configured geocoder or accepted limitation |
| FR-2.4 | PKR/USD input, canonical integer PKR, 10k–50m validation | `currency/exchange-rate.ts`, wizard finance step, submit route | **PARTIALLY IMPLEMENTED** | wired | `projects.budget_pkr` | fixed disclosed FX | local | live FX/source decision; duplicate rate constant |
| FR-2.5 | Optional business model/audience/shop size | wizard, `projects` fields, validation | **IMPLEMENTED** | wired | `projects.target_audience`, `business_model`, `storefront_footprint` | none | local | live persistence proof |
| FR-2.6 | Idempotent pending report + analysis submission | `submit/route.ts`, `submit_project_for_feasibility`, orchestrator | **PARTIALLY IMPLEMENTED** | wired | `projects`, `feasibility_reports`, `project_collection_runs` | Supabase RPC | local/static | live duplicate-submit test; coordinate mismatch |
| FR-2.7 | Radius default 10 km, max 15 km | wizard, `validation/project.ts`, submit route, DB checks | **PARTIALLY IMPLEMENTED** | wired | `projects.radius_km` | none | local | reconcile SRS 10–15 with corrected DB 5–15 acceptance wording |

## Module 3 — Smart data aggregation

| ID | Expected functionality | File(s) | Status | UI | DB deps | Integrations | Tests | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-3.1 | Category-mapped Overpass POIs with name/coords/tags/distance | `providers/competitors/overpass.ts`, `orchestrator.ts` | **PARTIALLY IMPLEMENTED** | wired | `project_competitors` | Overpass OSM | local with mocked fetch | live Overpass run |
| FR-3.2 | Timeout/retry/alternate endpoint + 7-day cache | `overpass.ts`, `competitor-cache.ts`, migration 20 | **PARTIALLY IMPLEMENTED** | wired | `competitor_query_cache` | Overpass, Supabase | local | live cache hit/expiry proof |
| FR-3.3 | Scheduled rent cache; analysis reads cache only | `cron/rent-cache`, `rent-lookup.ts`, `rent_cache`, `rent-map` | **PARTIALLY IMPLEMENTED** | wired | `rent_cache` | Supabase service role | local/static | scheduler and `CRON_SECRET` deployment proof |
| FR-3.4 | Nearest/city rent fallback with low confidence | `rent-lookup.ts`, `rent-cache-query.ts` | **IMPLEMENTED** | wired | `rent_cache` | none | local | live populated rent data |
| FR-3.5 | 12-month Pakistan Google Trends via Pytrends with stale fallback | `providers/trends/google-trends.ts`, `ml-service/trends/google_trends.py` | **PARTIALLY IMPLEMENTED** | wired | `project_demand_trends`, `market_trend_queries` | ML/Pytrends | mocked only | live Pytrends; cache contains expired synthetic entries |
| FR-3.6 | Typed payload + data-source health | `types/data-collection.ts`, orchestrator, MarketDataPanel | **PARTIALLY IMPLEMENTED** | wired | collection tables | all providers | local | live health report from populated run |
| FR-3.7 | Lawful terms/robots and aggregated rent only | source/provenance disclosures, rent cache only | **UNVERIFIED** | partial | `rent_cache` | Overpass/Pytrends | none | documented legal review and live source terms |

## Module 4 — Feature engineering and ML

| ID | Expected functionality | File(s) | Status | UI | DB deps | Integrations | Tests | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-4.1 | Ten specified unit-bearing features | `data-processing/feature-engineer.ts`, `processor.ts`, `config/module4-scoring.json` | **IMPLEMENTED** | wired | `project_features` | none | local | live populated feature row |
| FR-4.2 | Documented imputation/data quality | `cleaner.ts`, `trend-validity.ts`, processor | **PARTIALLY IMPLEMENTED** | wired | `project_processing_runs` | none | local | authoritative SRS wording; no synthetic local imputation by design |
| FR-4.3 | XGBoost continuous 0–1 feasibility score | `ml-service/models/*`, `scoring/mcda.ts` | **BLOCKED** | partial | `project_feasibility_runs`, `model_registry` | FastAPI ML | python/local | OI-6 approval, valid artifact, live serving |
| FR-4.4 | Four risk bands 0.75/0.55/0.35 | `ml/scoring-contract.ts`, Python `config.py`, UI badges | **IMPLEMENTED** | wired | thresholds in `system_config` | FastAPI ML | local/python | live version-forwarding proof |
| FR-4.5 | Versioned model artifact per report | `mcda.ts`, `model_registry`, migration 22/23 | **PARTIALLY IMPLEMENTED** | wired | `project_feasibility_runs.model_version` | FastAPI ML | local/python | approved artifact; activation success path |
| FR-4.6 | SHAP/gain feature contributions | `explainability.py`, feasibility UI | **PARTIALLY IMPLEMENTED** | wired | run metadata | FastAPI ML | python/local | true SHAP or accepted gain-equivalent decision; live attribution |
| FR-4.7 | Training provenance, disclaimer, MAE/RMSE/CV metrics | `sample_dataset_generator.py`, `trainer.py`, migrations 22/23 | **PARTIALLY IMPLEMENTED** | wired | provenance columns | FastAPI ML | python | approved dataset/metrics; no production artifact |
| FR-4.8 | Configurable thresholds | `/api/admin/scoring-thresholds`, `ml_scoring_config_versions`, `system_config` | **PARTIALLY IMPLEMENTED** | dead UI | config tables | FastAPI ML | local/static | UI caller; live versioned update proof |

## Module 5 — Competition, location and rent map

| ID | Expected functionality | File(s) | Status | UI | DB deps | Integrations | Tests | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-5.1 | Interactive map, markers, radius, popups | `CompetitorMap.tsx` | **PARTIALLY IMPLEMENTED** | wired | `project_competitors` | Leaflet/OSM | local | live browser tile/popup test |
| FR-5.2 | Area rent overlay | `rent-map` route, `CompetitorMap.tsx`, `rent-cache-query.ts` | **PARTIALLY IMPLEMENTED** | wired | `rent_cache` | none | local | live populated overlay |
| FR-5.3 | Rent-to-budget gauge with bands | `RentBudgetGauge.tsx` | **PARTIALLY IMPLEMENTED** | wired | `project_features` | none | local | visual/live proof |
| FR-5.4 | Saturation 0–100 with four labels | `SaturationMeter.tsx`, `config/module5-visualization.json` | **PARTIALLY IMPLEMENTED** | wired | `project_features` | none | local | verified cutoffs/source decision |
| FR-5.5 | 12-month trend chart | `TrendChart.tsx` | **PARTIALLY IMPLEMENTED** | wired | `project_demand_trends` | none | local | live browser rendering |
| FR-5.6 | Sortable/filterable competitor table + CSV | `CompetitorTable.tsx` | **IMPLEMENTED** | wired | `project_competitors` | none | local | live CSV/browser proof |
| FR-5.7 | OSM attribution on every map | `CompetitorMap.tsx:401-415` | **IMPLEMENTED** | wired | none | OSM | local source | live visual check |

## Module 6 — Multi-AI advisory and risk engine

| ID | Expected functionality | File(s) | Status | UI | DB deps | Integrations | Tests | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-6.1 | Configurable OpenAI→Gemini→Groq chain | `ai/gateway/router.ts`, `providers/*` | **PARTIALLY IMPLEMENTED** | wired | none | OpenAI/Gemini/Groq | mocked | OpenAI key locally empty; live chain |
| FR-6.2 | 429/5xx/timeout/schema failover + `ai_call_log` | `execute.ts`, `resilience.ts`, `log-attempt.ts` | **PARTIALLY IMPLEMENTED** | wired | `ai_call_log` | providers | mocked | live provider failures; shared quota/circuit |
| FR-6.3 | Deterministic final fallback | `execute.ts:207-233`, advisory generator | **IMPLEMENTED** | wired | none | none | mocked/local | live exhaustion scenario |
| FR-6.4 | English/Roman Urdu switch and language cache | `execute.ts:56-64`, `generator.ts:292-295`, `response-cache.ts` | **PARTIALLY IMPLEMENTED** | wired | cache process-local | providers | mocked | live bilingual output; shared cache |
| FR-6.5 | Computed-facts-only grounded JSON | `generator.ts`, `prompt-hygiene.ts`, `validate.ts` | **PARTIALLY IMPLEMENTED** | wired | `project_feasibility_runs`, `project_features` | providers | mocked | live numeric-grounding proof; explicit advisory ownership |
| FR-6.6 | Model risk + rule flags | `risk-engine.ts`, `generator.ts` | **PARTIALLY IMPLEMENTED** | wired | features/feasibility | none | local | approved low-budget cutoff |
| FR-6.7 | Priority/impact/effort action matrix with saved ticks | `action-matrix.ts`, `advisory_action_states`, actions route | **PARTIALLY IMPLEMENTED** | wired | `advisory_action_states` | Supabase | mocked/local | live RLS ownership proof |
| FR-6.8 | Stored-data-only budget re-simulation | `budget-simulation.ts`, simulation route | **IMPLEMENTED** | wired | stored features/runs | none | local | live populated run proof |
| FR-6.9 | Prompt hygiene and server-only secrets | `server-only.ts`, `prompt-hygiene.ts`, adapters | **IMPLEMENTED** | wired | none | providers | local | live secret-handling review |

## Module 7 — Theme configurator

| ID | Expected functionality | File(s) | Status | UI | DB deps | Integrations | Tests | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-7.1 | Four-step MCQ wizard, 3–5 choices, live preview | `ThemeConfigurator.tsx`, `theme/options.ts` | **PARTIALLY IMPLEMENTED** | wired | draft tables | none | local/mocked | live browser preview |
| FR-7.2 | Groq JSON-schema compilation with hex/enum validation | `theme/generator.ts`, `theme/schema.ts`, Groq adapter | **PARTIALLY IMPLEMENTED** | wired | none | Groq | mocked | live Groq success |
| FR-7.3 | One retry then deterministic preset fallback | `router.ts` theme policy, `execute.ts`, generator | **IMPLEMENTED** | wired | none | Groq | mocked | live failure injection |
| FR-7.4 | Save validated `theme_config` JSONB | `theme/persistence.ts`, `stores` | **PARTIALLY IMPLEMENTED** | wired | `stores`, `store_draft_versions`, `store_wizard_sessions` | Supabase | mocked/local | live RLS persistence |
| FR-7.5 | WCAG AA contrast check/adjustment | `theme/contrast.ts` | **IMPLEMENTED** | wired | none | none | local/mocked | browser WCAG audit |
| FR-7.6 | Rerun with configuration history | `ThemeConfigurator.tsx`, migration 25 | **PARTIALLY IMPLEMENTED** | wired | version history columns | Supabase | mocked/local | executed migration + live history proof |

## Module 8 — Storefront, SEO and administration

| ID | Expected functionality | File(s) | Status | UI | DB deps | Integrations | Tests | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-8.1 | Unique reserved-word-safe slug | `tenant.ts`, `publication.ts`, slug trigger | **PARTIALLY IMPLEMENTED** | wired | `stores.slug` | none | local/static | live reserved/duplicate attempts |
| FR-8.2 | One-click publish/wildcard URL after readiness | publish routes, `set_store_publication`, `proxy.ts` | **PARTIALLY IMPLEMENTED** | wired | `stores`, lifecycle events | Vercel wildcard host unproven | local/static | provider readiness and public URL proof |
| FR-8.3 | Vercel custom domain attach, DNS display, polling | `domains.ts`, domain route | **PARTIALLY IMPLEMENTED** | dead UI | store domain columns | Vercel API | mocked/source | UI, env, live Vercel/DNS proof |
| FR-8.4 | Unpublish/republish toggle | owner/admin publish routes, RPC | **PARTIALLY IMPLEMENTED** | wired | `stores.status`, lifecycle events | none | local/static | live toggle proof |
| FR-8.5 | Eight public pages incl. catalogue filter/sort | `src/app/[slug]/**` | **PARTIALLY IMPLEMENTED** | wired | `stores`, `products` | Supabase | local/static | 375px browser test; server-side filter after limit bug |
| FR-8.6 | Theme-config-only styling and 375px responsive | `[slug]/layout.tsx`, `theme/*` | **PARTIALLY IMPLEMENTED** | wired | `stores.theme_config` | none | local | browser proof |
| FR-8.7 | Guest COD checkout with DB-derived prices | storefront order route, `guest-checkout.ts`, RPC | **PARTIALLY IMPLEMENTED** | wired | `place_store_order`, orders, customers | Supabase RPC | local/static | idempotency key from UI; live checkout |
| FR-8.8 | Product CRUD with images, price, stock, category | store product routes, Storage | **PARTIALLY IMPLEMENTED** | wired | `products`, `product-images` | Supabase Storage | local/static | numeric validation, magic-byte MIME, live upload |
| FR-8.9 | Editable AI description writer via router | description route, store page | **PARTIALLY IMPLEMENTED** | wired | `products`, `ai_call_log` | AI gateway | mocked | broken length check; live save flow |
| FR-8.10 | Timestamped order pipeline with stock transitions | order routes, `transition_store_order_status`, inventory RPC | **PARTIALLY IMPLEMENTED** | wired | `orders`, `order_items`, `inventory_logs` | Supabase RPC | local/static | live transitions; merchant POST risk |
| FR-8.11 | Orders/revenue/low-stock/SEO KPIs | overview and analytics routes, admin stores | **PARTIALLY IMPLEMENTED** | wired | `orders`, `products`, events | none | local | real SEO signals; revenue/currency decision |
| FR-8.12 | Admin stores/usage/AI log/provider health/suspension | admin pages/routes | **PARTIALLY IMPLEMENTED** | wired | `stores`, `ai_call_log`, `profiles` | providers | local/static | live provider health and suspension audit |
| SEO-1 | Length-validated per-page title/description | `seo.ts`, all `[slug]` layouts/pages | **PARTIALLY IMPLEMENTED** | wired | `stores.seo_config` | none | local | browser/Lighthouse validation |
| SEO-2 | Store/Product/BreadcrumbList JSON-LD | `seo.ts`, layouts/product page | **PARTIALLY IMPLEMENTED** | wired | `stores`, `products` | none | local | validator run/live proof |
| SEO-3 | Per-tenant sitemap and robots | `[slug]/sitemap.ts`, `[slug]/robots.ts` | **BROKEN** | wired | `stores`, `products` | none | local/source | custom-domain robots host bug; live crawl |
| SEO-4 | Canonical/headings/alt/OG | `[slug]` pages/layouts | **PARTIALLY IMPLEMENTED** | wired | none | none | local | browser SEO audit |
| SEO-5 | AI copy checks and SEO score badge | description route, overview, `SeoScore.tsx` | **BROKEN** | partial | `stores`, products | AI gateway | local/source | correct validator call; wired score component; live check |

## Data, quality, security and interface requirements

| ID | Expected functionality | File(s)/scope | Status | UI | DB deps | Integrations | Tests | Missing evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DAT-1 | Customer name/phone/address used only for COD fulfilment | guest checkout, customers/orders schema | **PARTIALLY IMPLEMENTED** | wired | `orders`, `customers` | Supabase | local/source | live data-minimization review |
| DAT-2 | Account deletion cascades owned stores/reports | delete-account route, FK cascades | **PARTIALLY IMPLEMENTED** | wired | FK cascades | Supabase | local/source | live cascade proof; UI/API reauth mismatch |
| DAT-3 | RLS tenant isolation; public reads only published/unbanned stores | migrations, `proxy.ts`, public-store helpers | **PARTIALLY IMPLEMENTED** | wired | all tenant tables | Supabase | static | live RLS attack matrix and migration replay |
| NFR-P1 | Feasibility p90 ≤15 s warm caches | collect/process/feasibility | **UNVERIFIED** | wired | multiple | providers | none | recorded p90 measurement |
| NFR-P2 | Storefront LCP ≤2.5 s on 4G | `[slug]` pages | **UNVERIFIED** | wired | n/a | Vercel/browser | none | Lighthouse/field measurement |
| NFR-P3 | Theme compile ≤10 s incl. fallback | theme route/gateway | **UNVERIFIED** | wired | none | Groq | mocked | timed live run |
| NFR-P4 | Availability target 99% (target only) | deployment | **UNVERIFIED** | none | n/a | Vercel/Supabase | none | monitoring evidence |
| NFR-S1 | One DB row per tenant, no per-tenant infra | stores/RLS/proxy | **IMPLEMENTED** | wired | `stores` | Supabase | static | live tenant-add proof |
| NFR-S2 | Tenant tables indexed; top query plans reviewed | migrations indexes | **PARTIALLY IMPLEMENTED** | n/a | indexes | Supabase | static | `EXPLAIN` review evidence |
| NFR-S3 | Python service stateless/replicable; heavy results cached | `ml-service/main.py` | **PARTIALLY IMPLEMENTED** | admin | in-memory jobs/models | FastAPI | python | durable job/registry store |
| NFR-S4 | 50 users/20 stores evaluation target | deployment | **UNVERIFIED** | none | n/a | all | none | load test |
| NFR-C1 | Cost within Rs. 0–15,000 | platform plan decisions | **UNVERIFIED** | none | n/a | paid providers | none | cost ledger |
| NFR-C2 | Free-tier quota panel with 80% warnings | `admin/usage`, account page | **PARTIALLY IMPLEMENTED** | partial | `ai_call_log`, counts | providers | local | real 80% warning; hardcoded UI figures |
| NFR-C3 | Prefer open-source/open-data components | Leaflet/OSM/XGBoost/Pytrends | **IMPLEMENTED** | wired | n/a | providers | static | none |
| NFR-C4 | Tenant image isolation and file quotas | `product-images`, `project-attachments` | **PARTIALLY IMPLEMENTED** | wired | Storage buckets | Supabase Storage | static | `store-assets/<store_id>` naming/2 MB–50 MB decision; live quota |
| NFR-C5 | Per-user LLM rate limit ~20/hour | `resilience.ts` | **PARTIALLY IMPLEMENTED** | none | none | providers | mocked | shared cross-instance store |
| NFR-C6 | Cache reports/descriptions/trends | AI cache, competitor/trend caches | **PARTIALLY IMPLEMENTED** | wired | cache tables | providers | local | persistent cross-instance cache |
| NFR-R1 | Three-tier providers + deterministic tier 4 | gateway | **PARTIALLY IMPLEMENTED** | wired | none | providers | mocked | OpenAI key/live chain |
| NFR-R2 | Circuit breaker after 3 failures/5 min | `resilience.ts` | **PARTIALLY IMPLEMENTED** | none | none | providers | mocked | shared state and live failure |
| NFR-R3 | Schema-validate all LLM output | `validate.ts`, schemas | **IMPLEMENTED** | wired | none | providers | mocked | live invalid-output injection |
| NFR-R4 | Cached/stale data degrades gracefully and is labeled | providers/UI panels | **PARTIALLY IMPLEMENTED** | wired | cache tables | Overpass/Pytrends | local | live stale-cache rendering; UI source label |
| NFR-R5 | Idempotent jobs/retries without duplicates | submit RPC, checkout, ML jobs | **PARTIALLY IMPLEMENTED** | partial | orders/runs | Supabase/FastAPI | local | live replay; durable ML job store |
| NFR-R6 | Storefront availability target 99% | deployment | **UNVERIFIED** | wired | n/a | Vercel/Supabase | none | monitoring |
| NFR-SEC1 | HTTPS only; secrets env-only; service role never browser | config, clients | **PARTIALLY IMPLEMENTED** | n/a | n/a | all | static | deployed HTTPS check; secret scan |
| NFR-SEC2 | RLS on all tables; server JWT verification | migrations, routes | **PARTIALLY IMPLEMENTED** | wired | all | Supabase | static | live RLS attack matrix |
| NFR-SEC3 | Input validation and XSS-safe output | validation/routes/report helper | **PARTIALLY IMPLEMENTED** | wired | n/a | all | local | NaN/price gaps; live XSS review |
| NFR-SEC4 | Prompt-injection hygiene, no tools | `prompt-hygiene.ts`, adapters | **IMPLEMENTED** | wired | none | providers | local/mocked | live injection suite |
| NFR-SEC5 | Security headers, CSRF, guest abuse protection | `next.config.ts`, order RPC | **PARTIALLY IMPLEMENTED** | wired | orders/rate ledger | Supabase | static/source | explicit CSRF mechanism; live abuse test |
| NFR-SEC6 | Baseline: checkout rate limiting and server-side price re-read | `place_store_order`, checkout | **PARTIALLY IMPLEMENTED** | wired | orders/rate ledger | Supabase | local/source | trusted proxy header proof; live replay |
| NFR-M1 | Modular frontend/ML service | repo structure | **IMPLEMENTED** | wired | n/a | all | static | none |
| NFR-M2 | Versioned migrations in Git | 30 migrations | **PARTIALLY IMPLEMENTED** | n/a | schema | Supabase | static | empty replay; combined artifact is **BROKEN** |
| NFR-M3 | GitHub Actions CI | `.github/workflows/ci.yml` | **IMPLEMENTED** | n/a | n/a | GitHub | ci | live DB/browser/deploy jobs absent |
| Deployment | Python ML deployment blueprint | `Procfile`, `railway.json` | **PARTIALLY IMPLEMENTED** | n/a | n/a | Railway/PaaS | static | env contract; repo-root config path; live deploy |
| UI | Source UI/UX requirements (IDs unavailable locally) | screen inventory in `docs/SRS.md:689-712` | **UNVERIFIED** | partial | n/a | browser | local/static | exact advanced-source IDs and browser UAT |
| SI | Source system-integration requirements (IDs unavailable locally) | all providers/deployments | **UNVERIFIED** | partial | n/a | all | mock/static | exact IDs and live integration proof |
| CI | Source CI requirements (IDs unavailable locally) | `.github/workflows/ci.yml`, CI run `45831018355` | **PARTIALLY IMPLEMENTED** | n/a | n/a | GitHub Actions | ci | exact IDs; live security/E2E/perf/deploy gates |

## Out-of-scope source additions

| Item | Status | Reason |
| --- | --- | --- |
| Visitor analytics product, coupons, reviews, PDF invoices, Stripe/card gateway, manager approval gate, Module 9 numbering | **OUT OF SCOPE** | Excluded by `docs/FINAL_DELIVERY_BASELINE.md:30-33`; existing code may remain but must not be a completion gate. |
