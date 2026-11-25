/**
 * FR-4.4 / FR-4.8 scoring contract.
 *
 * These values mirror `config/module4-scoring.json`, which is the shared
 * cross-language source used by the Python service. The duplication is
 * intentional so the Next.js bundle has no filesystem dependency; tests assert
 * that both copies stay identical.
 */

export const SCORING_CONFIG_VERSION = 'v1.0-srs-fr4.4';

export const DEFAULT_RISK_THRESHOLDS = {
  version: SCORING_CONFIG_VERSION,
  low_risk_min: 0.75,
  moderate_risk_min: 0.55,
  high_risk_min: 0.35,
} as const;

export const LIMITED_DATA_DISCLAIMER = 'Estimate based on a model trained on limited data';
export const PROVISIONAL_DISCLAIMER =
  'Provisional MCDA index, not a calibrated probability from a supervised model.';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low risk',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
};

export interface RiskThresholds {
  version: string;
  low_risk_min: number;
  moderate_risk_min: number;
  high_risk_min: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Validates an admin-supplied threshold payload without mutating it. */
export function validateRiskThresholds(input: unknown): RiskThresholds {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Risk thresholds must be a JSON object.');
  }
  const candidate = input as Record<string, unknown>;
  const version = candidate.version;

  if (typeof version !== 'string' || !version.trim()) {
    throw new Error('Risk threshold configuration requires a non-empty version.');
  }

  const readBoundary = (name: string): number => {
    const value = candidate[name];
    if (!isFiniteNumber(value) || value < 0 || value > 1) {
      throw new Error(`${name} must be a finite number in [0, 1].`);
    }
    return value;
  };
  const boundaries = {
    low_risk_min: readBoundary('low_risk_min'),
    moderate_risk_min: readBoundary('moderate_risk_min'),
    high_risk_min: readBoundary('high_risk_min'),
  };
  if (
    !(boundaries.low_risk_min > boundaries.moderate_risk_min &&
      boundaries.moderate_risk_min > boundaries.high_risk_min &&
      boundaries.high_risk_min > 0)
  ) {
    throw new Error(
      'Risk thresholds must be strictly ordered: low_risk_min > moderate_risk_min > high_risk_min > 0.'
    );
  }

  return { version, ...boundaries };
}

/** Accepts the existing `system_config.scoring_thresholds` payload shape. */
export function riskThresholdsFromConfig(
  payload: unknown,
  fallbackVersion?: string
): RiskThresholds {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('scoring_thresholds payload must be a JSON object.');
  }
  const raw = payload as Record<string, unknown>;
  const version =
    typeof raw.version === 'string' && raw.version.trim()
      ? raw.version
      : fallbackVersion || SCORING_CONFIG_VERSION;
  return validateRiskThresholds({
    version,
    low_risk_min: raw.low_risk_min,
    moderate_risk_min: raw.moderate_risk_min,
    high_risk_min: raw.high_risk_min,
    critical_risk_max: raw.critical_risk_max,
  });
}

export function roundFeasibilityScore(score: number): number {
  if (!Number.isFinite(score)) {
    throw new Error('Feasibility score must be finite.');
  }
  return Number(Math.min(1, Math.max(0, score)).toFixed(2));
}

export function classifyRisk(
  score: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): { level: RiskLevel; label: string } {
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error('Feasibility score must be in [0, 1].');
  }
  const validated = validateRiskThresholds(thresholds);
  if (score >= validated.low_risk_min) return { level: 'low', label: RISK_LABELS.low };
  if (score >= validated.moderate_risk_min) return { level: 'moderate', label: RISK_LABELS.moderate };
  if (score >= validated.high_risk_min) return { level: 'high', label: RISK_LABELS.high };
  return { level: 'critical', label: RISK_LABELS.critical };
}

/** Preserves the historical feasibility vocabulary while using SRS boundaries. */
export function classifyFeasibility(
  score: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): 'High Feasibility' | 'Medium Feasibility' | 'Low Feasibility' | 'Not Feasible' {
  const { level } = classifyRisk(score, thresholds);
  if (level === 'low') return 'High Feasibility';
  if (level === 'moderate') return 'Medium Feasibility';
  if (level === 'high') return 'Low Feasibility';
  return 'Not Feasible';
}
