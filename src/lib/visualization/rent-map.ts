import type { ConfidenceLevel, DataFreshness, DataProvenance, RentLookupResult } from '@/types/data-collection';
import {
  lookupRentFromRows,
  type RentCacheRow,
  type RentLookupInput,
} from '@/lib/data-collection/rent-lookup';
import { haversineDistanceKm } from '@/lib/geo/distance';
import { finiteNumber, isValidMapCoordinate, isValidMapRadius } from './map-validation';
import { getRentIntensityBand, RENT_CACHE_FRESHNESS_DAYS, type RentIntensityBand } from './module5-config';

export interface RentMapCacheRow extends RentCacheRow {
  id?: string;
}

export interface RentMapProjectInput {
  city?: string | null;
  district?: string | null;
  region?: string | null;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number | null;
}

export interface RentMapArea {
  id?: string;
  area: string;
  city: string;
  district?: string;
  province?: string;
  lat: number;
  lng: number;
  rentMin: number | null;
  rentMax: number | null;
  rentAvg: number;
  currency: string;
  sampleSize: number | null;
  source: string;
  provenance: string;
  freshness: DataFreshness;
  confidence: ConfidenceLevel;
  retrievedAt: string | null;
  isStale: boolean;
  distanceKm: number | null;
  intensityBand: RentIntensityBand | null;
  /** No boundary geometry is stored; markers are centroid indicators only. */
  geometry: null;
  markerType: 'centroid';
  notes?: string;
}

export interface RentMapAggregate {
  area: string;
  city?: string;
  district?: string;
  province?: string;
  rentAvg: number;
  rentMin: number | null;
  rentMax: number | null;
  source: string;
  provenance: string;
  confidence: ConfidenceLevel;
  freshness: DataFreshness;
  sampleSize: number | null;
  notes?: string;
}

export interface RentMapSummary {
  status: 'coverage' | 'no_coverage' | 'unavailable';
  areaCount: number;
  invalidCoordinateCount: number;
  invalidValueCount: number;
  manualEstimateCount: number;
  cachedCount: number;
  licensedCount: number;
  staleCount: number;
  unavailableCount: number;
  cityAggregateAvailable: boolean;
  hasProjectCoordinates: boolean;
  hasValidRadius: boolean;
  radiusKm: number | null;
  newestRetrievedAt: string | null;
  source: 'rent_cache';
}

export interface RentMapPayload {
  projectGeography: {
    city?: string | null;
    district?: string | null;
    province?: string | null;
    lat?: number | null;
    lng?: number | null;
    radiusKm?: number | null;
  };
  status: RentMapSummary['status'];
  areas: RentMapArea[];
  aggregate: RentMapAggregate | null;
  matchedRent: RentLookupResult;
  summary: RentMapSummary;
}

