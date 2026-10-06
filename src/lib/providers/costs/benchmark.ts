import {
  CostEstimateRecord,
  CostEstimateQueryInput,
  ICostEstimateProvider,
} from '../../../types/data-collection';
import { createClient } from '@/lib/supabase/server';

const FOOTPRINT_SQFT_MAP: Record<string, number> = {
  kiosk: 120,
  boutique: 250,
  commercial: 650,
  flagship: 1400,
};

const DEFAULT_RENT_PER_SQFT_PKR: Record<string, number> = {
  lahore: 220,
  karachi: 260,
  islamabad: 250,
  rawalpindi: 180,
  faisalabad: 160,
  multan: 140,
  peshawar: 150,
  quetta: 130,
};

export class BenchmarkCostEstimateProvider implements ICostEstimateProvider {
  name = 'sme_cost_benchmark_model';
  provenance = 'manual_estimate' as const;

  async getCostEstimates(input: CostEstimateQueryInput): Promise<CostEstimateRecord[]> {
    const sqft = FOOTPRINT_SQFT_MAP[input.footprint] || 250;
    const cityKey = (input.city || '').toLowerCase().trim();

    let rentPerSqftPkr = 200; // fallback

    // Attempt to query PostgreSQL rent_cache if available
    try {
      const supabase = await createClient();
      const { data: rentData } = await supabase
        .from('rent_cache')
        .select('rent_per_sqft_pkr')
        .ilike('city', `%${input.city}%`)
        .limit(1)
        .maybeSingle();

      if (rentData?.rent_per_sqft_pkr) {
        rentPerSqftPkr = Number(rentData.rent_per_sqft_pkr);
      } else {
        // Fall back to city database
        for (const [k, v] of Object.entries(DEFAULT_RENT_PER_SQFT_PKR)) {
          if (cityKey.includes(k)) {
            rentPerSqftPkr = v;
            break;
          }
        }
      }
    } catch {
      // In case database client is offline in tests
      for (const [k, v] of Object.entries(DEFAULT_RENT_PER_SQFT_PKR)) {
        if (cityKey.includes(k)) {
          rentPerSqftPkr = v;
          break;
        }
      }
    }

    const monthlyRentPkr = sqft * rentPerSqftPkr;
    const isUsd = input.budgetCurrency === 'USD';
    const rateUsd = 278;

    const toCurr = (pkr: number) => (isUsd ? Math.round(pkr / rateUsd) : Math.round(pkr));
    const now = new Date().toISOString();

    // 1. Setup & Fitout Costs
    const setupMinPkr = sqft * 1600;
    const setupMaxPkr = sqft * 3200;

    // 2. Monthly Rent Estimate (range -15% to +20%)
    const rentMinPkr = Math.round(monthlyRentPkr * 0.85);
    const rentMaxPkr = Math.round(monthlyRentPkr * 1.2);

    // 3. Initial Marketing / Customer Acquisition Budget
    const mktMinPkr = Math.round(input.budgetAmount * (isUsd ? rateUsd : 1) * 0.12);
    const mktMaxPkr = Math.round(input.budgetAmount * (isUsd ? rateUsd : 1) * 0.22);

    // 4. Logistics & Delivery per Order (COD courier standard)
    const logMinPkr = 220;
    const logMaxPkr = 380;

    return [
      {
        project_id: '',
        cost_type: 'setup',
        amount_min: toCurr(setupMinPkr),
        amount_max: toCurr(setupMaxPkr),
        currency: input.budgetCurrency,
        period_or_unit: 'one-time',
        assumptions: `Fitout, display shelving, lighting & initial fixtures for ${sqft} sq.ft (${input.footprint}) in ${input.city || 'urban retail zone'}.`,
        provider: this.name,
        provenance: this.provenance,
        retrieved_at: now,
      },
      {
        project_id: '',
        cost_type: 'rent_monthly',
        amount_min: toCurr(rentMinPkr),
        amount_max: toCurr(rentMaxPkr),
        currency: input.budgetCurrency,
        period_or_unit: 'per_month',
        assumptions: `Commercial rent benchmarked at Rs. ${rentPerSqftPkr}/sq.ft for ${sqft} sq.ft footprint.`,
        provider: this.name,
        provenance: this.provenance,
        retrieved_at: now,
      },
      {
        project_id: '',
        cost_type: 'marketing_initial',
        amount_min: toCurr(mktMinPkr),
        amount_max: toCurr(mktMaxPkr),
        currency: input.budgetCurrency,
        period_or_unit: 'one-time',
        assumptions: 'Meta/Google digital ads launch runway (12–22% of total capital allocation).',
        provider: this.name,
        provenance: this.provenance,
        retrieved_at: now,
      },
      {
        project_id: '',
        cost_type: 'logistics_per_order',
        amount_min: toCurr(logMinPkr),
        amount_max: toCurr(logMaxPkr),
        currency: input.budgetCurrency,
        period_or_unit: 'per_order',
        assumptions: 'Standard COD domestic courier dispatch fee per parcel (TCS / Leopard / Call Courier benchmark).',
        provider: this.name,
        provenance: this.provenance,
        retrieved_at: now,
      },
    ];
  }
}
