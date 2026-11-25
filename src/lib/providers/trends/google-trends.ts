import type {
  DemandTrendRecord,
  DemandTrendPoint,
  DemandTrendQueryInput,
  IDemandTrendProvider,
  DataProvenance,
  DataFreshness,
} from '../../../types/data-collection';
import { CoverageUnavailableError } from '../../../types/data-collection';
import { mlClient } from '../../ml-client';
import type { GoogleTrendsResult } from '../../ml-client';
import { getRegion, PAKISTAN_COUNTRY_CODE } from '../../geo/pakistan-geography';

/**
 * Punjab-only seasonal demonstration curves.
 * Used solely when:
 *   1. live + fresh/stale cache retrieval both fail, AND
 *   2. the requested region has verified coverage (Punjab).
 * Never applied as local evidence for other Pakistani regions.
 */
const PUNJAB_CATEGORY_TREND_CURVES: Record<
  string,
  { baseline: number[]; slope: 'growing' | 'stable' | 'declining' }
> = {
  'Grocery / General Stores': {
    baseline: [65, 62, 88, 98, 72, 68, 64, 66, 70, 75, 85, 89],
    slope: 'stable',
  },
  'Clothing / Footwear': {
    baseline: [62, 58, 74, 96, 70, 65, 82, 91, 75, 68, 72, 85],
    slope: 'growing',
  },
  'Mobile Phones / Accessories': {
    baseline: [55, 52, 58, 61, 59, 63, 60, 66, 72, 88, 95, 84],
    slope: 'growing',
  },
  'Restaurants / Cafes': {
    baseline: [58, 60, 66, 71, 68, 64, 70, 76, 79, 82, 86, 90],
    slope: 'growing',
  },
  'Pharmacies / Medical Stores': {
    baseline: [66, 68, 74, 78, 72, 70, 69, 72, 76, 80, 85, 88],
    slope: 'stable',
  },
};

/** @deprecated Prefer PUNJAB_CATEGORY_TREND_CURVES — kept for Task 3 tests. */
export const CATEGORY_TREND_CURVES = PUNJAB_CATEGORY_TREND_CURVES;

