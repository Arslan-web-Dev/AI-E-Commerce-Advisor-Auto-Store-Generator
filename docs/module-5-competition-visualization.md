# Task 6 / Module 5 — Competition, Location and Rent Visualization

**Authority:** checked-in `docs/SRS.md` §Module 5, FR-5.1–FR-5.7 (lines 245–251), `docs/FINAL_DELIVERY_BASELINE.md`, `docs/requirements-traceability.md`, and the existing Module 3/4 data contracts. The advanced October 2026 SRS/SDD PDF is not present in this repository.

**Numbering note:** older documents use “Module 5” for feasibility scoring/ML. In the checked-in SRS that work is FR-4.1–FR-4.8; the competition, location and visualization module addressed here is FR-5.1–FR-5.7. This document does not alter the provisional MCDA formula or the OI-6 supervised-serving gate.

## 1. Status by source requirement

| Requirement | Implementation status | Local evidence | Runtime limitation |
| --- | --- | --- | --- |
| **FR-5.1** Leaflet/OSM map, competitor markers, radius, safe popups | Implemented in the existing `CompetitorMap.tsx`; no second map component added. | `tests/module5-competition-visualization.test.mjs`, `npx tsc --noEmit`, lint, build. | Browser-level desktop/keyboard/tile loading is `NOT RUN`. |
| **FR-5.2** Area rent overlay from stored data | Implemented through new owner/admin `GET /api/projects/[id]/rent-map` and `rent_cache`-only centroid markers. | Behavioral geography/provenance/staleness assertions in the Module 5 suite. | Live Supabase/RLS read and populated cache are `NOT RUN`. |
| **FR-5.3** Rent-to-budget gauge, green/amber/red bands | Implemented with monthly-equivalent denominator and genuine-range handling. | Rent math, currency mismatch and range assertions. | No live rent/budget fixture was rendered in a browser. |
| **FR-5.4** Saturation meter 0–100, four labels | Implemented with raw competitors/100k shown beside a documented presentation index. | Contiguous-band and validity assertions. | Population fixtures are not market evidence. |
| **FR-5.5** 12-month trend chart | Implemented from validated stored observations; source order, invalid months, duplicates and gaps are explicit. | Trend validation and summary assertions. | Live Pytrends/cache rendering is `NOT RUN`. |
| **FR-5.6** Competitor table filters, sort, pagination, CSV | Implemented over every stored competitor page with escaped, formula-safe CSV. | Filter/sort/pagination and CSV assertions. | Browser interaction on a real dataset is `NOT RUN`. |
| **FR-5.7** OSM attribution | Centralized text/link plus Leaflet tile attribution. | Attribution contract and source wiring assertions. | Browser rendering is `NOT RUN`. |

## 2. Data flow

1. `src/app/projects/[id]/feasibility/page.tsx` loads the project, stored features, all competitor pages, and the new rent-map endpoint.
2. Competitor pages are requested with `limit=50` until `pagination.total_pages` is exhausted. A worker pool fetches at most three pages concurrently; invalid page counts are bounded, page failures are recorded, and filtering/sorting/pagination in the table operate on the successfully loaded stored set rather than page 1.
3. `/api/projects/[id]/rent-map` authenticates the user, loads the project, checks owner-or-admin access, and applies canonical province/city/district predicates in the Supabase query **before** the 500-row limit. It never calls a rent provider, never reads an unfiltered global snapshot, and never writes to the cache.
4. `buildRentMap` applies exact/nearby/city-or-district/province geography guards, computes freshness and confidence states, and emits area **centroid markers** (`geometry: null`, `markerType: 'centroid'`). No boundary polygons or invented coordinates are produced.
5. The pure visualization helpers calculate rent share, saturation, trend analysis, table rows and CSV content; the React components render their results with explicit `N/A`/unavailable states.

## 3. Shared configuration and thresholds

`config/module5-visualization.json` and `src/lib/visualization/module5-config.ts` centralize values that already existed in the UI:

- Rent bands: `0–<30` well within budget, `30–<60` comfortable, `60–<85` tight/negotiate, `85+` over budget. These preserve the pre-Task-6 green/amber/red display cutoffs; the checked-in SRS names the colours but does not supply numeric cutoffs. They are **not** new market thresholds.
- Saturation bands: `0–<25` Underserved, `25–<50` Balanced, `50–<75` Crowded, `75–100` Saturated.
- Saturation presentation index: `min(100, competitorsPer100kResidents × 10)`. The raw competitors/100,000 value is always displayed; the index is not a calibrated market model.
- Rent overlay intensity bands are relative to the minimum/maximum of the currently displayed sourced area values; `max <= min` yields no band.
- Map: Leaflet 1.9.4 CDN assets, OSM raster tiles, 15 km radius cap, 8-second loader timeout, `© OpenStreetMap contributors` linking to `https://www.openstreetmap.org/copyright`.
- Rent cache freshness cutoff: 7 days.

