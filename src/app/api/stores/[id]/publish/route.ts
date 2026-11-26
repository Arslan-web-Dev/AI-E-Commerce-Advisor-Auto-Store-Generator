import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizationFailure, canManageStore } from '@/lib/store-management/authorization';
import { assertPublishable, parsePublicationAction, publicationResponse } from '@/lib/store-management/publication';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const failure = authorizationFailure('unauthorized');
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }

  const parsed = parsePublicationAction(await req.json().catch(() => null));
  if (!parsed.ok || !parsed.input) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status ?? 400 });
  }

  const { data: store, error: fetchErr } = await supabase
    .from('stores')
    .select('id, owner_id, slug, status, is_banned, custom_domain, domain_status, published_at, unpublished_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !store) {
    const failure = authorizationFailure('not_found');
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!canManageStore(user, store, profile)) {
    const failure = authorizationFailure('forbidden');
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }

  if (parsed.input.action === 'publish') {
    const readiness = assertPublishable(store as typeof store & { id: string; slug: string });
    if (!readiness.ok) return NextResponse.json({ error: readiness.error }, { status: readiness.status ?? 400 });
  }

  const { data, error: rpcErr } = await supabase.rpc('set_store_publication', {
    p_store_id: id,
    p_publish: parsed.input.action === 'publish',
    p_actor_id: user.id,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message || 'Publication update failed.' }, { status: 500 });
  }

  const rpcRow = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  const status = typeof rpcRow?.status === 'string' ? rpcRow.status : parsed.input.action;
  const response = publicationResponse({
    store: {
      ...store,
      id: String(store.id),
      slug: String(store.slug),
      status,
    },
    action: parsed.input.action,
    host: req.headers.get('x-forwarded-host') || req.headers.get('host'),
  });

  return NextResponse.json(response);
}
