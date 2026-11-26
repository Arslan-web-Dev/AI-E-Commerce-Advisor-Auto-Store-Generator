import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createIdempotencyKey, placeGuestOrder, validateGuestCheckout } from '@/lib/store-management/guest-checkout';
import { isValidStoreSlug } from '@/lib/store-management/tenant';

export const dynamic = 'force-dynamic';

/**
 * Guest COD checkout. Prices, availability, order/line-item writes and stock
 * consistency are enforced by the `place_store_order` security-definer RPC.
 * No client price or status is accepted. Repeating the same idempotency key
 * returns the original order instead of creating a duplicate.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!isValidStoreSlug(slug)) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const parsed = validateGuestCheckout(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });

  const idempotencyKey = createIdempotencyKey(req.headers.get('idempotency-key') ?? body?.idempotency_key);
  const supabase = await createClient();
  const outcome = await placeGuestOrder(supabase, slug, parsed.value, idempotencyKey);
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });

  return NextResponse.json(outcome.result, { status: 201 });
}
