/**
 * Module 6 FR-6.6: deterministic, transparent risk aggregation.
 *
 * This is not a calibrated probability and does not evaluate a supervised
 * model. Unknown inputs remain unknown; they are never treated as evidence of
 * low risk. No low-budget numeric cutoff is invented because the SRS and
 * approved configuration do not define one.
 */

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical' | null;
export type RuleStatus = 'triggered' | 'not_triggered' | 'unknown';

export interface RiskEngineInput {
  baselineRiskLevel: RiskLevel;
  rentToBudgetRatio: number | null;
  saturationIndex: number | null;
  trendSlopeScore: number | null;
  budgetRatio: number | null;
}

export interface RiskFlag {
  id: string;
  label: string;
  status: RuleStatus;
  value: number | null;
  threshold: number | null;
  reason: string;
  urRomanReason: string;
}

export interface RiskEvaluation {
  baselineRiskLevel: RiskLevel;
  combinedRiskLevel: RiskLevel;
  status: 'complete' | 'partial' | 'unavailable';
  flags: RiskFlag[];
  triggeredFlags: string[];
  unknownFlags: string[];
  escalationScore: number;
  formula: string;
  disclaimer: string;
}

const SEVERITY: Record<Exclude<RiskLevel, null>, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

function levelFromSeverity(severity: number): Exclude<RiskLevel, null> {
  if (severity >= 3) return 'critical';
  if (severity === 2) return 'high';
  if (severity === 1) return 'moderate';
  return 'low';
}

function knownNumber(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function ratioFlag(
  id: string,
  label: string,
  value: number | null,
  threshold: number,
  reason: string,
  urRomanReason: string,
): RiskFlag {
  const actual = knownNumber(value);
  if (actual === null) {
    return {
      id,
      label,
      status: 'unknown',
      value: null,
      threshold,
      reason: `${label} is unavailable; no risk conclusion was inferred.`,
      urRomanReason: `${label} available nahi hai; is se koi risk natija nahi nikala gaya.`,
    };
  }
  const triggered = actual > threshold;
  return {
    id,
    label,
    status: triggered ? 'triggered' : 'not_triggered',
    value: actual,
    threshold,
    reason: triggered ? reason : `${label} is within the reviewed rule boundary.`,
    urRomanReason: triggered
      ? urRomanReason
      : `${label} reviewed limit ke andar hai.`,
  };
}

export function evaluateRisk(input: RiskEngineInput): RiskEvaluation {
  const rentRatio = knownNumber(input.rentToBudgetRatio);
  const saturation = knownNumber(input.saturationIndex);
  const slope = knownNumber(input.trendSlopeScore);
  const budgetRatio = knownNumber(input.budgetRatio);

  const flags: RiskFlag[] = [
    ratioFlag(
      'rent_budget_ratio',
      'Rent-to-budget ratio',
      rentRatio,
      0.4,
      'Monthly rent consumes more than 40% of the monthly budget.',
      'Monthly rent budget ke 40% se zayada kharch ho raha hai.',
    ),
    ratioFlag(
      'market_saturation',
      'Market saturation index',
      saturation,
      75,
      'The 0-100 saturation index is above the reviewed crowded threshold.',
      '0-100 saturation index reviewed crowded limit se upar hai.',
    ),
    (() => {
      const status: RuleStatus = slope === null ? 'unknown' : slope < 0 ? 'triggered' : 'not_triggered';
      return {
        id: 'negative_trend_slope',
        label: 'Negative demand trend',
        status,
        value: slope,
        threshold: 0,
        reason:
          status === 'triggered'
            ? 'The stored in-scope demand trend is declining.'
            : status === 'unknown'
              ? 'Trend direction is unavailable; no risk conclusion was inferred.'
              : 'The stored demand trend is stable or growing.',
        urRomanReason:
          status === 'triggered'
            ? 'Stored demand trend gir raha hai.'
            : status === 'unknown'
              ? 'Trend direction available nahi hai; koi risk natija nahi nikala gaya.'
              : 'Stored demand trend stable ya badh raha hai.',
      };
    })(),
    {
      id: 'low_budget_ratio',
      label: 'Low budget ratio',
      status: 'unknown',
      value: budgetRatio,
      threshold: null,
      reason:
        'The SRS names this flag but defines no approved numeric cutoff; it remains unresolved and cannot trigger an escalation.',
      urRomanReason:
        'SRS is flag ka zikr karti hai lekin approved number nahi deti; yeh unresolved hai aur escalation nahi karta.',
    },
  ];

  const triggeredFlags = flags.filter((flag) => flag.status === 'triggered').map((flag) => flag.id);
  const unknownFlags = flags.filter((flag) => flag.status === 'unknown').map((flag) => flag.id);
  const baseline = input.baselineRiskLevel;
  const combinedRiskLevel: RiskLevel =
    baseline === null ? null : levelFromSeverity(Math.min(3, SEVERITY[baseline] + triggeredFlags.length));

  return {
    baselineRiskLevel: baseline,
    combinedRiskLevel,
    status: baseline === null ? 'unavailable' : unknownFlags.length > 0 ? 'partial' : 'complete',
    flags,
    triggeredFlags,
    unknownFlags,
    escalationScore: triggeredFlags.length,
    formula:
      'baseline severity (low=0, moderate=1, high=2, critical=3) + count of triggered rule flags, capped at 3; unknown flags add 0 and are reported explicitly.',
    disclaimer:
      'Transparent rule aggregation for planning only; not a calibrated probability, not a supervised-model output.',
  };
}
