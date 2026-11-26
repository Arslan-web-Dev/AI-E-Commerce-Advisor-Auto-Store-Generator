import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ id: string; actionId: string }> };
const ACTION_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

function actionExists(metadata: unknown, actionId: string): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const matrix = (metadata as Record<string, unknown>).action_matrix;
  if (!Array.isArray(matrix)) return false;
  return matrix.some((item) => {
    if (!item || typeof item !== 'object') return false;
    return (item as Record<string, unknown>).id === actionId;
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId, actionId } = await params;
  if (!ACTION_ID.test(actionId)) {
    return NextResponse.json({ error: 'Invalid action identifier.' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  if (
    Object.keys(payload).length !== 1 ||
    typeof payload.completed !== 'boolean'
  ) {
    return NextResponse.json(
      { error: 'Body must contain only a boolean completed field.' },
      { status: 400 },
    );
  }

  const { data: report, error: reportError } = await supabase
    .from('project_advisory_reports')
    .select('id, metadata')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reportError || !report) {
    return NextResponse.json({ error: 'Advisory report not found.' }, { status: 404 });
  }
  if (!actionExists(report.metadata, actionId)) {
    return NextResponse.json({ error: 'Action item not found in this report.' }, { status: 404 });
  }

  const completedAt = payload.completed ? new Date().toISOString() : null;
  const { data: state, error: upsertError } = await supabase
    .from('advisory_action_states')
    .upsert({
      report_id: report.id,
      item_key: actionId,
      owner_id: user.id,
      is_completed: payload.completed,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'report_id,owner_id,item_key' })
    .select('item_key, is_completed, completed_at, updated_at')
    .single();

  if (upsertError) {
    return NextResponse.json({ error: 'Unable to save action state.' }, { status: 500 });
  }

  return NextResponse.json({ data: state });
}
