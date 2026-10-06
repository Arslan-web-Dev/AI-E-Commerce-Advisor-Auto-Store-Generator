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

### B. Regional Statistics & Demographic Data (PBS / PTA Open Datasets)
- **Primary Source**: Pakistan Bureau of Statistics 2023 Digital Census Publications & Pakistan Telecommunication Authority 2024/2025 Digital Reports.
- **Metrics Collected**:
  - `population`: Regional census projection.
  - `internet_penetration_pct`: Regional broadband/cellular penetration rate.
  - `ecommerce_growth_rate_pct`: Estimated annual sector expansion index.
- **Licensing**: Public Government Open Data.
- **Fallback**: Synthetic demographic calculations matching provincial averages with provenance `synthetic_demo`.

### C. Category Demand & Search Trends (Google Trends / Pytrends)
- **Primary Method**: Relative Search Interest Series (`0–100`) for the target commercial vertical over 12 months.
- **Region**: Pakistan (`PK`).
- **Unit**: Relative Search Index (not absolute unit sales).
- **Fallback**: Seeded 12-month cyclical interest curves with provenance `synthetic_demo`.

### D. SME Commercial Cost Benchmarks & Rent Cache
- **Primary Source**: PostgreSQL `rent_cache` table containing commercial square-footage rates scraped/benchmarked for key Pakistani business districts.
- **Cost Categories**:
  - `setup`: Fit-out, electrical, display shelving, signage.
  - `rent_monthly`: Derived from footprint square footage and `rent_per_sqft_pkr`.
  - `marketing_initial`: Launch advertising, Meta/Google ads CAC baseline.
  - `logistics_per_order`: Courier Cash on Delivery (COD) rate average.
- **Provenance**: `manual_estimate` or `licensed_dataset`.

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
