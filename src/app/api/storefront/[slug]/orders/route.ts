import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Simple IP-based rate limit: max 10 orders/hour per IP (in-process store)
const orderRateMap = new Map<string, number[]>();

function checkOrderRateLimit(ip: string): boolean {
  const now = Date.now();
  const window = 60 * 60 * 1000;
  const times = (orderRateMap.get(ip) || []).filter((t) => now - t < window);
  if (times.length >= 10) return false;
  times.push(now);
  orderRateMap.set(ip, times);
  return true;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Rate limit check
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkOrderRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many orders. Please try again later.' }, { status: 429 });
  }

  const supabase = await createClient();

  const { data: store } = await supabase
    .from('stores')
    .select('id, is_published, is_banned')
    .eq('slug', slug)
    .maybeSingle();

  if (!store || !store.is_published || store.is_banned) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  let body: {
    store_id: string;
    customer_name: string;
    phone: string;
    delivery_address: string;
    city: string;
    notes?: string;
    items: Array<{ product_id: string; qty: number }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { customer_name, phone, delivery_address, city, notes, items } = body;

  // Validate required fields
  if (!customer_name?.trim() || !phone?.trim() || !delivery_address?.trim() || !city?.trim()) {
    return NextResponse.json({ error: 'All delivery fields are required' }, { status: 400 });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  // Server-side re-read prices (never trust client prices)
  const productIds = items.map((i) => i.product_id);
  const { data: dbProducts } = await supabase
    .from('store_products')
    .select('id, name, price_pkr, is_active, stock_quantity')
    .eq('store_id', store.id)
    .in('id', productIds);

  if (!dbProducts || dbProducts.length !== productIds.length) {
    return NextResponse.json({ error: 'One or more products are unavailable' }, { status: 400 });
  }

  const productMap = Object.fromEntries(dbProducts.map((p) => [p.id, p]));

  for (const item of items) {
    const p = productMap[item.product_id];
    if (!p) return NextResponse.json({ error: `Product not found: ${item.product_id}` }, { status: 400 });
    if (!p.is_active) return NextResponse.json({ error: `Product "${p.name}" is not available` }, { status: 400 });
    if (p.stock_quantity < item.qty) {
      return NextResponse.json({ error: `Insufficient stock for "${p.name}". Only ${p.stock_quantity} available.` }, { status: 400 });
    }
  }

  // Calculate total (from server prices)
  const totalPkr = items.reduce((sum, item) => {
    const p = productMap[item.product_id];
    return sum + p.price_pkr * item.qty;
  }, 0);

  // Generate order number
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  // Create order
  const { data: order, error: orderErr } = await supabase
    .from('store_orders')
    .insert({
      store_id: store.id,
      order_number: orderNumber,
      customer_name: customer_name.trim(),
      customer_phone: phone.trim(),
      delivery_address: delivery_address.trim(),
      city: city.trim(),
      notes: notes?.trim() || null,
      status: 'pending',
      payment_method: 'cod',
      total_pkr: totalPkr,
    })
    .select('id')
    .single();

  if (orderErr || !order) {
    console.error('Order creation error:', orderErr);
    return NextResponse.json({ error: 'Failed to create order. Please try again.' }, { status: 500 });
  }

  // Create order items
  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.qty,
    unit_price_pkr: productMap[item.product_id].price_pkr,
    subtotal_pkr: productMap[item.product_id].price_pkr * item.qty,
  }));

  await supabase.from('store_order_items').insert(orderItems);

  // Decrement stock
  for (const item of items) {
    const p = productMap[item.product_id];
    await supabase
      .from('store_products')
      .update({ stock_quantity: p.stock_quantity - item.qty })
      .eq('id', item.product_id)
      .eq('store_id', store.id);
  }

  return NextResponse.json({ order_number: orderNumber, order_id: order.id }, { status: 201 });
}
