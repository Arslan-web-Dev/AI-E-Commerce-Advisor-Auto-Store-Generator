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

  try {
    const body = await request.json();
    const {
      customer_name,
      customer_phone,
      customer_email,
      shipping_address,
      city = 'Lahore',
      payment_method = 'cod',
      items = [],
      shipping_fee_pkr = 200,
      notes,
    } = body;

    if (!customer_name || !customer_phone || !shipping_address) {
      return NextResponse.json(
        { error: 'Customer name, phone number, and shipping address are required.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Order must contain at least one item.' }, { status: 400 });
    }

    // Compute line items totals
    let subtotalPkr = 0;
    const validatedItems = items.map((item: any) => {
      const unitPrice = Math.round(Number(item.unit_price_pkr) || 0);
      const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
      const lineTotal = unitPrice * quantity;
      subtotalPkr += lineTotal;
      return {
        product_id: item.product_id || null,
        name: item.name || 'Custom Product',
        sku: item.sku || null,
        unit_price_pkr: unitPrice,
        quantity,
        total_price_pkr: lineTotal,
      };
    });

    const taxPkr = 0; // Tax configuration
    const shippingFee = Math.round(Number(shipping_fee_pkr) || 0);
    const grandTotal = subtotalPkr + taxPkr + shippingFee;

    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const nowIso = new Date().toISOString();

    const initialHistory = [
      {
        status: 'pending',
        changed_at: nowIso,
        actor: user.email || 'Merchant',
        notes: notes || 'Order placed',
      },
    ];

    // 1. Insert order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        store_id: storeId,
        order_number: orderNumber,
        customer_name: customer_name.trim(),
        customer_phone: customer_phone.trim(),
        customer_email: customer_email?.trim() || null,
        shipping_address: shipping_address.trim(),
        city: city.trim(),
        payment_method: payment_method === 'cod' ? 'cod' : 'card_mock',
        payment_status: 'pending',
        fulfillment_status: 'unfulfilled',
        subtotal_pkr: subtotalPkr,
        shipping_fee_pkr: shippingFee,
        tax_pkr: taxPkr,
        total_pkr: grandTotal,
        status: 'pending',
        status_history: initialHistory,
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

    // 2. Insert order items
    const itemsToInsert = validatedItems.map((item: any) => ({
      order_id: order.id,
      ...item,
    }));

    await supabase.from('order_items').insert(itemsToInsert);

    // 3. Upsert customer profile
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, total_orders, total_spend_pkr')
      .eq('store_id', storeId)
      .eq('phone', customer_phone.trim())
      .maybeSingle();

    if (existingCustomer) {
      await supabase
        .from('customers')
        .update({
          full_name: customer_name.trim(),
          email: customer_email?.trim() || null,
          city: city.trim(),
          address: shipping_address.trim(),
          total_orders: existingCustomer.total_orders + 1,
          total_spend_pkr: existingCustomer.total_spend_pkr + grandTotal,
          last_order_at: nowIso,
        })
        .eq('id', existingCustomer.id);
    } else {
      await supabase.from('customers').insert({
        store_id: storeId,
        full_name: customer_name.trim(),
        phone: customer_phone.trim(),
        email: customer_email?.trim() || null,
        city: city.trim(),
        address: shipping_address.trim(),
        total_orders: 1,
        total_spend_pkr: grandTotal,
        last_order_at: nowIso,
      });
    }

    return NextResponse.json({ order, order_number: orderNumber }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Malformed order creation payload' }, { status: 400 });
  }
}
