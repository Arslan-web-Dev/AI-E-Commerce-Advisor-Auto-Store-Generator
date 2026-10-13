import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id: storeId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).single();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.toLowerCase() || '';

  const { data: customers, error: custErr } = await supabase
    .from('customers')
    .select('*')
    .eq('store_id', storeId)
    .order('total_spend_pkr', { ascending: false });

  if (custErr) return NextResponse.json({ error: custErr.message }, { status: 500 });

  let filtered = customers || [];
  if (search) {
    filtered = filtered.filter(
      (c) =>
        c.full_name.toLowerCase().includes(search) ||
        c.phone.includes(search) ||
        (c.email && c.email.toLowerCase().includes(search)) ||
        (c.city && c.city.toLowerCase().includes(search))
    );
  }

  return NextResponse.json({ customers: filtered, count: filtered.length });
}
