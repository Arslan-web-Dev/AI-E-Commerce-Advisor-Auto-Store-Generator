import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Session missing or expired.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const confirmation = body.confirmation;
    const password = body.password;

    if (confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Confirmation mismatch. You must explicitly type "DELETE" to confirm account erasure.' },
        { status: 400 }
      );
    }

    // Re-authentication requirement (FR-1.8 & Security Specification)
    // Irreversible account deletion requires password verification or verified recent session authentication.
    if (user.email && password) {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: String(password),
      });
      if (verifyError) {
        return NextResponse.json(
          { error: 'Re-authentication failed: Invalid password supplied for account deletion.' },
          { status: 401 }
        );
      }
    } else if (user.app_metadata?.provider === 'email') {
      // If user is email-authenticated and no password was passed, check if session was established within 10 minutes
      const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
      const isRecent = Date.now() - lastSignIn < 10 * 60 * 1000;
      if (!isRecent) {
        return NextResponse.json(
          { error: 'Re-authentication required: Please provide your password to confirm permanent account deletion.' },
          { status: 401 }
        );
      }
    }

    // Perform privileged server-side Auth deletion using admin client.
    // In PostgreSQL, foreign-key constraints on public.profiles, public.stores, and public.feasibility_reports
    // with ON DELETE CASCADE will automatically remove all user data.
    const adminSupabase = createAdminClient();
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[Account Deletion Error]:', deleteError.message);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Sign out from current session cookies
    await supabase.auth.signOut({ scope: 'global' });

    return NextResponse.json({
      success: true,
      message: 'Your account, stores, and feasibility reports have been permanently deleted.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal deletion failure';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
