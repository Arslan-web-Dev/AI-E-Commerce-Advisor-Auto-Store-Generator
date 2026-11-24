import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface StoreProject {
  title?: string;
  description?: string;
}

function pickProject(projects: unknown): StoreProject | undefined {
  const proj = Array.isArray(projects) ? projects[0] : projects;
  return proj as StoreProject | undefined;
}

async function getStoreData(slug: string) {
  const supabase = await createClient();
  const { data: store } = await supabase
    .from('stores')
    .select('id, slug, is_published, is_banned, theme_config, projects(title, description)')
    .eq('slug', slug)
    .maybeSingle();

  if (!store || !store.is_published || store.is_banned) return null;

  const { data: products } = await supabase
    .from('store_products')
    .select('id, name, slug, price_pkr, images, category, is_active, stock_quantity')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .gt('stock_quantity', 0)
    .order('created_at', { ascending: false })
    .limit(8);

  const theme = (store.theme_config as Record<string, string>) || {};
  const proj = pickProject(store.projects);

  return { store, products: products || [], theme, proj };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStoreData(slug);
  if (!data) return { title: 'Store Not Found' };
  const name = data.theme.store_name || data.proj?.title || slug;
  return {
    title: `${name} — Home`,
    description: data.theme.tagline || data.proj?.description || `Shop at ${name}`,
  };
}

export default async function StorefrontHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStoreData(slug);
  if (!data) notFound();

  const { products, theme, proj } = data;
  const primary = theme.primary_color || '#4edea3';
  const bg = theme.bg_color || '#0b1326';
  const textCol = theme.text_color || '#dae2fd';
  const storeName = theme.store_name || proj?.title || slug;
  const tagline = theme.tagline || 'Quality products, delivered to your door.';
  const radius = theme.border_radius || '0.5rem';

  // Group products by category
  const categoryMap: Record<string, typeof products> = {};
  for (const p of products) {
    const cat = p.category || 'General';
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(p);
  }
  const categories = Object.keys(categoryMap);

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Store',
            name: storeName,
            description: tagline,
            url: `/${slug}`,
            address: { '@type': 'PostalAddress', addressRegion: 'Punjab', addressCountry: 'PK' },
          }),
        }}
      />

      {/* Hero Banner */}
      <section
        style={{
          background: theme.banner_url
            ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(${theme.banner_url}) center/cover no-repeat`
            : `linear-gradient(135deg, ${primary}22, ${bg})`,
          borderRadius: radius,
          padding: '4rem 2rem',
          marginBottom: '3rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 800, color: primary, marginBottom: '1rem' }}>
          {storeName}
        </h1>
        <p style={{ fontSize: '1.125rem', color: textCol, opacity: 0.85, marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem' }}>
          {tagline}
        </p>
        <a
          href={`/${slug}/catalogue`}
          style={{
            display: 'inline-block',
            backgroundColor: primary,
            color: bg,
            padding: '0.75rem 2rem',
            borderRadius: radius,
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '1rem',
          }}
        >
          Shop Now
        </a>
      </section>

      {/* Category Pills */}
      {categories.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: textCol }}>Shop by Category</h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <a
                key={cat}
                href={`/${slug}/catalogue?category=${encodeURIComponent(cat)}`}
                style={{
                  padding: '0.5rem 1.25rem',
                  border: `1px solid ${primary}`,
                  borderRadius: radius,
                  color: primary,
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {cat} ({categoryMap[cat].length})
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: textCol }}>Featured Products</h2>
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>No products available yet.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {products.map((p) => (
              <a
                key={p.id}
                href={`/${slug}/products/${p.id}`}
                style={{ textDecoration: 'none', color: textCol }}
              >
                <div
                  style={{
                    border: `1px solid ${primary}22`,
                    borderRadius: radius,
                    overflow: 'hidden',
                    transition: 'border-color 0.2s',
                    backgroundColor: '#171f33',
                  }}
                  onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.borderColor = primary)}
                  onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.borderColor = `${primary}22`)}
                >
                  <div style={{ aspectRatio: '4/3', overflow: 'hidden', backgroundColor: '#0d1829' }}>
                    {p.images?.[0] ? (
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        loading="lazy"
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, fontSize: '3rem' }}>
                        🛍️
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: primary, marginBottom: '0.25rem', fontWeight: 600 }}>{p.category || 'General'}</p>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', lineHeight: 1.3 }}>{p.name}</h3>
                    <p style={{ fontSize: '1.125rem', fontWeight: 800, color: primary }}>
                      PKR {(p.price_pkr || 0).toLocaleString('en-PK')}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
        {products.length >= 8 && (
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <a
              href={`/${slug}/catalogue`}
              style={{ color: primary, textDecoration: 'underline', fontWeight: 600 }}
            >
              View all products →
            </a>
          </div>
        )}
      </section>

      {/* COD Notice */}
      <section
        style={{
          marginTop: '3rem',
          padding: '1.5rem',
          borderRadius: radius,
          backgroundColor: `${primary}11`,
          border: `1px solid ${primary}33`,
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '1.5rem' }}>📦</span>
        <div>
          <p style={{ fontWeight: 700, marginBottom: '0.25rem', color: primary }}>Cash on Delivery Available</p>
          <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>Pay when your order arrives. Serving Punjab, Pakistan.</p>
        </div>
      </section>
    </>
  );
}
