import type { Project, BudgetCurrency } from '@/types/project';
import type { CleanedDataset } from '@/lib/data-processing/cleaner';
import { engineerFeatures } from '@/lib/data-processing/feature-engineer';
import { calculateProvisionalMCDA } from '@/lib/scoring/mcda';
import {
  DEFAULT_RISK_THRESHOLDS,
  LIMITED_DATA_DISCLAIMER,
  PROVISIONAL_DISCLAIMER,
  classifyFeasibility,
  classifyRisk,
  roundFeasibilityScore,
  type RiskThresholds,
} from '@/lib/ml/scoring-contract';

export interface BudgetValidation {
  valid: boolean;
  amount?: number;
  currency?: BudgetCurrency;
  error?: string;
}

/** Canonical Module 2 budget bounds; a simulation never mutates the project. */
export function validateSimulationBudget(
  rawAmount: unknown,
  rawCurrency: unknown,
): BudgetValidation {
  const amount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);
  const currency = rawCurrency === 'USD' || rawCurrency === 'PKR' ? rawCurrency : null;
  if (!currency) return { valid: false, error: 'budget_currency must be PKR or USD.' };
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return { valid: false, error: 'budget_amount must be a finite number.' };
  }
  if (currency === 'PKR' && (amount < 10_000 || amount > 50_000_000)) {
    return { valid: false, error: 'PKR budget must be between 10,000 and 50,000,000.' };
  }
  if (currency === 'USD' && (amount < 50 || amount > 200_000)) {
    return { valid: false, error: 'USD budget must be between 50 and 200,000.' };
  }
  return { valid: true, amount, currency };
}

export interface SimulationInput {
  project: Project;
  dataset: CleanedDataset;
  runId: string;
  budgetAmount: number;
  budgetCurrency: BudgetCurrency;
  thresholds?: RiskThresholds;
  baselineScore?: number | null;
  baselineRiskLevel?: string | null;
}

export interface SimulationResult {
  scoringMode: 'provisional_mcda' | 'unavailable';
  score: number | null;
  riskLevel: string | null;
  classification: string | null;
  budgetRatio: number | null;
  rentToBudgetRatio: number | null;
  engineeredVectorBudgetRatio: number | null;
  budgetAmount: number;
  budgetCurrency: BudgetCurrency;
  modelVersion: string;
  thresholdVersion: string;
  deltas: { score: number | null; riskLevel: string | null };
  disclaimers: string[];
  persisted: false;
  externalFetch: false;
}

/**
 * Deterministic dry-run using the same Module 4 feature and scoring functions
 * as a persisted feasibility report. No database write and no AI/provider call.
 */
export function simulateBudget(input: SimulationInput): SimulationResult {
  const thresholds = input.thresholds ?? DEFAULT_RISK_THRESHOLDS;
  const overrideProject: Project = {
    ...input.project,
    budget_amount: input.budgetAmount,
    budget_currency: input.budgetCurrency,
  };
  const features = engineerFeatures(overrideProject, input.dataset, input.runId);
  const mcda = calculateProvisionalMCDA(features.engineered_vector);
  const score = mcda.score === null ? null : roundFeasibilityScore(mcda.score);
  const risk = score === null ? null : classifyRisk(score, thresholds);
  const classification = score === null ? null : classifyFeasibility(score, thresholds);
  const baselineScore =
    typeof input.baselineScore === 'number' && Number.isFinite(input.baselineScore)
      ? roundFeasibilityScore(input.baselineScore)
      : null;

  return {
    scoringMode: mcda.mode === 'unavailable' ? 'unavailable' : 'provisional_mcda',
    score,
    riskLevel: risk?.level ?? null,
    classification,
    budgetRatio: features.budget_ratio,
    rentToBudgetRatio: features.rent_to_budget_ratio,
    engineeredVectorBudgetRatio: features.engineered_vector.norm_budget_ratio,
    budgetAmount: input.budgetAmount,
    budgetCurrency: input.budgetCurrency,
    modelVersion: `provisional_mcda:${mcda.version}`,
    thresholdVersion: thresholds.version,
    deltas: {
      score: score !== null && baselineScore !== null ? Number((score - baselineScore).toFixed(2)) : null,
      riskLevel:
        risk && input.baselineRiskLevel && risk.level !== input.baselineRiskLevel
          ? `${input.baselineRiskLevel} -> ${risk.level}`
          : null,
    },
    disclaimers: [LIMITED_DATA_DISCLAIMER, PROVISIONAL_DISCLAIMER],
    persisted: false,
    externalFetch: false,
  };
}
