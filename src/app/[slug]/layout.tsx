import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { getPublicStore } from '@/lib/store-management/public-store';
import { resolveSeoMetadata, safeSeoKeywords, serializeJsonLd, storeJsonLd } from '@/lib/store-management/seo';
import { PRODUCT_GRID_COLUMNS, themeCssVariables } from '@/lib/store-management/theme';
import { tenantConfigFromEnv } from '@/lib/store-management/tenant';

export const dynamic = 'force-dynamic';

export interface StoreContext {
  id: string;
  slug: string;
  name: string;
  description: string;
  baseUrl: string;
  theme: Awaited<ReturnType<typeof getPublicStore>> extends infer T
    ? T extends { theme: infer Theme } ? Theme : never
    : never;
}

async function loadStore(slug: string) {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host');
  return getPublicStore(slug, { host, config: tenantConfigFromEnv() });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) return { title: 'Store Not Found', robots: { index: false, follow: false } };
  const { title, description } = resolveSeoMetadata({
    title: store.seo.meta_title,
    description: store.seo.meta_description,
    fallbackTitle: `${store.name} — Online Store in Pakistan`,
    fallbackDescription: `${store.description || store.theme.tagline} Shop online with cash on delivery across Punjab, Pakistan.`,
  });
  const keywords = safeSeoKeywords([...store.seo.keywords, ...(store.theme.tagline ? [store.theme.tagline] : [])]);
  return {
    title,
    description,
    keywords,
    alternates: { canonical: store.baseUrl },
    openGraph: {
      type: 'website',
      title,
      description,
      url: store.baseUrl,
      siteName: store.name,
      images: store.theme.logoUrl ? [store.theme.logoUrl] : [],
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

export default async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) notFound();
  const t = store.theme;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCssVariables(t) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(storeJsonLd({
            name: t.storeName,
            description: t.tagline,
            url: store.baseUrl,
            logo: t.logoUrl,
            email: t.contactEmail,
            phone: t.contactPhone,
          })),
        }}
      />
      <div
        style={{ minHeight: '100vh', backgroundColor: t.surface, color: t.onSurface }}
        data-store-id={store.id}
        data-store-slug={store.slug}
        data-store-base-url={store.baseUrl}
        data-product-grid={PRODUCT_GRID_COLUMNS[t.productGrid]}
        data-navbar-style={t.navbarStyle}
        data-hero-style={t.heroStyle}
      >
        <header
          style={{
            backgroundColor: t.surface,
            borderBottom: `1px solid ${t.primary}22`,
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <nav
            aria-label="Store navigation"
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              padding: '0 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'var(--store-navbar-justify, space-between)',
              flexDirection: 'var(--store-navbar-direction, row)' as 'row',
              flexWrap: 'wrap',
              gap: '0.5rem',
              minHeight: '64px',
            }}
          >
            <a href={`/${slug}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: t.onSurface, fontWeight: 700 }}>
              {t.logoUrl ? (
                <img src={t.logoUrl} alt={t.storeName} style={{ height: '40px', maxWidth: '160px', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '1.25rem', color: t.primary }}>{t.storeName}</span>
              )}
            </a>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <a href={`/${slug}/catalogue`} style={{ color: t.onSurface, textDecoration: 'none', fontSize: '0.875rem' }}>Products</a>
              <a href={`/${slug}/about`} style={{ color: t.onSurface, textDecoration: 'none', fontSize: '0.875rem' }}>About</a>
              <a href={`/${slug}/contact`} style={{ color: t.onSurface, textDecoration: 'none', fontSize: '0.875rem' }}>Contact</a>
              <a
                href={`/${slug}/cart`}
                id="store-cart-link"
                style={{
                  backgroundColor: t.primary,
                  color: t.onPrimary,
                  padding: '0.4rem 1rem',
                  borderRadius: t.radius,
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                Cart <span id="cart-count-badge" style={{ display: 'none' }} />
              </a>
            </div>
          </nav>
        </header>

        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>{children}</main>

        <footer style={{ borderTop: `1px solid ${t.primary}22`, marginTop: '4rem', padding: '2rem 1rem', textAlign: 'center', fontSize: '0.875rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ opacity: 0.7 }}>© {new Date().getFullYear()} {t.storeName}. All rights reserved.</span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {t.contactPhone && <span>{t.contactPhone}</span>}
              {t.contactEmail && <a href={`mailto:${t.contactEmail}`} style={{ color: t.primary }}>{t.contactEmail}</a>}
            </div>
            <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>Cash on Delivery only</span>
          </div>
        </footer>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var cart = JSON.parse(sessionStorage.getItem('store_cart_${store.id}') || '[]');
                var total = cart.reduce(function(s,i){return s+(i.qty||0)},0);
                var badge = document.getElementById('cart-count-badge');
                if (badge && total > 0) {
                  badge.textContent = '(' + total + ')';
                  badge.style.display = 'inline';
                }
              } catch(e){}
            })();
          `,
        }}
      />
    </>
  );
}
