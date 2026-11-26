/**
 * Task 6 remediation — rent_cache geographic query regression.
 *
 * The mock implements the same minimal query interface as the API route and
 * actually applies every eq() filter before limit(). This proves the defect
 * (a global first-500 snapshot) cannot reappear unnoticed.
 */
import assert from 'node:assert/strict';
import './helpers/ts-loader.mjs';

const {
  RENT_CACHE_QUERY_LIMIT,
  buildRentQuerySpecs,
  fetchScopedRentRows,
  resolveRentProvince,
} = await import('../src/lib/visualization/rent-cache-query.ts');
const { buildRentMap } = await import('../src/lib/visualization/rent-map.ts');

class FakeRentQuery {
  constructor(client) {
    this.client = client;
    this.operations = [];
    this.filters = [];
  }

  select(columns) {
    this.operations.push({ type: 'select', columns });
    return this;
  }

  eq(column, value) {
    this.operations.push({ type: 'eq', column, value });
    this.filters.push({ column, value });
    return this;
  }

  order(column, options) {
    this.operations.push({ type: 'order', column, options });
    return this;
  }

  limit(limit) {
    this.operations.push({ type: 'limit', limit });
    const filtered = this.client.rows.filter((row) =>
      this.filters.every((filter) => String(row[filter.column] ?? '').trim().toLowerCase() === filter.value.trim().toLowerCase())
    );
    filtered.sort((a, b) => String(a.city).localeCompare(String(b.city)) || String(a.area).localeCompare(String(b.area)));
    return Promise.resolve({ data: filtered.slice(0, limit), error: null });
  }
}

class FakeRentClient {
  constructor(rows) {
    this.rows = rows;
    this.queries = [];
  }

  from(table) {
    assert.equal(table, 'rent_cache');
    const query = new FakeRentQuery(this);
    this.queries.push(query);
    return query;
  }
}

function assertFilteredBeforeLimit(query) {
  const limitIndex = query.operations.findIndex((operation) => operation.type === 'limit');
  assert.ok(limitIndex >= 0, 'a scoped query must apply a row limit');
  const eqIndexes = query.operations
    .map((operation, index) => (operation.type === 'eq' ? index : -1))
    .filter((index) => index >= 0);
  assert.ok(eqIndexes.length >= 1, 'a scoped query must have at least one geography filter');
  assert.ok(eqIndexes.every((index) => index < limitIndex), 'every eq filter must precede limit()');
  assert.ok(query.operations.some((operation) => operation.type === 'select'));
}

console.log('\n=========== RENT CACHE QUERY REGRESSION TESTS ===========');

// 1. Target city survives 600 unrelated rows; filters precede the limit.
const unrelated = Array.from({ length: 600 }, (_, index) => ({
  id: `karachi-${index}`,
  city: 'Karachi',
  district: 'Karachi',
  province: 'Sindh',
  area: `Unrelated ${index}`,
  rent_avg_pkr: 500 + index,
  rent_per_sqft_pkr: 500 + index,
  provenance: 'manual_estimate',
  currency: 'PKR',
}));
const targetRows = [
  {
    id: 'lahore-1', city: 'Lahore', district: 'Lahore', province: 'Punjab', area: 'Model Town',
    lat: 31.56, lng: 74.54, rent_avg_pkr: 150, rent_min_pkr: 120, rent_max_pkr: 180,
    sample_size: 12, source: 'manual survey', provenance: 'manual_estimate', confidence: 'medium',
    recorded_at: '2026-11-25T00:00:00Z', currency: 'PKR',
  },
  {
    id: 'lahore-2', city: 'Lahore', district: 'Lahore', province: 'Punjab', area: 'Gulberg',
    lat: 31.54, lng: 74.45, rent_avg_pkr: 180, rent_min_pkr: 160, rent_max_pkr: 200,
    sample_size: 6, source: 'manual survey', provenance: 'manual_estimate', confidence: 'high',
    recorded_at: '2026-11-25T00:00:00Z', currency: 'PKR',
  },
];
const targetClient = new FakeRentClient([...unrelated, ...targetRows]);
const targetGeography = { city: 'Lahore', district: 'Lahore', region: 'Punjab' };
const targetResult = await fetchScopedRentRows(targetClient, targetGeography);

assert.equal(targetResult.error, null);
assert.equal(targetResult.queryCount, 1);
assert.deepEqual(targetResult.rows.map((row) => row.area), ['Gulberg', 'Model Town']);
assert.equal(targetResult.rows.some((row) => row.city === 'Karachi'), false);
assert.equal(targetClient.queries.length, 1);
for (const query of targetClient.queries) {
  assertFilteredBeforeLimit(query);
  assert.ok(query.operations.some((operation) => operation.type === 'eq' && operation.column === 'province' && operation.value === 'Punjab'));
  assert.ok(query.operations.some((operation) => operation.type === 'eq' && operation.column === 'city' && operation.value === 'Lahore'));
  assert.equal(query.operations.some((operation) => operation.type === 'eq' && operation.column === 'province' && operation.value === 'Sindh'), false);
}
assert.equal(RENT_CACHE_QUERY_LIMIT, 500);
console.log('PASS: target-city rows are returned ahead of 600 unrelated global rows.');

