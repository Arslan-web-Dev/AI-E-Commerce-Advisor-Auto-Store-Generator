import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient, type TrainingJobResponse } from '@/lib/ml-client';
import { syncCompletedTrainingJob } from '@/lib/ml-registry-sync';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { supabase: null, userId: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || profile?.role !== 'admin') {
    return {
      supabase: null,
      userId: null,
      response: NextResponse.json({ error: profileError ? 'Unable to verify administrator access' : 'Forbidden. Admin role required.' }, { status: profileError ? 500 : 403 }),
    } as const;
  }
  return { supabase, userId: user.id, response: null } as const;
}

/** Called after a background job reaches `completed`; re-reads the job server-side. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const jobId = body?.job_id;
    if (typeof jobId !== 'string' || !jobId.trim()) {
      return NextResponse.json({ error: 'A non-empty job_id is required.' }, { status: 400 });
    }

    // Re-fetch from the ML service so a client cannot forge results or approval.
    const job: TrainingJobResponse = await mlClient.getTrainingJob(jobId);
    if (job.status !== 'completed') {
      return NextResponse.json({ error: 'Only completed jobs can be registered.', status: job.status }, { status: 409 });
    }

    const policy = await mlClient.getTrainingPolicy();
    const liveApproved = policy.label_policy.status === 'APPROVED'
      && policy.label_policy.oi6_validation?.approved === true;
    const sync = await syncCompletedTrainingJob(
      auth.supabase, job, auth.userId, policy.limited_data_disclaimer, liveApproved
    );
    return NextResponse.json({ sync });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to synchronise training registry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
