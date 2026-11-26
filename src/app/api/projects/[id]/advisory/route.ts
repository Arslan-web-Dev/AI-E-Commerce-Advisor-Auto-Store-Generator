import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAdvisoryReport } from '@/lib/advisory/generator';
import { resolveLatestEligibleFeasibilityRun } from '@/lib/advisory/run-selection';
import {
  mergeActionStates,
  type ActionItem,
  type PersistedActionState,
} from '@/lib/advisory/action-matrix';

type Context = { params: Promise<{ id: string }> };

function readActionMatrix(metadata: unknown): ActionItem[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const value = (metadata as Record<string, unknown>).action_matrix;
  return Array.isArray(value) ? (value as ActionItem[]) : [];
}

function readActionStates(data: unknown): PersistedActionState[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const record = row as Record<string, unknown>;
    if (typeof record.item_key !== 'string' || typeof record.is_completed !== 'boolean') return [];
    return [{
      item_key: record.item_key,
      is_completed: record.is_completed,
      completed_at: typeof record.completed_at === 'string' ? record.completed_at : null,
    }];
  });
}

// GET latest advisory report with owner-scoped checklist state merged in.
export async function GET(_request: Request, { params }: Context) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const { data: report, error } = await supabase
    .from('project_advisory_reports')
    .select(`
      *,
      project_feasibility_runs (
        score_value,
        classification,
        scoring_mode,
        risk_level,
        model_version,
        explanations
      ),
      projects (
        category,
        target_location,
        budget_amount,
        budget_currency
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch advisory report' }, { status: 500 });
  }

  if (!report) {
    return NextResponse.json({ data: null });
  }

  const { data: states, error: stateError } = await supabase
    .from('advisory_action_states')
    .select('item_key, is_completed, completed_at')
    .eq('report_id', report.id)
    .eq('owner_id', user.id);

  const metadata =
    report.metadata && typeof report.metadata === 'object'
      ? { ...(report.metadata as Record<string, unknown>) }
      : {};
  if (!stateError) {
    metadata.action_matrix = mergeActionStates(readActionMatrix(metadata), readActionStates(states));
  }

  return NextResponse.json({ data: { ...report, metadata } });
}

// POST resolves the latest eligible run on the server; the client sends no run id.
export async function POST(_request: Request, { params }: Context) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found or inaccessible.' }, { status: 404 });
  }

  const resolved = await resolveLatestEligibleFeasibilityRun(supabase, projectId);
  if (resolved.error || !resolved.data) {
    return NextResponse.json(
      { error: resolved.error ?? 'No eligible feasibility run.' },
      { status: resolved.status ?? 404 },
    );
  }

  const result = await generateAdvisoryReport(supabase, projectId, resolved.data.id, user.id);
  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({ data: result.data });
}
