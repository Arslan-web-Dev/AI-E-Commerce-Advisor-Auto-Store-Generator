import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient } from '@/lib/ml-client';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { input_features, model_id, project_id } = body;

    if (!input_features || typeof input_features !== 'object') {
      return NextResponse.json({ error: 'input_features object is required' }, { status: 400 });
    }

    const prediction = await mlClient.predict(input_features, model_id);

    // If project_id is provided, optionally log feasibility run
    if (project_id) {
      try {
        // Can optionally log to project_feasibility_runs
      } catch {
        // Safe ignore
      }
    }

    return NextResponse.json({ prediction });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Prediction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
