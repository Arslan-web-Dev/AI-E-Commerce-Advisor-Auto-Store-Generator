import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processFeasibility } from '@/lib/scoring/mcda';

// GET latest feasibility score for a project
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  // Check project access (implicitly done by RLS, but explicit is good)
  const { data: run, error } = await supabase
    .from('project_feasibility_runs')
    .select(`
      *,
      project_processing_runs (
        quality_score,
        data_completeness,
        created_at
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to fetch feasibility run' }, { status: 500 });
  }

  if (!run) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({ data: run });
}

// POST to trigger a new feasibility scoring run
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  try {
    const body = await request.json();
    const { processing_run_id } = body;

    if (!processing_run_id) {
      return NextResponse.json({ error: 'processing_run_id is required' }, { status: 400 });
    }

    // Process
    const result = await processFeasibility(supabase, projectId, processing_run_id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ data: result.data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
