import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { filterLowStockProducts } from '@/lib/store-management/inventory';

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

  // 1. Fetch store and check ownership
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, owner_id, name, slug, status, currency, custom_domain')
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

  // 2. Fetch products statistics
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .eq('is_archived', false);

  const productList = products || [];
  const activeProducts = productList.filter((p) => p.is_active);
  const lowStockProducts = filterLowStockProducts(productList);

  // 3. Fetch orders statistics
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  const orderList = orders || [];
  const totalOrders = orderList.length;
  const totalRevenue = orderList
    .filter((o) => o.status !== 'cancelled' && o.status !== 'returned')
    .reduce((sum, o) => sum + Number(o.total_pkr || 0), 0);

  const unfulfilledOrdersCount = orderList.filter(
    (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'packed'
  ).length;

  return NextResponse.json({
    kpis: {
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        status: store.status,
        currency: store.currency,
        custom_domain: store.custom_domain,
      },
      total_orders: totalOrders,
      total_revenue_pkr: totalRevenue,
      active_products: activeProducts.length,
      low_stock_count: lowStockProducts.length,
      unfulfilled_orders_count: unfulfilledOrdersCount,
      recent_orders: orderList.slice(0, 5),
      low_stock_products: lowStockProducts.slice(0, 5),
      is_sandbox: store.status === 'draft',
    },
  });
}
