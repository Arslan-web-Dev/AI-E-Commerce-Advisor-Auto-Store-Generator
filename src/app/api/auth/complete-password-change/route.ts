import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse, type NextRequest } from 'next/server';

const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/auth/complete-password-change
 *
 * Secure server-side completion of an authenticated password change, including
 * clearing the privileged `must_change_password` flag (FR-1.5).
 *
 * - Identity is derived exclusively from the verified server session; a target
 *   user id is never accepted from the browser.
 * - The password is updated through the authenticated Supabase session.
 * - The privileged profile flag is completed with the server-only service-role
 *   client, targeting the verified session user id only.
 * - Success is reported only when BOTH steps succeed.
 */
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
    const password = typeof body?.password === 'string' ? body.password : '';
    const confirmPassword = typeof body?.confirm_password === 'string' ? body.confirm_password : '';

    // Validate against the project's existing password policy.
    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters in length.' },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match. Please verify both fields.' },
        { status: 400 }
      );
    }

    // 1. Update the password through the authenticated user session.
    //    The submitted password is never logged or returned.
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const updatedUser = updateData.user;
    if (!updatedUser || updatedUser.id !== user.id) {
      return NextResponse.json(
        { error: 'Password update could not be verified for the authenticated session.' },
        { status: 500 }
      );
    }

    // 2. Complete the privileged must_change_password flag via the server-only
    //    service-role client, strictly targeting the verified session user id.
    try {
      const admin = createAdminClient();
      const { error: flagError } = await admin
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id);

      if (flagError) {
        throw flagError;
      }
    } catch (flagErr: unknown) {
      const message = flagErr instanceof Error ? flagErr.message : 'unknown error';
      console.error('[PasswordCompletion] Failed to clear must_change_password flag:', message);
      return NextResponse.json(
        {
          error: 'Your password was changed, but finalizing your account completion failed. Please retry.',
          password_updated: true,
          retry_required: true,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
