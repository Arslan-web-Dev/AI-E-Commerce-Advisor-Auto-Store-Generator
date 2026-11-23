import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch store and check authorization
  const { data: store, error: fetchErr } = await supabase
    .from('stores')
    .select('id, project_id, is_published, is_banned, slug')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  if (store.is_banned) {
    return NextResponse.json({ error: 'This store has been suspended by administration and cannot be published.' }, { status: 403 });
  }

  // Toggle publish status
  const nextPublished = !store.is_published;
  const { error: updateErr } = await supabase
    .from('stores')
    .update({ is_published: nextPublished })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    id: store.id,
    is_published: nextPublished,
    slug: store.slug,
    public_url: nextPublished ? `/${store.slug}` : null,
  });
}
