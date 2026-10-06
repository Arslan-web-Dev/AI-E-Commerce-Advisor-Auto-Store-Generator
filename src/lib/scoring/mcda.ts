import { SupabaseClient } from '@supabase/supabase-js';

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

export function classifyScore(score: number): Classification {
  if (score >= 0.75) return 'High Feasibility';
  if (score >= 0.55) return 'Medium Feasibility';
  if (score >= 0.35) return 'Low Feasibility';
  return 'Not Feasible';
}

export function calculateProvisionalMCDA(engineeredVector: any, config = DEFAULT_MCDA_CONFIG) {
  const explanations: any[] = [];
  let score = 0;
  let totalWeightUsed = 0;

  // 1. Budget Ratio
  const budgetVal = engineeredVector.norm_budget_ratio ?? 0;
  const budgetWeight = config.weights.budget_ratio;
  score += budgetVal * budgetWeight;
  totalWeightUsed += budgetWeight;
  explanations.push({
    feature: 'Budget Coverage',
    value: budgetVal,
    weight: budgetWeight,
    contribution: budgetVal * budgetWeight,
    note: budgetVal === 0 ? 'Missing or zero budget ratio.' : 'Sufficient budget improves feasibility.',
  });

  // 2. Average Demand
  const demandVal = engineeredVector.norm_avg_demand ?? 0;
  const demandWeight = config.weights.avg_demand;
  score += demandVal * demandWeight;
  totalWeightUsed += demandWeight;
  explanations.push({
    feature: 'Average Demand',
    value: demandVal,
    weight: demandWeight,
    contribution: demandVal * demandWeight,
    note: 'Based on search volume trends.',
  });

  // 3. Category Saturation (Inverse)
  let satVal = 0.5; // default if missing
  let satNote = 'Saturation missing, applying neutral penalty.';
  if (engineeredVector.norm_category_saturation !== undefined && engineeredVector.norm_category_saturation !== null) {
    satVal = Math.max(0, 1.0 - engineeredVector.norm_category_saturation);
    satNote = 'Lower saturation increases feasibility.';
  }
  const satWeight = config.weights.category_saturation_inverse;
  score += satVal * satWeight;
  totalWeightUsed += satWeight;
  explanations.push({
    feature: 'Market Saturation (Inverse)',
    value: satVal,
    weight: satWeight,
    contribution: satVal * satWeight,
    note: satNote,
  });

  // 4. Trend Slope
  let trendVal = 0.5; // default stable
  let trendNote = 'Stable trend.';
  if (engineeredVector.trend_slope_score !== undefined) {
    trendVal = (engineeredVector.trend_slope_score + 1.0) / 2.0; // [-1, 1] -> [0, 1]
    if (engineeredVector.trend_slope_score > 0) trendNote = 'Growing trend.';
    else if (engineeredVector.trend_slope_score < 0) trendNote = 'Declining trend.';
  }
  const trendWeight = config.weights.trend_slope;
  score += trendVal * trendWeight;
  totalWeightUsed += trendWeight;
  explanations.push({
    feature: 'Demand Trend',
    value: trendVal,
    weight: trendWeight,
    contribution: trendVal * trendWeight,
    note: trendNote,
  });

  // 5. E-commerce Growth
  const growthVal = engineeredVector.norm_ecommerce_growth ?? 0.5;
  const growthWeight = config.weights.ecommerce_growth;
  score += growthVal * growthWeight;
  totalWeightUsed += growthWeight;
  explanations.push({
    feature: 'E-commerce Growth',
    value: growthVal,
    weight: growthWeight,
    contribution: growthVal * growthWeight,
    note: 'Macro market growth factor.',
  });

  // Normalize if weights didn't sum to exactly 1.0
  const finalScore = totalWeightUsed > 0 ? score / totalWeightUsed : 0;
  
  // Ensure [0, 1] bounds
  const boundedScore = Math.max(0, Math.min(1.0, finalScore));

  return {
    score: boundedScore,
    explanations,
    version: config.version,
    mode: 'provisional_mcda' as ScoringMode,
  };
}

export async function processFeasibility(supabase: SupabaseClient, projectId: string, processingRunId: string) {
  // 1. Fetch processing run and features
  const { data: run, error: runErr } = await supabase
    .from('project_processing_runs')
    .select('*')
    .eq('id', processingRunId)
    .single();

  if (runErr || !run) {
    return { error: 'Processing run not found', status: 404 };
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

  // 2. Evaluate if data is sufficient for ANY score
  if (run.data_completeness === 'unavailable' || run.quality_score < 40) {
    // Cannot produce a defensible score
    const result = {
      project_id: projectId,
      processing_run_id: processingRunId,
      scoring_mode: 'unavailable',
      status: 'completed',
      explanations: { reason: 'Data quality is too poor or essential features are unavailable.' },
    };

    const { data: inserted, error: insertErr } = await supabase
      .from('project_feasibility_runs')
      .insert(result)
      .select()
      .single();

    return { data: inserted, error: insertErr };
  }

  // 3. Supervised Model Readiness Check
  // We statically know supervised_model is unavailable per step 1, but we could check the model_registry if we wanted to support dynamic switching.
  // We'll proceed with provisional_mcda.
  const { score, explanations, version, mode } = calculateProvisionalMCDA(features.engineered_vector);
  const classification = classifyScore(score);

  const result = {
    project_id: projectId,
    processing_run_id: processingRunId,
    scoring_mode: mode,
    score_value: parseFloat(score.toFixed(4)),
    classification,
    status: 'completed',
    explanations: {
      factors: explanations,
      configuration_version: version,
      data_quality: run.quality_score,
      completeness: run.data_completeness,
      disclaimer: 'This score is a Provisional MCDA Index based on heuristic weighting. It is NOT a calibrated probability from a supervised ML model.'
    },
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('project_feasibility_runs')
    .insert(result)
    .select()
    .single();

  return { data: inserted, error: insertErr };
}
