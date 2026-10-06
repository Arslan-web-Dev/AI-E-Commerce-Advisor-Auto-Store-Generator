import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET all registered models (Admin only)
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Implement actual Admin Role Check (e.g. from user metadata or a roles table)
  // if (user.app_metadata.role !== 'admin') {
  //   return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
  // }

  const { data, error } = await supabase
    .from('model_registry')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST to register a new model (Admin only)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // TODO: Implement actual Admin Role Check
  // if (user.app_metadata.role !== 'admin') {
  //   return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
  // }

  try {
    const body = await request.json();
    const { name, version, scoring_mode, configuration, evaluation_metrics, training_dataset_ref } = body;

    if (!name || !version || !scoring_mode) {
      return NextResponse.json({ error: 'name, version, and scoring_mode are required' }, { status: 400 });
    }

    if (scoring_mode === 'supervised_model' && !training_dataset_ref) {
       return NextResponse.json({ error: 'training_dataset_ref is required for supervised models' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('model_registry')
      .insert({
        name,
        version,
        scoring_mode,
        configuration: configuration || {},
        evaluation_metrics: evaluation_metrics || {},
        training_dataset_ref,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
