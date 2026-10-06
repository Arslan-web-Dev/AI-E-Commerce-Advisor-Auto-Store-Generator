import {
  CostEstimateRecord,
  CostEstimateQueryInput,
  ICostEstimateProvider,
} from '../../../types/data-collection';

export class DemoCostEstimateProvider implements ICostEstimateProvider {
  name = 'demo_cost_estimates';
  provenance = 'synthetic_demo' as const;

  async getCostEstimates(input: CostEstimateQueryInput): Promise<CostEstimateRecord[]> {
    const isUsd = input.budgetCurrency === 'USD';
    const now = new Date().toISOString();

    return [
      {
        project_id: '',
        cost_type: 'setup',
        amount_min: isUsd ? 1500 : 400000,
        amount_max: isUsd ? 3500 : 950000,
        currency: input.budgetCurrency,
        period_or_unit: 'one-time',
        assumptions: 'Synthetic setup cost estimate (Development Demo Mode)',
        provider: this.name,
        provenance: this.provenance,
        retrieved_at: now,
      },
      {
        project_id: '',
        cost_type: 'rent_monthly',
        amount_min: isUsd ? 350 : 95000,
        amount_max: isUsd ? 650 : 180000,
        currency: input.budgetCurrency,
        period_or_unit: 'per_month',
        assumptions: 'Synthetic commercial rent benchmark (Development Demo Mode)',
        provider: this.name,
        provenance: this.provenance,
        retrieved_at: now,
      },
      {
        project_id: '',
        cost_type: 'marketing_initial',
        amount_min: isUsd ? 1200 : 300000,
        amount_max: isUsd ? 2500 : 650000,
        currency: input.budgetCurrency,
        period_or_unit: 'one-time',
        assumptions: 'Synthetic digital marketing baseline (Development Demo Mode)',
        provider: this.name,
        provenance: this.provenance,
        retrieved_at: now,
      },
      {
        project_id: '',
        cost_type: 'logistics_per_order',
        amount_min: isUsd ? 1 : 220,
        amount_max: isUsd ? 2 : 350,
        currency: input.budgetCurrency,
        period_or_unit: 'per_order',
        assumptions: 'Synthetic COD courier logistics cost (Development Demo Mode)',
        provider: this.name,
        provenance: this.provenance,
        retrieved_at: now,
      },
    ];
  }
}
