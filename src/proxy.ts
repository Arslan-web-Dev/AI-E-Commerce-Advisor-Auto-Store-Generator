import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { parseTenantRequest } from '@/lib/store-management/tenant';

/**
 * Custom domains are rewritten to the canonical /<slug> route only when the
 * database confirms a published, unbanned store whose domain was verified by
 * the deployment provider. Path and wildcard tenants keep their URL.
 */
async function rewriteVerifiedCustomDomain(request: NextRequest): Promise<NextResponse | null> {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const resolution = parseTenantRequest({
    host,
    pathname: request.nextUrl.pathname,
    config: {
      appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL,
      rootDomain: process.env.STORE_ROOT_DOMAIN,
      additionalAppHosts: (process.env.APP_HOSTNAMES || '').split(',').filter(Boolean),
    },
  });
  if (resolution.kind !== 'custom-domain') return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !key) return null;

  const supabase = createServerClient(supabaseUrl, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll() { /* Domain resolution is read-only. */ },
    },
  });
  const { data: store } = await supabase
    .from('stores')
    .select('slug')
    .eq('custom_domain', resolution.domain)
    .eq('domain_status', 'verified')
    .eq('status', 'published')
    .eq('is_banned', false)
    .maybeSingle();

  if (!store?.slug) return null;
  const url = request.nextUrl.clone();
  url.pathname = `/${store.slug}${url.pathname === '/' ? '' : url.pathname}`;
  const response = NextResponse.rewrite(url);
  response.headers.set('x-store-domain', resolution.domain);
  return response;
}

export async function proxy(request: NextRequest) {
  const rewritten = await rewriteVerifiedCustomDomain(request);
  if (rewritten) return rewritten;
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
