import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

export default async function sitemap({ params }: { params: Promise<{ slug: string }> }): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from('stores')
    .select('id, slug, updated_at')
    .eq('slug', slug)
    .eq('is_published', true)
    .eq('is_banned', false)
    .maybeSingle();

  if (!store) return [];

  const baseUrl = `https://${slug}.platform.pk`;
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, lastModified: store.updated_at || new Date().toISOString(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/catalogue`, lastModified: new Date().toISOString(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date().toISOString(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date().toISOString(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  const { data: products } = await supabase
    .from('store_products')
    .select('id, updated_at')
    .eq('store_id', store.id)
    .eq('is_active', true);

  const productRoutes: MetadataRoute.Sitemap = (products || []).map((p) => ({
    url: `${baseUrl}/products/${p.id}`,
    lastModified: p.updated_at || new Date().toISOString(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
