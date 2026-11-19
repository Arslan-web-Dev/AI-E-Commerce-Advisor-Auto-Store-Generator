# Data Providers & Integrations Guide — Module 3

## 1. Provider Inventory & Contracts

### A. OpenStreetMap Overpass API (Competitor Discovery)
- **Primary Endpoint**: `https://overpass-api.de/api/interpreter`
- **Secondary / Alternate Endpoint**: `https://maps.mail.ru/osm/tools/overpass/api/interpreter`
- **Method**: HTTP POST with Overpass QL query:
  ```overpass
  [out:json][timeout:15];
  (
    node["shop"~"clothes|boutique|shoes"](around:10000, 31.5204, 74.3587);
    way["shop"~"clothes|boutique|shoes"](around:10000, 31.5204, 74.3587);
  );
  out center 30;
  ```
- **Authentication**: Public, no API key required.
- **Licensing & Terms**: Open Database License (ODbL). Attribution required: *"© OpenStreetMap contributors"*.
- **Rate Limits & Hygiene**: Up to 2 concurrent connections per IP. 15-second query timeouts.
- **Fallback**: When unreachable or rate-limited, the system falls back to `CompetitorDemoProvider` with provenance `synthetic_demo`.

### B. Regional Statistics & Demographic Data (embedded estimates)
- **Current implementation**: Embedded city reference values with citations; no live PBS/PTA request or versioned licensed dataset is loaded by this provider.
- **Metrics Collected**:
  - `population`: Regional census projection.
  - `internet_penetration_pct`: Regional broadband/cellular penetration rate.
  - `ecommerce_growth_rate_pct`: Estimated annual sector expansion index.
- **Provenance**: `manual_estimate`; values and source dates require validation before decision use.
- **Fallback**: An embedded national urban estimate is used for unsupported cities and must be treated as low-confidence.

### C. Category Demand & Search Trends (synthetic curve)
- **Current implementation**: In-code category seasonality curve, not Google Trends or Pytrends.
- **Unit**: Synthetic illustrative index (`0–100`), not observed search interest or absolute unit sales.
- **Provenance**: `synthetic_demo`; do not use as measured market demand.

### D. SME Commercial Cost Benchmarks & Rent Cache
- **Current implementation**: Attempts an owner-authenticated `rent_cache` lookup and uses embedded city defaults when no row is available. This is a benchmark model, not a verified live rent feed.
- **Cost Categories**:
  - `setup`: Fit-out, electrical, display shelving, signage.
  - `rent_monthly`: Derived from footprint square footage and `rent_per_sqft_pkr`.
  - `marketing_initial`: Launch advertising, Meta/Google ads CAC baseline.
  - `logistics_per_order`: Courier Cash on Delivery (COD) rate average.
- **Provenance**: `manual_estimate`; sources, sample size, and observation date should be shown where a cache row exists.

---

## 2. Environment Variables

```bash
# ==============================================================================
# Module 3: Data Collection & Provider Configuration
# ==============================================================================

# OpenStreetMap Overpass Endpoint (Leave blank to use default public interpreter)
OVERPASS_API_URL=https://overpass-api.de/api/interpreter
OVERPASS_API_TIMEOUT_MS=12000

# Force Demo Mode for testing and offline environments ('true' | 'false')
FORCE_DEMO_DATA=false

# Google Places / External Geocoding (Optional future upgrade; not required for OSM)
GOOGLE_PLACES_API_KEY=
```

---

## 3. Data Provenance Classification

Every persisted market record contains an explicit `provenance` value:
- `external_api`: Verifiable live record returned by an authoritative external API.
- `synthetic_demo`: Deterministic synthetic record generated for development or fallback when external APIs are offline.
- `licensed_dataset`: Sourced from an established published census or open government dataset.
- `manual_estimate`: Derived from documented SME benchmark heuristics and equations.
