import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

  // IMPORTANT: Avoid using getSession() which may be spoofed; getUser() validates the token on the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protected paths
  const isProtectedPath =
    pathname.startsWith('/account') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/wizard') ||
    pathname.startsWith('/projects');

  const isAuthPath =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/reset-password';

  const isPasswordUpdatePath = pathname === '/update-password';

  // If not authenticated and trying to access protected paths
  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // If authenticated, check user profile flags (role and must_change_password)
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, must_change_password')
      .eq('id', user.id)
      .maybeSingle();

    const mustChangePassword = profile?.must_change_password === true;
    const role = profile?.role || 'owner';

    // Enforce password update if flagged
    if (mustChangePassword && !isPasswordUpdatePath && pathname !== '/auth/callback' && !pathname.startsWith('/api/')) {
      const url = request.nextUrl.clone();
      url.pathname = '/update-password';
      url.searchParams.set('forced', 'true');
      return NextResponse.redirect(url);
    }

    // Role-based route guard for /admin
    if (pathname.startsWith('/admin')) {
      if (role !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/account/security';
        url.searchParams.set('error', 'unauthorized_role');
        return NextResponse.redirect(url);
      }
    }

    // If user is logged in, has changed password, and visits auth pages, redirect to appropriate destination
    if (isAuthPath && !mustChangePassword) {
      const url = request.nextUrl.clone();
      url.pathname = role === 'admin' ? '/admin' : '/account/security';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
