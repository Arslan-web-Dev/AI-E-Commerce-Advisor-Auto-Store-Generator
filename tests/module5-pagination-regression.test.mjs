/**
 * Task 6 remediation — bounded competitor pagination regression.
 *
 * Deterministic mocked page requests count simultaneous in-flight calls. The
 * assertions exercise loadCompetitorPages itself, not source-code substrings.
 */
import assert from 'node:assert/strict';
import './helpers/ts-loader.mjs';

const {
  DEFAULT_COMPETITOR_CONCURRENCY,
  competitorIdentityKey,
  loadCompetitorPages,
} = await import('../src/lib/visualization/competitor-pagination.ts');

const tick = () => new Promise((resolve) => setImmediate(resolve));

function makeFetcher(pages, failingPages = []) {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  return {
    calls,
    get maxActive() {
      return maxActive;
    },
    async fetch(page) {
      active += 1;
      maxActive = Math.max(maxActive, active);
      calls.push(page);
      try {
        await tick();
        if (failingPages.includes(page)) throw new Error(`Mock failure on page ${page}`);
        const payload = pages[page];
        if (!payload) throw new Error(`Missing mock payload for page ${page}`);
        return payload;
      } finally {
        active -= 1;
      }
    },
  };
}

function rowsFor(prefix, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    name: `${prefix} ${index + 1}`,
    lat: 31.5,
    lng: 74.3,
  }));
}

function pagePayload(page, competitors, total, totalPages) {
  return { competitors, pagination: { page, limit: 10, total, total_pages: totalPages } };
}

console.log('\n====== COMPETITOR PAGINATION REGRESSION TESTS ======');

