/** Transactional order and inventory operations backed by database RPCs. */

import type { SupabaseClient } from '@supabase/supabase-js';
import { canTransitionOrder, shouldDecrementStockOnTransition, shouldRestoreStockOnTransition } from './orders';
import { symbolicRpcCode } from './guest-checkout';
import type { OrderStatus } from '@/types/store-management';

export interface OrderOperationOutcome<T = Record<string, unknown>> {
  ok: boolean;
  status: 200 | 400 | 403 | 404 | 409 | 500;
  data?: T;
  error?: string;
}

function rpcError<T>(error: unknown): OrderOperationOutcome<T> {
  const details = error as { message?: string; code?: string };
  const code = symbolicRpcCode(details.message, details.code);
  if (code === 'FORBIDDEN') return { ok: false, status: 403, error: 'Forbidden' };
  if (code === 'ORDER_NOT_FOUND' || code === 'PRODUCT_UNAVAILABLE') return { ok: false, status: 404, error: 'Resource not found' };
  if (code === 'INVALID_TRANSITION' || code === 'INSUFFICIENT_STOCK' || code === 'INVALID_CHECKOUT') {
    return { ok: false, status: 409, error: details.message?.replace(/^[A-Z_]+:\s*/, '') ?? 'Operation rejected.' };
  }
  return { ok: false, status: 500, error: 'Order operation failed.' };
}

export async function transitionStoreOrder(
  supabase: SupabaseClient,
  input: {
    storeId: string;
    orderId: string;
    currentStatus: OrderStatus;
    targetStatus: OrderStatus;
    actor: string;
    notes?: string | null;
  },
): Promise<OrderOperationOutcome> {
  // Validate locally for a useful client error; the RPC validates again under lock.
  if (!canTransitionOrder(input.currentStatus, input.targetStatus)) {
    return { ok: false, status: 400, error: `Invalid transition: ${input.currentStatus} -> ${input.targetStatus}.` };
  }
  const { data, error } = await supabase.rpc('transition_store_order_status', {
    p_store_id: input.storeId,
    p_order_id: input.orderId,
    p_target_status: input.targetStatus,
    p_actor: input.actor,
    p_notes: input.notes ?? null,
  });
  if (error) return rpcError(error);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return { ok: true, status: 200, data: row ?? {} };
}

export function stockEffect(from: OrderStatus, to: OrderStatus): 'decrement' | 'restore' | 'none' {
  if (shouldDecrementStockOnTransition(from, to)) return 'decrement';
  if (shouldRestoreStockOnTransition(from, to)) return 'restore';
  return 'none';
}

export interface InventoryAdjustment {
  productId: string;
  storeId: string;
  newStock: number;
  reason: 'manual_adjustment' | 'restock' | 'damage';
  actorId: string;
}

export async function adjustStoreInventory(
  supabase: SupabaseClient,
  input: InventoryAdjustment,
): Promise<OrderOperationOutcome> {
  const { data, error } = await supabase.rpc('adjust_store_inventory', {
    p_store_id: input.storeId,
    p_product_id: input.productId,
    p_new_stock: input.newStock,
    p_reason: input.reason,
    p_actor_id: input.actorId,
  });
  if (error) return rpcError(error);
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return { ok: true, status: 200, data: row ?? {} };
}
