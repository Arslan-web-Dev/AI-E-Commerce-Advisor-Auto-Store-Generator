import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const RESERVED_SLUGS = new Set([
  'api', 'admin', 'login', 'auth', 'logout', 'signup', 'register', 'dashboard',
  'projects', 'wizard', 'market-intelligence', 'account', 'reset-password',
  'update-password', 'health', 'sitemap', 'robots', 'static', '_next', 'favicon',
]);

function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < 3 || slug.length > 63) return false;
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return false;
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug);
}

/** GET /api/admin/stores — list all stores (admin only) */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: stores } = await supabase
    .from('stores')
    .select(`
      id, slug, is_published, is_banned, created_at, theme_config,
      projects(title, owner_id),
      store_products(count),
      store_orders(count)
    `)
    .order('created_at', { ascending: false });

  return NextResponse.json({ stores: stores || [] });
}
