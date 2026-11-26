import type { RiskEvaluation } from './risk-engine';

export type ActionPriority = 'High' | 'Med' | 'Low';
export type ActionImpact = 'High' | 'Medium' | 'Low';
export type ActionEffort = 'High' | 'Medium' | 'Low';

export interface LocalizedActionText {
  en: string;
  ur_roman: string;
}

export interface ActionItem {
  id: string;
  title: LocalizedActionText;
  description: LocalizedActionText;
  priority: ActionPriority;
  impact: ActionImpact;
  effort: ActionEffort;
  relatedRisk: string;
  riskStatus: 'triggered' | 'not_triggered' | 'unknown';
  evidence: Record<string, number | string | null>;
  status: 'open' | 'completed';
  completedAt: string | null;
  generatedAt: string;
}

export interface PersistedActionState {
  item_key: string;
  is_completed: boolean;
  completed_at: string | null;
}

type ActionSeed = Omit<ActionItem, 'status' | 'completedAt' | 'generatedAt'>;

const SEEDS: Record<string, ActionSeed> = {
  rent_budget_ratio: {
    id: 'reduce-rent-commitment',
    title: { en: 'Reduce rent commitment', ur_roman: 'Rent ka commitment kam karein' },
    description: {
      en: 'Negotiate a smaller footprint or a lower monthly rent before committing capital.',
      ur_roman: 'Capital lagane se pehle chota footprint ya kam monthly rent par baat karein.',
    },
    priority: 'High',
    impact: 'High',
    effort: 'Medium',
    relatedRisk: 'rent_budget_ratio',
    riskStatus: 'triggered',
    evidence: {},
  },
  market_saturation: {
    id: 'differentiate-offering',
    title: { en: 'Differentiate the offering', ur_roman: 'Apni offering ko alag karein' },
    description: {
      en: 'Use a verified local niche, service bundle or pricing test instead of copying crowded competitors.',
      ur_roman: 'Crowded competitors ki copy karne ke bajaye verified local niche, service bundle ya pricing test use karein.',
    },
    priority: 'High',
    impact: 'Medium',
    effort: 'Medium',
    relatedRisk: 'market_saturation',
    riskStatus: 'triggered',
    evidence: {},
  },
  negative_trend_slope: {
    id: 'refresh-demand-plan',
    title: { en: 'Refresh the demand plan', ur_roman: 'Demand plan ko dobara dekhein' },
    description: {
      en: 'Treat declining stored demand as a warning and validate the product mix before scaling marketing.',
      ur_roman: 'Girte hue stored demand ko warning samjhein aur marketing badhane se pehle product mix verify karein.',
    },
    priority: 'High',
    impact: 'Medium',
    effort: 'Low',
    relatedRisk: 'negative_trend_slope',
    riskStatus: 'triggered',
    evidence: {},
  },
  low_budget_ratio: {
    id: 'review-capital-assumption',
    title: { en: 'Review capital assumptions', ur_roman: 'Capital assumptions ka jaiza lein' },
    description: {
      en: 'Confirm the budget against the stored annual cost because no approved low-budget cutoff exists yet.',
      ur_roman: 'Kyunki abhi approved low-budget cutoff nahi hai, budget ka stored annual cost se mutabcat check karein.',
    },
    priority: 'Med',
    impact: 'Medium',
    effort: 'Low',
    relatedRisk: 'low_budget_ratio',
    riskStatus: 'unknown',
    evidence: {},
  },
  baseline_risk: {
    id: 'confirm-feasibility-before-launch',
    title: { en: 'Confirm feasibility before launch', ur_roman: 'Launch se pehle feasibility confirm karein' },
    description: {
      en: 'Review the stored feasibility evidence and budget allocation before signing a lease or placing inventory.',
      ur_roman: 'Lease ya inventory se pehle stored feasibility evidence aur budget allocation ka jaiza lein.',
    },
    priority: 'Med',
    impact: 'High',
    effort: 'Low',
    relatedRisk: 'baseline_risk',
    riskStatus: 'unknown',
    evidence: {},
  },
};

function evidenceFor(flagId: string, facts: Record<string, unknown>): Record<string, number | string | null> {
  const asNumber = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  switch (flagId) {
    case 'rent_budget_ratio':
      return { rentToBudgetRatio: asNumber(facts.rentToBudgetRatio), threshold: 0.4 };
    case 'market_saturation':
      return { saturationIndex: asNumber(facts.saturationIndex), threshold: 75 };
    case 'negative_trend_slope':
      return { trendSlopeScore: asNumber(facts.trendSlopeScore), threshold: 0 };
    case 'low_budget_ratio':
      return { budgetRatio: asNumber(facts.budgetRatio), threshold: null };
    default:
      return {
        feasibilityScore: asNumber(facts.feasibilityScore),
        classification: typeof facts.classification === 'string' ? facts.classification : null,
      };
  }
}

/** Builds a stable, fact-derived checklist. IDs never depend on array order. */
export function buildActionMatrix(
  risk: RiskEvaluation,
  facts: Record<string, unknown>,
  generatedAt: string = new Date().toISOString(),
): ActionItem[] {
  const flagIds = risk.flags.map((flag) => flag.id);
  const selected = flagIds.filter((id) => {
    const status = risk.flags.find((flag) => flag.id === id)?.status;
    return status === 'triggered' || status === 'unknown';
  });
  if (risk.baselineRiskLevel === 'high' || risk.baselineRiskLevel === 'critical') {
    selected.push('baseline_risk');
  }
  if (selected.length === 0) selected.push('baseline_risk');

  const seen = new Set<string>();
  return selected
    .filter((id) => !seen.has(id) && Boolean(SEEDS[id]))
    .map((id) => {
      seen.add(id);
      const seed = SEEDS[id];
      const flagStatus = risk.flags.find((flag) => flag.id === id)?.status ?? 'unknown';
      return {
        ...seed,
        riskStatus: flagStatus,
        evidence: evidenceFor(id, facts),
        status: 'open',
        completedAt: null,
        generatedAt,
      };
    });
}

/** Merges owner-scoped persisted ticks into the generated action matrix. */
export function mergeActionStates(
  matrix: ActionItem[],
  states: PersistedActionState[],
): ActionItem[] {
  const byId = new Map(states.map((state) => [state.item_key, state]));
  return matrix.map((item) => {
    const state = byId.get(item.id);
    if (!state) return item;
    return {
      ...item,
      status: state.is_completed ? 'completed' : 'open',
      completedAt: state.is_completed ? state.completed_at : null,
    };
  });
}
