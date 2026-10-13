import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateOrderMetrics, RawOrderRecord, RawEventRecord } from '@/lib/analytics/metrics';

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

  // 1. Ownership verification
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, owner_id, name, status, currency')
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

  // 2. Parse date range query parameter
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get('range') || '7d';

  let days = 7;
  if (rangeParam === '30d') days = 30;
  if (rangeParam === '90d') days = 90;
  if (rangeParam === 'all') days = 365;

  const now = new Date();
  const currentPeriodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevPeriodStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

  // 3. Fetch orders (current and previous period)
  const { data: ordersData, error: ordersErr } = await supabase
    .from('orders')
    .select('id, total_pkr, status, created_at')
    .eq('store_id', storeId)
    .gte('created_at', prevPeriodStart.toISOString())
    .order('created_at', { ascending: false });

  if (ordersErr) {
    return NextResponse.json({ error: 'Failed to fetch order records' }, { status: 500 });
  }

  const allOrders = (ordersData || []) as RawOrderRecord[];
  const currentOrders = allOrders.filter(
    (o) => new Date(o.created_at) >= currentPeriodStart
  );
  const prevOrders = allOrders.filter(
    (o) => new Date(o.created_at) >= prevPeriodStart && new Date(o.created_at) < currentPeriodStart
  );

  // 4. Fetch telemetry events
  const { data: eventsData, error: eventsErr } = await supabase
    .from('store_analytics_events')
    .select('id, session_id, event_type, product_id, referrer, utm_source, created_at')
    .eq('store_id', storeId)
    .gte('created_at', currentPeriodStart.toISOString());

  const events = (eventsErr ? [] : eventsData || []) as RawEventRecord[];

  // 5. Compute deterministic metrics
  const summary = calculateOrderMetrics(
    currentOrders,
    prevOrders,
    events,
    currentPeriodStart.toISOString(),
    now.toISOString()
  );

  return NextResponse.json({
    storeId,
    storeName: store.name,
    currency: store.currency || 'PKR',
    dateRange: {
      preset: rangeParam,
      startDate: currentPeriodStart.toISOString(),
      endDate: now.toISOString(),
    },
    kpis: summary,
  });
}
