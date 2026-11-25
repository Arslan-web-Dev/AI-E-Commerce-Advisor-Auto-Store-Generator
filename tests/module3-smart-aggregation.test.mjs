/**
 * Task 4 / Module 3 — Smart Data Aggregation regression suite.
 *
 * Run with: node --test tests/module3-smart-aggregation.test.mjs
 *
 * Behavioural checks import the real TypeScript modules (via Node's built-in
 * type stripping + tests/helpers/ts-loader.mjs for `@/` aliases) and use mocked
 * fetch/Supabase/ML responses. No live Overpass, Google Trends or Supabase
 * calls are made. Static source checks below only verify wiring, not runtime.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import './helpers/ts-loader.mjs';

const root = process.cwd();

console.log('\n================ TASK 4 MODULE 3 SMART AGGREGATION ================');

const CATEGORIES = [
  'Grocery / General Stores',
  'Clothing / Footwear',
  'Mobile Phones / Accessories',
  'Restaurants / Cafes',
  'Pharmacies / Medical Stores',
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assertIncludes(haystack, needle, message) {
  assert.ok(haystack.includes(needle), message);
}

const { haversineDistanceKm, isValidCoordinate } = await import('../src/lib/geo/distance.ts');
const {
  CATEGORY_OSM_TAG_MAP,
  DEFAULT_OVERPASS_ENDPOINTS,
  OVERPASS_ATTRIBUTION,
  OverpassCompetitorProvider,
  buildOverpassQuery,
  clampRadiusKm,
  osmIdentityKey,
  parseOverpassElements,
} = await import('../src/lib/providers/competitors/overpass.ts');
const {
  COMPETITOR_CACHE_TTL_MS,
  buildCompetitorCacheKey,
  getCompetitorsWithCache,
  writeCompetitorCache,
} = await import('../src/lib/data-collection/competitor-cache.ts');
const { lookupRentFromRows, NEARBY_RENT_MAX_KM } = await import('../src/lib/data-collection/rent-lookup.ts');
const { PUNJAB_RENT_ESTIMATE_SEEDS } = await import('../src/lib/data-collection/rent-estimates.ts');
const { GoogleTrendsProvider, validateMonthlyTrendPoints } = await import('../src/lib/providers/trends/google-trends.ts');
const { mlClient } = await import('../src/lib/ml-client.ts');
const { assertCronAuthorized } = await import('../src/lib/security/cron-auth.ts');

const overpassSrc = read('src/lib/providers/competitors/overpass.ts');
const cacheSrc = read('src/lib/data-collection/competitor-cache.ts');
const rentLookupSrc = read('src/lib/data-collection/rent-lookup.ts');
const rentCronSrc = read('src/app/api/cron/rent-cache/route.ts');
const trendsSrc = read('src/lib/providers/trends/google-trends.ts');
const orchSrc = read('src/lib/data-collection/orchestrator.ts');
const typesSrc = read('src/types/data-collection.ts');
const migrationSrc = read('supabase/migrations/20261125010000_module3_smart_aggregation.sql');
const hardeningMigrationSrc = read('supabase/migrations/20261125120000_module3_persistence_hardening.sql');
const pyTrendsSrc = read('ml-service/trends/google_trends.py');
const cronAuthSrc = read('src/lib/security/cron-auth.ts');
const panelSrc = read('src/components/data-collection/MarketDataPanel.tsx');
const benchmarkSrc = read('src/lib/providers/costs/benchmark.ts');
const adminSyncSrc = read('src/app/api/admin/sync/route.ts');
const submitSrc = read('src/app/api/projects/[id]/submit/route.ts');

const COMPETITOR_INPUT = {
  category: 'Restaurants / Cafes',
  lat: 31.5204,
  lng: 74.3587,
  radiusKm: 10,
  city: 'Lahore',
};
const RETRIEVED_AT = '2026-11-20T00:00:00.000Z';

function makeCompetitor(overrides = {}) {
  return {
    project_id: '',
    name: 'Test Cafe',
    category: 'cafe',
    provider: 'overpass_osm',
    provenance: 'external_api',
    freshness: 'live',
    lat: COMPETITOR_INPUT.lat,
    lng: COMPETITOR_INPUT.lng,
    distance_km: 0,
    retrieved_at: RETRIEVED_AT,
    attribution: OVERPASS_ATTRIBUTION,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
console.log('\n[1] FR-3.1 Overpass category mapping, parsing and provider robustness...');

for (const category of CATEGORIES) {
  const mapping = CATEGORY_OSM_TAG_MAP[category];
  assert.ok(mapping, `Missing OSM tag mapping for ${category}`);
  const tags = [...(mapping.shop || []), ...(mapping.amenity || [])];
  assert.ok(tags.length > 0, `Empty OSM tag mapping for ${category}`);
  const query = buildOverpassQuery(category, COMPETITOR_INPUT.lat, COMPETITOR_INPUT.lng, 10);
  assert.match(query, /\[out:json\]/);
  assert.match(query, /around:10000,31\.5204,74\.3587/);
  for (const tag of tags) {
    assert.ok(query.includes(tag), `Query for ${category} must include OSM tag ${tag}`);
  }
  if (mapping.amenity?.length) {
    assert.match(query, /node\["amenity"/);
    assert.match(query, /way\["amenity"/);
  }
}
assert.throws(
  () => buildOverpassQuery('Unmapped category', 31.5204, 74.3587, 10),
  /No OpenStreetMap tag mapping/
);
assert.equal(clampRadiusKm(99), 15);
assert.equal(clampRadiusKm(0), 1);
assert.equal(clampRadiusKm(7), 7);
assert.equal(osmIdentityKey('node', 123), 'node/123');
assert.equal(osmIdentityKey('way', '99'), 'way/99');
assert.equal(osmIdentityKey(undefined, 1), null);

assert.equal(haversineDistanceKm(31.5204, 74.3587, 31.5204, 74.3587), 0);
const neighbourhoodKm = haversineDistanceKm(31.52, 74.35, 31.53, 74.36);
assert.ok(neighbourhoodKm > 1 && neighbourhoodKm < 2, `Unexpected distance ${neighbourhoodKm}`);
assert.equal(isValidCoordinate(31.52, 74.35), true);
assert.equal(isValidCoordinate(0, 0), false);
assert.equal(isValidCoordinate(Number.NaN, 74.35), false);
assert.equal(isValidCoordinate('31.52', 74.35), false);

const parsed = parseOverpassElements(
  [
    {
      type: 'node',
      id: 1,
      lat: 31.5204,
      lon: 74.3587,
      tags: { name: 'Shop A', shop: 'convenience', 'addr:street': 'Main Bazaar', stars: '4.5' },
    },
    { type: 'node', id: 1, lat: 31.5204, lon: 74.3587, tags: { name: 'Duplicate identity' } },
    { type: 'way', id: 99, center: { lat: 31.53, lon: 74.36 }, tags: { amenity: 'cafe' } },
    { type: 'node', id: 100, lat: 91, lon: 74.35, tags: { name: 'Invalid coordinate' } },
    { type: 'node', id: 101, lat: 35, lon: 74.35, tags: { name: 'Far outside radius' } },
    { type: 'node', id: 102, lat: 31.6204, lon: 74.3587, tags: { name: 'Just outside radius' } },
  ],
  { ...COMPETITOR_INPUT, category: 'Grocery / General Stores' },
  { retrievedAt: RETRIEVED_AT }
);
assert.equal(parsed.length, 2, 'Duplicate OSM identity, invalid and out-of-radius rows must be rejected');
assert.equal(parsed[0].name, 'Shop A');
assert.equal(parsed[0].rating, 4.5);
assert.equal(parsed[0].review_count, undefined, 'OSM review counts must not be manufactured');
assert.equal(parsed[0].raw_data.osm_identity, 'node/1');
assert.equal(parsed[0].attribution, OVERPASS_ATTRIBUTION);
assert.equal(parsed[0].freshness, 'live');
assert.equal(parsed[1].name, 'Unnamed business', 'Unnamed OSM objects must not be given invented names');
assert.equal(parsed[1].rating, undefined);
assert.ok(parsed[0].distance_km <= parsed[1].distance_km);

const originalFetch = globalThis.fetch;
const originalTimeout = process.env.OVERPASS_API_TIMEOUT_MS;
const originalEndpoint = process.env.OVERPASS_API_URL;

try {
  process.env.OVERPASS_API_URL = 'https://primary.test/interpreter';
  process.env.OVERPASS_API_TIMEOUT_MS = '25';

  // Retry on the primary endpoint (429), then succeed on an alternate endpoint.
  const retryCalls = [];
  globalThis.fetch = async (url, init) => {
    retryCalls.push({ url: String(url), init });
    if (retryCalls.length <= 2) {
      return new Response('rate limited', { status: 429, statusText: 'Too Many Requests' });
    }
    return Response.json({
      elements: [{ type: 'node', id: 7, lat: 31.5204, lon: 74.3587, tags: { name: 'Test Cafe', amenity: 'cafe' } }],
    });
  };

  const retryRecords = await new OverpassCompetitorProvider().getCompetitors(COMPETITOR_INPUT);
  assert.equal(retryRecords.length, 1);
  assert.equal(retryRecords[0].name, 'Test Cafe');
  assert.equal(retryCalls.length, 3);
  assert.equal(retryCalls[0].url, 'https://primary.test/interpreter');
  assert.equal(retryCalls[0].url, retryCalls[1].url);
  assert.equal(retryCalls[2].url, DEFAULT_OVERPASS_ENDPOINTS[0]);
  assert.ok(retryCalls.every((call) => call.init.signal instanceof AbortSignal));

  // Timeout of every attempt on every endpoint must fail honestly.
  process.env.OVERPASS_API_TIMEOUT_MS = '5';
  let aborted = 0;
  globalThis.fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        aborted += 1;
        reject(new Error('aborted by timeout'));
      });
    });

  await assert.rejects(
    new OverpassCompetitorProvider().getCompetitors(COMPETITOR_INPUT),
    /All Overpass OSM endpoints failed/
  );
  assert.ok(aborted >= DEFAULT_OVERPASS_ENDPOINTS.length + 1, `Expected aborts on all endpoints, got ${aborted}`);
} finally {
  globalThis.fetch = originalFetch;
  if (originalTimeout === undefined) delete process.env.OVERPASS_API_TIMEOUT_MS;
  else process.env.OVERPASS_API_TIMEOUT_MS = originalTimeout;
  if (originalEndpoint === undefined) delete process.env.OVERPASS_API_URL;
  else process.env.OVERPASS_API_URL = originalEndpoint;
}

// Static wiring guarantees only; the behaviour above is the actual evidence.
assertIncludes(overpassSrc, 'MAX_PROJECT_RADIUS_KM = 15', 'Radius must respect 15 km maximum');
assert.ok(!overpassSrc.includes('out center 50'), 'Overpass must not silently cap dense results at 50');
assert.ok(
  !overpassSrc.includes('clampRadiusKm(input.radiusKm) + 0.5'),
  'Overpass must not accept POIs beyond the advertised radius'
);
assertIncludes(overpassSrc, 'backoff', 'Bounded exponential backoff required');
console.log('PASS: Tag mapping, validation, dedupe, timeout/retry and alternate endpoint behaviour verified.');

// ---------------------------------------------------------------------------
console.log('\n[2] FR-3.2 Seven-day competitor cache behaviour...');

assert.equal(COMPETITOR_CACHE_TTL_MS, 7 * 24 * 60 * 60 * 1000);
const keyA = buildCompetitorCacheKey(COMPETITOR_INPUT);
assert.equal(keyA, buildCompetitorCacheKey(COMPETITOR_INPUT));
assert.notEqual(keyA, buildCompetitorCacheKey({ ...COMPETITOR_INPUT, radiusKm: 15 }));
assert.notEqual(keyA, buildCompetitorCacheKey({ ...COMPETITOR_INPUT, category: 'Pharmacies / Medical Stores' }));
assert.notEqual(keyA, buildCompetitorCacheKey({ ...COMPETITOR_INPUT, lng: 74.36 }));

function createCacheBackend() {
  const rows = new Map();
  return {
    rows,
    from(table) {
      assert.equal(table, 'competitor_query_cache');
      return {
        select() {
          let cacheKey;
          let minExpires;
          return {
            eq(column, value) {
              assert.equal(column, 'cache_key');
              cacheKey = value;
              return this;
            },
            gt(column, value) {
              assert.equal(column, 'expires_at');
              minExpires = String(value);
              return this;
            },
            async maybeSingle() {
              const row = rows.get(cacheKey);
              if (!row || !(row.expires_at > minExpires)) return { data: null, error: null };
              return { data: row, error: null };
            },
          };
        },
        async upsert(row, options) {
          assert.equal(options?.onConflict, 'cache_key');
          rows.set(row.cache_key, row);
          return { error: null };
        },
      };
    },
  };
}

const cacheBackend = createCacheBackend();
let liveCalls = 0;
const liveFetch = async () => {
  liveCalls += 1;
  return [makeCompetitor()];
};

const liveHit = await getCompetitorsWithCache(cacheBackend, COMPETITOR_INPUT, liveFetch);
assert.equal(liveHit.freshness, 'live');
assert.equal(liveHit.from_cache, false);
assert.equal(liveCalls, 1);
assert.equal(cacheBackend.rows.size, 1);
const cachedRow = cacheBackend.rows.get(keyA);
assert.equal(
  cachedRow.expires_at,
  new Date(Date.parse(RETRIEVED_AT) + COMPETITOR_CACHE_TTL_MS).toISOString()
);
assert.equal(cachedRow.provenance, 'external_api');
assert.equal(cachedRow.attribution, OVERPASS_ATTRIBUTION);

const freshHit = await getCompetitorsWithCache(cacheBackend, COMPETITOR_INPUT, liveFetch);
assert.equal(freshHit.freshness, 'cached');
assert.equal(freshHit.from_cache, true);
assert.equal(liveCalls, 1, 'Fresh cache must prevent a duplicate Overpass request');
assert.equal(freshHit.records[0].retrieved_at, RETRIEVED_AT);
assert.ok(freshHit.records[0].cache_retrieved_at);

cachedRow.expires_at = '2026-11-21T00:00:00.000Z';
const expiredHit = await getCompetitorsWithCache(cacheBackend, COMPETITOR_INPUT, liveFetch);
assert.equal(expiredHit.freshness, 'live');
assert.equal(liveCalls, 2, 'Expired cache must trigger a new live request');

const concurrentBackend = createCacheBackend();
let concurrentLiveCalls = 0;
const [firstConcurrent, secondConcurrent] = await Promise.all([
  getCompetitorsWithCache(concurrentBackend, COMPETITOR_INPUT, async () => {
    concurrentLiveCalls += 1;
    return [makeCompetitor()];
  }),
  getCompetitorsWithCache(concurrentBackend, COMPETITOR_INPUT, async () => {
    concurrentLiveCalls += 1;
    return [makeCompetitor()];
  }),
]);
assert.equal(firstConcurrent.freshness, 'live');
assert.equal(secondConcurrent.freshness, 'live');
assert.equal(concurrentLiveCalls, 1, 'Single-flight must prevent duplicate concurrent provider work');

const failedBackend = createCacheBackend();
await assert.rejects(
  getCompetitorsWithCache(failedBackend, COMPETITOR_INPUT, async () => {
    throw new Error('overpass unreachable');
  }),
  /overpass unreachable/
);
assert.equal(failedBackend.rows.size, 0, 'Failed live requests must not become cached positives');

await writeCompetitorCache(
  failedBackend,
  COMPETITOR_INPUT,
  [makeCompetitor({ provenance: 'synthetic_demo', freshness: 'synthetic_demo' })],
  new Date().toISOString()
);
assert.equal(failedBackend.rows.size, 0, 'Synthetic demo records must never enter the live cache');

const staleBackend = createCacheBackend();
const staleRetrievedAt = '2026-11-01T00:00:00.000Z';
await writeCompetitorCache(
  staleBackend,
  COMPETITOR_INPUT,
  [makeCompetitor({ retrieved_at: staleRetrievedAt })],
  staleRetrievedAt
);
const staleHit = await getCompetitorsWithCache(staleBackend, COMPETITOR_INPUT, async () => {
  throw new Error('overpass offline');
});
assert.equal(staleHit.freshness, 'stale_cache', 'Expired real cache must be labelled stale on live failure');
assert.equal(staleHit.records[0].freshness, 'stale_cache');
assert.equal(staleHit.records[0].retrieved_at, staleRetrievedAt);
assert.ok(staleHit.records[0].cache_retrieved_at);

assertIncludes(migrationSrc, 'competitor_query_cache', 'Migration must create competitor_query_cache');
assertIncludes(migrationSrc, 'expires_at', 'Cache expiry column required');
assertIncludes(cacheSrc, 'inflight', 'Single-flight guard required');
console.log('PASS: Seven-day hit/expiry, stale fallback, single-flight, failure and synthetic-exclusion behaviour verified.');

// ---------------------------------------------------------------------------
console.log('\n[3] FR-3.3/FR-3.4 Rent cache metadata, cron auth and lookup fallback...');

for (const seed of PUNJAB_RENT_ESTIMATE_SEEDS) {
  assert.equal(seed.province, 'Punjab');
  assert.ok(seed.sample_size > 1, 'Estimate seeds must not claim observed averages from one sample');
  assert.match(seed.notes, /Manual/i, 'Rent seeds must remain explicitly labelled as manual estimates');
  assert.ok(seed.rent_min_pkr <= seed.rent_avg_pkr && seed.rent_avg_pkr <= seed.rent_max_pkr);
}

const savedCronSecret = process.env.CRON_SECRET;
try {
  delete process.env.CRON_SECRET;
  assert.equal(assertCronAuthorized(new Request('https://example.test/api/cron/rent-cache')).status, 503);
  process.env.CRON_SECRET = 'unit-test-cron-secret';
  assert.equal(assertCronAuthorized(new Request('https://example.test/api/cron/rent-cache')).status, 401);
  assert.equal(
    assertCronAuthorized(
      new Request('https://example.test/api/cron/rent-cache', { headers: { 'x-cron-secret': 'wrong' } })
    ).status,
    401
  );
  assert.equal(
    assertCronAuthorized(
      new Request('https://example.test/api/cron/rent-cache', {
        headers: { 'x-cron-secret': 'unit-test-cron-secret' },
      })
    ).ok,
    true
  );
  assert.equal(
    assertCronAuthorized(
      new Request('https://example.test/api/cron/rent-cache', {
        headers: { authorization: 'Bearer unit-test-cron-secret' },
      })
    ).ok,
    true
  );
} finally {
  if (savedCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = savedCronSecret;
}

const rentRows = [
  ...PUNJAB_RENT_ESTIMATE_SEEDS.map((seed) => ({
    ...seed,
    rent_per_sqft_pkr: seed.rent_avg_pkr,
    source: 'punjab_manual_rent_estimate_corpus',
    scraped_at: '2026-11-25T01:00:00.000Z',
    recorded_at: '2026-11-25T01:00:00.000Z',
  })),
  {
    city: 'Karachi',
    area: 'Clifton',
    district: 'Karachi',
    province: 'Sindh',
    lat: 24.806,
    lng: 67.033,
    rent_per_sqft_pkr: 500,
    rent_avg_pkr: 500,
    provenance: 'external_api',
    source: 'verified_test_row',
    scraped_at: '2026-11-24T01:00:00.000Z',
  },
];

const exactRent = lookupRentFromRows(rentRows, {
  city: 'Lahore',
  area: 'Gulberg',
  district: 'Lahore',
  province: 'Punjab',
});
assert.equal(exactRent.status, 'found');
assert.equal(exactRent.match_level, 'exact');
assert.equal(exactRent.source_geography.area, 'Gulberg');
assert.equal(exactRent.sample_size, 8);
assert.equal(exactRent.source, 'punjab_manual_rent_estimate_corpus');
assert.equal(exactRent.provenance, 'manual_estimate');
assert.equal(exactRent.freshness, 'manual_estimate');
assert.equal(exactRent.retrieved_at, '2026-11-25T01:00:00.000Z');
assert.equal(exactRent.retrieved_at_kind, 'manual_estimate_recorded');

const nearbyRent = lookupRentFromRows(rentRows, {
  city: 'Lahore',
  area: 'Unknown Block',
  district: 'Lahore',
  province: 'Punjab',
  lat: 31.511,
  lng: 74.345,
});
assert.equal(nearbyRent.match_level, 'nearby');
assert.ok(nearbyRent.distance_km <= NEARBY_RENT_MAX_KM);
assert.equal(nearbyRent.confidence, 'low');
assert.ok(nearbyRent.source_geography?.city);

const cityRent = lookupRentFromRows(rentRows, { city: 'Lahore', district: 'Lahore', province: 'Punjab' });
assert.equal(cityRent.match_level, 'city');
assert.equal(cityRent.status, 'found');
assert.equal(cityRent.source_geography?.area, 'city/district aggregate');
assert.equal(
  cityRent.sample_size,
  PUNJAB_RENT_ESTIMATE_SEEDS.filter((seed) => seed.city === 'Lahore').reduce(
    (sum, seed) => sum + seed.sample_size,
    0
  ),
  'City fallback must aggregate all scoped area estimates, not one arbitrary row'
);
assert.match(cityRent.notes || '', /Computed from \d+ cached area estimate/);

const districtOnlyRent = lookupRentFromRows(rentRows, {
  district: 'Lahore',
  area: 'Gulberg',
  province: 'Punjab',
});
assert.notEqual(districtOnlyRent.match_level, 'exact', 'District-only requests must not claim exact area coverage');
assert.equal(districtOnlyRent.match_level, 'district');

const unavailableRent = lookupRentFromRows(
  rentRows.filter((row) => row.province === 'Punjab'),
  { city: 'Karachi', area: 'Clifton', district: 'Karachi', province: 'Sindh' }
);
assert.equal(unavailableRent.status, 'unavailable');
assert.equal(unavailableRent.match_level, 'unavailable');
assert.equal(unavailableRent.source_geography, null);
assert.match(unavailableRent.notes, /not substituted/);

const noRowsRent = lookupRentFromRows([], { city: 'Lahore', province: 'Punjab' });
assert.equal(noRowsRent.status, 'unavailable');
assert.equal(noRowsRent.confidence, 'none');

const sindhRent = lookupRentFromRows(rentRows, {
  city: 'Karachi',
  area: 'Clifton',
  district: 'Karachi',
  province: 'Sindh',
});
assert.equal(sindhRent.match_level, 'exact');
assert.equal(sindhRent.freshness, 'cached');
assert.equal(sindhRent.provenance, 'external_api');

assertIncludes(cronAuthSrc, 'CRON_SECRET', 'Cron auth must require CRON_SECRET');
assertIncludes(rentCronSrc, 'assertCronAuthorized', 'Rent cron must enforce cron auth');
assertIncludes(rentCronSrc, 'createAdminClient', 'Rent cron must use server-only admin client');
assertIncludes(rentCronSrc, "provenance: 'manual_estimate'", 'Rent seeds must be labelled estimates');
assertIncludes(benchmarkSrc, 'lookupRentFromRows', 'Analysis must read rent_cache via lookup helper');
assertIncludes(benchmarkSrc, 'never scrapes live', 'Analysis must not scrape live rent');
assertIncludes(rentLookupSrc, 'NEARBY_RENT_MAX_KM', 'Nearby distance bound required');
assertIncludes(rentCronSrc, 'recorded_at', 'Manual estimates must carry an honest curation timestamp');
assertIncludes(adminSyncSrc, 'provenance', 'Admin export must not drop rent provenance');
assert.ok(!panelSrc.includes('Authoritative open data active'), 'UI must not imply live data when none exists');
assertIncludes(panelSrc, 'Curated estimates only', 'UI must disclose estimate-only coverage');
assertIncludes(hardeningMigrationSrc, 'freshness', 'Per-record freshness columns required');
assertIncludes(hardeningMigrationSrc, 'recorded_at', 'Manual estimate timestamp column required');
assertIncludes(hardeningMigrationSrc, 'uq_collection_runs_active_project', 'Active run uniqueness required');
console.log('PASS: Cron auth, estimate metadata, provenance and exact/nearby/city/unavailable rent behaviour verified.');

// ---------------------------------------------------------------------------
console.log('\n[4] FR-3.5 Google Trends live/cached/stale/unavailable behaviour...');

const validated = validateMonthlyTrendPoints([
  { month: '2025-01', index: 50 },
  { month: 'not-a-month', index: 30 },
  { month: '2025-01', index: 60 },
  { month: '2025-02', index: 150 },
  { month: '2025-03', index: 75 },
]);
assert.deepEqual(validated, [
  { month: '2025-01', index: 60 },
  { month: '2025-03', index: 75 },
]);

function trendPayload(category, overrides = {}) {
  return {
    source: 'live_google_trends',
    geo: 'PK-PB',
    timeframe: 'today 12-m',
    keywords: [category],
    interest_over_time: Array.from({ length: 12 }, (_, i) => ({
      date: `2025-${String(i + 1).padStart(2, '0')}-01`,
      [category]: 50 + i,
    })),
    related_queries: {},
    analytics: {
      [category]: {
        average_interest: 55,
        trend_slope: 1,
        trend_direction: 'rising',
        peak_month: 'December',
        peak_value: 61,
        latest_value: 61,
      },
    },
    is_cached: false,
    is_stale: false,
    fetched_at: '2026-11-25T00:00:00.000Z',
    ...overrides,
  };
}

const originalGetTrends = mlClient.getTrends;
const category = CATEGORIES[0];
const trendsProvider = new GoogleTrendsProvider();
const receivedGeoRequests = [];

try {
  mlClient.getTrends = async (_keywords, geo, timeframe) => {
    receivedGeoRequests.push({ geo, timeframe });
    return trendPayload(category);
  };
  const liveTrend = await trendsProvider.getDemandTrends({ category, region: 'PK-PB' });
  assert.deepEqual(receivedGeoRequests[0], { geo: 'PK-PB', timeframe: 'today 12-m' });
  assert.equal(liveTrend.freshness, 'live');
  assert.equal(liveTrend.provenance, 'external_api');
  assert.equal(liveTrend.trend_series.length, 12);
  assert.equal(liveTrend.avg_interest, 55);
  assert.equal(liveTrend.requested_geo_scope, 'PK-PB');
  assert.equal(liveTrend.actual_geo_scope, 'PK-PB');

  mlClient.getTrends = async () => trendPayload(category, { is_cached: true });
  assert.equal(
    (await trendsProvider.getDemandTrends({ category, region: 'Punjab' })).freshness,
    'cached'
  );

  mlClient.getTrends = async () => trendPayload(category, { is_cached: true, is_stale: true });
  const staleTrend = await trendsProvider.getDemandTrends({ category, region: 'Punjab' });
  assert.equal(staleTrend.freshness, 'stale_cache');
  assert.equal(staleTrend.is_stale, true);

  mlClient.getTrends = async () => trendPayload(category, { source: 'empirical_market_baseline' });
  const baselineTrend = await trendsProvider.getDemandTrends({ category, region: 'Punjab' });
  assert.equal(baselineTrend.freshness, 'synthetic_demo');
  assert.equal(baselineTrend.provenance, 'synthetic_demo');
  assert.equal(baselineTrend.provider, 'empirical_market_baseline_fallback');

  // Genuine live data for an uncovered region is accepted with its real scope.
  mlClient.getTrends = async () => trendPayload(category, { geo: 'PK-SD' });
  const sindhTrend = await trendsProvider.getDemandTrends({ category, region: 'PK-SD' });
  assert.equal(sindhTrend.freshness, 'live');
  assert.equal(sindhTrend.actual_geo_scope, 'PK-SD');
  assert.equal(sindhTrend.requested_geo_scope, 'PK-SD');

  mlClient.getTrends = async () => trendPayload(category, { geo: 'PK-PB' });
  await assert.rejects(
    trendsProvider.getDemandTrends({ category, region: 'PK-SD' }),
    (error) => error?.name === 'CoverageUnavailableError'
  );

  // Unrecognised localities must fail closed rather than silently widening to PK.
  let unrecognisedProviderCalls = 0;
  mlClient.getTrends = async () => {
    unrecognisedProviderCalls += 1;
    throw new Error('should not be called');
  };
  await assert.rejects(
    trendsProvider.getDemandTrends({ category, region: 'Unknown District' }),
    (error) => error?.name === 'CoverageUnavailableError'
  );
  assert.equal(unrecognisedProviderCalls, 0, 'Unrecognised regions must not silently request national trends');

  // Empirical/Python baseline is not verified local evidence outside Punjab.
  mlClient.getTrends = async () => trendPayload(category, { source: 'empirical_market_baseline' });
  await assert.rejects(
    trendsProvider.getDemandTrends({ category, region: 'PK-SD' }),
    (error) => error?.name === 'CoverageUnavailableError'
  );

  mlClient.getTrends = async () => {
    throw new Error('pytrends offline');
  };
  await assert.rejects(
    trendsProvider.getDemandTrends({ category, region: 'PK-IS' }),
    (error) => error?.name === 'CoverageUnavailableError'
  );

  const punjabFallback = await trendsProvider.getDemandTrends({ category, region: 'Punjab' });
  assert.equal(punjabFallback.freshness, 'synthetic_demo');
  assert.equal(punjabFallback.provenance, 'synthetic_demo');
  assert.equal(punjabFallback.provider, 'punjab_seasonal_benchmark_fallback');
  assert.equal(punjabFallback.actual_geo_scope, 'PK-PB');
  assert.notEqual(punjabFallback.freshness, 'live');
} finally {
  mlClient.getTrends = originalGetTrends;
}

assertIncludes(trendsSrc, 'CoverageUnavailableError', 'Unsupported regions must be typed unavailable');
assertIncludes(trendsSrc, 'stale_cache', 'Stale cache freshness required');
assertIncludes(pyTrendsSrc, 'allow_stale', 'Python trends must support stale fallback');
assertIncludes(pyTrendsSrc, 'DEFAULT_TTL_HOURS = 24', 'Trends cache TTL must be 24 hours');
console.log('PASS: 12-month validation, geo scope, live/cache/stale/demo/unavailable behaviour verified.');

// ---------------------------------------------------------------------------
console.log('\n[5] FR-3.6/FR-3.7 Typed provenance, orchestration and UI wiring...');

assertIncludes(typesSrc, 'DataFreshness', 'Typed freshness enum required');
assertIncludes(typesSrc, 'TypedProviderResult', 'Typed provider result envelope required');
for (const state of ['pending', 'running', 'completed', 'partial', 'failed', 'unavailable']) {
  assertIncludes(typesSrc, `'${state}'`, `Provider state ${state} required`);
}
assertIncludes(orchSrc, 'Promise.allSettled', 'Independent provider execution required');
assertIncludes(orchSrc, 'STUCK_RUNNING_MS', 'Stuck-running recovery required');
assertIncludes(orchSrc, 'Do NOT silently substitute synthetic competitors', 'No silent demo fallback');
assertIncludes(orchSrc, '.eq(\'status\', activeRun.status)', 'Run claim must be conditional to prevent races');
assertIncludes(orchSrc, 'replaceRunRows', 'Reruns must replace rows instead of duplicating them');
assertIncludes(orchSrc, 'persistenceErrors', 'Persistence failures must not be reported as success');
assertIncludes(orchSrc, "status: 'running'", 'In-progress runs must be reported honestly');
assertIncludes(orchSrc, 'usableCount', 'Partial collection outcome required');
assertIncludes(submitSrc, 'rpcData.already_submitted', 'Repeat submissions must not trigger duplicate collection');
assertIncludes(panelSrc, 'Live observation', 'UI must label live observations');
assertIncludes(panelSrc, 'Cached (fresh)', 'UI must label fresh cache');
assertIncludes(panelSrc, 'Stale cache', 'UI must label stale cache');
assertIncludes(panelSrc, 'Synthetic demo', 'UI must label synthetic demo');
assertIncludes(panelSrc, 'Manual estimate', 'UI must label estimates');
assertIncludes(panelSrc, 'Unavailable', 'UI must label unavailable coverage');
assertIncludes(panelSrc, 'no live scrape', 'UI must state rent cache-only analysis');
assertIncludes(overpassSrc, OVERPASS_ATTRIBUTION, 'OSM attribution must be preserved');
console.log('PASS: Typed provider states, partial-failure wiring and provenance labelling present.');

console.log('\nNOTE: Source assertions above verify wiring only. Database persistence,');
console.log('      ownership enforcement and live external integrations are not exercised here.');
console.log('\n----------------------------------------------------');
console.log('TASK 4 MODULE 3 TESTS: ALL PASSED');
console.log('----------------------------------------------------\n');
