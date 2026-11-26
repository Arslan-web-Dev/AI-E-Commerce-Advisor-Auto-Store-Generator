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
    title: `Order Confirmation — ${store.name}`,
    description: `Your ${store.name} cash-on-delivery order has been placed successfully.`,
    fallbackTitle: `Order Confirmation — ${store.name} Cash on Delivery`,
    fallbackDescription: `Your ${store.name} cash-on-delivery order has been placed successfully across Punjab, Pakistan.`,
  });
  const canonical = buildCanonicalUrl({ slug, host: store.verifiedHost, path: 'checkout/confirmation', config: tenantConfigFromEnv() });
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: false },
  };
}

export default function ConfirmationLayout({ children }: { children: ReactNode }) {
  return children;
}
