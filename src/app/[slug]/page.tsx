import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { getPublicStore, listPublicProducts } from '@/lib/store-management/public-store';
import { breadcrumbJsonLd, buildCanonicalUrl, resolveSeoMetadata, safeSeoKeywords, serializeJsonLd } from '@/lib/store-management/seo';
import { tenantConfigFromEnv } from '@/lib/store-management/tenant';

export const dynamic = 'force-dynamic';

async function loadData(slug: string) {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host');
  const store = await getPublicStore(slug, { host, config: tenantConfigFromEnv() });
  if (!store) return null;
  return { store, products: await listPublicProducts(store.id, 8) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadData(slug);
  if (!data) return { title: 'Store Not Found', robots: { index: false } };
  const { title, description } = resolveSeoMetadata({
    title: `${data.store.seo.meta_title || data.store.name} — Home`,
    description: data.store.seo.meta_description || data.store.description,
    fallbackTitle: `${data.store.name} — Home Collection in Pakistan`,
    fallbackDescription: `Browse the ${data.store.name} collection with cash on delivery across Punjab, Pakistan.`,
  });
  return {
    title,
    description,
    keywords: safeSeoKeywords(data.store.seo.keywords),
    alternates: { canonical: data.store.baseUrl },
    openGraph: { title, description, url: data.store.baseUrl, type: 'website' },
  };
}

export default async function StorefrontHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await loadData(slug);
  if (!data) notFound();
  const { store, products } = data;
  const t = store.theme;
  const canonical = buildCanonicalUrl({ slug, host: store.verifiedHost, config: tenantConfigFromEnv() });

  const categories = [...new Set(products.map((p) => p.category || 'General'))];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd([{ name: t.storeName, url: canonical }])) }}
      />
      <section
        style={{
          background: t.bannerUrl
            ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.65)), url(${t.bannerUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${t.primary}22, ${t.surface})`,
          borderRadius: t.radius,
          padding: 'clamp(2rem, 6vw, 4rem) 1.5rem',
          marginBottom: '2.5rem',
          textAlign: 'var(--store-hero-align, center)' as 'center',
        }}
      >
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', color: t.primary, marginBottom: '1rem' }}>{t.storeName}</h1>
        <p style={{ maxWidth: '640px', margin: '0 auto 1.5rem', opacity: 0.85 }}>{t.tagline}</p>
        <a
          href={`/${slug}/catalogue`}
          style={{ display: 'inline-block', backgroundColor: t.primary, color: t.onPrimary, padding: '0.75rem 2rem', borderRadius: t.radius, textDecoration: 'none', fontWeight: 700 }}
        >
          Shop Now
        </a>
      </section>

      {categories.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Shop by Category</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {categories.map((category) => (
              <a
                key={category}
                href={`/${slug}/catalogue?category=${encodeURIComponent(category)}`}
                style={{ padding: '0.45rem 1rem', border: `1px solid ${t.primary}`, borderRadius: t.radius, color: t.primary, textDecoration: 'none', fontSize: '0.85rem' }}
              >
                {category}
              </a>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Featured Products</h2>
        {products.length === 0 ? (
          <p style={{ opacity: 0.6 }}>No products available yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'var(--store-grid-columns, repeat(auto-fill, minmax(220px, 1fr)))', gap: '1.25rem' }}>
            {products.map((product) => (
              <a key={product.id} href={`/${slug}/products/${product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <article style={{ border: `1px solid ${t.primary}22`, borderRadius: t.radius, overflow: 'hidden', backgroundColor: `${t.surface}99` }}>
                  <div style={{ aspectRatio: '4/3', backgroundColor: '#0d1829' }}>
                    {product.images[0] ? (
                      <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                    ) : (
                      <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontSize: '2rem', opacity: 0.3 }}>🛍️</div>
                    )}
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <p style={{ fontSize: '0.7rem', color: t.primary }}>{product.category || 'General'}</p>
                    <h3 style={{ fontSize: '1rem', margin: '0.25rem 0' }}>{product.name}</h3>
                    <p style={{ fontWeight: 800, color: t.primary }}>PKR {product.price_pkr.toLocaleString('en-PK')}</p>
                  </div>
                </article>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
