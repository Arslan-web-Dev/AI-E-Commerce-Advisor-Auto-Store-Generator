import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveProjectStore } from '@/lib/store-management/project-store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const result = await resolveProjectStore(supabase, projectId, user.id, profile?.role === 'admin');
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ store: result.store, is_new: result.is_new });
}
