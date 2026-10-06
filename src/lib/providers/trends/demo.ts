import {
  DemandTrendRecord,
  DemandTrendPoint,
  DemandTrendQueryInput,
  IDemandTrendProvider,
} from '../../../types/data-collection';

export class DemoDemandTrendProvider implements IDemandTrendProvider {
  name = 'demo_trends';
  provenance = 'synthetic_demo' as const;

  async getDemandTrends(input: DemandTrendQueryInput): Promise<DemandTrendRecord> {
    const points: DemandTrendPoint[] = [];
    const today = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const monthStr = `${year}-${month}`;

      // Deterministic oscillation
      const index = 50 + Math.round(20 * Math.sin((i / 12) * Math.PI * 2));
      points.push({ month: monthStr, index });
    }

    return {
      project_id: '',
      category: input.category,
      region: input.region || 'PK',
      trend_series: points,
      avg_interest: 54.0,
      trend_slope: 'stable',
      provider: this.name,
      provenance: this.provenance,
      retrieved_at: new Date().toISOString(),
    };
  }
}
