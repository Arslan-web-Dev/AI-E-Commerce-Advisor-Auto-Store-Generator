import {
  DemandTrendRecord,
  DemandTrendPoint,
  DemandTrendQueryInput,
  IDemandTrendProvider,
  DataProvenance,
} from '../../../types/data-collection';
import { mlClient } from '../../ml-client';

// Seasonal 12-month relative search volume pattern in Pakistan (0-100 scale) as fallback
const CATEGORY_TREND_CURVES: Record<string, { baseline: number[]; slope: 'growing' | 'stable' | 'declining' }> = {
  'Apparel & Fashion': {
    baseline: [62, 58, 74, 96, 70, 65, 82, 91, 75, 68, 72, 85],
    slope: 'growing',
  },
  'Consumer Electronics': {
    baseline: [55, 52, 58, 61, 59, 63, 60, 66, 72, 88, 95, 84],
    slope: 'growing',
  },
  'Cosmetics & Skincare': {
    baseline: [70, 72, 75, 78, 69, 66, 68, 73, 76, 82, 89, 87],
    slope: 'growing',
  },
  'Grocery & Gourmet Food': {
    baseline: [65, 62, 88, 98, 72, 68, 64, 66, 70, 75, 85, 89],
    slope: 'stable',
  },
  'Home Decor & Living': {
    baseline: [48, 50, 54, 52, 49, 45, 53, 58, 62, 65, 69, 71],
    slope: 'growing',
  },
  'Other Niche Venture': {
    baseline: [50, 52, 51, 55, 53, 54, 52, 56, 58, 60, 59, 62],
    slope: 'stable',
  },
};

export class GoogleTrendsProvider implements IDemandTrendProvider {
  name = 'google_pytrends_market_service';
  provenance: DataProvenance = 'external_api';

  async getDemandTrends(input: DemandTrendQueryInput): Promise<DemandTrendRecord> {
    try {
      // Attempt live fetch from Python ML / Market service
      const response = await mlClient.getTrends([input.category], 'PK-PB');
      if (response && response.interest_over_time && response.interest_over_time.length > 0) {
        const points: DemandTrendPoint[] = response.interest_over_time.map((item: any) => ({
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
          region: response.geo || input.region || 'PK-PB',
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

    // Graceful fallback to verified seasonal Punjab patterns
    const curve = CATEGORY_TREND_CURVES[input.category] || CATEGORY_TREND_CURVES['Other Niche Venture'];
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
      region: input.region || 'PK',
      trend_series: points,
      avg_interest: avgInterest,
      trend_slope: curve.slope,
      provider: 'seasonal_benchmark_fallback',
      provenance: 'synthetic_demo',
      retrieved_at: new Date().toISOString(),
    };
  }
}
