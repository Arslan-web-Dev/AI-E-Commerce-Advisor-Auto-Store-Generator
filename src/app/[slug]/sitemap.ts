import { headers } from 'next/headers';
import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getPublicStore } from '@/lib/store-management/public-store';
import { buildStorePath } from '@/lib/store-management/tenant';
import { tenantConfigFromEnv } from '@/lib/store-management/tenant';

export const dynamic = 'force-dynamic';

export default async function sitemap({ params }: { params: Promise<{ slug: string }> }): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host');
  const store = await getPublicStore(slug, { host, config: tenantConfigFromEnv() });
  if (!store) return [];

  const now = new Date().toISOString();
  const routes: MetadataRoute.Sitemap = [
    { url: store.baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: buildStorePath(store.baseUrl, 'catalogue'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: buildStorePath(store.baseUrl, 'about'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: buildStorePath(store.baseUrl, 'contact'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products')
    .select('id, updated_at')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(1000);

  for (const product of products ?? []) {
    routes.push({
      url: buildStorePath(store.baseUrl, `products/${product.id}`),
      lastModified: product.updated_at || now,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }
  return routes;
}
