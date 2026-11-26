import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidStoreSlug } from '@/lib/store-management/tenant';

export const dynamic = 'force-dynamic';

/**
 * Narrow guest order lookup: order number + phone only, published store only.
 * The RPC returns no address, line items or full phone number.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; orderNumber: string }> },
) {
  const { slug, orderNumber } = await params;
  if (!isValidStoreSlug(slug)) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const phone = new URL(req.url).searchParams.get('phone')?.trim() ?? '';
  if (!orderNumber.trim() || phone.length < 7) {
    return NextResponse.json({ error: 'Order number and phone are required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('lookup_store_order', {
    p_store_slug: slug,
    p_order_number: orderNumber.trim().toUpperCase(),
    p_phone: phone,
  });

  if (error) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  return NextResponse.json({ order: row });
}
