/**
 * Task 6 / Module 5 — Competition, rent overlay and visualization contracts.
 *
 * Run with: node --test tests/module5-competition-visualization.test.mjs
 *
 * Behavioural assertions import the real TypeScript helpers via Node's built-in
 * type stripping and tests/helpers/ts-loader.mjs. No live Supabase, provider,
 * browser or network call is made. A small final set of source checks confirms
 * that the tested contracts are actually wired into the UI and API.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import './helpers/ts-loader.mjs';

const {
  MODULE5_CONFIG_VERSION,
  OSM_ATTRIBUTION_TEXT,
  OSM_ATTRIBUTION_URL,
  RENT_BANDS,
  SATURATION_BANDS,
  getRentBand,
  getRentIntensityBand,
  getSaturationBand,
} = await import('../src/lib/visualization/module5-config.ts');
const {
  formatMapNumber,
  isValidMapCoordinate,
  isValidMapRadius,
  sanitizeMapText,
} = await import('../src/lib/visualization/map-validation.ts');
const {
  calculateRentBudget,
  deriveMonthlyRentRange,
  formatCurrency,
} = await import('../src/lib/visualization/rent-budget.ts');
const {
  calculateSaturation,
  competitorsPer100k,
} = await import('../src/lib/visualization/saturation.ts');
const {
  analyzeTrendSeries,
  buildTrendSummary,
} = await import('../src/lib/visualization/trend-analysis.ts');
const {
  filterCompetitors,
  paginateRows,
  sortCompetitors,
} = await import('../src/lib/visualization/competitor-table.ts');
const {
  buildCompetitorCsv,
  escapeCsvCell,
  safeCsvFilename,
} = await import('../src/lib/visualization/csv.ts');
const { buildRentMap, deriveRentFreshness } = await import('../src/lib/visualization/rent-map.ts');
const { hasProjectAccess } = await import('../src/lib/visualization/access.ts');

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

console.log('\n================ TASK 6 MODULE 5 VERIFICATION ================');

// ---------------------------------------------------------------------------
console.log('\n[1/14] Centralized bands are contiguous and match the JSON contract...');
const config = JSON.parse(read('config/module5-visualization.json'));
assert.equal(config.version, MODULE5_CONFIG_VERSION);
assert.equal(config.map.attributionText, OSM_ATTRIBUTION_TEXT);
assert.equal(config.map.attributionUrl, OSM_ATTRIBUTION_URL);
assert.equal(RENT_BANDS.length, 4);
assert.equal(SATURATION_BANDS.length, 4);
config.rentBands.forEach((band, index) => {
  assert.equal(band.label, RENT_BANDS[index].label);
  assert.equal(band.minInclusive, RENT_BANDS[index].minInclusive);
  assert.equal(band.maxExclusive, RENT_BANDS[index].maxExclusive);
  if (index > 0) assert.equal(RENT_BANDS[index - 1].maxExclusive, band.minInclusive);
});
config.saturationBands.forEach((band, index) => {
  assert.equal(band.label, SATURATION_BANDS[index].label);
  assert.equal(band.minInclusive, SATURATION_BANDS[index].minInclusive);
  assert.equal(band.maxExclusive, SATURATION_BANDS[index].maxExclusive);
  if (index > 0) assert.equal(SATURATION_BANDS[index - 1].maxExclusive, band.minInclusive);
});
assert.equal(getRentBand(0).label, 'Well within budget');
assert.equal(getRentBand(29.99).label, 'Well within budget');
assert.equal(getRentBand(30).label, 'Comfortable');
assert.equal(getRentBand(60).label, 'Tight — consider negotiating');
assert.equal(getRentBand(85).label, 'Over budget');
assert.equal(getRentBand(null), null);
assert.deepEqual(
  SATURATION_BANDS.map((band) => band.label),
  ['Underserved', 'Balanced', 'Crowded', 'Saturated']
);
assert.equal(getSaturationBand(-10).label, 'Underserved');
assert.equal(getSaturationBand(25).label, 'Balanced');
assert.equal(getSaturationBand(50).label, 'Crowded');
assert.equal(getSaturationBand(75).label, 'Saturated');
assert.equal(getSaturationBand(100).label, 'Saturated');
assert.equal(getRentIntensityBand(150, 100, 200).label, 'High');
assert.equal(getRentIntensityBand(150, 150, 150), null);
console.log('PASS: rent and saturation bands cover 0–100 with no gaps or overlaps.');

// ---------------------------------------------------------------------------
console.log('\n[2/14] Map inputs and untrusted popup text are validated...');
assert.equal(isValidMapCoordinate(31.5, 74.3), true);
assert.equal(isValidMapCoordinate('31.5', '74.3'), true);
assert.equal(isValidMapCoordinate(0, 0), false);
assert.equal(isValidMapCoordinate(Number.NaN, 74.3), false);
assert.equal(isValidMapCoordinate(91, 74.3), false);
assert.equal(isValidMapRadius(10), true);
assert.equal(isValidMapRadius(15), true);
assert.equal(isValidMapRadius('12'), true);
assert.equal(isValidMapRadius(15.1), false);
assert.equal(isValidMapRadius(0), false);
assert.equal(sanitizeMapText('<img src=x onerror=alert(1)>').includes('<'), false);
assert.equal(sanitizeMapText('<img src=x onerror=alert(1)>').includes('>'), false);
assert.equal(formatMapNumber(null), 'N/A');
assert.equal(formatMapNumber(3.14159, 2), '3.14');
console.log('PASS: coordinates, radius and popup text are bounded/sanitized before rendering.');

// ---------------------------------------------------------------------------
console.log('\n[3/14] Rent share uses the monthly-equivalent budget denominator...');
const share = calculateRentBudget({
  monthlyRent: 10000,
  totalBudget: 300000,
  rentCurrency: 'PKR',
  budgetCurrency: 'PKR',
});
assert.equal(share.monthlyBudget, 25000);
assert.equal(share.ratioPercent, 40);
assert.equal(share.band.label, 'Comfortable');
assert.equal(share.fillPercent, 40);
const wrongShare = calculateRentBudget({
  monthlyRent: 10000,
  totalBudget: 300000,
  rentCurrency: 'PKR',
  budgetCurrency: 'USD',
});
assert.equal(wrongShare.valid, false);
assert.equal(wrongShare.ratioPercent, null);
assert.match(wrongShare.reason, /currencies differ/);
const noBudget = calculateRentBudget({ monthlyRent: 10000, totalBudget: 0 });
assert.equal(noBudget.valid, false);
assert.equal(noBudget.band, null);
const range = deriveMonthlyRentRange(30000, 120, 180, 150);
assert.equal(range.hasGenuineRange, true);
assert.equal(range.rentMin, 24000);
assert.equal(range.rentMax, 36000);
const flatRange = deriveMonthlyRentRange(30000, null, null, 150);
assert.equal(flatRange.hasGenuineRange, false);
assert.equal(flatRange.rentMin, 30000);
assert.equal(flatRange.rentMax, 30000);
assert.match(formatCurrency(12345, 'PKR'), /12,345/);
assert.equal(formatCurrency(null), 'N/A');
console.log('PASS: rent share is monthly-rent ÷ (budget ÷ 12); fake range/currency values are refused.');

// ---------------------------------------------------------------------------
console.log('\n[4/14] Saturation keeps raw units separate from the 0–100 index...');
assert.equal(competitorsPer100k(20, 200000), 10);
assert.equal(competitorsPer100k(20, 0), null);
assert.equal(competitorsPer100k(null, 200000), null);
const saturated = calculateSaturation({ saturationPer100k: 10 });
assert.equal(saturated.normalizedIndex, 100);
assert.equal(saturated.band.label, 'Saturated');
const crowded = calculateSaturation({ competitorCount: 10, population: 200000 });
assert.equal(crowded.competitorsPer100k, 5);
assert.equal(crowded.normalizedIndex, 50);
assert.equal(crowded.band.label, 'Crowded');
const unavailable = calculateSaturation({});
assert.equal(unavailable.normalizedIndex, null);
assert.equal(unavailable.band, null);
assert.match(unavailable.reason, /unavailable or invalid/);
console.log('PASS: raw competitors/100k, normalized index and N/A state are distinct.');

// ---------------------------------------------------------------------------
console.log('\n[5/14] Trend points are validated, ordered and summarized...');
const months = [];
for (let year = 2025; year <= 2026; year += 1) {
  for (let month = 1; month <= 12; month += 1) {
    if (year === 2025 && month < 10) continue;
    if (year === 2026 && month > 9) continue;
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
}
assert.equal(months.length, 12);
const values = [10, 15, 20, 18, 25, 30, 28, 35, 40, 38, 45, 50];
const series = months.map((month, index) => ({ month, index: values[index] }));
const trend = analyzeTrendSeries(series, { sourceSlope: 'growing', sourceIsUsable: true });
assert.equal(trend.validPoints.length, 12);
assert.equal(trend.completeTwelveMonths, true);
assert.equal(trend.chronological, true);
assert.equal(trend.firstMonth, '2025-10');
assert.equal(trend.lastMonth, '2026-09');
assert.equal(trend.average, 29.5);
assert.equal(trend.peak, 50);
assert.equal(trend.minimum, 10);
assert.equal(trend.direction, 'growing');
assert.equal(trend.directionSource, 'stored');
assert.match(buildTrendSummary(trend), /Twelve complete monthly observations/);
const calculatedTrend = analyzeTrendSeries(series);
assert.equal(calculatedTrend.directionSource, 'calculated');
assert.equal(calculatedTrend.direction, 'growing');
const reversed = analyzeTrendSeries([...series].reverse());
assert.equal(reversed.chronological, false);
assert.equal(reversed.completeTwelveMonths, false);
assert.equal(reversed.firstMonth, '2025-10');
const dirty = analyzeTrendSeries([
  { month: '2026-13', index: 20 },
  { month: '2026-01', index: 101 },
  { month: '2026-01', index: 30 },
  { month: '2026-01', index: 40 },
  { month: '2026-02', index: 45 },
]);
assert.equal(dirty.invalidCount, 3);
assert.deepEqual(dirty.duplicateMonths, ['2026-01']);
assert.equal(dirty.validPoints.length, 2);
const incomplete = analyzeTrendSeries(series.slice(0, 11));
assert.equal(incomplete.completeTwelveMonths, false);
assert.match(buildTrendSummary(incomplete), /Incomplete series/);
console.log('PASS: chronological order, invalid months, duplicates and incomplete series are explicit.');

// ---------------------------------------------------------------------------
console.log('\n[6/14] Competitor filters, sorting and pagination are behavioral...');
const competitors = [
  { name: 'Beta', category: 'Cafes', distance_km: 2, rating: 4.5, address: 'A' },
  { name: 'Alpha', category: 'Retail', distance_km: 1, address: 'B' },
  { name: 'Gamma', category: 'Cafes', distance_km: 3, rating: 3.8, address: 'C' },
  { name: 'Delta', category: 'Retail', distance_km: 5, rating: 4.8, address: 'D' },
  { name: 'NoDistance', category: 'Other', rating: 5, address: 'E' },
];
assert.deepEqual(
  filterCompetitors(competitors, { search: 'caf' }).map((row) => row.name),
  ['Beta', 'Gamma']
);
assert.deepEqual(
  filterCompetitors(competitors, { category: 'Retail' }).map((row) => row.name),
  ['Alpha', 'Delta']
);
assert.deepEqual(
  filterCompetitors(competitors, { minDistance: 2, maxDistance: 4 }).map((row) => row.name),
  ['Beta', 'Gamma']
);
assert.deepEqual(
  filterCompetitors(competitors, { ratingFilter: 'minimum', minRating: 4 }).map((row) => row.name),
  ['Beta', 'Delta', 'NoDistance']
);
assert.deepEqual(
  sortCompetitors(competitors, 'name', 'asc').map((row) => row.name),
  ['Alpha', 'Beta', 'Delta', 'Gamma', 'NoDistance']
);
assert.deepEqual(
  sortCompetitors(competitors, 'name', 'desc').map((row) => row.name),
  ['NoDistance', 'Gamma', 'Delta', 'Beta', 'Alpha']
);
assert.deepEqual(
  sortCompetitors(competitors, 'distance', 'desc').map((row) => row.name),
  ['Delta', 'Gamma', 'Beta', 'Alpha', 'NoDistance']
);
assert.deepEqual(
  sortCompetitors(competitors, 'rating', 'asc').map((row) => row.name),
  ['Gamma', 'Beta', 'Delta', 'NoDistance', 'Alpha']
);
const page = paginateRows(competitors, 2, 2);
assert.deepEqual(page.items.map((row) => row.name), ['Gamma', 'Delta']);
assert.equal(page.total, 5);
assert.equal(page.totalPages, 3);
assert.equal(page.start, 3);
assert.equal(page.end, 4);
assert.equal(paginateRows(competitors, 99, 2).page, 3);
console.log('PASS: all required filters, both sort directions, null-last ordering and pagination work.');

// ---------------------------------------------------------------------------
console.log('\n[7/14] CSV export is escaped and formula-injection safe...');
assert.equal(escapeCsvCell('=SUM(1+1)'), '"\'=SUM(1+1)"');
assert.equal(escapeCsvCell('He said "hi"'), '"He said ""hi"""');
assert.equal(escapeCsvCell(null), '"N/A"');
const csv = buildCompetitorCsv([{ name: '=HYPERLINK("x")', category: 'Cafes', distance_km: 2 }]);
assert.equal(csv.startsWith('\uFEFF'), true);
assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
assert.match(csv, /Distance \(km\)/);
assert.equal(safeCsvFilename('../../Bad Name?'), 'bad_name_competitors.csv');
console.log('PASS: untrusted cells are quoted, formula prefixes are neutralized and URLs are cleaned.');

// ---------------------------------------------------------------------------
console.log('\n[8/14] Stored rent overlay keeps only same-geography area points...');
const now = new Date('2026-11-26T00:00:00Z');
const rentRows = [
  {
    id: 'rl-1', city: 'Lahore', area: 'Model Town', district: 'Lahore', province: 'Punjab',
    lat: 31.56, lng: 74.54, rent_avg_pkr: 150, rent_min_pkr: 120, rent_max_pkr: 180,
    sample_size: 12, source: 'manual survey', provenance: 'manual_estimate', confidence: 'medium',
    recorded_at: '2026-11-25T00:00:00Z', currency: 'PKR',
  },
  {
    id: 'rl-2', city: 'Lahore', area: 'Gulberg', district: 'Lahore', province: 'Punjab',
    lat: 31.54, lng: 74.45, rent_avg_pkr: 180, rent_min_pkr: 160, rent_max_pkr: 200,
    sample_size: 6, source: 'aggregated listing snapshot', provenance: 'external_api', confidence: 'high',
    scraped_at: '2026-01-01T00:00:00Z', currency: 'PKR',
  },
  {
    id: 'rl-3', city: 'Karachi', area: 'DHA', district: 'Karachi', province: 'Sindh',
    lat: 24.8, lng: 67.0, rent_avg_pkr: 300, rent_min_pkr: 250, rent_max_pkr: 350,
    sample_size: 20, source: 'manual survey', provenance: 'manual_estimate', confidence: 'high',
    recorded_at: '2026-11-25T00:00:00Z', currency: 'PKR',
  },
  {
    id: 'rl-4', city: 'Lahore', area: 'No Coordinates', district: 'Lahore', province: 'Punjab',
    rent_avg_pkr: 100, provenance: 'manual_estimate', currency: 'PKR',
  },
];
const mapPayload = buildRentMap(
  rentRows,
  {
    city: 'Lahore', district: 'Lahore', region: 'Punjab',
    lat: 31.55, lng: 74.5, radiusKm: 10,
  },
  now
);
assert.equal(mapPayload.status, 'coverage');
assert.deepEqual(mapPayload.areas.map((area) => area.area), ['Model Town', 'Gulberg']);
assert.equal(mapPayload.areas.some((area) => area.area === 'DHA'), false);
assert.equal(mapPayload.areas.some((area) => area.area === 'No Coordinates'), false);
assert.equal(mapPayload.summary.invalidCoordinateCount, 1);
assert.equal(mapPayload.summary.staleCount, 1);
assert.equal(mapPayload.summary.manualEstimateCount, 2);
assert.equal(mapPayload.summary.cityAggregateAvailable, false);
assert.equal(mapPayload.matchedRent.match_level, 'nearby');
const cityAggregatePayload = buildRentMap(
  rentRows,
  { city: 'Lahore', district: 'Lahore', region: 'Punjab' },
  now
);
assert.equal(cityAggregatePayload.matchedRent.match_level, 'city');
assert.equal(cityAggregatePayload.summary.cityAggregateAvailable, true);
assert.equal(mapPayload.areas.every((area) => area.geometry === null && area.markerType === 'centroid'), true);
assert.equal(mapPayload.areas.every((area) => area.intensityBand !== null), true);
assert.equal(deriveRentFreshness(rentRows[0], now).freshness, 'manual_estimate');
assert.equal(deriveRentFreshness(rentRows[1], now).freshness, 'stale_cache');
console.log('PASS: exact/nearby/city matching is geography-scoped; stale/manual/unavailable states remain visible.');

// ---------------------------------------------------------------------------
console.log('\n[9/14] Cross-city and cross-province substitution is refused...');
const wrongCity = buildRentMap(
  [rentRows[2]],
  { city: 'Lahore', district: 'Lahore', region: 'Punjab', lat: 31.55, lng: 74.5, radiusKm: 10 },
  now
);
assert.equal(wrongCity.status, 'no_coverage');
assert.equal(wrongCity.areas.length, 0);
assert.equal(wrongCity.matchedRent.status, 'unavailable');
assert.match(wrongCity.matchedRent.notes, /not substituted/);
const wrongProvince = buildRentMap(
  [{ ...rentRows[0], province: 'Sindh' }],
  { city: 'Lahore', district: 'Lahore', region: 'Punjab', lat: 31.55, lng: 74.5, radiusKm: 10 },
  now
);
assert.equal(wrongProvince.areas.length, 0);
const emptyCache = buildRentMap([], { city: 'Lahore', district: 'Lahore', region: 'Punjab' }, now);
assert.equal(emptyCache.status, 'unavailable');
assert.equal(emptyCache.matchedRent.status, 'unavailable');
console.log('PASS: another city/province is never substituted for missing local rent coverage.');

// ---------------------------------------------------------------------------
console.log('\n[10/14] Project access is owner-or-admin only...');
assert.equal(hasProjectAccess({ userId: 'u1', ownerId: 'u1', role: 'entrepreneur' }), true);
assert.equal(hasProjectAccess({ userId: 'admin', ownerId: 'u1', role: 'admin' }), true);
assert.equal(hasProjectAccess({ userId: 'u2', ownerId: 'u1', role: 'entrepreneur' }), false);
assert.equal(hasProjectAccess({ ownerId: 'u1', role: 'admin' }), false);
assert.equal(hasProjectAccess({ userId: 'u1', ownerId: null, role: 'entrepreneur' }), false);
console.log('PASS: pure owner/admin gate denies anonymous and cross-user access.');

// ---------------------------------------------------------------------------
console.log('\n[11/14] OSM attribution contract is explicit...');
assert.equal(OSM_ATTRIBUTION_TEXT, '© OpenStreetMap contributors');
assert.equal(OSM_ATTRIBUTION_URL, 'https://www.openstreetmap.org/copyright');
assert.equal(config.map.attributionText, OSM_ATTRIBUTION_TEXT);
assert.equal(config.map.provider, 'Leaflet with OpenStreetMap raster tiles');
console.log('PASS: the required attribution text and copyright URL are centralized.');

// ---------------------------------------------------------------------------
console.log('\n[12/14] Module 5 routes and components are wired to the tested helpers...');
const mapSource = read('src/components/feasibility/CompetitorMap.tsx');
const rentRoute = read('src/app/api/projects/[id]/rent-map/route.ts');
const pageSource = read('src/app/projects/[id]/feasibility/page.tsx');
assert.match(mapSource, /loadLeaflet/);
assert.match(mapSource, /OSM_ATTRIBUTION_URL/);
assert.match(mapSource, /bindPopup\(buildPopup/);
assert.equal(/<script/.test(mapSource), false);
assert.match(rentRoute, /hasProjectAccess/);
assert.match(rentRoute, /buildRentMap/);
assert.match(rentRoute, /rent_cache/);
assert.match(rentRoute, /fetchScopedRentRows/);
assert.equal(/getCostEstimates|fetch\(/.test(rentRoute), false);
assert.match(pageSource, /\/rent-map/);
assert.match(pageSource, /totalCount=\{competitorTotal\}/);
assert.match(pageSource, /rentAreas=\{rentMap\?\.areas \?\? \[\]\}/);
assert.match(pageSource, /loadCompetitorPages/);
assert.equal(/Promise\.all\(\s*Array\.from/.test(pageSource), false);
console.log('PASS: one shared map loader, read-only rent route and complete page wiring are present.');

// ---------------------------------------------------------------------------
console.log('\n[13/14] No duplicate production map instances were introduced...');
const componentFiles = fs
  .readdirSync(path.join(root, 'src/components'), { withFileTypes: true })
  .flatMap((entry) => {
    const entryPath = path.join(root, 'src/components', entry.name);
    if (entry.isDirectory()) {
      return fs.readdirSync(entryPath, { recursive: true })
        .map((file) => path.join(entryPath, String(file)))
        .filter((file) => file.endsWith('.tsx'));
    }
    return entry.name.endsWith('.tsx') ? [entryPath] : [];
  });
const mapComponents = componentFiles.filter((file) =>
  /L\.map\(|tile\.openstreetmap\.org/.test(fs.readFileSync(file, 'utf8'))
);
assert.deepEqual(mapComponents.map((file) => path.relative(root, file).replace(/\\/g, '/')), [
  'src/components/feasibility/CompetitorMap.tsx',
]);
console.log('PASS: CompetitorMap.tsx remains the single real Leaflet/OSM map component.');

// ---------------------------------------------------------------------------
console.log('\n[14/14] Task 6 stays within its boundary...');
const labelApproval = JSON.parse(read('ml-service/config/label_approval.json'));
assert.equal(labelApproval.status, 'BLOCKED');
assert.equal(labelApproval.oi_id, 'OI-6');
console.log('PASS: OI-6 remains BLOCKED; no supervised-production gate was changed.');

console.log('\n================ ALL MODULE 5 BEHAVIORAL CHECKS PASSED ================\n');
