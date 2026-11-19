import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase: null,
      userId: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as const;
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
      response: NextResponse.json({ error: 'Forbidden. Administrator access required.' }, { status: 403 }),
    } as const;
  }

  return { supabase, userId: user.id, response: null } as const;
}

// GET all registered models (Admin only)
export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { supabase } = auth;

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
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { supabase, userId } = auth;

  try {
    const body = await request.json();
    const { name, version, scoring_mode, configuration, evaluation_metrics, training_dataset_ref } = body;

    if (typeof name !== 'string' || !name.trim() || typeof version !== 'string' || !version.trim()) {
      return NextResponse.json({ error: 'name, version, and scoring_mode are required' }, { status: 400 });
    }

    if (scoring_mode !== 'supervised_model' && scoring_mode !== 'provisional_mcda') {
      return NextResponse.json({ error: 'scoring_mode must be supervised_model or provisional_mcda' }, { status: 400 });
    }

    if (scoring_mode === 'supervised_model' && !training_dataset_ref) {
       return NextResponse.json({ error: 'training_dataset_ref is required for supervised models' }, { status: 400 });
    }

    if (configuration !== undefined && (configuration === null || typeof configuration !== 'object' || Array.isArray(configuration))) {
      return NextResponse.json({ error: 'configuration must be a JSON object' }, { status: 400 });
    }

    if (evaluation_metrics !== undefined && evaluation_metrics !== null && (typeof evaluation_metrics !== 'object' || Array.isArray(evaluation_metrics))) {
      return NextResponse.json({ error: 'evaluation_metrics must be a JSON object or null' }, { status: 400 });
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
        created_by: userId
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