## 4. Map implementation (FR-5.1, FR-5.7)

- `src/components/feasibility/CompetitorMap.tsx` remains the **single** real Leaflet/OSM map component. The shared `src/lib/visualization/leaflet-loader.ts` uses one script id, one stylesheet id and one in-memory load promise so Strict Mode remounts do not add duplicate scripts/listeners.
- The map is created only when the project has finite coordinates and a valid (>0, ≤15 km) radius. `(0, 0)` is refused as Null Island rather than treated as a real project location.
- `map.remove()` is called on unmount, invalid input, or provider failure; competitor and rent layer groups are cleared before repopulation.
- Popups are built with DOM `textContent` and `sanitizeMapText`, not interpolated HTML. They show competitor name, category, distance/rating when stored, and target coordinates.
- Visible states: loading, provider failed, invalid coordinates/radius, no in-scope observations, and ready. A visible attribution link is rendered below the map in addition to the Leaflet tile attribution control.
- Rent-area markers can be toggled independently. Their popups expose stored rent, observed min/max, source, provenance, freshness, confidence, recorded time, sample size and the centroid-only geometry note.

## 5. Rent overlay (FR-5.2)

The new route returns a `RentMapPayload` containing `areas`, optional `aggregate`, `matchedRent` and a `summary` with `areaCount`, `invalidCoordinateCount`, `invalidValueCount`, `manualEstimateCount`, `cachedCount`, `licensedCount`, `staleCount`, `unavailableCount`, `cityAggregateAvailable`, radius validity and newest retrieval time.

Geography rules:

- Province must match when the project names one; a row with unknown province is not accepted.
- City/district must match the project city or district. If the project has no city/district identity, no row is considered “nearby”.
- When a valid radius and coordinates exist, only area centroids within that radius are mapped.
- Other cities, other provinces, invalid coordinates and invalid rent values are excluded from the overlay. The existing rent lookup still supplies an explicit audit note that no unrelated geography was substituted.
- Provenance/freshness can be `manual_estimate`, `cached`, `stale_cache`, `verified_benchmark`, `synthetic_demo` or `unavailable`; stale and manual rows remain visible and labelled rather than being silently upgraded.

## 6. Rent gauge and saturation meter (FR-5.3, FR-5.4)

`RentBudgetGauge` uses `monthlyRent ÷ (totalBudget ÷ 12)`. Mismatched currencies, missing/zero budget, or missing/invalid rent produce `N/A` with a reason instead of a number. The monthly range is scaled only from a genuine cached per-square-foot `rent_min/rent_max/avg`; otherwise the UI says a genuine range is unavailable. Popups and the gauge distinguish monthly rent from the per-square-foot rent unit (PKR/ft² in this application) and from total budget.

`SaturationMeter` accepts raw stored `competitorsPer100k`, or derives it from competitor count and a positive population. It shows the raw value, normalized 0–100 index, four exact labels, and an explicit `N/A` state when the denominator is invalid. Raw and normalized values are never conflated.

## 7. Trend chart (FR-5.5)

`analyzeTrendSeries` validates `YYYY-MM` months and `0–100` indices, removes invalid/duplicate observations, sorts chronologically, reports missing months, and refuses to call a series complete unless it has 12 unique valid months, no invalid observations and no disorder. Direction prefers the stored usable slope and otherwise calculates a transparent linear slope; the source is labelled `stored`, `calculated` or `unavailable`. The responsive SVG includes an accessible summary, average/peak/minimum, provider/scope/freshness/cached/stale metadata, incomplete-series messaging, and an empty state instead of a synthetic curve.

## 8. Competitor table and export (FR-5.6)

`CompetitorTable` filters over all stored rows by search text, category, distance range and rating mode/minimum. Name/distance/rating sort in both directions, with missing values always last. Pagination is controlled and resets to page 1 when the filter/sort signature changes without a `setState` effect. Accurate filtered and stored counts are displayed.

