import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertPublishable, parsePublicationAction, publicationResponse } from '@/lib/store-management/publication';

export const dynamic = 'force-dynamic';

/** POST /api/admin/stores/[id]/publish — explicit publish/unpublish action. */
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

  const parsed = parsePublicationAction(await req.json().catch(() => null));
  if (!parsed.ok || !parsed.input) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status ?? 400 });
  }

  const { data: store } = await supabase
    .from('stores')
    .select('id, slug, status, is_banned, custom_domain, domain_status, published_at, unpublished_at')
    .eq('id', id)
    .maybeSingle();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  if (parsed.input.action === 'publish') {
    const readiness = assertPublishable(store as typeof store & { id: string; slug: string });
    if (!readiness.ok) return NextResponse.json({ error: readiness.error }, { status: readiness.status ?? 400 });
  }

  const { data, error } = await supabase.rpc('set_store_publication', {
    p_store_id: id,
    p_publish: parsed.input.action === 'publish',
    p_actor_id: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rpcRow = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  const status = typeof rpcRow?.status === 'string' ? rpcRow.status : parsed.input.action;
  return NextResponse.json(publicationResponse({
    store: { ...store, id: String(store.id), slug: String(store.slug), status },
    action: parsed.input.action,
    host: req.headers.get('x-forwarded-host') || req.headers.get('host'),
  }));
}
