import type {
  CompetitorRecord,
  CompetitorQueryInput,
  ICompetitorProvider,
} from '../../../types/data-collection';
import { haversineDistanceKm, isValidCoordinate } from '../../geo/distance';

export const OVERPASS_QUERY_VERSION = 'v2-shop-amenity';
export const OVERPASS_ATTRIBUTION = '© OpenStreetMap contributors';
export const MAX_PROJECT_RADIUS_KM = 15;
export const MIN_PROJECT_RADIUS_KM = 1;

export const DEFAULT_OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Accurate OSM tag mappings for the five approved categories.
 * Restaurants/cafes and pharmacies primarily use amenity=* in OSM;
 * retail categories use shop=*.
 */
export const CATEGORY_OSM_TAG_MAP: Record<
  string,
  { shop?: string[]; amenity?: string[] }
> = {
  'Grocery / General Stores': {
    shop: ['supermarket', 'convenience', 'grocery', 'greengrocer', 'bakery', 'deli', 'general', 'butcher'],
  },
  'Clothing / Footwear': {
    shop: ['clothes', 'shoes', 'boutique', 'tailor', 'fashion_accessories', 'bag', 'jewelry', 'fabric'],
  },
  'Mobile Phones / Accessories': {
    shop: ['mobile_phone', 'electronics', 'telecommunication', 'computer', 'hifi'],
  },
  'Restaurants / Cafes': {
    amenity: ['restaurant', 'cafe', 'fast_food', 'food_court', 'ice_cream', 'biergarten'],
    shop: ['coffee', 'pastry'],
  },
  'Pharmacies / Medical Stores': {
    amenity: ['pharmacy'],
    shop: ['chemist', 'medical_supply', 'optician', 'hearing_aids'],
  },
};

export function getOverpassEndpoints(): string[] {
  const primary = process.env.OVERPASS_API_URL?.trim();
  const endpoints = primary
    ? [primary, ...DEFAULT_OVERPASS_ENDPOINTS.filter((e) => e !== primary)]
    : [...DEFAULT_OVERPASS_ENDPOINTS];
  return endpoints;
}

export function clampRadiusKm(radiusKm: number): number {
  if (!Number.isFinite(radiusKm)) return 10;
  return Math.min(MAX_PROJECT_RADIUS_KM, Math.max(MIN_PROJECT_RADIUS_KM, radiusKm));
}

export function buildOverpassQuery(
  category: string,
  lat: number,
  lng: number,
  radiusKm: number
): string {
  const radiusMeters = Math.round(clampRadiusKm(radiusKm) * 1000);
  const mapping = CATEGORY_OSM_TAG_MAP[category];
  const clauses: string[] = [];

  if (mapping?.shop?.length) {
    const shopRegex = mapping.shop.join('|');
    clauses.push(`node["shop"~"^(${shopRegex})$"](around:${radiusMeters},${lat},${lng});`);
    clauses.push(`way["shop"~"^(${shopRegex})$"](around:${radiusMeters},${lat},${lng});`);
  }
  if (mapping?.amenity?.length) {
    const amenityRegex = mapping.amenity.join('|');
    clauses.push(`node["amenity"~"^(${amenityRegex})$"](around:${radiusMeters},${lat},${lng});`);
    clauses.push(`way["amenity"~"^(${amenityRegex})$"](around:${radiusMeters},${lat},${lng});`);
  }

  // Unknown category: refuse to run an unbounded shop=* query.
  if (clauses.length === 0) {
    throw new Error(`No OpenStreetMap tag mapping for category "${category}"`);
  }

  return `
    [out:json][timeout:20];
    (
      ${clauses.join('\n      ')}
    );
    out center;
  `;
}

export function osmIdentityKey(osmType: string | undefined, osmId: number | string | undefined): string | null {
  if (osmType == null || osmId == null || osmId === '') return null;
  return `${String(osmType).toLowerCase()}/${String(osmId)}`;
}

function parseOptionalRating(tags: Record<string, string>): number | undefined {
  const raw = tags.stars ?? tags.rating;
  if (raw == null || raw === '') return undefined;
  const value = Number.parseFloat(String(raw));
  if (!Number.isFinite(value) || value < 0 || value > 5) return undefined;
  return Math.round(value * 10) / 10;
}

function buildAddress(tags: Record<string, string>, fallbackCity?: string): string | undefined {
  const parts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] || tags['addr:neighbourhood'],
    tags['addr:city'] || fallbackCity,
  ].filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.join(', ');
}

