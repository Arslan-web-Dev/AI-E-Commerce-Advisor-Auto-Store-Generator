/**
 * FR-5.2: project-scoped rent_cache reads.
 *
 * The previous route took a global 500-row snapshot and filtered afterwards,
 * so a project's own city could be crowded out by unrelated rows. Every query
 * here applies province/city/district predicates BEFORE the row limit. No
 * unfiltered fallback is used, and no row is rewritten or relabelled.
 */
import { canonicalRegionName } from '@/lib/geo/pakistan-geography';
import type { RentMapCacheRow } from './rent-map';

export const RENT_CACHE_QUERY_LIMIT = 500;

export interface RentQueryGeography {
  city?: string | null;
  district?: string | null;
  region?: string | null;
  province?: string | null;
}

export interface RentQueryFilter {
  column: 'province' | 'city' | 'district';
  value: string;
}

export interface ScopedRentQuerySpec {
  filters: RentQueryFilter[];
}

export interface RentCacheQueryResult {
  data: RentMapCacheRow[] | null;
  error: { message: string } | null;
}

/**
 * Minimal structural client used by the route. The mock in the regression
 * suite implements the same interface so real filter order can be asserted.
 */
export interface RentCacheQueryBuilder {
  select(columns: string): RentCacheQueryBuilder;
  eq(column: RentQueryFilter['column'], value: string): RentCacheQueryBuilder;
  order(column: 'city' | 'area', options?: { ascending?: boolean }): RentCacheQueryBuilder;
  limit(limit: number): PromiseLike<RentCacheQueryResult>;
}

export interface RentCacheQueryClient {
  from(table: 'rent_cache'): RentCacheQueryBuilder;
}

export interface ScopedRentRowsResult {
  rows: RentMapCacheRow[];
  error: { message: string } | null;
  queryCount: number;
  appliedFilters: RentQueryFilter[];
}

export const RENT_MAP_SELECT = [
  'id',
  'city',
  'area',
  'district',
  'province',
  'lat',
  'lng',
  'rent_per_sqft_pkr',
  'rent_min_pkr',
  'rent_max_pkr',
  'rent_avg_pkr',
  'sample_size',
  'source',
  'scraped_at',
  'recorded_at',
  'confidence',
  'provenance',
  'notes',
  'currency',
].join(', ');

function clean(value?: string | null): string {
  return (value ?? '').trim();
}

function norm(value?: string | null): string {
  return clean(value).toLowerCase();
}

/** Canonical province from a name or ISO code, falling back to exact stored text. */
export function resolveRentProvince(geography: RentQueryGeography): string | null {
  const raw = clean(geography.province ?? geography.region);
  if (!raw) return null;
  return canonicalRegionName(raw) ?? raw;
}

/**
 * Build one narrow query per safe geography predicate.
 *
 * `buildRentMap` accepts a row when its city matches the project city OR its
 * district matches the project city/district. A district-only project also
 * accepts rows whose city equals that district. Those cases are expressed as
 * separate bounded queries, deduplicated after execution, instead of as one
 * global snapshot.
 */
export function buildRentQuerySpecs(geography: RentQueryGeography): ScopedRentQuerySpec[] {
  const province = resolveRentProvince(geography);
  const city = clean(geography.city);
  const district = clean(geography.district);
  const predicates: RentQueryFilter[] = [];

  if (city) predicates.push({ column: 'city', value: city });
  if (district && (!city || norm(city) !== norm(district))) {
    predicates.push({ column: 'district', value: district });
    predicates.push({ column: 'city', value: district });
  }

  // Without a city/district identity, buildRentMap refuses every row. Do not
  // issue a broad query that could later be mistaken for scoped coverage.
  if (predicates.length === 0) return [];

  return predicates.map((predicate) => ({
    filters: province ? [{ column: 'province' as const, value: province }, predicate] : [predicate],
  }));
}

/** Stable dedupe key; full rows are preserved exactly as returned by storage. */
export function rentRowIdentity(row: RentMapCacheRow): string | null {
  if (row.id && clean(String(row.id))) return `id:${clean(String(row.id))}`;
  const parts = [row.province, row.district, row.city, row.area].map(norm);
  if (parts.some((part) => part === '')) return null;
  return `geo:${parts.join('|')}`;
}

function rowSortKey(row: RentMapCacheRow): string {
  return [row.city, row.district || row.city, row.area, row.id].map(norm).join('|');
}

async function runSpec(
  client: RentCacheQueryClient,
  spec: ScopedRentQuerySpec,
  limit: number
): Promise<RentCacheQueryResult> {
  let query = client.from('rent_cache').select(RENT_MAP_SELECT);
  for (const filter of spec.filters) {
    query = query.eq(filter.column, filter.value);
  }
  query = query.order('city', { ascending: true }).order('area', { ascending: true });
  return await query.limit(limit);
}

/**
 * Read only project-scoped rent_cache rows. Geography predicates are applied
 * before `limit`, overlapping results are deduplicated, and the merged result
 * is capped at the same predictable bound.
 */
export async function fetchScopedRentRows(
  client: RentCacheQueryClient,
  geography: RentQueryGeography,
  options?: { limit?: number }
): Promise<ScopedRentRowsResult> {
  const specs = buildRentQuerySpecs(geography);
  if (specs.length === 0) {
    return { rows: [], error: null, queryCount: 0, appliedFilters: [] };
  }

  const requestedLimit = options?.limit;
  const limit =
    typeof requestedLimit === 'number' && Number.isInteger(requestedLimit) && requestedLimit > 0
      ? requestedLimit
      : RENT_CACHE_QUERY_LIMIT;
  let results: RentCacheQueryResult[];
  try {
    results = await Promise.all(specs.map((spec) => runSpec(client, spec, limit)));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Rent cache query failed';
    return { rows: [], error: { message }, queryCount: specs.length, appliedFilters: specs.flatMap((spec) => spec.filters) };
  }

  const queryError = results.find((result) => result?.error)?.error;
  if (queryError) {
    return {
      rows: [],
      error: { message: queryError.message },
      queryCount: specs.length,
      appliedFilters: specs.flatMap((spec) => spec.filters),
    };
  }

  const seen = new Set<string>();
  const merged: RentMapCacheRow[] = [];
  for (const result of results) {
    for (const row of Array.isArray(result?.data) ? result.data : []) {
      const identity = rentRowIdentity(row);
      if (identity) {
        if (seen.has(identity)) continue;
        seen.add(identity);
      }
      merged.push(row);
    }
  }

  merged.sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b)));
  return {
    rows: merged.slice(0, limit),
    error: null,
    queryCount: specs.length,
    appliedFilters: specs.flatMap((spec) => spec.filters),
  };
}
