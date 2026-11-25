import type { DemandTrendRecord } from '@/types/data-collection';
import type { Project } from '@/types/project';
import {
  getRegion,
  PAKISTAN_COUNTRY,
  PAKISTAN_COUNTRY_CODE,
} from '@/lib/geo/pakistan-geography';

/**
 * A trend may feed scoring/display only when it is current and its *actual*
 * geography matches the project. National or stale cached responses remain
 * stored for traceability but must never be presented as local observations.
 */
const USABLE_FRESHNESS = new Set(['live', 'cached', 'verified_benchmark']);

type TrendProject = Pick<
  Project,
  'city' | 'district' | 'region' | 'lat' | 'lng' | 'target_location'
>;

function normalise(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function isUsableDemandTrend(
  trend: DemandTrendRecord | null | undefined,
  project: TrendProject | null | undefined
): boolean {
  if (!trend || !project || trend.is_stale === true) return false;
  if (!USABLE_FRESHNESS.has(String(trend.freshness ?? '').toLowerCase())) return false;

  const scope = normalise(trend.actual_geo_scope);
  if (!scope || scope === 'none') return false;

  const region = getRegion(project.region ?? null);
  const acceptedScopes = [
    project.city,
    project.district,
    project.region,
    project.target_location,
    region?.name,
    region?.code,
  ]
    .map(normalise)
    .filter((value): value is string => value !== null);

  // National results are not local evidence. They are only accepted for a
  // project that is explicitly national and has no local scope of its own.
  if (scope === PAKISTAN_COUNTRY_CODE.toLowerCase() || scope === PAKISTAN_COUNTRY.toLowerCase()) {
    return !acceptedScopes.some((value) => value !== PAKISTAN_COUNTRY.toLowerCase());
  }
  if (acceptedScopes.includes(scope)) return true;

  if (
    project.lat != null &&
    project.lng != null &&
    Number.isFinite(Number(project.lat)) &&
    Number.isFinite(Number(project.lng))
  ) {
    return scope === `${Number(project.lat).toFixed(4)},${Number(project.lng).toFixed(4)}`;
  }

  return false;
}
