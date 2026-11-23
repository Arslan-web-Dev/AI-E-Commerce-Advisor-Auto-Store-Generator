import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** POST /api/admin/stores/[id]/publish — toggle is_published */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: store } = await supabase.from('stores').select('id, is_published').eq('id', id).maybeSingle();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const newPublished = !store.is_published;
  await supabase.from('stores').update({ is_published: newPublished }).eq('id', id);

  return NextResponse.json({ is_published: newPublished });
}
