# Data Providers & Integrations Guide — Module 3

## 1. Provider Inventory & Contracts

### A. OpenStreetMap Overpass API (Competitor Discovery)
- **Primary Endpoint**: `OVERPASS_API_URL` or `https://overpass-api.de/api/interpreter`
- **Alternate Endpoints**: `https://maps.mail.ru/osm/tools/overpass/api/interpreter`, `https://overpass.kumi.systems/api/interpreter`
- **Method**: HTTP POST with Overpass QL. Each approved category maps to the relevant `shop=*` and `amenity=*` values. Restaurants/cafes and pharmacies are not queried as shops only.
- **Radius**: Project radius, clamped to 1–15 km.
- **Records**: Name (or `Unnamed business`), coordinates, OSM type/id, tags, category, Haversine distance, address when present. Ratings and review counts are stored only when OSM actually provides a valid rating. Review counts are not invented.
- **Deduping**: Stable OSM identity (`type/id`), not business name.
- **Resilience**: Per-request timeout, bounded exponential backoff, and failover across endpoints.
- **Cache**: Successful live responses are stored in `competitor_query_cache` for seven days. The cache key includes category, rounded coordinates, radius, and query version. Concurrent requests for the same key share one live fetch. A cache outage does not fail collection.
- **Authentication**: Public Overpass, no API key. Usage stays within public Overpass terms (bounded queries, identifying User-Agent, no bypass of rate limits).
- **Licensing**: Open Database License (ODbL). Attribution: *"© OpenStreetMap contributors"*.
- **Failure**: All endpoints failing returns a provider `failed` status. Synthetic competitors are used only when demo mode is explicit (`force_demo` or `FORCE_DEMO_DATA=true`) and are labelled `synthetic_demo`.

### B. Regional Statistics & Demographic Data (embedded estimates)
- **Current implementation**: Embedded city reference values with citations. This provider does not call a live PBS or PTA API.
- **Metrics**: `population`, `internet_penetration_pct`, `ecommerce_growth_rate_pct`.
- **Provenance**: `manual_estimate`.

### C. Category Demand & Search Trends (Google Trends / Pytrends)
- **Current implementation**: `GoogleTrendsProvider` calls the Python ML service (`/market/trends`), which uses Pytrends when installed.
- **Geography**: Recognised province ISO 3166-2 code, otherwise Pakistan-wide `PK`. The requested scope is stored separately from the actual data scope.
- **Cache**: Successful live responses are cached for 24 hours. If live retrieval fails, a stale cached payload may be returned and is flagged `is_stale` / freshness `stale_cache`.
- **Punjab-only fallback**: Seasonal demonstration curves are used only for regions with verified coverage (Punjab) and are labelled `synthetic_demo`. They are not applied to other Pakistani regions. Those regions receive `unavailable` coverage when live and stale data are both missing.
- **Empirical baseline**: If Pytrends is unavailable and no cache exists, the ML service may return `source: empirical_market_baseline`. That is not a live Google Trends observation.

### D. SME Commercial Cost Benchmarks & Rent Cache
- **Analysis reads `rent_cache` only.** It does not scrape rent websites during a feasibility request.
- **Lookup order**: exact area, then a nearby area in the same city/district within 12 km, then a city/district record, otherwise unavailable. Another district is never substituted silently.
- **Scheduled writer**: `GET /api/cron/rent-cache` requires `CRON_SECRET` and upserts Punjab manual estimates with min, max, average, sample size, currency, source, confidence, and timestamp. Those rows are `manual_estimate`, not observed market averages.
- **Cost categories**: `setup`, `rent_monthly`, `marketing_initial`, `logistics_per_order`.
- **Missing rent**: `rent_monthly` is returned as unavailable (`0`–`0`) rather than a borrowed city rate.

### E. Module 5 visualization consumers
- The feasibility map reads competitors from the authenticated paginated competitor endpoint and reads rent areas from `GET /api/projects/[id]/rent-map` (owner/admin only). Neither UI path performs live scraping.
- The rent-map route applies canonical province/city/district predicates in the `rent_cache` query before its 500-row limit, deduplicates overlapping scoped reads, and then applies exact/nearby/city-or-district/province guards. Only same-geography area centroids inside a valid project radius are plotted; another city/province is never substituted and there is no unfiltered global fallback.
- Area markers carry `provenance`, `confidence`, `freshness`, `isStale`, source, sample size and recorded timestamp. The cache freshness cutoff for display is 7 days; manual estimates and stale cached values remain labelled, not upgraded.
- `geometry` is always `null` and `markerType` is `centroid` because no boundary polygons are stored. Relative colour intensity is computed from the currently displayed sourced values, not from an absolute market threshold.

---

## 2. Environment Variables

```bash
OVERPASS_API_URL=https://overpass-api.de/api/interpreter
OVERPASS_API_TIMEOUT_MS=12000
FORCE_DEMO_DATA=false
CRON_SECRET=change-me-to-a-long-random-cron-secret
ML_SERVICE_URL=http://127.0.0.1:8000
ML_SERVICE_API_KEY=your-secure-ml-service-api-key-here
```

---

## 3. Data Provenance and Freshness

Persisted records use `provenance`:

- `external_api`: Observation returned by a permitted external API.
- `synthetic_demo`: Deterministic demonstration or empirical baseline.
- `licensed_dataset`: Published census or open government dataset.
- `manual_estimate`: Documented estimate, not a live average.

Collection status also reports `freshness`: `live`, `cached`, `stale_cache`, `verified_benchmark`, `manual_estimate`, `synthetic_demo`, `unavailable`.