export interface OverpassElement {
  type?: string;
  id?: number | string;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

/**
 * Parse and validate Overpass elements into competitor records.
 * Deduplicates by OSM identity (type/id), never by name alone.
 * Does not invent business names, ratings, or review counts.
 */
export function parseOverpassElements(
  elements: OverpassElement[],
  input: CompetitorQueryInput,
  options?: { retrievedAt?: string; provider?: string }
): CompetitorRecord[] {
  const retrievedAt = options?.retrievedAt || new Date().toISOString();
  const provider = options?.provider || 'overpass_osm';
  const records: CompetitorRecord[] = [];
  const seenIds = new Set<string>();

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !isValidCoordinate(lat, lng)) {
      continue;
    }

    const identity = osmIdentityKey(el.type, el.id);
    if (!identity) continue;
    if (seenIds.has(identity)) continue;
    seenIds.add(identity);

    const tags = el.tags || {};
    const name =
      tags.name?.trim() ||
      tags['name:en']?.trim() ||
      tags.brand?.trim() ||
      'Unnamed business';

    const osmCategory = tags.shop || tags.amenity || input.category;
    const distanceKm = haversineDistanceKm(input.lat, input.lng, lat, lng);
    if (distanceKm > clampRadiusKm(input.radiusKm)) continue;

    const rating = parseOptionalRating(tags);

    records.push({
      project_id: '',
      name,
      category: osmCategory,
      provider,
      provenance: 'external_api',
      freshness: 'live',
      lat,
      lng,
      distance_km: distanceKm,
      rating,
      // OSM does not provide reliable review counts — leave undefined.
      review_count: undefined,
      price_level: undefined,
      address: buildAddress(tags, input.city),
      raw_data: {
        osm_id: el.id,
        osm_type: el.type,
        osm_identity: identity,
        tags,
        attribution: OVERPASS_ATTRIBUTION,
        query_version: OVERPASS_QUERY_VERSION,
      },
      retrieved_at: retrievedAt,
      attribution: OVERPASS_ATTRIBUTION,
    });
  }

  records.sort((a, b) => a.distance_km - b.distance_km);
  return records;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class OverpassCompetitorProvider implements ICompetitorProvider {
  name = 'overpass_osm';
  provenance = 'external_api' as const;

  async getCompetitors(input: CompetitorQueryInput): Promise<CompetitorRecord[]> {
    if (!isValidCoordinate(input.lat, input.lng)) {
      throw new Error('Invalid project coordinates for Overpass competitor search');
    }
    if (!CATEGORY_OSM_TAG_MAP[input.category]) {
      throw new Error(`Unsupported competitor category: ${input.category}`);
    }

    const query = buildOverpassQuery(input.category, input.lat, input.lng, input.radiusKm);
    const timeoutMs = Number.parseInt(process.env.OVERPASS_API_TIMEOUT_MS || '12000', 10);
    const endpoints = getOverpassEndpoints();
    const maxAttemptsPerEndpoint = 2;
    let lastError: Error | null = null;

    for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
      const endpoint = endpoints[endpointIndex];

      for (let attempt = 0; attempt < maxAttemptsPerEndpoint; attempt++) {
        if (attempt > 0) {
          const backoffMs = Math.min(4000, 400 * 2 ** (attempt - 1));
          await sleep(backoffMs);
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'AIECommerceFeasibilityAdvisor/2.0 (Academic FYP; COMSATS University)',
              },
              body: `data=${encodeURIComponent(query)}`,
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error(`Overpass HTTP ${response.status}: ${response.statusText}`);
            }

            const data = (await response.json()) as { elements?: OverpassElement[] };
            if (!data || !Array.isArray(data.elements)) {
              throw new Error('Overpass response missing elements array');
            }

            return parseOverpassElements(data.elements, input, {
              retrievedAt: new Date().toISOString(),
              provider: this.name,
            });
          } finally {
            // Always clear the request timer, including aborted/failed requests.
            clearTimeout(timeoutId);
          }
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));
          // Retry same endpoint on transient failures; otherwise move on.
          const message = lastError.message.toLowerCase();
          const transient =
            message.includes('abort') ||
            message.includes('429') ||
            message.includes('504') ||
            message.includes('502') ||
            message.includes('503') ||
            message.includes('fetch failed') ||
            message.includes('network');
          if (!transient) break;
        }
      }
    }

    throw new Error(
      `All Overpass OSM endpoints failed. Last error: ${lastError?.message || 'unknown'}`
    );
  }
}

/** @deprecated Use haversineDistanceKm from geo/distance — kept for older imports/tests. */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistanceKm(lat1, lon1, lat2, lon2);
}

/** @deprecated Prefer CATEGORY_OSM_TAG_MAP */
export const CATEGORY_TAG_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_OSM_TAG_MAP).map(([category, mapping]) => [
    category,
    [...(mapping.shop || []), ...(mapping.amenity || [])].join('|'),
  ])
);
