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

### F. Module 6 advisory providers and stored-data simulation
- Provider order is server-owned: advisory uses OpenAI → Gemini → Groq by default; `AI_ADVISORY_PROVIDERS` may override the order with validated names only.
- A provider is eligible only when **both** its `*_API_KEY` and `*_MODEL` are configured. No runtime model-ID fallback exists. Unconfigured providers are skipped, and exhausted/failed providers return deterministic stored-facts advice.
- Requests carry no tools and only a trusted computed-facts JSON block plus a delimited, sanitized project description. Model output must be strict JSON matching the server schema; invented numbers and Urdu script are rejected.
- Every attempt is written to `ai_call_log` with sanitized telemetry only. The 3-failure/5-minute circuit, 20-call/hour user quota and 10-minute language cache are **process-local**; a shared store is needed for serverless-wide guarantees.
- `POST /api/projects/[id]/advisory/simulation` reads only stored collection/feature rows and recomputes provisional MCDA. It performs no provider call, external fetch, new run or report mutation. OI-6 remains open; no supervised model is activated.
- Advisory checklist ticks are stored in `advisory_action_states`, with RLS restricting rows to `auth.uid()` and to reports whose project the caller may access.

### G. Module 7 theme generation and persistence
- The theme configurator uses the shared server-only AI gateway with the `theme` task policy: **Groq only**, 20-second timeout and at most two provider attempts. `GROQ_API_KEY` and `GROQ_MODEL` are both required; `AI_ADVISORY_PROVIDERS` does not alter theme routing. No provider, model or credential is accepted from the browser.
- Model output must be strict JSON with exactly seven properties, enum-validated MCQ IDs and six-digit hex colours. The server additionally requires the model to return the owner's selected IDs unchanged and rejects HTML, scripts, executable code, CSS strings, unsafe labels and extra properties.
- Invalid, unavailable, timed-out or unconfigured Groq responses fall back to a deterministic palette derived from the approved MCQ answers. The fallback is disclosed in `generation.fallback`, `generation.provider` and `generation.model`; no live provider call is claimed by the mocked test suite.
- WCAG relative luminance and contrast ratios are computed locally: 3:1 for accent-on-surface and 4.5:1 for normal text. Failing colours are deterministically adjusted, with final ratios, original colours and changed tokens recorded in the saved configuration.
- Validated configurations are written to `stores.theme_config` with `theme_config_version` and `theme_updated_at`. Previous draft configurations are copied into `store_draft_versions` with a stable version number before replacement; published stores are rejected. All reads and writes are scoped to the authenticated project owner, with database RLS remaining authoritative.
- Additive migration `supabase/migrations/20261126160000_module7_theme_configurator.sql` adds the project link, version metadata, history index, owner-consistency trigger and append-only history trigger. It is checked in only; execution in Supabase is not claimed. See `docs/module-7-theme-configurator.md`.

### H. Module 8 multi-tenant storefront and deployment
- A single Next.js deployment serves every tenant. `src/proxy.ts` rewrites only hosts whose `custom_domain` is present with `domain_status='verified'`, `status='published'` and `is_banned=false`; path and wildcard tenants are resolved by `src/lib/store-management/tenant.ts`. A host header alone never proves domain ownership.
- `src/lib/store-management/project-store.ts` resolves exactly one store by `project_id` (never by `owner_id` alone), checks owner/admin against the project, and provisions new stores as `draft` with the project owner. Additive `20261127000000_module8_publication_domain_lifecycle.sql` adds a partial unique index on non-null `project_id` and fails closed on pre-existing duplicates instead of deleting or reassigning rows.
- Custom-domain attachment uses the real Vercel Domains API (`v10` add, `v9` get/verify/remove) through server-only `VERCEL_TOKEN`/`VERCEL_PROJECT_ID` credentials. DNS records and tokens come from the provider response; `verified` is stored only when the provider confirms `verified: true`. Payment for this upgrade remains manual/out of band.
- Publication, ban/unban, checkout, order transitions and inventory adjustments go through narrowly granted `SECURITY DEFINER` RPCs in `20261127020000_module8_secure_order_rpcs.sql`. Authorization is derived from `auth.uid()`, `public.is_admin()` and `public.can_manage_store()`; client-supplied actor IDs are audit labels only. Idempotency, hashed-IP rate limiting, row locks, DB-derived prices, conditional stock updates and append-only history are enforced in the database.
- Public reads use canonical `stores`, `products`, `orders` and `order_items` rows. The removed `store_products`, `store_orders`, `store_order_items`, `stock_quantity`, `delivery_address` and `is_published` names are not queried anywhere in the new Module 8 path.
- All four `20261127*.sql` migrations are forward-only and additive; rollback comments remove only newly introduced objects. The fourth creates the `product-images` bucket with owner-scoped insert/update/delete policies and public read for published storefront images. Migrations are checked in but have **not** been executed against a live Supabase project in this task.
- Owner product images can be uploaded through `POST /api/stores/[id]/products/images` to the `product-images` bucket; file type, size and store ownership are enforced server-side. The owner UI still permits reviewed external HTTPS URLs.
- The governed AI description route accepts tone, language (English/Roman Urdu), keywords and target length, returns keyword/length checks, and never saves the suggestion; the owner must review and save explicitly.
- SEO metadata is normalized on write and on render; all eight public routes set validated metadata and their own canonical URL. Server-computed SEO readiness is exposed in owner and admin dashboards. `GET /api/admin/usage` provides aggregated counts and sanitized AI call telemetry only.
- The SEO score is on-page readiness, not a search-ranking prediction.
- Tests in `tests/module8-*.test.mjs` inject mocked Supabase/fetch clients. No live Vercel, DNS, Supabase, Groq or deployed-runtime call was made. See `docs/module-8-implementation-gap-report.md` and the Task 9 implementation report for the honest limitation list.

---

## 2. Environment Variables

```bash
OVERPASS_API_URL=https://overpass-api.de/api/interpreter
OVERPASS_API_TIMEOUT_MS=12000
FORCE_DEMO_DATA=false
CRON_SECRET=change-me-to-a-long-random-cron-secret
ML_SERVICE_URL=http://127.0.0.1:8000
ML_SERVICE_API_KEY=your-secure-ml-service-api-key-here

# Modules 6 and 7 (server-only; never prefix with NEXT_PUBLIC_)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
# Module 7 requires both Groq values and has no client provider/model override.
AI_PROMPT_VERSION=v1
AI_USER_HOURLY_QUOTA=20
AI_ADVISORY_PROVIDERS=openai,gemini,groq

# Module 8 (server-only; never prefix with NEXT_PUBLIC_)
STORE_ROOT_DOMAIN=stores.example.com
APP_HOSTNAMES=preview.example.com
VERCEL_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=
```

---

## 3. Data Provenance and Freshness

Persisted records use `provenance`:

- `external_api`: Observation returned by a permitted external API.
- `synthetic_demo`: Deterministic demonstration or empirical baseline.
- `licensed_dataset`: Published census or open government dataset.
- `manual_estimate`: Documented estimate, not a live average.

Collection status also reports `freshness`: `live`, `cached`, `stale_cache`, `verified_benchmark`, `manual_estimate`, `synthetic_demo`, `unavailable`.
