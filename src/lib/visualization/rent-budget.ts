import { finiteNumber } from './map-validation';
import { getRentBand, type RentBand } from './module5-config';

export interface RentBudgetInput {
  monthlyRent: number | null | undefined;
  totalBudget: number | null | undefined;
  rentMin?: number | null;
  rentMax?: number | null;
  rentCurrency?: string | null;
  budgetCurrency?: string | null;
}

export interface RentBudgetCalculation {
  monthlyRent: number | null;
  totalBudget: number | null;
  monthlyBudget: number | null;
  ratioPercent: number | null;
  fillPercent: number;
  band: RentBand | null;
  valid: boolean;
  reason?: string;
}

/**
 * FR-5.3 compares monthly rent with the monthly-equivalent budget share, not
 * with the whole project budget. Invalid or mismatched inputs stay null.
 */
export function calculateRentBudget(input: RentBudgetInput): RentBudgetCalculation {
  const monthlyRent = finiteNumber(input.monthlyRent);
  const totalBudget = finiteNumber(input.totalBudget);
  const result: RentBudgetCalculation = {
    monthlyRent,
    totalBudget,
    monthlyBudget: null,
    ratioPercent: null,
    fillPercent: 0,
    band: null,
    valid: false,
  };

  if (input.rentCurrency && input.budgetCurrency && input.rentCurrency !== input.budgetCurrency) {
    result.reason = 'Rent and budget currencies differ; no percentage is calculated.';
    return result;
  }
  if (monthlyRent === null || monthlyRent < 0) {
    result.reason = 'Monthly rent is unavailable or invalid.';
    return result;
  }
  if (totalBudget === null || totalBudget <= 0) {
    result.reason = 'Budget is unavailable or zero; no percentage is calculated.';
    return result;
  }

  const monthlyBudget = totalBudget / 12;
  const ratioPercent = (monthlyRent / monthlyBudget) * 100;
  if (!Number.isFinite(ratioPercent)) {
    result.reason = 'Rent-to-budget calculation is not finite.';
    return result;
  }

  result.monthlyBudget = monthlyBudget;
  result.ratioPercent = ratioPercent;
  result.fillPercent = Math.max(0, Math.min(100, ratioPercent));
  result.band = getRentBand(ratioPercent);
  result.valid = true;
  return result;
}

export interface MonthlyRentRange {
  rentMin: number;
  rentMax: number;
  hasGenuineRange: boolean;
  note: string;
}

/**
 * Scale a genuine cached per-square-foot range onto the derived monthly rent.
 * When the cache has no real range, the UI shows the single sourced value and
 * states that a range is unavailable rather than inventing one.
 */
export function deriveMonthlyRentRange(
  monthlyRent: number | null | undefined,
  rentMin: number | null | undefined,
  rentMax: number | null | undefined,
  rentAvg: number | null | undefined
): MonthlyRentRange | null {
  const rent = finiteNumber(monthlyRent);
  if (rent === null || rent < 0) return null;

  const min = finiteNumber(rentMin);
  const max = finiteNumber(rentMax);
  const avg = finiteNumber(rentAvg);
  const genuineRange =
    min !== null && max !== null && avg !== null && avg > 0 && min >= 0 && max > min;

  if (!genuineRange) {
    return {
      rentMin: rent,
      rentMax: rent,
      hasGenuineRange: false,
      note: 'A genuine rent range is unavailable; showing the single sourced monthly estimate.',
    };
  }

  const scale = rent / avg;
  return {
    rentMin: Math.round(min * scale * 100) / 100,
    rentMax: Math.round(max * scale * 100) / 100,
    hasGenuineRange: true,
    note: 'Monthly range scaled from the cached per-square-foot minimum and maximum; not a quoted lease.',
  };
}

export function formatCurrency(value: number | null | undefined, currency = 'PKR'): string {
  const amount = finiteNumber(value);
  if (amount === null) return 'N/A';
  try {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-PK')}`;
  }
}
