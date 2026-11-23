import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function isValidHttpUrl(str?: string): boolean {
  if (!str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Open-redirect defense: strictly allow only relative, internal application paths.
 * Rejects protocol-relative URLs (//evil.com), malformed backslash redirects (/\evil.com),
 * and absolute URLs (https://...).
 */
export function sanitizeRedirectPath(pathStr?: string | null): string {
  if (!pathStr || typeof pathStr !== 'string') return '/account/security';
  const trimmed = pathStr.trim();
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    trimmed.startsWith('\\') ||
    trimmed.includes('://')
  ) {
    return '/account/security';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Protected paths requiring authenticated session
  const isProtectedPath =
    pathname.startsWith('/account') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/wizard') ||
    pathname.startsWith('/projects') ||
    pathname.startsWith('/stores');

  const isAuthPath =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/reset-password';

  const isPasswordUpdatePath = pathname === '/update-password';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  // FAIL CLOSED: If Supabase configuration is missing or invalid, reject access to protected paths
  if (!isValidHttpUrl(supabaseUrl) || !supabasePublicKey) {
    if (isProtectedPath) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'configuration_missing');
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Authoritative server-side identity check (token validation on auth server)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If not authenticated and trying to access protected paths
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', sanitizeRedirectPath(pathname));
    return NextResponse.redirect(url);
  }

  // If authenticated, check user profile flags (authoritative role and must_change_password)
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, must_change_password')
      .eq('id', user.id)
      .maybeSingle();

    const mustChangePassword = profile?.must_change_password === true;
    const role = profile?.role || 'owner';

    // Enforce password update if flagged (FR-1.5)
    if (mustChangePassword && !isPasswordUpdatePath && pathname !== '/auth/callback' && !pathname.startsWith('/api/')) {
      const url = request.nextUrl.clone();
      url.pathname = '/update-password';
      url.searchParams.set('forced', 'true');
      return NextResponse.redirect(url);
    }

    // Role-based route guard for /admin: strict owner/admin isolation
    if (pathname.startsWith('/admin')) {
      if (role !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/account/security';
        url.searchParams.set('error', 'unauthorized_role');
        return NextResponse.redirect(url);
      }
    }

    // If user is logged in, has changed password, and visits auth pages, redirect to dashboard
    if (isAuthPath && !mustChangePassword) {
      const url = request.nextUrl.clone();
      url.pathname = role === 'admin' ? '/admin' : '/account/security';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
