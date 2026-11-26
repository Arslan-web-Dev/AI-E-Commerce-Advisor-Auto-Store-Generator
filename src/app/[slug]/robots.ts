import { headers } from 'next/headers';
import type { MetadataRoute } from 'next';
import { getPublicStore } from '@/lib/store-management/public-store';
import { buildRobotsDocument } from '@/lib/store-management/seo';
import { tenantConfigFromEnv } from '@/lib/store-management/tenant';

export const dynamic = 'force-dynamic';

export default async function robots({ params }: { params: Promise<{ slug: string }> }): Promise<MetadataRoute.Robots> {
  const { slug } = await params;
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host');
  const store = await getPublicStore(slug, { host, config: tenantConfigFromEnv() });
  if (!store) return { rules: [{ userAgent: '*', disallow: '/' }] };

  const document = buildRobotsDocument({
    slug,
    host: store.verifiedHost,
    config: tenantConfigFromEnv(),
  });
  return { rules: document.rules, sitemap: document.sitemap };
}