export function validateMonthlyTrendPoints(points: DemandTrendPoint[]): DemandTrendPoint[] {
  const valid = points.filter((p) => {
    if (!p.month || !/^\d{4}-\d{2}$/.test(p.month)) return false;
    if (!Number.isFinite(p.index) || p.index < 0 || p.index > 100) return false;
    return true;
  });

  // Collapse duplicate months by keeping the last observation.
  const byMonth = new Map<string, DemandTrendPoint>();
  for (const point of valid) {
    byMonth.set(point.month, point);
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function mapTrendSeries(
  response: GoogleTrendsResult,
  category: string
): DemandTrendPoint[] {
  const points: DemandTrendPoint[] = response.interest_over_time.map((item) => {
    const monthRaw = String(item.date || item.month || '').slice(0, 7);
    const index = Number(item[category] ?? item.index);
    return { month: monthRaw, index: Number.isFinite(index) ? index : NaN };
  });
  return validateMonthlyTrendPoints(points);
}

function slopeFromAnalytics(
  analytics: GoogleTrendsResult['analytics'][string] | undefined
): 'growing' | 'stable' | 'declining' {
  if (!analytics) return 'stable';
  if (analytics.trend_direction === 'rising' || analytics.trend_direction === 'rapidly_rising') {
    return 'growing';
  }
  if (analytics.trend_direction === 'falling' || analytics.trend_direction === 'rapidly_falling') {
    return 'declining';
  }
  return 'stable';
}

function buildPunjabSyntheticFallback(
  category: string,
  regionCode: string
): DemandTrendRecord {
  const curve = PUNJAB_CATEGORY_TREND_CURVES[category];
  if (!curve) {
    throw new CoverageUnavailableError(
      `No verified demand-trend coverage for category "${category}" in Punjab.`
    );
  }

  const points: DemandTrendPoint[] = [];
  const today = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    points.push({
      month: monthStr,
      index: Math.min(100, Math.max(0, curve.baseline[11 - i])),
    });
  }

  const sum = points.reduce((acc, p) => acc + p.index, 0);
  return {
    project_id: '',
    category,
    region: regionCode,
    trend_series: points,
    avg_interest: Math.round((sum / points.length) * 10) / 10,
    trend_slope: curve.slope,
    provider: 'punjab_seasonal_benchmark_fallback',
    provenance: 'synthetic_demo',
    freshness: 'synthetic_demo',
    requested_geo_scope: regionCode,
    actual_geo_scope: regionCode,
    retrieved_at: new Date().toISOString(),
    is_stale: false,
  };
}

export class GoogleTrendsProvider implements IDemandTrendProvider {
  name = 'google_pytrends_market_service';
  provenance: DataProvenance = 'external_api';

  async getDemandTrends(input: DemandTrendQueryInput): Promise<DemandTrendRecord> {
    const region = getRegion(input.region);
    const requestedRegion = input.region?.trim() || '';
    const isPakistanWide = /^(pk|pakistan|pakistan[- ]?wide)$/i.test(requestedRegion);

    // Never silently widen an unrecognised locality to national trends: that
    // would report Pakistan-wide data as if it were local evidence.
    if (!region && !isPakistanWide) {
      throw new CoverageUnavailableError(
        `No verified demand-trend coverage for "${requestedRegion || 'unspecified region'}". ` +
          'Recognise the region or request Pakistan-wide coverage explicitly.'
      );
    }

    const requestedScope = region?.code ?? PAKISTAN_COUNTRY_CODE;
    const geoCode = region?.code ?? PAKISTAN_COUNTRY_CODE;

    try {
      const response = await mlClient.getTrends([input.category], geoCode, 'today 12-m');
      const points = mapTrendSeries(response, input.category);

      if (points.length >= 6) {
        const analytics = response.analytics?.[input.category];
        const avgInterest =
          analytics?.average_interest ??
          Math.round((points.reduce((a, p) => a + p.index, 0) / points.length) * 10) / 10;

        const actualScope = String(response.geo || geoCode).toUpperCase();
        const expectedScope = (isPakistanWide ? PAKISTAN_COUNTRY_CODE : geoCode).toUpperCase();
        if (actualScope !== expectedScope) {
          throw new CoverageUnavailableError(
            `Trend provider returned ${actualScope} for a ${expectedScope} request; ` +
              'the response was not accepted as regional evidence.'
          );
        }

        const isEmpirical = response.source === 'empirical_market_baseline';
        if (isEmpirical && !region?.analysis_enabled) {
          throw new CoverageUnavailableError(
            `Empirical benchmark data is not verified local coverage for "${requestedRegion}".`
          );
        }

        const freshness: DataFreshness = isEmpirical
          ? 'synthetic_demo'
          : response.is_stale
          ? 'stale_cache'
          : response.is_cached
          ? 'cached'
          : 'live';

        const provenance: DataProvenance = isEmpirical ? 'synthetic_demo' : 'external_api';

        return {
          project_id: '',
          category: input.category,
          region: response.geo || geoCode,
          trend_series: points.slice(-12),
          avg_interest: avgInterest,
          trend_slope: slopeFromAnalytics(analytics),
          provider: isEmpirical ? 'empirical_market_baseline_fallback' : this.name,
          provenance,
          freshness,
          requested_geo_scope: requestedScope,
          actual_geo_scope: actualScope,
          retrieved_at: response.fetched_at || new Date().toISOString(),
          cache_retrieved_at: response.is_cached || response.is_stale ? new Date().toISOString() : undefined,
          is_stale: Boolean(response.is_stale),
        };
      }
    } catch (err) {
      if (err instanceof CoverageUnavailableError) throw err;
      console.warn('Live/stale Pytrends retrieval failed:', err);
    }

    // Punjab seasonal curves only for verified Punjab coverage.
    if (region?.analysis_enabled) {
      return buildPunjabSyntheticFallback(input.category, region.code);
    }

    throw new CoverageUnavailableError(
      `No verified demand-trend coverage for "${input.region || 'unrecognised region'}". ` +
        'Live search-trend data was unavailable and Punjab seasonal benchmarks are not substituted for other regions.'
    );
  }
}
