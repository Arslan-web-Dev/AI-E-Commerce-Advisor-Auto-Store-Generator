import { NextRequest, NextResponse } from 'next/server';
import { getPublicStore, listPublicProducts } from '@/lib/store-management/public-store';
import { tenantConfigFromEnv } from '@/lib/store-management/tenant';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const store = await getPublicStore(slug, { host, config: tenantConfigFromEnv() });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search')?.trim().toLowerCase();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 24));

  let products = await listPublicProducts(store.id, limit);
  if (category) products = products.filter((p) => p.category === category);
  if (search) {
    products = products.filter((p) =>
      `${p.name} ${p.description ?? ''} ${p.sku ?? ''}`.toLowerCase().includes(search),
    );
  }

  return NextResponse.json({
    store: { id: store.id, slug: store.slug, name: store.name, base_url: store.baseUrl },
    products,
  });
}
