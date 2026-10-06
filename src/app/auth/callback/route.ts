import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');
  let next = requestUrl.searchParams.get('next') || requestUrl.searchParams.get('redirectTo') || '/account/security';

  // Prevent open redirect vulnerabilities: strictly permit only relative paths starting with a single '/'
  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/account/security';
  }

  if (error) {
    console.error('[OAuth Callback Error]:', error, error_description);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', error_description || error);
    return NextResponse.redirect(loginUrl);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[Auth Exchange Error]:', exchangeError.message);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', exchangeError.message);
      return NextResponse.redirect(loginUrl);
    }

    // Check user profile for forced password update or admin role routing
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, must_change_password')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.must_change_password) {
        const updateUrl = new URL('/update-password', request.url);
        updateUrl.searchParams.set('forced', 'true');
        return NextResponse.redirect(updateUrl);
      }

      if (profile?.role === 'admin' && next === '/account/security') {
        next = '/admin';
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL(next, request.url));
}
