import type { SupabaseClient } from '@supabase/supabase-js';
import type { EngineeredVector } from '@/types/feature-processing';
import type { RiskThresholds } from '@/lib/ml/scoring-contract';
import {
  DEFAULT_RISK_THRESHOLDS,
  LIMITED_DATA_DISCLAIMER,
  PROVISIONAL_DISCLAIMER,
  classifyFeasibility,
  classifyRisk,
  riskThresholdsFromConfig,
  roundFeasibilityScore,
} from '@/lib/ml/scoring-contract';

export const DEFAULT_MCDA_CONFIG = {
  version: 'v1.0-mcda',
  weights: {
    budget_ratio: 0.30,
    avg_demand: 0.25,
    category_saturation_inverse: 0.20, // 1.0 - saturation
    trend_slope: 0.15, // mapped from [-1, 1] to [0, 1]
    ecommerce_growth: 0.10,
  },
};

export type ScoringMode = 'supervised_model' | 'provisional_mcda' | 'unavailable';
export type Classification = 'High Feasibility' | 'Medium Feasibility' | 'Low Feasibility' | 'Not Feasible';

/** Backwards-compatible classifier that now uses the SRS threshold contract. */
export function classifyScore(
  score: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): Classification {
  return classifyFeasibility(score, thresholds);
}

export interface MCDAExplanation {
  feature: string;
  /** Null is explicit: the source was unavailable or out of scope. */
  value: number | null;
  weight: number;
  contribution: number;
  note: string;
  available: boolean;
}

export interface MCDAResult {
  score: number | null;
  explanations: MCDAExplanation[];
  missing_drivers: string[];
  version: string;
  mode: ScoringMode;
}

/**
 * Provisional index over *available* drivers only. Missing drivers contribute
 * zero weight and are disclosed; they are never replaced with neutral values.
 */
export function calculateProvisionalMCDA(
  engineeredVector: EngineeredVector,
  config = DEFAULT_MCDA_CONFIG
): MCDAResult {
  const explanations: MCDAExplanation[] = [];
  const missing_drivers: string[] = [];
  let score = 0;
  let totalWeightUsed = 0;

  const addDriver = (
    feature: string,
    value: number | null,
    weight: number,
    availableNote: string,
    unavailableNote: string
  ) => {
    if (value === null || !Number.isFinite(value)) {
      missing_drivers.push(feature);
      explanations.push({
        feature,
        value: null,
        weight,
        contribution: 0,
        note: unavailableNote,
        available: false,
      });
      return;
    }
    const bounded = Math.max(0, Math.min(1, value));
    score += bounded * weight;
    totalWeightUsed += weight;
    explanations.push({
      feature,
      value: bounded,
      weight,
      contribution: bounded * weight,
      note: availableNote,
      available: true,
    });
  };

  addDriver(
    'Budget Coverage',
    engineeredVector.norm_budget_ratio ?? null,
    config.weights.budget_ratio,
    'Sufficient budget improves feasibility.',
    'Budget ratio unavailable; excluded from the index.'
  );
  addDriver(
    'Average Demand',
    engineeredVector.norm_avg_demand ?? null,
    config.weights.avg_demand,
    'Based on an in-scope search volume trend.',
    'In-scope demand trend unavailable; excluded from the index.'
  );
  const saturation = engineeredVector.norm_category_saturation;
  addDriver(
    'Market Saturation (Inverse)',
    saturation === null || saturation === undefined ? null : Math.max(0, 1.0 - saturation),
    config.weights.category_saturation_inverse,
    'Lower saturation increases feasibility.',
    'Saturation unavailable; excluded from the index.'
  );
  const trendScore = engineeredVector.trend_slope_score;
  addDriver(
    'Demand Trend',
    trendScore === null || trendScore === undefined ? null : (trendScore + 1.0) / 2.0,
    config.weights.trend_slope,
    trendScore !== null && trendScore !== undefined && trendScore > 0 ? 'Growing trend.' :
      trendScore !== null && trendScore !== undefined && trendScore < 0 ? 'Declining trend.' : 'Stable trend.',
    'Trend direction unavailable; excluded from the index.'
  );
  addDriver(
    'E-commerce Growth',
    engineeredVector.norm_ecommerce_growth ?? null,
    config.weights.ecommerce_growth,
    'Macro market growth factor.',
    'Growth observation unavailable; excluded from the index.'
  );

  if (totalWeightUsed <= 0) {
    return {
      score: null,
      explanations,
      missing_drivers,
      version: config.version,
      mode: 'unavailable' as ScoringMode,
    };
  }

  const boundedScore = Math.max(0, Math.min(1, score / totalWeightUsed));
  return {
    score: boundedScore,
    explanations,
    missing_drivers,
    version: config.version,
    mode: 'provisional_mcda' as ScoringMode,
  };
}

/** Reads and validates FR-4.8 thresholds; invalid configuration fails closed. */
export async function loadScoringThresholds(
  supabase: SupabaseClient
): Promise<{ thresholds?: RiskThresholds; error?: string; status?: number }> {
  const { data, error } = await supabase
    .from('system_config')
    .select('payload')
    .eq('config_key', 'scoring_thresholds')
    .maybeSingle();

  if (error) {
    return { error: `Unable to read scoring thresholds: ${error.message}`, status: 500 };
  }
  if (!data) {
    return { thresholds: DEFAULT_RISK_THRESHOLDS };
  }
  try {
    return {
      thresholds: riskThresholdsFromConfig(
        data.payload,
        DEFAULT_RISK_THRESHOLDS.version
      ),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Invalid scoring threshold configuration.',
      status: 422,
    };
  }
}