function norm(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function isInScope(row: RentMapCacheRow, project: RentMapProjectInput): boolean {
  const projectProvince = norm(project.region);
  const rowProvince = norm(row.province);
  if (projectProvince) {
    // Do not accept rows whose province is unknown when the project names one.
    if (!rowProvince || rowProvince !== projectProvince) return false;
  }

  const projectCity = norm(project.city);
  const projectDistrict = norm(project.district || project.city);
  const rowCity = norm(row.city);
  const rowDistrict = norm(row.district || row.city);
  if (projectCity) {
    if (rowCity !== projectCity && rowDistrict !== projectCity && rowDistrict !== projectDistrict) {
      return false;
    }
  } else if (projectDistrict) {
    if (rowDistrict !== projectDistrict && rowCity !== projectDistrict) return false;
  } else {
    // Without a city/district identity no cached row is safely "nearby".
    return false;
  }
  return true;
}

export function deriveRentFreshness(row: RentMapCacheRow, now: Date = new Date()): {
  freshness: DataFreshness;
  isStale: boolean;
  retrievedAt: string | null;
} {
  const provenance = (row.provenance || 'manual_estimate') as DataProvenance;
  const retrievedAt = row.recorded_at || row.scraped_at || null;
  const timestamp = retrievedAt ? Date.parse(retrievedAt) : Number.NaN;
  const ageDays = Number.isFinite(timestamp) ? (now.getTime() - timestamp) / 86400000 : null;
  const isStale = ageDays !== null && ageDays > RENT_CACHE_FRESHNESS_DAYS;

  if (provenance === 'manual_estimate') return { freshness: 'manual_estimate', isStale, retrievedAt };
  if (provenance === 'licensed_dataset') return { freshness: 'verified_benchmark', isStale, retrievedAt };
  if (provenance === 'synthetic_demo') return { freshness: 'synthetic_demo', isStale, retrievedAt };
  if (!retrievedAt || ageDays === null) return { freshness: 'unavailable', isStale: false, retrievedAt };
  return { freshness: isStale ? 'stale_cache' : 'cached', isStale, retrievedAt };
}

function buildAggregate(
  matched: RentLookupResult,
  scopedRows: RentMapCacheRow[],
  now: Date
): RentMapAggregate | null {
  if (matched.status !== 'found' || !['city', 'district'].includes(matched.match_level)) return null;
  const freshness = deriveRentFreshness({ city: '', area: '', rent_per_sqft_pkr: 0, scraped_at: matched.retrieved_at }, now);
  return {
    area: matched.source_geography?.area || 'city/district aggregate',
    city: matched.source_geography?.city,
    district: matched.source_geography?.district,
    province: matched.source_geography?.province,
    rentAvg: finiteNumber(matched.rent_avg_pkr) ?? 0,
    rentMin: finiteNumber(matched.rent_min_pkr),
    rentMax: finiteNumber(matched.rent_max_pkr),
    source: matched.source || 'rent_cache aggregated area estimates',
    provenance: String(matched.provenance),
    confidence: matched.confidence,
    freshness: provenanceFreshness(String(matched.provenance), freshness.freshness),
    sampleSize: finiteNumber(matched.sample_size),
    notes: matched.notes,
  };
}

function provenanceFreshness(provenance: string, fallback: DataFreshness): DataFreshness {
  if (provenance === 'manual_estimate') return 'manual_estimate';
  if (provenance === 'licensed_dataset') return 'verified_benchmark';
  if (provenance === 'synthetic_demo') return 'synthetic_demo';
  return fallback;
}

/**
 * Build an honest area-point overlay from stored rent_cache rows only.
 * No live scraping, no polygon geometry, no cross-province/city substitution.
 */
export function buildRentMap(
  rows: RentMapCacheRow[],
  project: RentMapProjectInput,
  now: Date = new Date()
): RentMapPayload {
  const projectGeography = {
    city: project.city ?? null,
    district: project.district ?? null,
    province: project.region ?? null,
    lat: project.lat ?? null,
    lng: project.lng ?? null,
    radiusKm: project.radiusKm ?? null,
  };

  const summary: RentMapSummary = {
    status: 'unavailable',
    areaCount: 0,
    invalidCoordinateCount: 0,
    invalidValueCount: 0,
    manualEstimateCount: 0,
    cachedCount: 0,
    licensedCount: 0,
    staleCount: 0,
    unavailableCount: 0,
    cityAggregateAvailable: false,
    hasProjectCoordinates: isValidMapCoordinate(project.lat, project.lng),
    hasValidRadius: isValidMapRadius(project.radiusKm),
    radiusKm: isValidMapRadius(project.radiusKm) ? project.radiusKm : null,
    newestRetrievedAt: null,
    source: 'rent_cache',
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    const input: RentLookupInput = {
      city: project.city ?? undefined,
      district: project.district ?? undefined,
      province: project.region ?? undefined,
      lat: summary.hasProjectCoordinates ? Number(project.lat) : undefined,
      lng: summary.hasProjectCoordinates ? Number(project.lng) : undefined,
    };
    return {
      projectGeography,
      status: 'unavailable',
      areas: [],
      aggregate: null,
      matchedRent: lookupRentFromRows([], input),
      summary,
    };
  }

  const scoped = rows.filter((row) => isInScope(row, project));
  const input: RentLookupInput = {
    city: project.city ?? undefined,
    district: project.district ?? undefined,
    province: project.region ?? undefined,
    lat: summary.hasProjectCoordinates ? Number(project.lat) : undefined,
    lng: summary.hasProjectCoordinates ? Number(project.lng) : undefined,
  };
  // When strict scoping removes every row, pass the original rows to the
  // existing lookup only so its explicit "not substituted" audit note is
  // preserved. Its own geography guard still refuses the unrelated rows.
  const matchedRent = lookupRentFromRows(scoped.length > 0 ? scoped : rows, input);
  const validValues = scoped
    .map((row) => ({
      ...row,
      rentAvg: finiteNumber(row.rent_avg_pkr ?? row.rent_per_sqft_pkr),
    }))
    .filter((row) => row.rentAvg !== null && row.rentAvg >= 0);
  summary.invalidValueCount = scoped.length - validValues.length;

  const candidates: (RentMapArea & { sortKey: number })[] = [];
  for (const row of validValues) {
    const freshnessInfo = deriveRentFreshness(row, now);
    if (freshnessInfo.freshness === 'manual_estimate') summary.manualEstimateCount += 1;
    if (freshnessInfo.freshness === 'cached' || freshnessInfo.freshness === 'stale_cache') summary.cachedCount += 1;
    if (row.provenance === 'licensed_dataset') summary.licensedCount += 1;
    if (freshnessInfo.isStale) summary.staleCount += 1;
    if (freshnessInfo.freshness === 'unavailable') summary.unavailableCount += 1;
    if (freshnessInfo.retrievedAt && (!summary.newestRetrievedAt || freshnessInfo.retrievedAt > summary.newestRetrievedAt)) {
      summary.newestRetrievedAt = freshnessInfo.retrievedAt;
    }

    if (!isValidMapCoordinate(row.lat, row.lng)) {
      summary.invalidCoordinateCount += 1;
      continue;
    }

    let distanceKm: number | null = null;
    if (summary.hasProjectCoordinates) {
      distanceKm = haversineDistanceKm(
        Number(project.lat),
        Number(project.lng),
        Number(row.lat),
        Number(row.lng)
      );
      if (summary.hasValidRadius && distanceKm > summary.radiusKm!) continue;
    }

    candidates.push({
      id: row.id,
      area: row.area,
      city: row.city,
      district: row.district ?? undefined,
      province: row.province ?? undefined,
      lat: Number(row.lat),
      lng: Number(row.lng),
      rentMin: finiteNumber(row.rent_min_pkr),
      rentMax: finiteNumber(row.rent_max_pkr),
      rentAvg: row.rentAvg as number,
      currency: row.currency || 'PKR',
      sampleSize: finiteNumber(row.sample_size),
      source: row.source || 'rent_cache',
      provenance: row.provenance || 'manual_estimate',
      freshness: freshnessInfo.freshness,
      confidence: (row.confidence as ConfidenceLevel) || 'low',
      retrievedAt: freshnessInfo.retrievedAt,
      isStale: freshnessInfo.isStale,
      distanceKm,
      intensityBand: null,
      geometry: null,
      markerType: 'centroid',
      notes: row.notes ?? undefined,
      sortKey: distanceKm ?? 0,
    });
  }

  const values = candidates.map((area) => area.rentAvg);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const areas = candidates
    .sort((a, b) => a.sortKey - b.sortKey || a.area.localeCompare(b.area))
    .map(({ sortKey, ...area }) => {
      void sortKey; // Consumed only by the deterministic sort above.
      return {
        ...area,
        intensityBand: getRentIntensityBand(area.rentAvg, min, max),
      };
    });

  const aggregate = buildAggregate(matchedRent, scoped, now);
  summary.areaCount = areas.length;
  summary.cityAggregateAvailable = aggregate !== null;
  summary.status = areas.length > 0 || aggregate ? 'coverage' : 'no_coverage';

  return { projectGeography, status: summary.status, areas, aggregate, matchedRent, summary };
}
