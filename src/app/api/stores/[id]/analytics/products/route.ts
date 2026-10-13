import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  aggregateProductPerformance,
  RawProductRecord,
  RawOrderItemRecord,
  RawEventRecord,
} from '@/lib/analytics/metrics';

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

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Verify store ownership
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, owner_id')
    .eq('id', storeId)
    .single();

  if (storeErr || !store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';

  if (store.owner_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden: You do not own this store' }, { status: 403 });
  }

  // 2. Fetch products, order items and product_view events
  const [{ data: productsData }, { data: orderItemsData }, { data: eventsData }] = await Promise.all([
    supabase.from('products').select('id, name, price_pkr').eq('store_id', storeId),
    supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name, quantity, total_price_pkr'),
    supabase
      .from('store_analytics_events')
      .select('id, session_id, event_type, product_id, created_at')
      .eq('store_id', storeId)
      .eq('event_type', 'product_view'),
  ]);

  const products = (productsData || []) as RawProductRecord[];
  const orderItems = (orderItemsData || []) as RawOrderItemRecord[];
  const events = (eventsData || []) as RawEventRecord[];

  const productPerformance = aggregateProductPerformance(products, orderItems, events);

  return NextResponse.json({
    storeId,
    totalProducts: products.length,
    products: productPerformance,
  });
}
