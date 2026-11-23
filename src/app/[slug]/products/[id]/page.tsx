import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AddToCartButton from './AddToCartButton';
import type { Metadata } from 'next';

async function getProduct(slug: string, productId: string) {
  const supabase = await createClient();
  const { data: store } = await supabase
    .from('stores')
    .select('id, slug, is_published, is_banned, theme_config')
    .eq('slug', slug)
    .maybeSingle();

  if (!store || !store.is_published || store.is_banned) return null;

  const { data: product } = await supabase
    .from('store_products')
    .select('*')
    .eq('id', productId)
    .eq('store_id', store.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!product) return null;
  return { product, store };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; id: string }> }): Promise<Metadata> {
  const { slug, id } = await params;
  const data = await getProduct(slug, id);
  if (!data) return { title: 'Product Not Found' };
  const { product } = data;
  return {
    title: product.name,
    description: product.description || `Buy ${product.name} — PKR ${product.price_pkr}`,
    openGraph: { images: product.images?.[0] ? [product.images[0]] : [] },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const data = await getProduct(slug, id);
  if (!data) notFound();

  const { product, store } = data;
  const theme = (store.theme_config as Record<string, string>) || {};
  const primary = theme.primary_color || '#4edea3';
  const bg = theme.bg_color || '#0b1326';
  const radius = theme.border_radius || '0.5rem';
  const inStock = product.stock_quantity > 0;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description,
            image: product.images || [],
            offers: {
              '@type': 'Offer',
              priceCurrency: 'PKR',
              price: product.price_pkr,
              availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            },
          }),
        }}
      />

      {/* Breadcrumb */}
      <nav style={{ fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.7 }}>
        <a href={`/${slug}`} style={{ color: primary }}>Home</a>
        {' › '}
        <a href={`/${slug}/catalogue`} style={{ color: primary }}>Products</a>
        {' › '}
        {product.name}
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {/* Images */}
        <div>
          <div style={{ aspectRatio: '1', borderRadius: radius, overflow: 'hidden', backgroundColor: '#0d1829', marginBottom: '1rem' }}>
            {product.images?.[0] ? (
              <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, fontSize: '5rem' }}>🛍️</div>
            )}
          </div>
          {product.images?.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {product.images.slice(1).map((img: string, i: number) => (
                <img key={i} src={img} alt={`${product.name} ${i + 2}`} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '0.25rem', border: `1px solid ${primary}44` }} />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.category && (
            <p style={{ fontSize: '0.8rem', color: primary, fontWeight: 600, marginBottom: '0.5rem' }}>{product.category}</p>
          )}
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem', lineHeight: 1.3 }}>{product.name}</h1>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: primary, marginBottom: '1rem' }}>
            PKR {(product.price_pkr || 0).toLocaleString('en-PK')}
          </p>

          {product.compare_at_price_pkr && product.compare_at_price_pkr > product.price_pkr && (
            <p style={{ fontSize: '0.95rem', textDecoration: 'line-through', opacity: 0.5, marginBottom: '0.5rem' }}>
              PKR {product.compare_at_price_pkr.toLocaleString('en-PK')}
            </p>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                borderRadius: '100px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: inStock ? `${primary}22` : '#ff444422',
                color: inStock ? primary : '#ff4444',
              }}
            >
              {inStock ? `In Stock (${product.stock_quantity} available)` : 'Out of Stock'}
            </span>
          </div>

          {product.description && (
            <div style={{ marginBottom: '1.5rem', lineHeight: 1.7, opacity: 0.85 }}>
              {product.description}
            </div>
          )}

          {product.sku && <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '1rem' }}>SKU: {product.sku}</p>}

          <AddToCartButton
            product={{ id: product.id, name: product.name, price_pkr: product.price_pkr, images: product.images }}
            storeId={store.id}
            storeSlug={slug}
            inStock={inStock}
            primary={primary}
            bg={bg}
            radius={radius}
          />

          <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: radius, backgroundColor: `${primary}0d`, border: `1px solid ${primary}22`, fontSize: '0.875rem' }}>
            <p>📦 <strong>Cash on Delivery</strong> — Pay when your order arrives</p>
            <p style={{ marginTop: '0.5rem', opacity: 0.7 }}>Delivery within Punjab, Pakistan</p>
          </div>
        </div>
      </div>
    </>
  );
}