// 1. Every page loads; in-flight calls never exceed the configured limit.
const pages = {};
for (let page = 1; page <= 6; page += 1) {
  pages[page] = pagePayload(page, rowsFor(`p${page}`, 10), 60, 6);
}
const boundedFetcher = makeFetcher(pages);
const allPages = await loadCompetitorPages(boundedFetcher.fetch, { concurrency: 3 });
assert.equal(DEFAULT_COMPETITOR_CONCURRENCY, 3);
assert.deepEqual(boundedFetcher.calls.slice().sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
assert.ok(allPages.maxObservedConcurrency <= 3, 'concurrency must not exceed the configured limit');
assert.ok(allPages.maxObservedConcurrency >= 2, 'the worker pool should actually overlap page requests');
assert.equal(allPages.competitors.length, 60);
assert.equal(allPages.loadedCount, 60);
assert.equal(allPages.loadedRowCount, 60);
assert.equal(allPages.serverTotal, 60);
assert.deepEqual(allPages.successfulPages, [1, 2, 3, 4, 5, 6]);
assert.deepEqual(allPages.failedPages, []);
assert.equal(allPages.complete, true);
assert.equal(allPages.partial, false);
assert.deepEqual(allPages.competitors.map((row) => row.id), Array.from({ length: 6 }, (_, p) => rowsFor(`p${p + 1}`, 10).map((row) => row.id)).flat());
console.log('PASS: all pages load in order with at most three concurrent requests.');

// 2. Stable OSM identity removes duplicates without touching distinct rows.
const osmRow = (identity) => ({ name: `Business ${identity}`, lat: 31.5, lng: 74.3, raw_data: { osm_identity: identity } });
assert.equal(competitorIdentityKey(osmRow('node/1')), 'osm:node/1');
const duplicatePages = {
  1: pagePayload(1, [osmRow('node/1'), osmRow('node/2')], 3, 2),
  2: pagePayload(2, [osmRow('node/1'), osmRow('node/3')], 3, 2),
};
const duplicateFetcher = makeFetcher(duplicatePages);
const deduped = await loadCompetitorPages(duplicateFetcher.fetch, { concurrency: 2 });
assert.equal(deduped.loadedRowCount, 4);
assert.equal(deduped.loadedCount, 3);
assert.equal(deduped.duplicateCount, 1);
assert.deepEqual(deduped.competitors.map((row) => row.raw_data.osm_identity), ['node/1', 'node/2', 'node/3']);
assert.equal(deduped.serverTotal, 3);
assert.equal(deduped.complete, true);
console.log('PASS: duplicate competitors are removed by stable OSM identity.');

// 3. Invalid, negative, fractional and unreasonable total_pages are refused.
for (const invalidValue of ['many', -4, 2.7]) {
  const invalidFetcher = makeFetcher({ 1: pagePayload(1, rowsFor('bad', 2), 10, invalidValue) });
  const invalid = await loadCompetitorPages(invalidFetcher.fetch, { concurrency: 3 });
  assert.equal(invalid.invalidTotalPages, true, `total_pages=${invalidValue} must be marked invalid`);
  assert.equal(invalid.totalPages, 1);
  assert.deepEqual(invalidFetcher.calls, [1]);
  assert.equal(invalid.loadedCount, 2);
  assert.equal(invalid.serverTotal, 10);
  assert.equal(invalid.partial, true);
  assert.equal(invalid.complete, false);
}
const cappedPages = {
  1: pagePayload(1, rowsFor('cap1', 10), 999, 1000),
  2: pagePayload(2, rowsFor('cap2', 10), 999, 1000),
  3: pagePayload(3, rowsFor('cap3', 10), 999, 1000),
};
const cappedFetcher = makeFetcher(cappedPages);
const capped = await loadCompetitorPages(cappedFetcher.fetch, { concurrency: 3, maxPages: 3 });
assert.equal(capped.cappedTotalPages, true);
assert.equal(capped.totalPages, 3);
assert.deepEqual(cappedFetcher.calls, [1, 2, 3]);
assert.equal(capped.partial, true);
assert.equal(capped.complete, false);
console.log('PASS: invalid and unreasonable page counts are bounded and never trusted.');

// 4. A failed page is reported but does not crash the dashboard load.
const partialPages = {};
for (let page = 1; page <= 4; page += 1) {
  partialPages[page] = pagePayload(page, rowsFor(`partial${page}`, 10), 40, 4);
}
const partialFetcher = makeFetcher(partialPages, [3]);
const partial = await loadCompetitorPages(partialFetcher.fetch, { concurrency: 3 });
assert.deepEqual(partial.failedPages.map((failure) => failure.page), [3]);
assert.deepEqual(partial.successfulPages, [1, 2, 4]);
assert.equal(partial.loadedCount, 30);
assert.equal(partial.serverTotal, 40);
assert.notEqual(partial.serverTotal, partial.loadedCount);
assert.equal(partial.complete, false);
assert.equal(partial.partial, true);
assert.ok(partial.notes.some((note) => /page 3 failed/i.test(note)));
console.log('PASS: a failed page yields an explicit partial state, not a crash.');

// 5. Server-reported total is never presented as the successfully loaded count.
const mismatchFetcher = makeFetcher({ 1: pagePayload(1, rowsFor('mismatch', 2), 999, 1) });
const mismatch = await loadCompetitorPages(mismatchFetcher.fetch, { concurrency: 3 });
assert.equal(mismatch.serverTotal, 999);
assert.equal(mismatch.loadedRowCount, 2);
assert.equal(mismatch.loadedCount, 2);
assert.equal(mismatch.complete, false);
assert.equal(mismatch.partial, true);
assert.ok(mismatch.notes.some((note) => /reported total of 999/.test(note)));
console.log('PASS: loaded count and server total remain explicitly distinct.');

// 6. A first-page failure is also contained and clearly reported.
const firstFailFetcher = makeFetcher({}, [1]);
const firstFail = await loadCompetitorPages(firstFailFetcher.fetch, { concurrency: 3 });
assert.equal(firstFail.competitors.length, 0);
assert.equal(firstFail.serverTotal, null);
assert.equal(firstFail.partial, true);
assert.equal(firstFail.complete, false);
assert.deepEqual(firstFail.failedPages.map((failure) => failure.page), [1]);
console.log('PASS: first-page failure is contained and reported as incomplete.');

console.log('\n==== ALL COMPETITOR PAGINATION REGRESSION TESTS PASSED ====\n');
