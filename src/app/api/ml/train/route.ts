import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient } from '@/lib/ml-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('job_id');

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { dataset_id, target_column, problem_type, candidate_algorithms, cv_folds, test_size } = body;

    if (!dataset_id || !target_column || !problem_type) {
      return NextResponse.json({ error: 'dataset_id, target_column, and problem_type are required' }, { status: 400 });
    }

    const job = await mlClient.startTraining({
      dataset_id,
      target_column,
      problem_type,
      candidate_algorithms,
      cv_folds: cv_folds || 5,
      test_size: test_size || 0.2,
    });

    // Sync best model to model_registry in Supabase if completed
    if (job?.results?.best_model_id && job?.results?.best_model_name) {
      try {
        await supabase.from('model_registry').insert({
          name: job.results.best_model_name,
          version: `v1.${Date.now().toString().slice(-4)}`,
          scoring_mode: 'supervised_model',
          is_active: true,
          configuration: {
            algorithm: job.results.best_algorithm,
            problem_type: job.problem_type,
            test_f1: job.results.best_score,
            cv_mean: job.results.leaderboard?.[0]?.cv_score,
            dataset_id: job.dataset_id,
          },
        });
      } catch (dbSyncErr) {
        console.warn('Could not sync to model_registry table:', dbSyncErr);
      }
    }

    return NextResponse.json({ job });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to start training';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
