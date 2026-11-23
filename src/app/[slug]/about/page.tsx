import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

async function getStore(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('stores')
    .select('id, slug, is_published, is_banned, theme_config, projects(title, description)')
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
  const name = theme.store_name || (Array.isArray(store.projects) ? (store.projects[0] as any)?.title : (store.projects as any)?.title) || slug;
  return { title: `About — ${name}` };
}

export default async function AboutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();

  const theme = (store.theme_config as Record<string, string>) || {};
  const primary = theme.primary_color || '#4edea3';
  const radius = theme.border_radius || '0.5rem';
  const storeName = theme.store_name || (Array.isArray(store.projects) ? (store.projects[0] as any)?.title : (store.projects as any)?.title) || slug;
  const proj = Array.isArray(store.projects) ? store.projects[0] : store.projects;
  const description = (proj as any)?.description || `Welcome to ${storeName}. We offer quality products with Cash on Delivery across Punjab, Pakistan.`;

  return (
    <div style={{ maxWidth: '800px' }}>
      <nav style={{ fontSize: '0.8rem', marginBottom: '1.5rem', opacity: 0.7 }}>
        <a href={`/${slug}`} style={{ color: primary }}>Home</a> › About
      </nav>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1.5rem', color: primary }}>About {storeName}</h1>
      <div style={{ lineHeight: 1.8, opacity: 0.85, marginBottom: '2rem', fontSize: '1.0625rem' }}>
        {description}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        {[
          { icon: '📦', title: 'Cash on Delivery', desc: 'Pay only when your order arrives.' },
          { icon: '🏪', title: 'Quality Products', desc: 'Carefully selected items for you.' },
          { icon: '🚚', title: 'Punjab Delivery', desc: 'Delivering across all districts of Punjab.' },
        ].map((f) => (
          <div key={f.title} style={{ padding: '1.25rem', border: `1px solid ${primary}22`, borderRadius: radius, backgroundColor: '#171f33' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{f.icon}</div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{f.title}</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.75 }}>{f.desc}</p>
          </div>
        ))}
      </div>
      <a href={`/${slug}/catalogue`} style={{ display: 'inline-block', padding: '0.75rem 2rem', backgroundColor: primary, color: '#0b1326', borderRadius: radius, textDecoration: 'none', fontWeight: 700 }}>
        Shop Now
      </a>
    </div>
  );
}
