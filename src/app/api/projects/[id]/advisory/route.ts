import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAdvisoryReport } from '@/lib/advisory/generator';

// GET latest advisory report
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  const { data: report, error } = await supabase
    .from('project_advisory_reports')
    .select(`
      *,
      project_feasibility_runs (
        score_value,
        classification,
        scoring_mode,
        explanations
      ),
      projects (
        category,
        target_location,
        budget_amount
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to fetch advisory report' }, { status: 500 });
  }

  return NextResponse.json({ data: report || null });
}

// POST to trigger a new advisory report
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
    const { feasibility_run_id } = body;

    if (!feasibility_run_id) {
      return NextResponse.json({ error: 'feasibility_run_id is required' }, { status: 400 });
    }

    const result = await generateAdvisoryReport(supabase, projectId, feasibility_run_id);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json({ data: result.data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
