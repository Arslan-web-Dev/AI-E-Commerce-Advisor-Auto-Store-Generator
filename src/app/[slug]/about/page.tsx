import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { getPublicStore } from '@/lib/store-management/public-store';
import { buildCanonicalUrl, resolveSeoMetadata } from '@/lib/store-management/seo';
import { tenantConfigFromEnv } from '@/lib/store-management/tenant';

async function loadStore(slug: string) {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host');
  return getPublicStore(slug, { host, config: tenantConfigFromEnv() });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) return { title: 'Store Not Found', robots: { index: false } };
  const { title, description } = resolveSeoMetadata({
    title: `About ${store.name}`,
    description: store.description,
    fallbackTitle: `About ${store.name} — Cash on Delivery in Pakistan`,
    fallbackDescription: `Learn about ${store.name} and shop with cash on delivery across Punjab, Pakistan.`,
  });
  const canonical = buildCanonicalUrl({ slug, host: store.verifiedHost, path: 'about', config: tenantConfigFromEnv() });
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website', siteName: store.name },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) notFound();
  const t = store.theme;
  const description = store.description || `Welcome to ${t.storeName}. We offer quality products with Cash on Delivery across Punjab, Pakistan.`;

  return (
    <div style={{ maxWidth: '800px' }}>
      <nav aria-label="Breadcrumb" style={{ fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.7 }}>
        <a href={`/${slug}`} style={{ color: t.primary }}>Home</a> › About
      </nav>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1.5rem', color: t.primary }}>About {t.storeName}</h1>
      <div style={{ lineHeight: 1.8, opacity: 0.85, marginBottom: '2rem', fontSize: '1.0625rem' }}>
        {description}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {[
          { icon: '📦', title: 'Cash on Delivery', desc: 'Pay only when your order arrives.' },
          { icon: '🏪', title: 'Quality Products', desc: 'Carefully selected items for you.' },
          { icon: '🚚', title: 'Punjab Delivery', desc: 'Delivering across all districts of Punjab.' },
        ].map((f) => (
          <div key={f.title} style={{ padding: '1.25rem', border: `1px solid ${t.primary}22`, borderRadius: t.radius, backgroundColor: t.surface }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{f.icon}</div>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.25rem' }}>{f.title}</h2>
            <p style={{ fontSize: '0.875rem', opacity: 0.75 }}>{f.desc}</p>
          </div>
        ))}
      </div>
      <a href={`/${slug}/catalogue`} style={{ display: 'inline-block', padding: '0.75rem 2rem', backgroundColor: t.primary, color: t.onPrimary, borderRadius: t.radius, textDecoration: 'none', fontWeight: 700 }}>
        Shop Now
      </a>
    </div>
  );
}
