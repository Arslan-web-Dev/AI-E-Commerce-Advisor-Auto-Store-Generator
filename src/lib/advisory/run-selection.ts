import type { SupabaseClient } from '@supabase/supabase-js';

export interface EligibilityResult<T> {
  data?: T;
  error?: string;
  status?: number;
}

export interface EligibleFeasibilityRun {
  id: string;
  project_id: string;
  processing_run_id: string;
  score_value: number | null;
  classification: string | null;
  scoring_mode: string | null;
  risk_level: string | null;
  status: string;
  created_at: string;
}

/**
 * FR-6.8 frontend contract: the server resolves the newest completed,
 * provisionally scored run. The client never supplies a run id.
 */
export async function resolveLatestEligibleFeasibilityRun(
  supabase: SupabaseClient,
  projectId: string,
): Promise<EligibilityResult<EligibleFeasibilityRun>> {
  const { data, error } = await supabase
    .from('project_feasibility_runs')
    .select(`
      id,
      project_id,
      processing_run_id,
      score_value,
      classification,
      scoring_mode,
      risk_level,
      status,
      created_at
    `)
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .in('scoring_mode', ['provisional_mcda'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return { error: 'Unable to resolve the latest completed feasibility run.', status: 500 };
  }

  const eligible = (data ?? []).find(
    (run) =>
      typeof run.score_value === 'number' &&
      Number.isFinite(run.score_value) &&
      Boolean(run.processing_run_id),
  );

  if (!eligible) {
    return {
      error: 'No completed provisional feasibility run is available for advisory generation.',
      status: 404,
    };
  }

  return { data: eligible as EligibleFeasibilityRun };
}
