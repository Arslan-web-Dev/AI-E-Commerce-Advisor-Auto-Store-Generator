/** Guest COD checkout validation and secure-RPC invocation. */

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface GuestCheckoutItem {
  product_id: string;
  quantity: number;
}

export interface GuestCheckoutInput {
  customer_name: string;
  phone: string;
  shipping_address: string;
  city: string;
  notes?: string | null;
  items: GuestCheckoutItem[];
}

export type ValidatedGuestCheckout = {
  ok: true;
  value: GuestCheckoutInput;
} | {
  ok: false;
  status: 400;
  error: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateGuestCheckout(raw: unknown): ValidatedGuestCheckout {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, status: 400, error: 'Invalid checkout request.' };
  }
  const body = raw as Record<string, unknown>;
  const customerName = asTrimmedString(body.customer_name);
  const phone = asTrimmedString(body.phone);
  const shippingAddress = asTrimmedString(body.shipping_address ?? body.delivery_address);
  const city = asTrimmedString(body.city);
  const notes = asTrimmedString(body.notes);

  if (customerName.length < 2 || customerName.length > 120) {
    return { ok: false, status: 400, error: 'Customer name must be 2-120 characters.' };
  }
  if (!PHONE_PATTERN.test(phone)) {
    return { ok: false, status: 400, error: 'Enter a valid phone number.' };
  }
  if (shippingAddress.length < 5 || shippingAddress.length > 300) {
    return { ok: false, status: 400, error: 'Shipping address must be 5-300 characters.' };
  }
  if (city.length < 2 || city.length > 80) {
    return { ok: false, status: 400, error: 'City must be 2-80 characters.' };
  }
  if (notes.length > 500) {
    return { ok: false, status: 400, error: 'Order notes must be at most 500 characters.' };
  }
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return { ok: false, status: 400, error: 'Cart must contain between 1 and 50 line items.' };
  }

  const items: GuestCheckoutItem[] = [];
  const seen = new Set<string>();
  for (const rawItem of body.items) {
    if (!rawItem || typeof rawItem !== 'object') {
      return { ok: false, status: 400, error: 'Invalid cart item.' };
    }
    const item = rawItem as Record<string, unknown>;
    const productId = asTrimmedString(item.product_id);
    const quantity = Number(item.quantity ?? item.qty);
    if (!UUID_PATTERN.test(productId)) {
      return { ok: false, status: 400, error: 'Invalid product identifier.' };
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return { ok: false, status: 400, error: 'Each quantity must be an integer from 1 to 100.' };
    }
    if (seen.has(productId)) {
      return { ok: false, status: 400, error: 'Duplicate products must be combined before checkout.' };
    }
    seen.add(productId);
    items.push({ product_id: productId, quantity });
  }

  return {
    ok: true,
    value: { customer_name: customerName, phone, shipping_address: shippingAddress, city, notes: notes || null, items },
  };
}

export function checkoutRpcArguments(input: GuestCheckoutInput, idempotencyKey: string) {
  return {
    p_store_slug: '',
    p_customer_name: input.customer_name,
    p_customer_phone: input.phone,
    p_shipping_address: input.shipping_address,
    p_city: input.city,
    p_notes: input.notes ?? null,
    p_items: input.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
    p_idempotency_key: idempotencyKey,
  };
}

export interface GuestOrderResult {
  order_id: string;
  order_number: string;
  status: string;
  subtotal_pkr: number;
  shipping_fee_pkr: number;
  total_pkr: number;
  idempotent: boolean;
}

export type CheckoutOutcome =
  | { ok: true; result: GuestOrderResult }
  | { ok: false; status: 400 | 404 | 409 | 429 | 500 | 503; error: string };

function normalizeRpcResult(data: unknown): GuestOrderResult | null {
  if (!data || typeof data !== 'object') return null;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  if (typeof row.order_id !== 'string' || typeof row.order_number !== 'string') return null;
  return {
    order_id: row.order_id,
    order_number: row.order_number,
    status: typeof row.status === 'string' ? row.status : 'pending',
    subtotal_pkr: Number(row.subtotal_pkr ?? 0),
    shipping_fee_pkr: Number(row.shipping_fee_pkr ?? 0),
    total_pkr: Number(row.total_pkr ?? 0),
    idempotent: Boolean(row.idempotent),
  };
}

/** PostgreSQL SQLSTATEs are five characters; the RPC also prefixes messages with a symbolic code. */
export function symbolicRpcCode(message: string | undefined, sqlstate?: string): string | undefined {
  const match = message?.match(/^([A-Z_]{4,40}):/);
  if (match) return match[1];
  const stateMap: Record<string, string> = {
    STORE: 'STORE_UNAVAILABLE',
    RATEL: 'RATE_LIMITED',
    PRDCT: 'PRODUCT_UNAVAILABLE',
    STOCK: 'INSUFFICIENT_STOCK',
    CHKIN: 'INVALID_CHECKOUT',
  };
  return sqlstate ? stateMap[sqlstate] : undefined;
}

function errorOutcome(message: string, code?: string): CheckoutOutcome {
  const symbolic = symbolicRpcCode(message, code);
  if (symbolic === 'STORE_UNAVAILABLE') return { ok: false, status: 404, error: 'Store is not available.' };
  if (symbolic === 'RATE_LIMITED') return { ok: false, status: 429, error: 'Too many orders. Please try again later.' };
  if (symbolic === 'PROVIDER_UNAVAILABLE') return { ok: false, status: 503, error: 'Checkout is temporarily unavailable.' };
  if (symbolic === 'PRODUCT_UNAVAILABLE' || symbolic === 'INSUFFICIENT_STOCK' || symbolic === 'INVALID_CHECKOUT') {
    return { ok: false, status: 409, error: message.replace(/^[A-Z_]+:\s*/, '') };
  }
  return { ok: false, status: 500, error: 'Failed to place order. Please try again.' };
}

/** All order, item, customer and abuse writes happen inside the RPC transaction. */
export async function placeGuestOrder(
  supabase: SupabaseClient,
  slug: string,
  input: GuestCheckoutInput,
  idempotencyKey: string,
): Promise<CheckoutOutcome> {
  const args = { ...checkoutRpcArguments(input, idempotencyKey), p_store_slug: slug };
  const { data, error } = await supabase.rpc('place_store_order', args);
  if (error) {
    const details = error as { message?: string; code?: string };
    return errorOutcome(details.message ?? 'Checkout failed.', details.code);
  }
  const result = normalizeRpcResult(data);
  if (!result) return { ok: false, status: 500, error: 'The checkout service returned an invalid response.' };
  return { ok: true, result };
}

export function createIdempotencyKey(supplied: unknown): string {
  const value = typeof supplied === 'string' ? supplied.trim() : '';
  if (value.length >= 8 && value.length <= 128 && /^[A-Za-z0-9._-]+$/.test(value)) return value;
  return randomUUID();
}
