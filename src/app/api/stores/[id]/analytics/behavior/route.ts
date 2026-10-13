import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  computeFunnel,
  computeCartAbandonment,
  computeTrafficSources,
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

  // 2. Fetch events & fulfilled orders
  const [{ data: eventsData }, { data: ordersData }] = await Promise.all([
    supabase
      .from('store_analytics_events')
      .select('id, session_id, event_type, product_id, referrer, utm_source, created_at')
      .eq('store_id', storeId),
    supabase
      .from('orders')
      .select('id, status')
      .eq('store_id', storeId)
      .in('status', ['confirmed', 'packed', 'shipped', 'delivered']),
  ]);

  const events = (eventsData || []) as RawEventRecord[];
  const fulfilledOrdersCount = (ordersData || []).length;

  const funnel = computeFunnel(events, fulfilledOrdersCount);
  const cartAbandonment = computeCartAbandonment(events, fulfilledOrdersCount);
  const trafficSources = computeTrafficSources(events);

  return NextResponse.json({
    storeId,
    funnel,
    cartAbandonment,
    trafficSources,
    hasEventData: events.length > 0,
  });
}