function buildUnavailableReport(
  projectId: string,
  processingRunId: string,
  thresholds: RiskThresholds,
  reason: string,
  missingDrivers: string[] = []
) {
  const disclaimer = `${LIMITED_DATA_DISCLAIMER} ${PROVISIONAL_DISCLAIMER}`;
  return {
    project_id: projectId,
    processing_run_id: processingRunId,
    scoring_mode: 'unavailable',
    score_value: null,
    classification: null,
    risk_level: null,
    model_version: 'unavailable',
    threshold_version: thresholds.version,
    status: 'completed',
    evaluation_metrics: {
      status: 'not_applicable',
      reason: 'No score was computed; no supervised model was trained or evaluated.',
    },
    training_provenance: {
      scoring_mode: 'unavailable',
      label_approval_status: 'BLOCKED',
      oi_id: 'OI-6',
      artifact: null,
    },
    disclaimer,
    explanations: {
      reason,
      missing_drivers: missingDrivers,
      configuration_version: DEFAULT_MCDA_CONFIG.version,
      threshold_version: thresholds.version,
      risk_label: null,
      disclaimer,
      label_approval_status: 'BLOCKED',
    },
  };
}

function hasEssentialScoringDrivers(vector: EngineeredVector): boolean {
  // Budget coverage and an in-scope demand observation are required. Without
  // them a weighted index would be driven only by peripheral assumptions.
  return vector.norm_budget_ratio != null && vector.norm_avg_demand != null;
}

export async function processFeasibility(
  supabase: SupabaseClient,
  projectId: string,
  processingRunId: string
) {
  // 1. Fetch processing run and features. An owner of two projects must not be
  // able to attach a run from project A to a score row for project B.
  const { data: run, error: runErr } = await supabase
    .from('project_processing_runs')
    .select('*')
    .eq('id', processingRunId)
    .single();

  if (runErr || !run) {
    return { error: 'Processing run not found', status: 404 };
  }
  if (run.project_id !== projectId) {
    return { error: 'Processing run does not belong to this project.', status: 403 };
  }

  if (run.status !== 'completed' && run.status !== 'partial') {
    return { error: 'Processing run is not ready for scoring.', status: 400 };
  }

  const { data: features, error: featErr } = await supabase
    .from('project_features')
    .select('*')
    .eq('processing_run_id', processingRunId)
    .single();

  if (featErr || !features) {
    return { error: 'Features not found for this run.', status: 404 };
  }

  const thresholdResult = await loadScoringThresholds(supabase);
  if (!thresholdResult.thresholds) {
    return { error: thresholdResult.error, status: thresholdResult.status };
  }
  const thresholds = thresholdResult.thresholds;

  // 2. Evaluate if data is sufficient for ANY score.
  if (run.data_completeness === 'unavailable' || run.quality_score < 40) {
    const result = buildUnavailableReport(
      projectId,
      processingRunId,
      thresholds,
      'Data quality is too poor or essential features are unavailable.'
    );
    const { data: inserted, error: insertErr } = await supabase
      .from('project_feasibility_runs')
      .insert(result)
      .select()
      .single();

    return { data: inserted, error: insertErr };
  }

  // OI-6 is open: supervised feasibility inference is intentionally disabled.
  const vector = features.engineered_vector as EngineeredVector;
  const { score, explanations, missing_drivers, version, mode } = calculateProvisionalMCDA(vector);
  if (
    mode === 'unavailable' ||
    score === null ||
    !hasEssentialScoringDrivers(vector)
  ) {
    const missing = Array.from(
      new Set([
        ...missing_drivers,
        ...(!hasEssentialScoringDrivers(vector)
          ? ['Budget Coverage / Average Demand']
          : []),
      ])
    );
    const result = buildUnavailableReport(
      projectId,
      processingRunId,
      thresholds,
      'Essential budget or in-scope demand drivers are unavailable; no score was computed.',
      missing
    );
    const { data: inserted, error: insertErr } = await supabase
      .from('project_feasibility_runs')
      .insert(result)
      .select()
      .single();

    return { data: inserted, error: insertErr };
  }

  const roundedScore = roundFeasibilityScore(score);
  const risk = classifyRisk(roundedScore, thresholds);
  const classification = classifyFeasibility(roundedScore, thresholds);

  const result = {
    project_id: projectId,
    processing_run_id: processingRunId,
    scoring_mode: mode,
    score_value: roundedScore,
    classification,
    risk_level: risk.level,
    model_version: `provisional_mcda:${version}`,
    threshold_version: thresholds.version,
    status: 'completed',
    evaluation_metrics: {
      status: 'not_applicable',
      reason: 'Provisional MCDA index; no supervised model was trained or evaluated.',
    },
    training_provenance: {
      scoring_mode: mode,
      label_approval_status: 'BLOCKED',
      oi_id: 'OI-6',
      artifact: null,
    },
    disclaimer: `${LIMITED_DATA_DISCLAIMER} ${PROVISIONAL_DISCLAIMER}`,
    explanations: {
      factors: explanations,
      missing_drivers,
      configuration_version: version,
      threshold_version: thresholds.version,
      risk_label: risk.label,
      data_quality: run.quality_score,
      completeness: run.data_completeness,
      disclaimer: `${LIMITED_DATA_DISCLAIMER} ${PROVISIONAL_DISCLAIMER}`,
      label_approval_status: 'BLOCKED',
    },
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('project_feasibility_runs')
    .insert(result)
    .select()
    .single();

  return { data: inserted, error: insertErr };
}
