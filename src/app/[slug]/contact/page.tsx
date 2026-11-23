import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

async function getStore(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('stores')
    .select('id, slug, is_published, is_banned, theme_config')
    .eq('slug', slug)
    .maybeSingle();
  if (!data || !data.is_published || data.is_banned) return null;
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) return { title: 'Not Found' };
  const theme = (store.theme_config as Record<string, string>) || {};
  return { title: `Contact — ${theme.store_name || slug}` };
}

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  const theme = (store.theme_config as Record<string, string>) || {};
  const primary = theme.primary_color || '#4edea3';
  const radius = theme.border_radius || '0.5rem';
  const storeName = theme.store_name || slug;
  const phone = theme.contact_phone;
  const email = theme.contact_email;

  return (
    <div style={{ maxWidth: '600px' }}>
      <nav style={{ fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.7 }}>
        <a href={`/${slug}`} style={{ color: primary }}>Home</a> › Contact
      </nav>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1.5rem', color: primary }}>Contact {storeName}</h1>
      <p style={{ opacity: 0.8, marginBottom: '2rem', lineHeight: 1.7 }}>
        Have a question about your order or our products? Reach out to us and we will get back to you as soon as possible.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', border: `1px solid ${primary}22`, borderRadius: radius, backgroundColor: '#171f33' }}>
            <span style={{ fontSize: '1.5rem' }}>📞</span>
            <div>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.1rem' }}>Phone</p>
              <a href={`tel:${phone}`} style={{ fontWeight: 700, color: primary, textDecoration: 'none', fontSize: '1.0625rem' }}>{phone}</a>
            </div>
          </div>
        )}
        {email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', border: `1px solid ${primary}22`, borderRadius: radius, backgroundColor: '#171f33' }}>
            <span style={{ fontSize: '1.5rem' }}>✉️</span>
            <div>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.1rem' }}>Email</p>
              <a href={`mailto:${email}`} style={{ fontWeight: 700, color: primary, textDecoration: 'none', fontSize: '1.0625rem' }}>{email}</a>
            </div>
          </div>
        )}
        {!phone && !email && (
          <div style={{ padding: '1rem', border: `1px solid ${primary}22`, borderRadius: radius, backgroundColor: '#171f33', opacity: 0.7 }}>
            Contact information not available. Please check back later.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem', border: `1px solid ${primary}22`, borderRadius: radius, backgroundColor: '#171f33' }}>
          <span style={{ fontSize: '1.5rem' }}>🏢</span>
          <div>
            <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.1rem' }}>Service Area</p>
            <p style={{ fontWeight: 700, fontSize: '1.0625rem' }}>Punjab, Pakistan</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '1.25rem', borderRadius: radius, backgroundColor: `${primary}0d`, border: `1px solid ${primary}22` }}>
        <p style={{ fontWeight: 700, marginBottom: '0.25rem', color: primary }}>Payment</p>
        <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>We accept Cash on Delivery only. No advance payment required.</p>
      </div>
    </div>
  );
}
