import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** POST /api/admin/stores/[id]/suspend — explicit suspend/unsuspend action. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  let banned: boolean | null = null;
  if (body?.action === 'suspend' || body?.is_banned === true) banned = true;
  else if (body?.action === 'unsuspend' || body?.is_banned === false) banned = false;
  if (banned === null) {
    return NextResponse.json({ error: 'An explicit suspend or unsuspend action is required.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('set_store_admin_state', {
    p_store_id: id,
    p_banned: banned,
    p_actor_id: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return NextResponse.json({
    id,
    is_banned: row?.is_banned ?? banned,
    status: row?.status ?? (banned ? 'draft' : undefined),
  });
}
