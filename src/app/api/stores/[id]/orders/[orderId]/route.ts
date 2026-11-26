import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizationFailure, canManageStore } from '@/lib/store-management/authorization';
import { transitionStoreOrder } from '@/lib/store-management/order-operations';
import { ALLOWED_STATUS_TRANSITIONS, canTransitionOrder } from '@/lib/store-management/orders';
import type { OrderStatus } from '@/types/store-management';

interface RouteContext {
  params: Promise<{ id: string; orderId: string }>;
}

async function authorizeStore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { failure: authorizationFailure('unauthorized') };
  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).maybeSingle();
  if (!store) return { failure: authorizationFailure('not_found') };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const ownership = store as unknown as { owner_id: string };
  if (!canManageStore(user, ownership, profile as { role?: string | null } | null)) {
    return { failure: authorizationFailure('forbidden') };
  }
  return { user };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: storeId, orderId } = await context.params;
  const supabase = await createClient();
  const auth = await authorizeStore(supabase, storeId);
  if (auth.failure) return NextResponse.json({ error: auth.failure.error }, { status: auth.failure.status });

  const { data: order, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .eq('store_id', storeId)
    .maybeSingle();

  if (error || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: storeId, orderId } = await context.params;
  const supabase = await createClient();
  const auth = await authorizeStore(supabase, storeId);
  if (auth.failure) return NextResponse.json({ error: auth.failure.error }, { status: auth.failure.status });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const targetStatus = body?.status ?? body?.target_status;
  if (typeof targetStatus !== 'string') {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }
  const notes = typeof body?.notes === 'string' ? body.notes.slice(0, 500) : null;

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('store_id', storeId)
    .maybeSingle();
  if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const currentStatus = order.status as OrderStatus;
  if (!canTransitionOrder(currentStatus, targetStatus as OrderStatus)) {
    return NextResponse.json({
      error: `Invalid transition: cannot move order from '${currentStatus}' to '${targetStatus}'.`,
      currentStatus,
      allowedTransitions: ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [],
    }, { status: 400 });
  }

  const outcome = await transitionStoreOrder(supabase, {
    storeId,
    orderId,
    currentStatus,
    targetStatus: targetStatus as OrderStatus,
    actor: auth.user.email ?? auth.user.id,
    notes,
  });
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });

  return NextResponse.json({
    order: outcome.data,
    message: `Order transitioned from '${currentStatus}' to '${targetStatus}'.`,
  });
}
