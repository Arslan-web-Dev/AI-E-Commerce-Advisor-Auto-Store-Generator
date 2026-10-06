import {
  CompetitorRecord,
  CompetitorQueryInput,
  ICompetitorProvider,
} from '../../../types/data-collection';

const OVERPASS_ENDPOINTS = [
  process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const CATEGORY_TAG_MAP: Record<string, string> = {
  'Apparel & Fashion': 'clothes|boutique|shoes|tailor|department_store|fashion',
  'Consumer Electronics': 'electronics|mobile_phone|computer|telecommunication|hardware',
  'Cosmetics & Skincare': 'chemist|beauty|perfumery|cosmetics|hairdresser',
  'Grocery & Gourmet Food': 'supermarket|convenience|grocery|organic|bakery|deli|spices',
  'Home Decor & Living': 'furniture|interior_decoration|houseware|carpet|curtain|kitchen',
  'Other Niche Venture': 'yes|general|kiosk|speciality',
};

function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export class OverpassCompetitorProvider implements ICompetitorProvider {
  name = 'overpass_osm';
  provenance = 'external_api' as const;

  async getCompetitors(input: CompetitorQueryInput): Promise<CompetitorRecord[]> {
    const radiusMeters = Math.min(25000, Math.max(1000, Math.round(input.radiusKm * 1000)));
    const tagRegex = CATEGORY_TAG_MAP[input.category] || 'yes';

    const query = `
      [out:json][timeout:15];
      (
        node["shop"~"${tagRegex}"](around:${radiusMeters},${input.lat},${input.lng});
        way["shop"~"${tagRegex}"](around:${radiusMeters},${input.lat},${input.lng});
      );
      out center 35;
    `;

    const timeoutMs = parseInt(process.env.OVERPASS_API_TIMEOUT_MS || '12000', 10);
    let lastError: Error | null = null;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'AIECommerceFeasibilityAdvisor/2.0 (Academic FYP; COMSATS University)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Overpass HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const elements = data.elements || [];

        const records: CompetitorRecord[] = [];
        const seenNames = new Set<string>();

        for (const el of elements) {
          const lat = el.lat || el.center?.lat;
          const lng = el.lon || el.center?.lon;
          if (!lat || !lng) continue;

          const tags = el.tags || {};
          const name = tags.name || tags['name:en'] || tags.brand || `${input.category} Merchant #${el.id}`;

          if (seenNames.has(name.toLowerCase())) continue;
          seenNames.add(name.toLowerCase());

          const distanceKm = calculateHaversineDistance(input.lat, input.lng, lat, lng);

          records.push({
            project_id: '',
            name,
            category: tags.shop || input.category,
            provider: this.name,
            provenance: this.provenance,
            lat,
            lng,
            distance_km: distanceKm,
            rating: tags.stars ? parseFloat(tags.stars) : undefined,
            review_count: tags.check_date ? 12 : undefined,
            price_level: tags.fee === 'no' ? 'Budget' : 'Moderate',
            address: tags['addr:street'] ? `${tags['addr:street']}, ${tags['addr:city'] || input.city || ''}`.trim() : undefined,
            raw_data: {
              osm_id: el.id,
              osm_type: el.type,
              tags: el.tags,
            },
            retrieved_at: new Date().toISOString(),
          });
        }

        // Sort by distance ascending
        records.sort((a, b) => a.distance_km - b.distance_km);
        return records;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Continue to alternate endpoint
      }
    }

    throw new Error(`All Overpass OSM endpoints failed. Last error: ${lastError?.message}`);
  }
}
