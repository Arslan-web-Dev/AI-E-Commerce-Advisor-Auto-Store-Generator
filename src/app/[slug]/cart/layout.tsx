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
    title: `Shopping Cart — ${store.name}`,
    description: `Review your ${store.name} cart before cash-on-delivery checkout.`,
    fallbackTitle: `Shopping Cart — ${store.name} Cash on Delivery`,
    fallbackDescription: `Review your ${store.name} cart and place a cash-on-delivery order across Punjab, Pakistan.`,
  });
  const canonical = buildCanonicalUrl({ slug, host: store.verifiedHost, path: 'cart', config: tenantConfigFromEnv() });
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: false },
  };
}

export default function CartLayout({ children }: { children: ReactNode }) {
  return children;
}
