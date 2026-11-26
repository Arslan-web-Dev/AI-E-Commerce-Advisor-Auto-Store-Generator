import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient } from '@/lib/ml-client';
import { syncCompletedTrainingJob } from '@/lib/ml-registry-sync';

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

    const policy = await mlClient.getTrainingPolicy();
    const normalizedTarget = String(target_column).toLowerCase();
    const usesRuleLabel = normalizedTarget === 'feasibility_class' || normalizedTarget === 'feasibility_score';
    const oi6Warning = usesRuleLabel && policy.label_policy.status !== 'APPROVED'
      ? {
          error:
            'OI-6 is open. This run is an EXPERIMENTAL SANDBOX run only: the rule-generated label formula has no supervisor approval, and the artifact will be ineligible for production activation or customer-facing scoring.',
          policy: policy.label_policy,
          acknowledged: true,
        }
      : null;

    // The Python service owns the gate and records the exact approval state on
    // the artifact. Training is permitted for experimental sandbox purposes;
    // production activation is blocked separately.
    const job = await mlClient.startTraining({
      dataset_id,
      target_column,
      problem_type,
      candidate_algorithms,
      cv_folds: cv_folds || 5,
      test_size: test_size || 0.2,
    });

    // TestClient/synchronous implementations may return a finished job. Persist
    // its metadata when present; the normal async path uses /api/ml/train/sync.
    if (job.status === 'completed' && job.results?.best_model_id) {
      const liveApproved = policy.label_policy.status === 'APPROVED'
        && policy.label_policy.oi6_validation?.approved === true;
      const sync = await syncCompletedTrainingJob(
        supabase, job, userId, policy.limited_data_disclaimer, liveApproved
      );
      if (!sync.synced && !sync.reason?.includes('already exists')) {
        return NextResponse.json({ error: sync.reason || 'Registry sync failed', job }, { status: 500 });
      }
    }

    return NextResponse.json({ job, oi6_warning: oi6Warning }, { status: 202 });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to start training';
    if (message.includes('409')) {
      return NextResponse.json({ error: 'A training job for this dataset and target is already active.', detail: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
