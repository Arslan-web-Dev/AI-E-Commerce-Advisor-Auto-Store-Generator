import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDailyTrends, RawOrderRecord, RawEventRecord } from '@/lib/analytics/metrics';

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

  // 2. Parse range
  const url = new URL(request.url);
  const rangeParam = url.searchParams.get('range') || '7d';
  let days = 7;
  if (rangeParam === '30d') days = 30;
  if (rangeParam === '90d') days = 90;

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 3. Query orders & events in range
  const [{ data: ordersData }, { data: eventsData }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, total_pkr, status, created_at')
      .eq('store_id', storeId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('store_analytics_events')
      .select('id, session_id, event_type, created_at')
      .eq('store_id', storeId)
      .gte('created_at', startDate.toISOString()),
  ]);

  const orders = (ordersData || []) as RawOrderRecord[];
  const events = (eventsData || []) as RawEventRecord[];

  const trends = generateDailyTrends(orders, events, days);

  return NextResponse.json({
    storeId,
    daysCount: days,
    trends,
  });
}
