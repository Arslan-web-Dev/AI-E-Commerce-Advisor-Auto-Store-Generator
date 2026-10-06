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

    if (confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Confirmation mismatch. You must explicitly type "DELETE" to confirm account erasure.' },
        { status: 400 }
      );
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
