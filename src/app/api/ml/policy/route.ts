import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient } from '@/lib/ml-client';

export const dynamic = 'force-dynamic';

/** Admin-only view of the server-side OI-6 training-label gate. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: 'Unable to verify administrator access' }, { status: 500 });
  }
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  try {
    const policy = await mlClient.getTrainingPolicy();
    return NextResponse.json({ policy });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'ML service is unavailable';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