// 2. Provenance labels and centroid output pass through unchanged.
const now = new Date('2026-11-26T00:00:00Z');
const payload = buildRentMap(targetResult.rows, { ...targetGeography, lat: 31.55, lng: 74.5, radiusKm: 10 }, now);
assert.equal(payload.status, 'coverage');
assert.equal(payload.areas.length, 2);
assert.equal(payload.areas.every((area) => area.provenance === 'manual_estimate'), true);
assert.equal(payload.areas.every((area) => area.freshness === 'manual_estimate'), true);
assert.equal(payload.summary.manualEstimateCount, 2);
assert.equal(payload.areas.every((area) => area.geometry === null && area.markerType === 'centroid'), true);
console.log('PASS: rent provenance, freshness and centroid marker behavior are unchanged.');

// 3. District-only geography is queried by district and city alias, before limit.
const districtClient = new FakeRentClient([
  {
    id: 'district-1', city: 'Model Town', district: 'Lahore', province: 'Punjab', area: 'Model Town',
    lat: 31.56, lng: 74.54, rent_avg_pkr: 140, rent_per_sqft_pkr: 140, provenance: 'external_api',
    scraped_at: '2026-11-25T00:00:00Z', currency: 'PKR',
  },
  {
    id: 'district-2', city: 'DHA', district: 'Karachi', province: 'Sindh', area: 'DHA',
    lat: 24.8, lng: 67.0, rent_avg_pkr: 300, rent_per_sqft_pkr: 300, provenance: 'manual_estimate',
    recorded_at: '2026-11-25T00:00:00Z', currency: 'PKR',
  },
]);
const districtResult = await fetchScopedRentRows(districtClient, { district: 'Lahore', region: 'Punjab' });
assert.deepEqual(districtResult.rows.map((row) => row.id), ['district-1']);
assert.ok(districtClient.queries.some((query) => query.filters.some((filter) => filter.column === 'district' && filter.value === 'Lahore')));
assert.ok(districtClient.queries.some((query) => query.filters.some((filter) => filter.column === 'city' && filter.value === 'Lahore')));
for (const query of districtClient.queries) assertFilteredBeforeLimit(query);
console.log('PASS: district filtering and the city alias are applied before limiting.');

// 4. Overlapping city/district queries are deduplicated by stable id.
const overlapClient = new FakeRentClient(targetRows);
const overlapResult = await fetchScopedRentRows(overlapClient, { city: 'Gulberg', district: 'Lahore', region: 'Punjab' });
assert.deepEqual(overlapResult.rows.map((row) => row.id), ['lahore-2', 'lahore-1']);
assert.equal(overlapResult.queryCount, 3);
assert.equal(new Set(overlapResult.rows.map((row) => row.id)).size, overlapResult.rows.length);
for (const query of overlapClient.queries) assertFilteredBeforeLimit(query);
console.log('PASS: overlapping scoped queries are deduplicated, not mixed with unrelated rows.');

// 5. ISO region codes resolve canonically without a Lahore/Punjab default.
assert.equal(resolveRentProvince({ region: 'PK-PB' }), 'Punjab');
assert.equal(resolveRentProvince({ region: 'PK-SD' }), 'Sindh');
assert.equal(resolveRentProvince({}), null);
const isoClient = new FakeRentClient(targetRows);
await fetchScopedRentRows(isoClient, { city: 'Lahore', region: 'PK-PB' });
assert.ok(isoClient.queries.every((query) => query.filters.some((filter) => filter.column === 'province' && filter.value === 'Punjab')));
console.log('PASS: canonical province resolution never substitutes a default location.');

// 6. Missing optional geography issues no global query and stays unavailable.
const sparseClient = new FakeRentClient([...unrelated, ...targetRows]);
const sparseResult = await fetchScopedRentRows(sparseClient, { region: 'Punjab' });
assert.deepEqual(sparseResult.rows, []);
assert.equal(sparseResult.queryCount, 0);
assert.equal(sparseClient.queries.length, 0);
assert.deepEqual(buildRentQuerySpecs({ region: 'Punjab' }), []);
const unavailable = buildRentMap([], { city: null, district: null, region: 'Punjab' }, now);
assert.equal(unavailable.status, 'unavailable');
assert.equal(unavailable.matchedRent.status, 'unavailable');
assert.equal(unavailable.areas.length, 0);
console.log('PASS: missing geography has no unfiltered fallback and remains unavailable.');

console.log('\n====== ALL RENT CACHE QUERY REGRESSION TESTS PASSED ======\n');
