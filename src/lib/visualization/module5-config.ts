/**
 * Central Module 5 visualization thresholds.
 *
 * The checked-in SRS names green/amber/red rent bands and four saturation
 * labels but does not publish numeric cutoffs. The numeric cutoffs below are
 * the pre-Task-6 UI values, retained deliberately and documented in
 * `config/module5-visualization.json`. Nothing here is a market estimate.
 */
export const MODULE5_CONFIG_VERSION = 'v1.0-existing-ui-bands';

export type SemanticColor = 'green' | 'amber' | 'red';

export interface RentBand {
  label: string;
  semanticColor: SemanticColor;
  color: string;
  bg: string;
  minInclusive: number;
  maxExclusive: number | null;
}

export interface SaturationBand {
  label: string;
  color: string;
  bg: string;
  minInclusive: number;
  maxExclusive: number | null;
}

export const RENT_BANDS: readonly RentBand[] = [
  { label: 'Well within budget', semanticColor: 'green', color: '#4edea3', bg: '#4edea322', minInclusive: 0, maxExclusive: 30 },
  { label: 'Comfortable', semanticColor: 'amber', color: '#4cd7f6', bg: '#4cd7f622', minInclusive: 30, maxExclusive: 60 },
  { label: 'Tight — consider negotiating', semanticColor: 'amber', color: '#f59e0b', bg: '#f59e0b22', minInclusive: 60, maxExclusive: 85 },
  { label: 'Over budget', semanticColor: 'red', color: '#ef4444', bg: '#ef444422', minInclusive: 85, maxExclusive: null },
] as const;

export const SATURATION_BANDS: readonly SaturationBand[] = [
  { label: 'Underserved', color: '#4edea3', bg: '#4edea322', minInclusive: 0, maxExclusive: 25 },
  { label: 'Balanced', color: '#4cd7f6', bg: '#4cd7f622', minInclusive: 25, maxExclusive: 50 },
  { label: 'Crowded', color: '#f59e0b', bg: '#f59e0b22', minInclusive: 50, maxExclusive: 75 },
  { label: 'Saturated', color: '#ef4444', bg: '#ef444422', minInclusive: 75, maxExclusive: null },
] as const;

export interface RentIntensityBand {
  key: 'low' | 'moderate' | 'high' | 'veryHigh' | 'single-value';
  label: string;
  color: string;
  maxRatioExclusive: number | null;
}

/** Relative intensity bands for cached area markers, not market thresholds. */
export const RENT_INTENSITY_BANDS: readonly RentIntensityBand[] = [
  { key: 'low', label: 'Low', color: '#4edea3', maxRatioExclusive: 0.25 },
  { key: 'moderate', label: 'Moderate', color: '#4cd7f6', maxRatioExclusive: 0.5 },
  { key: 'high', label: 'High', color: '#f59e0b', maxRatioExclusive: 0.75 },
  { key: 'veryHigh', label: 'Very high', color: '#ef4444', maxRatioExclusive: null },
] as const;

export const OSM_ATTRIBUTION_TEXT = '© OpenStreetMap contributors';
export const OSM_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';
export const OSM_ATTRIBUTION_HTML =
  `© <a href="${OSM_ATTRIBUTION_URL}" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors`;
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAX_MAP_RADIUS_KM = 15;
export const LEAFLET_LOAD_TIMEOUT_MS = 8000;
export const RENT_CACHE_FRESHNESS_DAYS = 7;

function inBand(value: number, band: { minInclusive: number; maxExclusive: number | null }): boolean {
  return value >= band.minInclusive && (band.maxExclusive === null || value < band.maxExclusive);
}

/** Rent percentage bands. `null` for invalid input so the UI can show N/A. */
export function getRentBand(percent: number | null | undefined): RentBand | null {
  if (percent == null || !Number.isFinite(percent) || percent < 0) return null;
  return RENT_BANDS.find((band) => inBand(percent, band)) ?? null;
}

/** Relative intensity within a displayed set of sourced area values. */
export function getRentIntensityBand(
  value: number,
  min: number,
  max: number
): RentIntensityBand | null {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max <= min) return null;
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    RENT_INTENSITY_BANDS.find(
      (band) => band.maxRatioExclusive === null || ratio < band.maxRatioExclusive
    ) ?? RENT_INTENSITY_BANDS[RENT_INTENSITY_BANDS.length - 1]
  );
}

/** Saturation bands after normalization/clamping to 0–100. */
export function getSaturationBand(score: number | null | undefined): SaturationBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  const normalized = Math.max(0, Math.min(100, score));
  return SATURATION_BANDS.find((band) => inBand(normalized, band)) ?? SATURATION_BANDS[SATURATION_BANDS.length - 1];
}
