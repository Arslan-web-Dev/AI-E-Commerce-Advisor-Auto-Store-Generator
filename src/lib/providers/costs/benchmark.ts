import {
  CostEstimateRecord,
  CostEstimateQueryInput,
  ICostEstimateProvider,
  RentLookupResult,
} from '../../../types/data-collection';
import { createClient } from '@/lib/supabase/server';
import { lookupRentFromRows, RentCacheRow } from '@/lib/data-collection/rent-lookup';

const FOOTPRINT_SQFT_MAP: Record<string, number> = {
  kiosk: 120,
  boutique: 250,
  commercial: 650,
  flagship: 1400,
};

export class BenchmarkCostEstimateProvider implements ICostEstimateProvider {
  name = 'sme_cost_benchmark_model';
  provenance = 'manual_estimate' as const;

  async getCostEstimates(input: CostEstimateQueryInput): Promise<CostEstimateRecord[]> {
    const sqft = FOOTPRINT_SQFT_MAP[input.footprint] || 250;
    let rentLookup: RentLookupResult | null = null;

    // Analysis reads rent_cache only — never scrapes live.
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from('rent_cache')
        .select(
          'city, area, district, province, lat, lng, rent_per_sqft_pkr, rent_min_pkr, rent_max_pkr, rent_avg_pkr, sample_size, source, scraped_at, confidence, provenance, notes, currency'
        );

      if (data && data.length > 0) {
        rentLookup = lookupRentFromRows(data as RentCacheRow[], {
          city: input.city,
          area: input.area,
          district: input.district || input.city,
          province: input.province,
          lat: input.lat,
          lng: input.lng,
        });
      }
    } catch {
      rentLookup = null;
    }

    const rentAvailable = rentLookup?.status === 'found' && rentLookup.rent_per_sqft_pkr != null;
    const rentPerSqftPkr = rentAvailable ? Number(rentLookup!.rent_per_sqft_pkr) : null;

    const monthlyRentPkr = rentPerSqftPkr != null ? sqft * rentPerSqftPkr : null;
    const isUsd = input.budgetCurrency === 'USD';
    const rateUsd = 278;
    const toCurr = (pkr: number) => (isUsd ? Math.round(pkr / rateUsd) : Math.round(pkr));
    const now = new Date().toISOString();

    const setupMinPkr = sqft * 1600;
    const setupMaxPkr = sqft * 3200;
    const mktMinPkr = Math.round(input.budgetAmount * (isUsd ? rateUsd : 1) * 0.12);
    const mktMaxPkr = Math.round(input.budgetAmount * (isUsd ? rateUsd : 1) * 0.22);
    const logMinPkr = 220;
    const logMaxPkr = 380;

    const rentAssumptions = rentAvailable
      ? `Commercial rent from rent_cache (${rentLookup!.match_level} match). ` +
        `Source geography: ${rentLookup!.source_geography?.area || ''}, ${rentLookup!.source_geography?.city || ''}` +
        `${rentLookup!.distance_km != null ? ` (~${rentLookup!.distance_km} km from request)` : ''}. ` +
        `Provenance: ${rentLookup!.provenance}; confidence: ${rentLookup!.confidence}; ` +
        `source: ${rentLookup!.source || 'n/a'}; retrieved: ${rentLookup!.retrieved_at || 'n/a'}. ` +
        `Rs. ${rentPerSqftPkr}/sq.ft × ${sqft} sq.ft.`
      : `No rent_cache coverage for ${input.city || input.area || 'requested geography'}. ` +
        'Monthly rent is omitted rather than substituting another region's data.';

    const records: CostEstimateRecord[] = [
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
        freshness: 'manual_estimate',
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
        freshness: 'manual_estimate',
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
        freshness: 'manual_estimate',
        retrieved_at: now,
      },
    ];

    if (monthlyRentPkr != null) {
      const rentMinPkr = Math.round(monthlyRentPkr * 0.85);
      const rentMaxPkr = Math.round(monthlyRentPkr * 1.2);
      records.splice(1, 0, {
        project_id: '',
        cost_type: 'rent_monthly',
        amount_min: toCurr(rentMinPkr),
        amount_max: toCurr(rentMaxPkr),
        currency: input.budgetCurrency,
        period_or_unit: 'per_month',
        assumptions: rentAssumptions,
        provider: this.name,
        provenance: rentLookup!.provenance === 'manual_estimate' ? 'manual_estimate' : this.provenance,
        freshness: rentLookup!.freshness,
        retrieved_at: rentLookup!.retrieved_at || now,
      });
    } else {
      // Explicit unavailable rent estimate so analysis can show coverage gap.
      records.splice(1, 0, {
        project_id: '',
        cost_type: 'rent_monthly',
        amount_min: 0,
        amount_max: 0,
        currency: input.budgetCurrency,
        period_or_unit: 'per_month',
        assumptions: rentAssumptions,
        provider: this.name,
        provenance: 'manual_estimate',
        freshness: 'unavailable',
        retrieved_at: now,
      });
    }

    return records;
  }
}
