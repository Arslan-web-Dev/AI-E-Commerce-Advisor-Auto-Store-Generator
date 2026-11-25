import type { RentLookupResult, ConfidenceLevel, DataProvenance } from '@/types/data-collection';
import { haversineDistanceKm, isValidCoordinate } from '@/lib/geo/distance';

export const NEARBY_RENT_MAX_KM = 12;

export interface RentCacheRow {
  city: string;
  area: string;
  district?: string | null;
  province?: string | null;
  lat?: number | null;
  lng?: number | null;
  rent_per_sqft_pkr: number;
  rent_min_pkr?: number | null;
  rent_max_pkr?: number | null;
  rent_avg_pkr?: number | null;
  sample_size?: number | null;
  source?: string | null;
  scraped_at?: string | null;
  recorded_at?: string | null;
  confidence?: string | null;
  provenance?: string | null;
  notes?: string | null;
  currency?: string | null;
}

export interface RentLookupInput {
  city?: string;
  area?: string;
  district?: string;
  province?: string;
  lat?: number;
  lng?: number;
}

function norm(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

function unavailable(input: RentLookupInput, notes: string): RentLookupResult {
  return {
    status: 'unavailable',
    match_level: 'unavailable',
    requested_geography: {
      city: input.city,
      area: input.area,
      district: input.district,
      province: input.province,
      lat: input.lat,
      lng: input.lng,
    },
    source_geography: null,
    currency: 'PKR',
    provenance: 'unavailable',
    freshness: 'unavailable',
    confidence: 'none',
    notes,
  };
}

function toResult(
  row: RentCacheRow,
  input: RentLookupInput,
  matchLevel: RentLookupResult['match_level'],
  distanceKm?: number,
  confidenceOverride?: ConfidenceLevel
): RentLookupResult {
  const avg = Number(row.rent_avg_pkr ?? row.rent_per_sqft_pkr);
  const provenance = (row.provenance as DataProvenance) || 'manual_estimate';
  const confidence =
    confidenceOverride ||
    ((row.confidence as ConfidenceLevel) || 'low');

  return {
    status: 'found',
    match_level: matchLevel,
    requested_geography: {
      city: input.city,
      area: input.area,
      district: input.district,
      province: input.province,
      lat: input.lat,
      lng: input.lng,
    },
    source_geography: {
      city: row.city,
      area: row.area,
      district: row.district || undefined,
      province: row.province || undefined,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
    },
    distance_km: distanceKm,
    rent_per_sqft_pkr: avg,
    rent_min_pkr: row.rent_min_pkr != null ? Number(row.rent_min_pkr) : undefined,
    rent_max_pkr: row.rent_max_pkr != null ? Number(row.rent_max_pkr) : undefined,
    rent_avg_pkr: avg,
    currency: 'PKR',
    sample_size: row.sample_size != null ? Number(row.sample_size) : undefined,
    source: row.source || undefined,
    provenance,
    freshness: provenance === 'manual_estimate' ? 'manual_estimate' : 'cached',
    confidence,
    retrieved_at:
      provenance === 'manual_estimate'
        ? row.recorded_at || row.scraped_at || undefined
        : row.scraped_at || undefined,
    retrieved_at_kind: provenance === 'manual_estimate' ? 'manual_estimate_recorded' : 'observation',
    notes: row.notes || undefined,
  };
}

/**
 * Build an honest city/district aggregate from cached area estimates instead of
 * presenting one arbitrary area row as city-wide coverage.
 */
function cityAggregateRow(rows: RentCacheRow[], input: RentLookupInput): RentCacheRow | null {
  const usable = rows.filter((row) => Number.isFinite(Number(row.rent_avg_pkr ?? row.rent_per_sqft_pkr)));
  if (usable.length === 0) return null;

  let weightSum = 0;
  let weightedValue = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  const provenances = new Set<string>();

  for (const row of usable) {
    const avg = Number(row.rent_avg_pkr ?? row.rent_per_sqft_pkr);
    const weight = Math.max(1, Number(row.sample_size ?? 1));
    weightSum += weight;
    weightedValue += avg * weight;
    const rowMin = row.rent_min_pkr != null ? Number(row.rent_min_pkr) : avg;
    const rowMax = row.rent_max_pkr != null ? Number(row.rent_max_pkr) : avg;
    if (Number.isFinite(rowMin)) min = Math.min(min, rowMin);
    if (Number.isFinite(rowMax)) max = Math.max(max, rowMax);
    if (row.provenance) provenances.add(row.provenance);
  }

  const average = Math.round((weightedValue / weightSum) * 100) / 100;
  const provenance = provenances.size === 1 ? [...provenances][0] : 'manual_estimate';

  return {
    city: input.city || '',
    area: 'city/district aggregate',
    district: input.district || input.city,
    province: input.province,
    rent_per_sqft_pkr: average,
    rent_min_pkr: Number.isFinite(min) ? min : average,
    rent_max_pkr: Number.isFinite(max) ? max : average,
    rent_avg_pkr: average,
    sample_size: weightSum,
    source: 'rent_cache aggregated area estimates',
    provenance,
    notes: `Computed from ${usable.length} cached area estimate(s); not a single-area observation.`,
  };
}

/**
 * Pure rent lookup against an in-memory rent_cache snapshot.
 * Prefer exact area → nearby area (same city/district) → city/district aggregate → unavailable.
 * Never silently substitutes an unrelated city (e.g. Lahore for Karachi).
 */
export function lookupRentFromRows(
  rows: RentCacheRow[],
  input: RentLookupInput
): RentLookupResult {
  if (!rows.length) {
    return unavailable(input, 'No rent_cache records are available for analysis.');
  }

  const city = norm(input.city);
  const area = norm(input.area);
  const district = norm(input.district || input.city);
  const province = norm(input.province);

  // Guard: if the caller named a city/district, only consider rows in that geography.
  const scoped = rows.filter((row) => {
    const rowCity = norm(row.city);
    const rowDistrict = norm(row.district || row.city);
    const rowProvince = norm(row.province);

    if (province && rowProvince && province !== rowProvince) return false;

    if (city) {
      return rowCity === city || rowDistrict === city || rowDistrict === district;
    }
    if (district) {
      return rowDistrict === district || rowCity === district;
    }
    // Without a city/district identity we refuse national substitution.
    return false;
  });

  if (!scoped.length) {
    return unavailable(
      input,
      `No rent coverage for ${input.city || input.district || 'the requested geography'}. ` +
        'Data from another district or province was not substituted.'
    );
  }

  // 1. Exact area match requires a named city. A district-only request must
  //    not label an arbitrary city's area row as an exact match.
  if (area && city) {
    const exact = scoped.find((row) => norm(row.area) === area && norm(row.city) === city);
    if (exact) {
      return toResult(exact, input, 'exact');
    }
  }

  // 2. Nearby area within the same city/district using coordinates.
  if (isValidCoordinate(input.lat, input.lng)) {
    let best: { row: RentCacheRow; distance: number } | null = null;
    for (const row of scoped) {
      if (!isValidCoordinate(row.lat, row.lng)) continue;
      const distance = haversineDistanceKm(input.lat!, input.lng!, row.lat!, row.lng!);
      if (distance > NEARBY_RENT_MAX_KM) continue;
      if (!best || distance < best.distance) {
        best = { row, distance };
      }
    }
    if (best) {
      return toResult(best.row, input, 'nearby', best.distance, 'low');
    }
  }

  // 3. City/district aggregate computed from all scoped area estimates.
  const aggregate = cityAggregateRow(scoped, input);
  if (aggregate) {
    const matchLevel = !city && district ? 'district' : 'city';
    return toResult(aggregate, input, matchLevel, undefined, 'low');
  }

  return unavailable(input, 'No valid rent source matched the requested geography.');
}

/**
 * Analysis-time rent lookup: reads only from the provided cache rows.
 * Never performs live scraping.
 */
export async function lookupCachedRent(
  fetchRows: () => Promise<RentCacheRow[]>,
  input: RentLookupInput
): Promise<RentLookupResult> {
  try {
    const rows = await fetchRows();
    return lookupRentFromRows(rows, input);
  } catch (err) {
    return unavailable(
      input,
      `Rent cache unavailable: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
