import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string; orderId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id: storeId, orderId } = await context.params;
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

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .eq('store_id', storeId)
    .single();

  if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  return NextResponse.json({ order });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: storeId, orderId } = await context.params;
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).maybeSingle();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const targetStatus = body?.status;
    const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 1000) : null;
    const allowed = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (typeof targetStatus !== 'string' || !allowed.includes(targetStatus)) {
      return NextResponse.json({ error: 'A valid target status is required.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('transition_store_order', {
      p_store_id: storeId,
      p_order_id: orderId,
      p_target_status: targetStatus,
      p_notes: notes,
    });

    if (error) {
      const status = error.code === 'P0002' ? 404 :
        error.code === '42501' ? 403 :
        ['22023', '23514', '23503'].includes(error.code ?? '') ? 400 : 500;
      return NextResponse.json({ error: status === 500 ? 'Unable to update order status.' : error.message }, { status });
    }
    return NextResponse.json({ ...data, message: `Order transitioned to '${targetStatus}'.` });
  } catch {
    return NextResponse.json({ error: 'Malformed order status update request.' }, { status: 400 });
  }
}
