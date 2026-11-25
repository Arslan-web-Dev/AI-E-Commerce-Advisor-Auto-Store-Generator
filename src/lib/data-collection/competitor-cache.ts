import { createHash } from 'crypto';
import { CompetitorQueryInput, CompetitorRecord, DataFreshness } from '@/types/data-collection';
import {
  OVERPASS_ATTRIBUTION,
  OVERPASS_QUERY_VERSION,
  clampRadiusKm,
} from '@/lib/providers/competitors/overpass';

export const COMPETITOR_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** In-process locks to prevent stampedes for the same cache key. */
const inflight = new Map<string, Promise<CompetitorCacheHit>>();

export interface CompetitorCacheHit {
  records: CompetitorRecord[];
  freshness: Extract<DataFreshness, 'live' | 'cached'>;
  cache_key: string;
  retrieved_at: string;
  cache_retrieved_at?: string;
  from_cache: boolean;
}

function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildCompetitorCacheKey(input: CompetitorQueryInput): string {
  const radius = clampRadiusKm(input.radiusKm);
  const raw = [
    input.category.trim().toLowerCase(),
    roundCoord(input.lat).toFixed(3),
    roundCoord(input.lng).toFixed(3),
    radius.toFixed(2),
    OVERPASS_QUERY_VERSION,
  ].join('|');
  return createHash('sha256').update(raw).digest('hex');
}

type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        gt: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        };
      };
    };
    upsert: (
      row: Record<string, unknown>,
      opts?: { onConflict?: string }
    ) => Promise<{ error: { message: string } | null }>;
  };
};

function stampCachedRecords(
  payload: CompetitorRecord[],
  cacheRetrievedAt: string,
  originalRetrievedAt: string
): CompetitorRecord[] {
  return payload.map((record) => ({
    ...record,
    freshness: 'cached' as const,
    cache_retrieved_at: cacheRetrievedAt,
    retrieved_at: originalRetrievedAt,
    attribution: record.attribution || OVERPASS_ATTRIBUTION,
  }));
}

/**
 * Read a non-expired competitor cache entry. Returns null when missing,
 * expired, or when the cache backend is unavailable.
 */
export async function readCompetitorCache(
  supabase: SupabaseLike | null,
  input: CompetitorQueryInput
): Promise<CompetitorCacheHit | null> {
  if (!supabase) return null;
  const cacheKey = buildCompetitorCacheKey(input);
  const nowIso = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('competitor_query_cache')
      .select('payload, retrieved_at, expires_at, item_count, provenance')
      .eq('cache_key', cacheKey)
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (error || !data) return null;

    const payload = Array.isArray(data.payload) ? (data.payload as CompetitorRecord[]) : [];
    // Do not treat empty successful caches as fabricated positive results —
    // empty is a valid observation (no POIs found) and may be reused.
    const retrievedAt = String(data.retrieved_at || nowIso);
    return {
      records: stampCachedRecords(payload, nowIso, retrievedAt),
      freshness: 'cached',
      cache_key: cacheKey,
      retrieved_at: retrievedAt,
      cache_retrieved_at: nowIso,
      from_cache: true,
    };
  } catch {
    return null;
  }
}

/**
 * Persist a successful live competitor response for seven days.
 * Failures are swallowed so cache outages never break collection.
 */
export async function writeCompetitorCache(
  supabase: SupabaseLike | null,
  input: CompetitorQueryInput,
  records: CompetitorRecord[],
  retrievedAt: string
): Promise<void> {
  if (!supabase) return;
  // Never cache synthetic demo results into the shared live cache.
  if (records.some((r) => r.provenance === 'synthetic_demo')) return;

  const cacheKey = buildCompetitorCacheKey(input);
  const expiresAt = new Date(Date.parse(retrievedAt) + COMPETITOR_CACHE_TTL_MS).toISOString();

  try {
    await supabase.from('competitor_query_cache').upsert(
      {
        cache_key: cacheKey,
        category: input.category,
        lat_rounded: roundCoord(input.lat),
        lng_rounded: roundCoord(input.lng),
        radius_km: clampRadiusKm(input.radiusKm),
        provider: 'overpass_osm',
        query_version: OVERPASS_QUERY_VERSION,
        item_count: records.length,
        payload: records,
        provenance: 'external_api',
        attribution: OVERPASS_ATTRIBUTION,
        retrieved_at: retrievedAt,
        expires_at: expiresAt,
      },
      { onConflict: 'cache_key' }
    );
  } catch {
    // Cache write failure must not fail the live collection path.
  }
}

/**
 * Fetch competitors with seven-day cache + in-process single-flight.
 * Live failures are rethrown — callers must not invent synthetic data.
 */
export async function getCompetitorsWithCache(
  supabase: SupabaseLike | null,
  input: CompetitorQueryInput,
  fetchLive: (input: CompetitorQueryInput) => Promise<CompetitorRecord[]>
): Promise<CompetitorCacheHit> {
  const cacheKey = buildCompetitorCacheKey(input);

  const cached = await readCompetitorCache(supabase, input);
  if (cached) return cached;

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<CompetitorCacheHit> => {
    // Re-check after acquiring the lock in case another worker filled the cache.
    const again = await readCompetitorCache(supabase, input);
    if (again) return again;

    const live = await fetchLive(input);
    const retrievedAt = live[0]?.retrieved_at || new Date().toISOString();
    const stamped = live.map((r) => ({
      ...r,
      freshness: 'live' as const,
      retrieved_at: retrievedAt,
      attribution: r.attribution || OVERPASS_ATTRIBUTION,
    }));

    await writeCompetitorCache(supabase, input, stamped, retrievedAt);

    return {
      records: stamped,
      freshness: 'live',
      cache_key: cacheKey,
      retrieved_at: retrievedAt,
      from_cache: false,
    };
  })();

  inflight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(cacheKey);
  }
}
