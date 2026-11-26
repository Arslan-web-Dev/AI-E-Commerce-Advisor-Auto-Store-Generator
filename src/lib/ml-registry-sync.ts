import type { createClient } from '@/lib/supabase/server';
import type { TrainingJobResponse } from '@/lib/ml-client';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Persist a truthful registry row for a COMPLETED experimental training job.
 *
 * Idempotent by python_model_id and never auto-activates. OI-6 approval state is
 * copied from the Python artifact decision, never inferred from a job status.
 */
export async function syncCompletedTrainingJob(
  supabase: SupabaseServerClient,
  job: TrainingJobResponse,
  userId: string,
  disclaimer: string,
  liveOi6Approved: boolean
): Promise<{ synced: boolean; reason?: string; model_id?: string }> {
  const results = job.results;
  if (!results?.best_model_id) {
    return { synced: false, reason: 'Job has no completed artifact yet.' };
  }

  const pythonModelId = String(results.best_model_id);
  const { data: existing, error: lookupError } = await supabase
    .from('model_registry')
    .select('id')
    .eq('configuration->>python_model_id', pythonModelId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Unable to verify model registry state: ${lookupError.message}`);
  }
  if (existing) {
    return { synced: false, reason: 'Registry row already exists.', model_id: pythonModelId };
  }

  // Only a live, genuine approval may be recorded as registry approval. A job
  // stamped APPROVED while an earlier policy was open is no longer approved.
  const labelApprovalStatus = liveOi6Approved && results.label_approval_status === 'APPROVED'
    ? 'APPROVED'
    : 'BLOCKED';
  const trainingMode = liveOi6Approved && results.training_mode === 'production'
    ? 'production'
    : 'experimental_sandbox';
  const { error: insertError } = await supabase.from('model_registry').insert({
    name: results.best_model_name || 'ML candidate',
    version: results.artifact_version || `unversioned-${job.job_id}`,
    scoring_mode: 'supervised_model',
    is_active: false,
    configuration: {
      python_model_id: pythonModelId,
      algorithm: results.best_algorithm,
      problem_type: job.problem_type,
      dataset_id: job.dataset_id,
      feature_columns: results.feature_columns || [],
      feature_schema_version: results.feature_schema_version || null,
    },
    evaluation_metrics: {
      holdout: results.test_metrics || {},
      cross_validation: results.cv_metrics || {},
      selection_basis: 'holdout selection metric on synthetic sandbox data; not a production performance estimate',
    },
    validation_metrics: results.test_metrics || {},
    cv_metrics: results.cv_metrics || {},
    training_dataset_ref: job.dataset_id,
    artifact_path: results.artifact_path || null,
    artifact_version: results.artifact_version || null,
    dataset_fingerprint: results.dataset_fingerprint || null,
    label_approval_status: labelApprovalStatus,
    training_mode: trainingMode,
    feature_schema_version: results.feature_schema_version || null,
    comparison_report_path: results.comparison_report_path || null,
    training_provenance: {
      dataset_id: job.dataset_id,
      target_column: job.target_column,
      training_mode: trainingMode,
      approved_for_production: liveOi6Approved && results.approved_for_production === true,
      comparison_report_path: results.comparison_report_path || null,
      disclaimer,
    },
    created_by: userId,
  });

  if (insertError) {
    throw new Error(`Registry sync failed: ${insertError.message}`);
  }
  return { synced: true, model_id: pythonModelId };
}
