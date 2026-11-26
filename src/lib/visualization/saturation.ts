import { finiteNumber } from './map-validation';
import { getSaturationBand, type SaturationBand } from './module5-config';

export interface SaturationCalculationInput {
  /** Raw documented unit: competitors per 100,000 residents. */
  saturationPer100k?: number | null;
  competitorCount?: number | null;
  population?: number | null;
}

export interface SaturationCalculation {
  competitorsPer100k: number | null;
  normalizedIndex: number | null;
  band: SaturationBand | null;
  hasPopulationDenominator: boolean;
  reason?: string;
}

/** Competitors per 100k is null unless a valid positive population is present. */
export function competitorsPer100k(
  competitorCount: number | null | undefined,
  population: number | null | undefined
): number | null {
  const count = finiteNumber(competitorCount);
  const residents = finiteNumber(population);
  if (count === null || residents === null || count < 0 || residents <= 0) return null;
  return Math.round((count / residents) * 100000 * 100000) / 100000;
}

/**
 * Presentation-only normalization: 10 competitors per 100k residents maps to
 * the top of the meter. The raw value remains visible beside the index.
 */
export function normalizeSaturationIndex(per100k: number | null | undefined): number | null {
  const raw = finiteNumber(per100k);
  if (raw === null || raw < 0) return null;
  return Math.max(0, Math.min(100, raw * 10));
}

export function calculateSaturation(input: SaturationCalculationInput): SaturationCalculation {
  const storedRaw = finiteNumber(input.saturationPer100k);
  const derivedRaw = competitorsPer100k(input.competitorCount, input.population);
  const raw = storedRaw !== null && storedRaw >= 0 ? storedRaw : derivedRaw;
  const normalized = normalizeSaturationIndex(raw);

  return {
    competitorsPer100k: raw,
    normalizedIndex: normalized,
    band: getSaturationBand(normalized),
    hasPopulationDenominator: derivedRaw !== null || (storedRaw !== null && storedRaw >= 0),
    reason: raw === null ? 'Population or competitor data is unavailable or invalid.' : undefined,
  };
}