CSV export includes a UTF-8 BOM, quoted cells, neutralized formula prefixes (`=`, `+`, `-`, `@`, tab, carriage return), CRLF rows, a sanitized filename, and `URL.revokeObjectURL` cleanup. Export covers the currently filtered/sorted rows.

## 9. Task 6 remediation: scoped rent queries and bounded pagination

Two defects found after the initial Task 6 delivery were corrected without changing the API response contract, thresholds, ML pipeline, authentication or schema.

### Rent-cache geographic filtering

- **Defect:** `src/app/api/projects/[id]/rent-map/route.ts` selected the first 500 global `rent_cache` rows and only then called `buildRentMap`. Unrelated cities could fill the snapshot and hide valid local coverage.
- **Fix:** `src/lib/visualization/rent-cache-query.ts` resolves the canonical province (including ISO codes), city and district, builds one narrow query per safe geography predicate, applies province/city/district `eq()` filters **before** `order()` and `limit()`, deduplicates overlapping city/district results by stable row id, and caps the merged result at 500 rows.
- **Safety:** no unfiltered fallback exists. A project without city/district identity issues no query; `buildRentMap` therefore returns `unavailable` rather than borrowing Lahore/Punjab or any other default. Rows are passed through unchanged, so provenance, freshness, confidence and centroid markers keep their original labels.

### Competitor pagination

- **Defect:** `src/app/projects/[id]/feasibility/page.tsx` used `Promise.all(Array.from(...))`, launching every remaining page at once.
- **Fix:** `src/lib/visualization/competitor-pagination.ts` fetches page 1, validates `total_pages` (finite, non-negative integer, capped at 100 by default), then loads later pages with a worker pool of at most three simultaneous requests. Records are deduplicated by OSM identity (`raw_data.osm_identity` or `osm_type/osm_id`), then DB id, then a provider/name/coordinate composite; names alone are never merged.
- **Honest partial state:** each page failure is recorded while other pages continue. `loadedCount` (unique loaded rows), `loadedRowCount`, `serverTotal`, `failedPages` and `partial` are returned separately. The feasibility page displays an explicit incomplete-data notice; a server total larger than the rows actually fetched is never reported as complete.

### Regression evidence

- `tests/module5-rent-query-regression.test.mjs` uses a mock Supabase query builder that applies every `eq()` filter before `limit()`. It proves target-city rows survive 600 unrelated rows, province/city/district filters precede limits, district-only and overlapping queries are scoped and deduplicated, canonical ISO provinces work, missing geography issues no global query, and provenance/unavailable behavior is unchanged.
- `tests/module5-pagination-regression.test.mjs` counts simultaneous in-flight requests and proves the configured limit of three is never exceeded while all pages load in order. It also covers OSM deduplication, invalid/negative/fractional/capped page counts, a failed page, first-page failure, and separation of server total from loaded count.
- The existing `tests/module5-competition-visualization.test.mjs` gained wiring assertions for both helpers and a guard against the removed `Promise.all(Array.from(...))` pattern; no existing assertion was removed or weakened.

## 10. Files

**Created:** `config/module5-visualization.json`, `src/app/api/projects/[id]/rent-map/route.ts`, `src/lib/visualization/*`, `tests/module5-competition-visualization.test.mjs`, `tests/module5-rent-query-regression.test.mjs`, `tests/module5-pagination-regression.test.mjs`, `docs/module-5-competition-visualization.md`, `docs/task6-final-report.md`.

**Modified:** the five feasibility components, `src/app/projects/[id]/feasibility/page.tsx`, `docs/requirements-traceability.md`, `docs/FINAL_DELIVERY_BASELINE.md`, `docs/api.md`, `docs/data-and-integrations.md`, and legacy Module 5 numbering notes.

**Migration/rollback:** none. Task 6 adds no schema, policy or migration; reverting the listed files restores the prior UI/API behavior. No credentials or service-role keys were added.

## 11. Verification and non-claims

Run `node --test tests/module5-rent-query-regression.test.mjs`, `node --test tests/module5-pagination-regression.test.mjs`, `node --test tests/module5-competition-visualization.test.mjs`, and `node --test tests/*.mjs`. Exact command results are in `docs/task6-final-report.md`.

`PARTIAL` means static/mocked/local verification only. `NOT RUN` covers live Supabase/RLS, populated rent-cache rows in a deployed database, live OSM tile loading, live provider calls, deployed runtime, browser-level keyboard/responsive review, and external accessibility/security review. Provisional MCDA remains the active feasibility mode; OI-6 remains `BLOCKED`; no supervised model was trained, activated or represented as calibrated for this task.
