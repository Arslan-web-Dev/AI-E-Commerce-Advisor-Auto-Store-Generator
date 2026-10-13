import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  canTransitionOrder,
  shouldDecrementStockOnTransition,
  shouldRestoreStockOnTransition,
  appendStatusHistory,
} from '@/lib/store-management/orders';
import { OrderStatus } from '@/types/store-management';

interface RouteContext {
  params: Promise<{ id: string; orderId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id: storeId, orderId } = await context.params;
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

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .eq('store_id', storeId)
    .single();

  if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  return NextResponse.json({ order });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: storeId, orderId } = await context.params;
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
    const { status: targetStatus, notes } = body;

    if (!targetStatus) {
      return NextResponse.json({ error: 'targetStatus is required' }, { status: 400 });
    }

    // 1. Fetch current order with items
    const { data: order, error: fetchErr } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('id', orderId)
      .eq('store_id', storeId)
      .single();

    if (fetchErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const currentStatus = order.status as OrderStatus;

    // 2. Validate allowed status transition
    if (!canTransitionOrder(currentStatus, targetStatus as OrderStatus)) {
      return NextResponse.json(
        {
          error: `Invalid transition: cannot move order from '${currentStatus}' to '${targetStatus}'.`,
          currentStatus,
          allowedTransitions: (canTransitionOrder as any)[currentStatus] || [],
        },
        { status: 400 }
      );
    }

    // 3. Handle stock synchronization
    const items = order.items || [];

    if (shouldDecrementStockOnTransition(currentStatus, targetStatus as OrderStatus)) {
      // Decrement stock for each item with a product_id
      for (const item of items) {
        if (item.product_id) {
          const { data: prod } = await supabase
            .from('products')
            .select('stock, name')
            .eq('id', item.product_id)
            .single();

          if (prod) {
            const newStock = Math.max(0, prod.stock - item.quantity);
            await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id);
            await supabase.from('inventory_logs').insert({
              store_id: storeId,
              product_id: item.product_id,
              delta: -item.quantity,
              previous_stock: prod.stock,
              new_stock: newStock,
              reason: 'order_placed',
              actor_id: user.id,
            });
          }
        }
      }
    } else if (shouldRestoreStockOnTransition(currentStatus, targetStatus as OrderStatus)) {
      // Restore stock for cancelled order
      for (const item of items) {
        if (item.product_id) {
          const { data: prod } = await supabase
            .from('products')
            .select('stock, name')
            .eq('id', item.product_id)
            .single();

          if (prod) {
            const newStock = prod.stock + item.quantity;
            await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id);
            await supabase.from('inventory_logs').insert({
              store_id: storeId,
              product_id: item.product_id,
              delta: item.quantity,
              previous_stock: prod.stock,
              new_stock: newStock,
              reason: 'order_cancelled',
              actor_id: user.id,
            });
          }
        }
      }
    }

    // 4. Update status history & payment state
    const updatedHistory = appendStatusHistory(
      order.status_history || [],
      targetStatus as OrderStatus,
      user.email || 'Merchant',
      notes
    );

    const updateFields: Record<string, any> = {
      status: targetStatus,
      status_history: updatedHistory,
    };

    if (targetStatus === 'delivered') {
      updateFields.fulfillment_status = 'fulfilled';
      if (order.payment_method === 'cod') {
        updateFields.payment_status = 'paid';
      }
    } else if (targetStatus === 'cancelled') {
      updateFields.fulfillment_status = 'cancelled';
    } else if (targetStatus === 'returned') {
      updateFields.fulfillment_status = 'returned';
      updateFields.payment_status = 'refunded';
    }

    const { data: updatedOrder, error: updateErr } = await supabase
      .from('orders')
      .update(updateFields)
      .eq('id', orderId)
      .eq('store_id', storeId)
      .select('*, items:order_items(*)')
      .single();

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    return NextResponse.json({
      order: updatedOrder,
      message: `Order #${order.order_number} transitioned to '${targetStatus}'.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Malformed status update request' }, { status: 400 });
  }
}
