import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from('stores')
    .select('id, slug, is_published, is_banned')
    .eq('slug', slug)
    .maybeSingle();

  if (!store || !store.is_published || store.is_banned) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const { data: products } = await supabase
    .from('store_products')
    .select('id, name, slug, price_pkr, compare_at_price_pkr, images, category, description, is_active, stock_quantity, sku')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .gt('stock_quantity', 0)
    .order('created_at', { ascending: false });

  return NextResponse.json({ products: products || [] });
}
