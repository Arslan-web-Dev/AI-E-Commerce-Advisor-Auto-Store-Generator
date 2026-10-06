import { createClient } from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json().catch(() => ({}));
    const scope = body.scope === 'global' ? 'global' : 'local';

    const { error } = await supabase.auth.signOut({ scope });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: scope === 'global' ? 'Signed out of all active sessions worldwide.' : 'Signed out successfully.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal sign-out error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
