import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrderStatus } from '@/types/store-management';

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
  const status = url.searchParams.get('status') as OrderStatus | null;
  const search = url.searchParams.get('search')?.toLowerCase() || '';

  let query = supabase.from('orders').select('*, items:order_items(*)').eq('store_id', storeId);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: orders, error: ordersErr } = await query.order('created_at', { ascending: false });

  if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 });

  let filtered = orders || [];
  if (search) {
    filtered = filtered.filter(
      (o) =>
        o.order_number.toLowerCase().includes(search) ||
        o.customer_name.toLowerCase().includes(search) ||
        o.customer_phone.includes(search) ||
        (o.customer_email && o.customer_email.toLowerCase().includes(search))
    );
  }

  return NextResponse.json({ orders: filtered, count: filtered.length });
}

export async function POST(request: Request, context: RouteContext) {
  const { id: storeId } = await context.params;
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
    const { customer_name, customer_phone, customer_email, shipping_address, city, items, payment_method } = body ?? {};

    if (payment_method && payment_method !== 'cod') {
      return NextResponse.json({ error: 'Only cash on delivery is supported.' }, { status: 400 });
    }
    if (typeof customer_name !== 'string' || typeof customer_phone !== 'string' ||
        typeof shipping_address !== 'string' || typeof city !== 'string') {
      return NextResponse.json({ error: 'Customer name, phone, shipping address and city are required.' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 50 ||
        items.some((item) => !item || typeof item.product_id !== 'string' ||
          !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000)) {
      return NextResponse.json({ error: 'Provide 1–50 valid product IDs and integer quantities.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('create_store_cod_order', {
      p_store_id: storeId,
      p_customer_name: customer_name,
      p_customer_phone: customer_phone,
      p_customer_email: typeof customer_email === 'string' ? customer_email : null,
      p_shipping_address: shipping_address,
      p_city: city,
      p_items: items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
    });

    if (error) {
      const clientError = ['22023', '23514', 'P0002'].includes(error.code ?? '');
      return NextResponse.json({ error: clientError ? error.message : 'Unable to create order.' }, { status: clientError ? 400 : 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Malformed order creation payload.' }, { status: 400 });
  }
}
