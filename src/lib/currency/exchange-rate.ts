/**
 * Currency & Foreign Exchange Reference Service
 * Provides transparent conversion between USD and PKR with provenance tracking.
 */

export interface ExchangeRateInfo {
  rate: number;
  baseCurrency: 'USD';
  targetCurrency: 'PKR';
  source: 'configured_benchmark' | 'live_market';
  timestamp: string;
  disclaimer: string;
}

// Configured benchmark exchange rate for Punjab commercial feasibility planning
// Stored as Rs. 278 per 1 USD with explicit documentation.
export const BENCHMARK_EXCHANGE_RATE = 278;

export function getExchangeRateInfo(): ExchangeRateInfo {
  return {
    rate: BENCHMARK_EXCHANGE_RATE,
    baseCurrency: 'USD',
    targetCurrency: 'PKR',
    source: 'configured_benchmark',
    timestamp: '2026-11-23T00:00:00Z',
    disclaimer: 'Benchmark Planning Rate: Rs. 278 / USD (State Bank of Pakistan / Interbank baseline, November 2026). Canonical database storage uses integer PKR.',
  };
}

export function convertUsdToPkr(amountUsd: number): number {
  return Math.round(amountUsd * BENCHMARK_EXCHANGE_RATE);
}

export function convertPkrToUsd(amountPkr: number): number {
  return Math.max(1, Math.round(amountPkr / BENCHMARK_EXCHANGE_RATE));
}
