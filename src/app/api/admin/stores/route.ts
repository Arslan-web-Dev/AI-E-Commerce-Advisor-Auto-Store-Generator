import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeStoreSeoScore, safeSeoKeywords } from '@/lib/store-management/seo';

export const dynamic = 'force-dynamic';

/** GET /api/admin/stores — system-admin view of all tenant stores. */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: stores, error } = await supabase
    .from('stores')
    .select(`
      id, slug, name, status, is_banned, created_at, theme_config, seo_config,
      custom_domain, domain_status, project_id,
      projects(title, owner_id)
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = stores ?? [];

  const withCounts = await Promise.all(rows.map(async (store) => {
    const [products, orders, customerCount] = await Promise.all([
      supabase.from('products').select('id, images').eq('store_id', store.id).eq('is_archived', false),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
      supabase.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
    ]);
    const productRows = products.data ?? [];
    const storeSeo = (store.seo_config && typeof store.seo_config === 'object'
      ? store.seo_config
      : {}) as Record<string, unknown>;
    return {
      ...store,
      is_published: store.status === 'published' && !store.is_banned,
      product_count: productRows.length,
      order_count: orders.count ?? 0,
      customer_count: customerCount.count ?? 0,
      seo_score: computeStoreSeoScore({
        title: typeof storeSeo.meta_title === 'string' ? storeSeo.meta_title : null,
        description: typeof storeSeo.meta_description === 'string' ? storeSeo.meta_description : null,
        keywords: safeSeoKeywords(storeSeo.keywords),
        hasImage: productRows.some((product) => Array.isArray(product.images) && product.images.length > 0),
        hasCanonical: true,
        hasJsonLd: true,
        hasBreadcrumbs: true,
      }),
    };
  }));

  return NextResponse.json({ stores: withCounts });
}
