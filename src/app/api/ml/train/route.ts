import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient } from '@/lib/ml-client';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase: null, userId: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    return {
      supabase: null,
      userId: null,
      response: NextResponse.json({ error: 'Unable to verify administrator access' }, { status: 500 }),
    } as const;
  }
  if (profile?.role !== 'admin') {
    return {
      supabase: null,
      userId: null,
      response: NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 }),
    } as const;
  }
  return { supabase, userId: user.id, response: null } as const;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const jobId = new URL(request.url).searchParams.get('job_id');
  if (!jobId) {
    return NextResponse.json({ error: 'job_id query parameter is required' }, { status: 400 });
  }

  try {
    const job = await mlClient.getTrainingJob(jobId);
    return NextResponse.json({ job });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to get job status';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { supabase, userId } = auth;

  try {
    const body = await request.json();
    const { dataset_id, target_column, problem_type, candidate_algorithms, cv_folds, test_size } = body;

    if (!dataset_id || !target_column || !problem_type) {
      return NextResponse.json({ error: 'dataset_id, target_column, and problem_type are required' }, { status: 400 });
    }
    if (problem_type !== 'classification' && problem_type !== 'regression') {
      return NextResponse.json({ error: 'problem_type must be classification or regression' }, { status: 400 });
    }

    // The Python service owns the OI-6 gate. Check it before starting a job so
    // the admin console receives an actionable error rather than a failed job.
    const policy = await mlClient.getTrainingPolicy();
    const normalizedTarget = String(target_column).toLowerCase();
    if (
      policy.label_policy.status !== 'APPROVED' &&
      (normalizedTarget === 'feasibility_class' || normalizedTarget === 'feasibility_score')
    ) {
      return NextResponse.json(
        {
          error: 'Training blocked by OI-6: no supervisor-approved rule-label formula and weights are recorded.',
          policy: policy.label_policy,
        },
        { status: 422 }
      );
    }

    const job = await mlClient.startTraining({
      dataset_id,
      target_column,
      problem_type,
      candidate_algorithms,
      cv_folds: cv_folds || 5,
      test_size: test_size || 0.2,
    });

    // Persist truthful artifact metadata. Supervised artifacts are never
    // auto-active because OI-6 may still be open and activation is explicit.
    if (job?.results?.best_model_id) {
      const results = job.results;
      const { error: syncError } = await supabase.from('model_registry').insert({
        name: results.best_model_name || 'ML candidate',
        version: results.artifact_version || `unversioned-${job.job_id}`,
        scoring_mode: 'supervised_model',
        is_active: false,
        configuration: {
          python_model_id: results.best_model_id,
          algorithm: results.best_algorithm,
          problem_type: job.problem_type,
          dataset_id: job.dataset_id,
          feature_names: results.feature_names || [],
        },
        evaluation_metrics: {
          holdout: results.test_metrics || {},
          cross_validation: results.cv_metrics || {},
          test_metrics: results.test_metrics || {},
          cv_metrics: results.cv_metrics || {},
        },
        validation_metrics: results.test_metrics || {},
        cv_metrics: results.cv_metrics || {},
        training_dataset_ref: job.dataset_id,
        artifact_path: results.artifact_path,
        artifact_version: results.artifact_version,
        dataset_fingerprint: results.dataset_fingerprint,
        label_approval_status: results.label_approval_status || 'BLOCKED',
        training_provenance: {
          dataset_id: job.dataset_id,
          target_column: job.target_column,
          disclaimer: policy.limited_data_disclaimer,
        },
        created_by: userId,
      });

      if (syncError) {
        return NextResponse.json(
          { error: `Training completed but registry sync failed: ${syncError.message}`, job },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ job });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to start training';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
