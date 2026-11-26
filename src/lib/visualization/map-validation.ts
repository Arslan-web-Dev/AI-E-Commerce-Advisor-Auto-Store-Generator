import { MAX_MAP_RADIUS_KM } from './module5-config';

/** Finite number or null. Never coerces null, NaN or Infinity into a map value. */
export function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Valid finite map coordinates. Zero is not rejected merely because it is
 * falsy; only the (0, 0) Null Island pair is refused as a project location.
 */
export function isValidMapCoordinate(lat: unknown, lng: unknown): boolean {
  const a = finiteNumber(lat);
  const b = finiteNumber(lng);
  if (a === null || b === null) return false;
  if (a === 0 && b === 0) return false; // Null Island is not a project location.
  return a >= -90 && a <= 90 && b >= -180 && b <= 180;
}

/** Radius must be finite, positive and within the configured provider cap. */
export function isValidMapRadius(radiusKm: unknown): radiusKm is number {
  const radius = finiteNumber(radiusKm);
  return radius !== null && radius > 0 && radius <= MAX_MAP_RADIUS_KM;
}

export function sanitizeMapText(value: unknown, maxLength = 160): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export type MapStatus = 'loading' | 'ready' | 'failed' | 'invalid' | 'no-data';

export function getMapStatusMessage(status: MapStatus): string {
  switch (status) {
    case 'loading':
      return 'Loading OpenStreetMap map…';
    case 'failed':
      return 'The map provider could not be loaded. No substitute or fabricated map is shown.';
    case 'invalid':
      return 'Project coordinates are invalid, so no map is drawn.';
    case 'no-data':
      return 'No in-scope map observations are stored for this project.';
    default:
      return '';
  }
}

export function formatMapNumber(value: number | null | undefined, digits = 2): string {
  const number = finiteNumber(value);
  return number === null ? 'N/A' : number.toFixed(digits);
}
