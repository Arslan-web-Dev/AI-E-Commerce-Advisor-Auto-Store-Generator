import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { headers } from 'next/headers';
import { getPublicStore } from '@/lib/store-management/public-store';
import { buildCanonicalUrl, resolveSeoMetadata } from '@/lib/store-management/seo';
import { tenantConfigFromEnv } from '@/lib/store-management/tenant';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host');
  const store = await getPublicStore(slug, { host, config: tenantConfigFromEnv() });
  if (!store) return { title: 'Store Not Found', robots: { index: false } };
  const { title, description } = resolveSeoMetadata({
    title: `Shop All Products — ${store.name}`,
    description: store.description,
    fallbackTitle: `Shop All Products — ${store.name} in Pakistan`,
    fallbackDescription: `Browse the full ${store.name} catalogue with cash on delivery across Punjab, Pakistan.`,
  });
  const canonical = buildCanonicalUrl({ slug, host: store.verifiedHost, path: 'catalogue', config: tenantConfigFromEnv() });
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: store.name },
    robots: { index: true, follow: true },
  };
}

export default function CatalogueLayout({ children }: { children: ReactNode }) {
  return children;
}
