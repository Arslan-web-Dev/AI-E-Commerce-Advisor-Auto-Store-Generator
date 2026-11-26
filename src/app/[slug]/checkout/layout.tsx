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
    title: `Cash on Delivery Checkout — ${store.name}`,
    description: `Complete your ${store.name} order with cash on delivery; no advance payment required.`,
    fallbackTitle: `Cash on Delivery Checkout — ${store.name} Pakistan`,
    fallbackDescription: `Complete your ${store.name} order with cash on delivery across Punjab, Pakistan; no advance payment required.`,
  });
  const canonical = buildCanonicalUrl({ slug, host: store.verifiedHost, path: 'checkout', config: tenantConfigFromEnv() });
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: false },
  };
}

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
