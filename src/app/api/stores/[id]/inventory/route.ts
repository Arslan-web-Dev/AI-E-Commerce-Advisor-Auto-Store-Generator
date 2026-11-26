import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isLowStock } from '@/lib/store-management/inventory';
import { adjustStoreInventory } from '@/lib/store-management/order-operations';

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

  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).single();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const lowStockOnly = url.searchParams.get('low_stock') === 'true';

  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, name, slug, sku, price_pkr, stock, low_stock_threshold, is_active, category')
    .eq('store_id', storeId)
    .eq('is_archived', false)
    .order('stock', { ascending: true });

  if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 500 });

  let items = (products || []).map((p) => ({
    ...p,
    is_low_stock: isLowStock(p),
  }));

  if (lowStockOnly) {
    items = items.filter((p) => p.is_low_stock);
  }

  // Also fetch the last 15 inventory logs
  const { data: logs } = await supabase
    .from('inventory_logs')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(15);

  return NextResponse.json({ items, count: items.length, recent_logs: logs || [] });
}

export async function POST(request: Request, context: RouteContext) {
  const { id: storeId } = await context.params;
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
    const body = await request.json() as {
      product_id?: string;
      new_stock?: number | string;
      reason?: 'manual_adjustment' | 'restock' | 'damage';
    };
    const { product_id, new_stock, reason = 'manual_adjustment' } = body;

    if (!product_id) {
      return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
    }
    if (!['manual_adjustment', 'restock', 'damage'].includes(reason)) {
      return NextResponse.json({ error: 'Invalid adjustment reason.' }, { status: 400 });
    }

    // Atomic stock update + append-only log inside the database RPC.
    const outcome = await adjustStoreInventory(supabase, {
      storeId,
      productId: product_id,
      newStock: Number(new_stock),
      reason,
      actorId: user.id,
    });
    if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
    return NextResponse.json({ product: outcome.data, message: 'Stock updated.' });
  } catch (e: unknown) {
    const message = e instanceof Error && e.message ? e.message : 'Malformed stock adjustment request';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
