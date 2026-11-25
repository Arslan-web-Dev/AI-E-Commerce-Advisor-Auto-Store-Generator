# Module 3: Smart Data Aggregation — Specification & Implementation Status

> **Task 4 status (25 November 2026):** Module 3 (FR-3.1–FR-3.7) is implemented with honest provenance, seven-day competitor cache plus labelled stale fallback, secure rent-cache cron, nearest/city aggregate rent fallback, fail-closed Google Trends geo scope, and typed provider health. Acceptance evidence lives in `tests/module3-smart-aggregation.test.mjs` (real TypeScript modules exercised with mocked fetch, cache backend and ML client, plus source/wiring assertions) and `scripts/verify-module3.mjs` (source/wiring checks). Live Overpass / Pytrends / Supabase runtime checks and a migration-from-empty `/collect` exercise remain environment-dependent and are marked unverified unless executed against configured services.

## 1. Objectives

When an authenticated entrepreneur submits a business idea, Module 3 aggregates:

1. Nearby competitor POIs via OpenStreetMap Overpass (FR-3.1 / FR-3.2)
2. Regional demographic reference estimates (manual / curated)
3. 12-month demand trends via Google Trends / Pytrends (FR-3.5)
4. Cost baselines including rent_cache lookup only (FR-3.3 / FR-3.4)

Every result distinguishes:

| Freshness / provenance | Meaning |
| --- | --- |
| `live` / `external_api` | Fresh observation from an external provider |
| `cached` | Successful response reused within TTL |
| `stale_cache` | Expired cache returned because live retrieval failed |
| `verified_benchmark` / `licensed_dataset` | Curated verified corpus |
| `manual_estimate` | Explicit human/expert estimate — not a live average |
| `synthetic_demo` | Deterministic demo / empirical baseline |
| `unavailable` | No lawful/technical coverage; nothing invented |

## 2. Requirement coverage

| ID | Requirement | Implementation | Evidence |
| --- | --- | --- | --- |
| **FR-3.1** | Category-mapped Overpass POIs | `src/lib/providers/competitors/overpass.ts` — shop + amenity tags, Haversine distance, OSM id dedupe, unnamed handling, no fabricated ratings | `tests/module3-smart-aggregation.test.mjs` |
| **FR-3.2** | Timeout / retry / alternate endpoint + 7-day cache | Overpass backoff + endpoints; `competitor_query_cache` + `competitor-cache.ts` | migration `20261125010000_*`, tests |
| **FR-3.3** | Scheduled aggregated rent cache | Secure `/api/cron/rent-cache` writes `rent_cache` as `manual_estimate` | cron route + cron-auth |
| **FR-3.4** | Exact → nearby → city/district rent fallback | `rent-lookup.ts`; never substitutes Lahore for Karachi etc. | unit assertions in module3 test |
| **FR-3.5** | 12-month Pakistan Pytrends + stale fallback | Next.js provider + `ml-service/trends/google_trends.py` | tests + Python cache flags |
| **FR-3.6** | Typed payload + provider health | `TypedProviderResult`, expanded `ProviderStatusDetail`, orchestrator partial outcomes | types + orchestrator |
| **FR-3.7** | Lawful sources / attribution / no invented live data | OSM attribution, estimate labels, no silent demo fallback | UI + providers |

## 3. Provider inventory

### Competitors (`OverpassCompetitorProvider`)
- Endpoints: env primary + mail.ru + kumi.systems
- Categories use both `shop=*` and `amenity=*` where appropriate
- Radius clamped to 1–15 km; POIs outside the clamped radius are rejected and dense results are not silently capped
- Cache: SHA-256 key of category + rounded lat/lng + radius + query version; TTL 7 days
- On live failure an expired real cache row may be returned as `stale_cache`; otherwise the failure is surfaced
- Failed live requests do **not** become synthetic competitors unless `force_demo` / `FORCE_DEMO_DATA`

### Demand trends (`GoogleTrendsProvider`)
- Calls ML service `/market/trends`
- Freshness: live / cached / stale_cache / synthetic_demo
- Punjab seasonal curves only when region has `analysis_enabled`
- Unrecognised regions fail closed instead of silently widening to `PK`; recognised non-Punjab regions are accepted only when the ML response reports the same real geo scope
- Other regions → `CoverageUnavailableError` when live+stale fail or an empirical baseline would be mislabelled as local coverage

### Rent / costs (`BenchmarkCostEstimateProvider`)
- Reads `rent_cache` only
- Match levels: exact (requires a named city), nearby (≤12 km same city/district), city/district aggregate, unavailable
- Cron seeds Punjab estimates labelled `manual_estimate` with a separate `recorded_at` curation timestamp; the legacy `scraped_at` column is not presented as a live observation
- City/district fallback computes a weighted aggregate from all scoped cached area rows instead of labelling one arbitrary row as city coverage

## 4. Orchestration & security

- `runDataCollection` claims pending runs created by `submit_project_for_feasibility`
- Reclaims stuck `running` runs after 5 minutes
- `Promise.allSettled` preserves successful providers on partial failure
- Active runs are claimed conditionally; a duplicate submit does not trigger a second collection
- Reruns replace that run's observation rows; persistence errors fail the run instead of reporting stored data that does not exist
- Ownership checked against `projects.owner_id` (admin override explicit)
- Cron requires `CRON_SECRET` via Bearer or `x-cron-secret`
- Service-role key never sent to the browser

## 5. Migrations

| Migration | Purpose |
| --- | --- |
| `20261006010000_module3_data_collection_schema.sql` | Collection runs + observation tables + RLS |
| `20261125010000_module3_smart_aggregation.sql` | `competitor_query_cache` + rent_cache enrichment |
| `20261125120000_module3_persistence_hardening.sql` | Per-record freshness columns, manual-estimate timestamp, active-run uniqueness guard |

Rollback for Task 4 migration is documented in the SQL file header.

## 6. APIs

See [api.md](api.md) for `/collect`, `/collection`, competitor/market/cost routes, and `/api/cron/rent-cache`.

## 7. Verification evidence

- `node --test tests/*.mjs` — 6 test files pass. The Module 3 suite imports the real TypeScript modules and uses mocked `fetch`, a Supabase-shaped cache backend and mocked ML responses; it covers tag mapping, Haversine filtering, OSM dedupe, retry/alternate endpoint, fresh/expired/stale cache, single-flight, synthetic exclusion, cron authorization, exact/nearby/city/district/unavailable rent paths, trend validation, live/cached/stale/demo/unavailable trends, geo-scope rejection and wiring assertions.
- `node scripts/verify-module3.mjs` — source/wiring and migration assertions only; no live services.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `python ml-service/test_pipeline.py` — rerun after the hardening changes.
- **Not verified here:** live Overpass, live Google Trends, live Supabase writes, RLS enforcement at runtime, migration-from-empty plus `/collect` row persistence, duplicate-submit race, and multi-instance cache stampede. The single-flight guard is process-local only. `TypedProviderResult<T>` is declared for consistent envelopes but provider paths still return their existing interface types; treat that as a typing/detail gap rather than runtime evidence.
