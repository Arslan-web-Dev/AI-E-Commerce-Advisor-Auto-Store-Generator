import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';

interface StoreTheme {
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  font_family?: string;
  border_radius?: string;
  bg_color?: string;
  text_color?: string;
  store_name?: string;
  tagline?: string;
  logo_url?: string;
  banner_url?: string;
  contact_phone?: string;
  contact_email?: string;
}

export interface StoreContext {
  id: string;
  slug: string;
  name: string;
  description?: string;
  theme: StoreTheme;
  project_id: string;
}

async function getStore(slug: string): Promise<StoreContext | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('stores')
    .select('id, slug, project_id, is_published, is_banned, theme_config, projects(title, description)')
    .eq('slug', slug)
    .maybeSingle();

  if (!data || !data.is_published || data.is_banned) return null;

  const proj = Array.isArray(data.projects) ? data.projects[0] : data.projects;
  const theme = (data.theme_config as StoreTheme) || {};

  return {
    id: data.id,
    slug: data.slug,
    name: theme.store_name || (proj as any)?.title || slug,
    description: (proj as any)?.description,
    theme,
    project_id: data.project_id,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) return { title: 'Store Not Found' };
  return {
    title: store.name,
    description: store.description || `Shop at ${store.name}`,
    openGraph: {
      title: store.name,
      description: store.description || `Shop at ${store.name}`,
      images: store.theme.logo_url ? [store.theme.logo_url] : [],
    },
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
  const store = await getStore(slug);
  if (!store) notFound();

  const t = store.theme;
  const primary = t.primary_color || '#4edea3';
  const secondary = t.secondary_color || '#4cd7f6';
  const accent = t.accent_color || '#f59e0b';
  const bg = t.bg_color || '#0b1326';
  const textCol = t.text_color || '#dae2fd';
  const fontFamily = t.font_family || 'system-ui, sans-serif';
  const radius = t.border_radius || '0.5rem';

  const cssVars = `
    :root {
      --store-primary: ${primary};
      --store-secondary: ${secondary};
      --store-accent: ${accent};
      --store-bg: ${bg};
      --store-text: ${textCol};
      --store-font: ${fontFamily};
      --store-radius: ${radius};
    }
    body { background-color: var(--store-bg); color: var(--store-text); font-family: var(--store-font); }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      <div
        style={{ minHeight: '100vh', backgroundColor: bg, color: textCol, fontFamily }}
        data-store-id={store.id}
        data-store-slug={store.slug}
      >
        {/* Nav */}
        <header
          style={{ backgroundColor: bg, borderBottom: `1px solid ${primary}22`, position: 'sticky', top: 0, zIndex: 50 }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
            <a href={`/${slug}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: textCol }}>
              {t.logo_url ? (
                <img src={t.logo_url} alt={store.name} style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: primary }}>{store.name}</span>
              )}
            </a>
            <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <a href={`/${slug}/catalogue`} style={{ color: textCol, textDecoration: 'none', fontSize: '0.875rem' }}>Products</a>
              <a href={`/${slug}/about`} style={{ color: textCol, textDecoration: 'none', fontSize: '0.875rem' }}>About</a>
              <a href={`/${slug}/contact`} style={{ color: textCol, textDecoration: 'none', fontSize: '0.875rem' }}>Contact</a>
              <a
                href={`/${slug}/cart`}
                id="store-cart-link"
                style={{
                  backgroundColor: primary,
                  color: bg,
                  padding: '0.4rem 1rem',
                  borderRadius: radius,
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                Cart <span id="cart-count-badge" style={{ display: 'none' }}></span>
              </a>
            </nav>
          </div>
        </header>

        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1rem' }}>{children}</main>

        <footer style={{ borderTop: `1px solid ${primary}22`, marginTop: '4rem', padding: '2rem 1rem', textAlign: 'center', fontSize: '0.875rem' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: textCol, opacity: 0.7 }}>© {new Date().getFullYear()} {store.name}. All rights reserved.</span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {t.contact_phone && <span>📞 {t.contact_phone}</span>}
              {t.contact_email && <a href={`mailto:${t.contact_email}`} style={{ color: primary }}>{t.contact_email}</a>}
            </div>
            <span style={{ color: textCol, opacity: 0.5, fontSize: '0.75rem' }}>Cash on Delivery only · Punjab, Pakistan</span>
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
