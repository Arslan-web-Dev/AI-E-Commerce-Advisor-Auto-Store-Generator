import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateEventPayload } from '@/lib/analytics/events';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { id: storeId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  // Inject path storeId if missing or mismatch
  if (body && typeof body === 'object') {
    (body as Record<string, unknown>).store_id = storeId;
  }

  const { valid, error, sanitized } = validateEventPayload(body);
  if (!valid || !sanitized) {
    return NextResponse.json({ error: error || 'Invalid event payload' }, { status: 422 });
  }

  const supabase = await createClient();

  // 1. Verify store exists and is active (not banned)
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, is_banned')
    .eq('id', storeId)
    .single();

  if (storeErr || !store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  if (store.is_banned) {
    return NextResponse.json({ error: 'Store is suspended' }, { status: 403 });
  }

  // 2. Insert event
  const { error: insertErr } = await supabase.from('store_analytics_events').insert({
    store_id: storeId,
    session_id: sanitized.session_id,
    event_type: sanitized.event_type,
    product_id: sanitized.product_id || null,
    referrer: sanitized.referrer || null,
    utm_source: sanitized.utm_source || null,
    utm_medium: sanitized.utm_medium || null,
    utm_campaign: sanitized.utm_campaign || null,
    metadata: sanitized.metadata || {},
  });

  if (insertErr) {
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }

  return NextResponse.json({ success: true, recorded: true }, { status: 201 });
}
