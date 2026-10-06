import { CompetitorRecord } from '@/types/data-collection';
import { DeduplicationStats } from '@/types/feature-processing';

/**
 * Calculates great-circle distance between two coordinates in kilometers using Haversine formula.
 */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Normalizes a brand / business name for deduplication.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deduplicates competitor POIs based on spatial proximity (< 50 meters)
 * or identical brand name within 1.0 km radius.
 */
export function deduplicateCompetitors(records: CompetitorRecord[]): {
  deduplicated: CompetitorRecord[];
  stats: DeduplicationStats;
} {
  const raw_count = records.length;
  if (raw_count <= 1) {
    return {
      deduplicated: [...records],
      stats: {
        raw_count,
        unique_count: raw_count,
        duplicates_removed: 0,
      },
    };
  }

  const kept: CompetitorRecord[] = [];

  for (const current of records) {
    const currentName = normalizeName(current.name);
    let isDuplicate = false;

    for (let i = 0; i < kept.length; i++) {
      const existing = kept[i];
      const distKm = calculateDistanceKm(
        current.lat,
        current.lng,
        existing.lat,
        existing.lng
      );
      const existingName = normalizeName(existing.name);

      // Rule 1: Very close geographic proximity (< 50 meters / 0.05 km)
      const isGeographicallySame = distKm < 0.05;

      // Rule 2: Same normalized name within 1.0 km
      const isSameBrandCluster = currentName === existingName && distKm < 1.0;

      if (isGeographicallySame || isSameBrandCluster) {
        isDuplicate = true;
        // Merge richer metadata if current has rating/review and existing doesn't
        if ((current.review_count || 0) > (existing.review_count || 0)) {
          kept[i] = {
            ...existing,
            rating: current.rating || existing.rating,
            review_count: current.review_count || existing.review_count,
            price_level: current.price_level || existing.price_level,
            address: current.address || existing.address,
          };
        }
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(current);
    }
  }

  const unique_count = kept.length;
  const duplicates_removed = raw_count - unique_count;

  return {
    deduplicated: kept,
    stats: {
      raw_count,
      unique_count,
      duplicates_removed,
    },
  };
}
