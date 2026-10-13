import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateOrderMetrics,
  generateDailyTrends,
  aggregateProductPerformance,
  computeFunnel,
  computeCartAbandonment,
  computeTrafficSources,
  RawOrderRecord,
  RawOrderItemRecord,
  RawProductRecord,
  RawEventRecord,
} from '@/lib/analytics/metrics';
import { generateAnalyticsReportHtml } from '@/lib/analytics/report';
import { StoreAnalyticsReport } from '@/types/analytics';

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
    .select('id, owner_id, name, currency, status')
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

  // 2. Parse query parameters
  const url = new URL(request.url);
  const rangeParam = (url.searchParams.get('range') || '30d') as '7d' | '30d' | '90d' | 'all';
  const format = url.searchParams.get('format') || 'html';

  let days = 30;
  if (rangeParam === '7d') days = 7;
  if (rangeParam === '90d') days = 90;
  if (rangeParam === 'all') days = 365;

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevDate = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

  // 3. Concurrently fetch all necessary records
  const [
    { data: ordersData },
    { data: orderItemsData },
    { data: productsData },
    { data: eventsData },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total_pkr, status, created_at')
      .eq('store_id', storeId)
      .gte('created_at', prevDate.toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name, quantity, total_price_pkr'),
    supabase
      .from('products')
      .select('id, name, price_pkr')
      .eq('store_id', storeId),
    supabase
      .from('store_analytics_events')
      .select('id, session_id, event_type, product_id, referrer, utm_source, created_at')
      .eq('store_id', storeId)
      .gte('created_at', startDate.toISOString()),
  ]);

  const allOrders = (ordersData || []) as RawOrderRecord[];
  const currentOrders = allOrders.filter((o) => new Date(o.created_at) >= startDate);
  const prevOrders = allOrders.filter(
    (o) => new Date(o.created_at) >= prevDate && new Date(o.created_at) < startDate
  );
  const orderItems = (orderItemsData || []) as RawOrderItemRecord[];
  const products = (productsData || []) as RawProductRecord[];
  const events = (eventsData || []) as RawEventRecord[];

  const fulfilledOrdersCount = currentOrders.filter((o) =>
    ['confirmed', 'packed', 'shipped', 'delivered'].includes(o.status)
  ).length;

  // 4. Compute all metrics
  const kpis = calculateOrderMetrics(
    currentOrders,
    prevOrders,
    events,
    startDate.toISOString(),
    now.toISOString()
  );
  const trends = generateDailyTrends(currentOrders, events, days);
  const topProducts = aggregateProductPerformance(products, orderItems, events);
  const funnel = computeFunnel(events, fulfilledOrdersCount);
  const trafficSources = computeTrafficSources(events);
  const abandonment = computeCartAbandonment(events, fulfilledOrdersCount);

  const reportPayload: StoreAnalyticsReport = {
    storeId,
    storeName: store.name,
    currency: store.currency || 'PKR',
    generatedAt: now.toISOString(),
    dateRange: {
      preset: rangeParam,
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    },
    kpis,
    trends,
    topProducts,
    funnel,
    trafficSources,
    abandonment,
    dataLimitations: [
      'Gross Sales include all non-cancelled orders; Net Revenue deducts verified returns and cancels.',
      'Visitors and cart abandonment metrics are derived from privacy-conscious pseudonymous session telemetry.',
      'Stores operating in draft/sandbox mode reflect simulated checkout activity rather than external payment gateway settlement.',
      'Attribution sources reflect first-party referrer headers and UTM query parameters.',
    ],
  };

  if (format === 'json') {
    return NextResponse.json(reportPayload);
  }

  const html = generateAnalyticsReportHtml(reportPayload);
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline';",
    },
  });
}
