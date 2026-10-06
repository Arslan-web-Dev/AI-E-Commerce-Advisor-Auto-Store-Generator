import {
  MarketObservation,
  RegionalQueryInput,
  IRegionalStatsProvider,
} from '../../../types/data-collection';

export class DemoRegionalStatsProvider implements IRegionalStatsProvider {
  name = 'demo_regional_stats';
  provenance = 'synthetic_demo' as const;

  async getRegionalStats(input: RegionalQueryInput): Promise<MarketObservation[]> {
    const now = new Date().toISOString();
    const geography = `${input.city || 'Regional Hub'}, Pakistan (Synthetic Baseline)`;

    return [
      {
        project_id: '',
        metric_name: 'population',
        metric_value: 3200000,
        unit: 'count',
        geography,
        period_year: 2024,
        provider: this.name,
        provenance: this.provenance,
        source_citation: 'Synthetic Demo Demographics Engine (Development Mock)',
        retrieved_at: now,
      },
      {
        project_id: '',
        metric_name: 'internet_penetration_pct',
        metric_value: 58.0,
        unit: 'percentage',
        geography,
        period_year: 2024,
        provider: this.name,
        provenance: this.provenance,
        source_citation: 'Synthetic Demo Demographics Engine (Development Mock)',
        retrieved_at: now,
      },
      {
        project_id: '',
        metric_name: 'ecommerce_growth_rate_pct',
        metric_value: 19.5,
        unit: 'percentage',
        geography,
        period_year: 2024,
        provider: this.name,
        provenance: this.provenance,
        source_citation: 'Synthetic Demo Demographics Engine (Development Mock)',
        retrieved_at: now,
      },
    ];
  }
}
