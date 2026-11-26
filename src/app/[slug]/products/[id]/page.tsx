import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import AddToCartButton from './AddToCartButton';
import { getPublicProduct, getPublicStore } from '@/lib/store-management/public-store';
import { breadcrumbJsonLd, buildCanonicalUrl, productJsonLd, resolveSeoMetadata, safeSeoKeywords, serializeJsonLd } from '@/lib/store-management/seo';
import { tenantConfigFromEnv } from '@/lib/store-management/tenant';

interface RouteParams { slug: string; id: string }

async function loadData({ slug, id }: RouteParams) {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host');
  const store = await getPublicStore(slug, { host, config: tenantConfigFromEnv() });
  if (!store) return null;
  const product = await getPublicProduct(store.id, id);
  if (!product) return null;
  return { store, product };
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const data = await loadData(await params);
  if (!data) return { title: 'Product Not Found', robots: { index: false } };
  const { store, product } = data;
  const { title, description } = resolveSeoMetadata({
    title: product.seo.meta_title || product.name,
    description: product.seo.meta_description || product.description,
    fallbackTitle: `${product.name} — Buy Online in Pakistan`,
    fallbackDescription: `${product.name} is available from ${store.name} with cash on delivery across Punjab, Pakistan.`,
  });
  const canonical = buildCanonicalUrl({ slug: store.slug, host: store.verifiedHost, path: `products/${product.id}` });
  return {
    title,
    description,
    keywords: safeSeoKeywords(product.seo.keywords),
    alternates: { canonical },
    openGraph: { title, description, url: canonical, images: product.images },
  };
}

export default async function ProductDetailPage({ params }: { params: Promise<RouteParams> }) {
  const routeParams = await params;
  const data = await loadData(routeParams);
  if (!data) notFound();
  const { store, product } = data;
  const t = store.theme;
  const inStock = product.stock > 0;
  const canonical = buildCanonicalUrl({
    slug: store.slug,
    host: store.verifiedHost,
    path: `products/${product.id}`,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd({
          name: product.name,
          description: product.description ?? '',
          url: canonical,
          images: product.images,
          pricePkr: product.price_pkr,
          inStock,
          sku: product.sku,
        })) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd([
          { name: t.storeName, url: store.baseUrl },
          { name: 'Products', url: `${store.baseUrl}/catalogue` },
          { name: product.name },
        ])) }}
      />

      <nav aria-label="Breadcrumb" style={{ fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.7 }}>
        <a href={`/${store.slug}`} style={{ color: t.primary }}>Home</a> ›{' '}
        <a href={`/${store.slug}/catalogue`} style={{ color: t.primary }}>Products</a> › {product.name}
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '2rem' }}>
        <div>
          <div style={{ aspectRatio: '1', borderRadius: t.radius, overflow: 'hidden', backgroundColor: '#0d1829', marginBottom: '1rem' }}>
            {product.images[0] ? (
              <img src={product.images[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', fontSize: '4rem', opacity: 0.3 }}>🛍️</div>
            )}
          </div>
          {product.images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {product.images.slice(1).map((image, index) => (
                <img key={image} src={image} alt={`${product.name} ${index + 2}`} style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '0.25rem' }} />
              ))}
            </div>
          )}
        </div>

        <div>
          {product.category && <p style={{ fontSize: '0.8rem', color: t.primary }}>{product.category}</p>}
          <h1 style={{ fontSize: '1.75rem', margin: '0.25rem 0 0.75rem' }}>{product.name}</h1>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: t.primary }}>PKR {product.price_pkr.toLocaleString('en-PK')}</p>
          {product.compare_at_price_pkr && product.compare_at_price_pkr > product.price_pkr && (
            <p style={{ textDecoration: 'line-through', opacity: 0.5 }}>PKR {product.compare_at_price_pkr.toLocaleString('en-PK')}</p>
          )}
          <p style={{ fontSize: '0.8rem', margin: '1rem 0' }}>{inStock ? `In Stock (${product.stock} available)` : 'Out of Stock'}</p>
          {product.description && <div style={{ lineHeight: 1.7, opacity: 0.85, marginBottom: '1.5rem' }}>{product.description}</div>}
          {product.sku && <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>SKU: {product.sku}</p>}

          <AddToCartButton
            product={{ id: product.id, name: product.name, price_pkr: product.price_pkr, images: product.images }}
            storeId={store.id}
            storeSlug={store.slug}
            inStock={inStock}
            primary={t.primary}
            bg={t.surface}
            radius={t.radius}
          />
        </div>
      </div>
    </>
  );
}
