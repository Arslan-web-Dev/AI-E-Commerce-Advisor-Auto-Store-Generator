import {
  DemandTrendRecord,
  DemandTrendPoint,
  DemandTrendQueryInput,
  IDemandTrendProvider,
  DataProvenance,
  CoverageUnavailableError,
} from '../../../types/data-collection';
import { mlClient } from '../../ml-client';
import { getRegion, PAKISTAN_COUNTRY_CODE } from '../../geo/pakistan-geography';

// Punjab-derived seasonal 12-month relative search volume pattern (0-100 scale).
// This is Punjab *coverage* data: it must never be presented as another region's
// local trend (see the coverage guard in `getDemandTrends`).
// Keys are the five approved Task 3 category names (Task 3 §3) and must match
// PREDEFINED_CATEGORIES exactly.
const CATEGORY_TREND_CURVES: Record<string, { baseline: number[]; slope: 'growing' | 'stable' | 'declining' }> = {
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

// Neutral fallback used only if an unrecognised category name reaches the
// provider. Any recognised (approved) category always resolves to its own curve.
const FALLBACK_TREND_CURVE = {
  baseline: [50, 52, 51, 55, 53, 54, 52, 56, 58, 60, 59, 62],
  slope: 'stable' as const,
};

export class GoogleTrendsProvider implements IDemandTrendProvider {
  name = 'google_pytrends_market_service';
  provenance: DataProvenance = 'external_api';

  async getDemandTrends(input: DemandTrendQueryInput): Promise<DemandTrendRecord> {
    const region = getRegion(input.region);
    // Google Trends geo: the requested region's ISO 3166-2 code when recognised,
    // otherwise the national Pakistan code. Never a fixed Punjab code.
    const geoCode = region?.code ?? PAKISTAN_COUNTRY_CODE;

    try {
      // Live fetch from the nationwide-capable Python ML / Market service.
      const response = await mlClient.getTrends([input.category], geoCode);
      if (response && response.interest_over_time && response.interest_over_time.length > 0) {
        const points: DemandTrendPoint[] = response.interest_over_time.map((item: Record<string, unknown>) => ({
          month: String(item.date || item.month || '').slice(0, 7),
          index: Number(item[input.category] ?? item.index ?? 50),
        }));

        const analytics = response.analytics?.[input.category];
        const avgInterest = analytics?.average_interest ?? 50;
        const slope = analytics?.trend_direction === 'rising' || analytics?.trend_direction === 'rapidly_rising'
          ? 'growing'
          : analytics?.trend_direction === 'falling' || analytics?.trend_direction === 'rapidly_falling'
          ? 'declining'
          : 'stable';

        return {
          project_id: '',
          category: input.category,
          region: response.geo || geoCode,
          trend_series: points,
          avg_interest: avgInterest,
          trend_slope: slope,
          provider: this.name,
          provenance: 'external_api',
          retrieved_at: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('Live Pytrends fetch failed, falling back to calibrated seasonal benchmark:', err);
    }

    // The curated curves below are Punjab coverage data. They may only be used
    // for a region with verified coverage (currently Punjab). Any other region
    // gets an explicit coverage-unavailable signal rather than Punjab trends.
    if (!region || !region.analysis_enabled) {
      throw new CoverageUnavailableError(
        `No verified demand-trend coverage for "${input.region || 'unrecognised region'}". ` +
          'Live search-trend data was unavailable and Punjab seasonal benchmarks are not substituted for other regions.'
      );
    }

    // Graceful fallback to verified seasonal Punjab patterns (Punjab coverage).
    const curve = CATEGORY_TREND_CURVES[input.category] || FALLBACK_TREND_CURVE;
    const points: DemandTrendPoint[] = [];
    const today = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const monthStr = `${year}-${month}`;

      const rawVal = curve.baseline[11 - i];
      points.push({
        month: monthStr,
        index: Math.min(100, Math.max(10, rawVal)),
      });
    }

    const sum = points.reduce((acc, p) => acc + p.index, 0);
    const avgInterest = Math.round((sum / points.length) * 10) / 10;

    return {
      project_id: '',
      category: input.category,
      region: region.code,
      trend_series: points,
      avg_interest: avgInterest,
      trend_slope: curve.slope,
      provider: 'seasonal_benchmark_fallback',
      provenance: 'synthetic_demo',
      retrieved_at: new Date().toISOString(),
    };
  }
}
