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
  const description = `Contact ${store.name} for order support. We accept cash on delivery across Punjab, Pakistan.`;
  const { title, description: validatedDescription } = resolveSeoMetadata({
    title: `Contact ${store.name}`,
    description,
    fallbackTitle: `Contact ${store.name} — Cash on Delivery Support`,
    fallbackDescription: description,
  });
  const canonical = buildCanonicalUrl({ slug, host: store.verifiedHost, path: 'contact', config: tenantConfigFromEnv() });
  return {
    title,
    description: validatedDescription,
    alternates: { canonical },
    openGraph: { title, description: validatedDescription, url: canonical, type: 'website', siteName: store.name },
  };
}

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await loadStore(slug);
  if (!store) notFound();
  const t = store.theme;
  const phone = t.contactPhone;
  const email = t.contactEmail;

  return (
    <div style={{ maxWidth: '600px' }}>
      <nav aria-label="Breadcrumb" style={{ fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.7 }}>
        <a href={`/${slug}`} style={{ color: t.primary }}>Home</a> › Contact
      </nav>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1.5rem', color: t.primary }}>Contact {t.storeName}</h1>
      <p style={{ opacity: 0.8, marginBottom: '2rem', lineHeight: 1.7 }}>
        Have a question about your order or our products? Reach out to us and we will get back to you as soon as possible.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', border: `1px solid ${t.primary}22`, borderRadius: t.radius, backgroundColor: t.surface }}>
            <span style={{ fontSize: '1.5rem' }}>📞</span>
            <div>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.1rem' }}>Phone</p>
              <a href={`tel:${phone}`} style={{ fontWeight: 700, color: t.primary, textDecoration: 'none', fontSize: '1.0625rem' }}>{phone}</a>
            </div>
          </div>
        )}
        {email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', border: `1px solid ${t.primary}22`, borderRadius: t.radius, backgroundColor: t.surface }}>
            <span style={{ fontSize: '1.5rem' }}>✉️</span>
            <div>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.1rem' }}>Email</p>
              <a href={`mailto:${email}`} style={{ fontWeight: 700, color: t.primary, textDecoration: 'none', fontSize: '1.0625rem' }}>{email}</a>
            </div>
          </div>
        )}
        {!phone && !email && (
          <div style={{ padding: '1rem', border: `1px solid ${t.primary}22`, borderRadius: t.radius, backgroundColor: t.surface, opacity: 0.7 }}>
            Contact information not available. Please check back later.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', border: `1px solid ${t.primary}22`, borderRadius: t.radius, backgroundColor: t.surface }}>
          <span style={{ fontSize: '1.5rem' }}>🏢</span>
          <div>
            <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.1rem' }}>Service Area</p>
            <p style={{ fontWeight: 700, fontSize: '1.0625rem' }}>Punjab, Pakistan</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.25rem', borderRadius: t.radius, backgroundColor: `${t.primary}0d`, border: `1px solid ${t.primary}22` }}>
        <p style={{ fontWeight: 700, marginBottom: '0.25rem', color: t.primary }}>Payment</p>
        <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>We accept Cash on Delivery only. No advance payment required.</p>
      </div>
    </div>
  );
}
