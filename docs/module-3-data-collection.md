# Module 3: Data Collection and Provider Integration — Specification & Architecture

## 1. Overview & Objectives

Module 3 implements **Smart Data Aggregation & Provider Integration** for the **AI E-Commerce Advisor & Auto Store Generator**. When an authenticated entrepreneur submits a business idea in Module 2, Module 3 orchestrates and aggregates market data from external APIs and configured providers:

1. **Nearby Competitor POIs (SRS FR-3.1)**: Discovers existing businesses in the target category within the chosen radius (10–15 km) using OpenStreetMap Overpass API, with deterministic demo fallback.
2. **Regional Statistics & Demographics (SRS FR-3.2)**: Collects regional population, internet penetration rates, and e-commerce growth metrics for the target city/province.
3. **Demand & Trend Series (SRS FR-3.2)**: Gathers 12-month category interest indicators and relative trend trajectories.
4. **Cost Baselines & Unit Economics (SRS FR-3.3)**: Aggregates category-specific commercial rent (via `rent_cache`), physical setup estimates, initial marketing CAC, and per-order courier logistics baselines.
5. **Data Provenance & Operational Integrity**: Every persisted record explicitly stores its provenance (`external_api`, `synthetic_demo`, `licensed_dataset`, `manual_estimate`). Missing credentials or external downtime trigger graceful fallback to visibly labeled demo records without crashing or faking live results.
6. **Preservation of Module Boundaries**: Module 3 collects and persists clean source data. It does NOT compute the final feasibility score, perform feature engineering, generate recommendations, or train ML models.

---

## 2. SRS Requirements Traceability

| Requirement ID | Description | Module 3 Implementation | State |
| :--- | :--- | :--- | :--- |
| **FR-3.1** | Competitor Data Collection: nearby businesses by location & category | Overpass OSM API query with bounding circle & category shop tags + local demo provider | ✅ Fully In Scope |
| **FR-3.2** | Market & Demand Data: population, internet penetration, search trend series | Regional statistics provider (PBS / PTA census data) + 12-month Google Trends series | ✅ Fully In Scope |
| **FR-3.3** | Cost Data Collection: setup, marketing, logistics, and rent estimates | Commercial `rent_cache` lookup + SME retail cost model (setup, marketing, logistics) | ✅ Fully In Scope |
| **Operational** | Quota handling, timeouts, retry, partial success | Independent provider execution via `Promise.allSettled`, 10s timeouts, partial status | ✅ Fully In Scope |
| **Security** | API keys in env, RLS, tenant isolation | Server-side only keys (`OVERPASS_API_URL`, etc.), forced PostgreSQL RLS on all data | ✅ Fully In Scope |
| **Provenance** | Visible "Demo Data" tags and provenance tracking | Explicit provenance column on all tables, UI badges for `external_api` vs `synthetic_demo` | ✅ Fully In Scope |

---

## 3. Provider Contracts & Fallback Strategy

### A. Competitor Provider (`ICompetitorProvider`)
- **Live Provider**: OpenStreetMap Overpass API (`https://overpass-api.de/api/interpreter`). Queries nodes/ways tagged with relevant `shop` values within the project's coordinate and radius buffer.
- **Failover / Backup Endpoint**: `https://maps.mail.ru/osm/tools/overpass/api/interpreter`.
- **Demo Provider**: Deterministic POI generator using seed hash of `(category, city, lat, lng)` producing realistic local store names, coordinate offsets, and distance metrics tagged as `synthetic_demo`.

### B. Regional Demographics Provider (`IRegionalStatsProvider`)
- **Live / Open Data Provider**: Pakistan Bureau of Statistics (PBS) 2023/2024 census projections & PTA digital indicators.
- **Demo Provider**: Deterministic population and penetration indicators tagged as `synthetic_demo`.

### C. Demand Trends Provider (`IDemandTrendProvider`)
- **Live / Trend Provider**: Google Trends / Pytrends 12-month search interest index (`0–100`) for the target commercial vertical in region `PK`.
- **Demo Provider**: Deterministic seasonal search interest curve tagged as `synthetic_demo`.

### D. Cost Estimate Provider (`ICostEstimateProvider`)
- **Live / Cache Provider**: Reads area commercial rent per sq. ft. from PostgreSQL `rent_cache` and applies SME industry cost equations.
- **Demo Provider**: Documented commercial cost benchmarks tagged as `manual_estimate`.

---

## 4. Database Schema (`supabase/migrations/20261006010000_module3_data_collection_schema.sql`)

- `public.project_collection_runs`: Tracks run lifecycle (`pending`, `running`, `completed`, `partial`, `failed`), timestamps, and per-provider statuses.
- `public.project_competitors`: Individual POI records with name, coordinates, distance, rating, review count, price level, provider, and provenance.
- `public.project_market_observations`: Regional metrics (population, internet penetration, growth rate).
- `public.project_demand_trends`: 12-month interest index series, average interest, and slope.
- `public.project_cost_estimates`: Setup, rent, marketing, and logistics range estimates.

---

## 5. REST API Endpoints

- `POST /api/projects/[id]/collect`: Initiate a data collection run (idempotent; returns existing run if already executing).
- `GET /api/projects/[id]/collection`: Get current collection run status & summary.
- `GET /api/projects/[id]/competitors`: Paginated list of discovered competitors with provenance.
- `GET /api/projects/[id]/market-data`: Regional demographic and trend indicators.
- `GET /api/projects/[id]/costs`: Category and location cost estimates.
