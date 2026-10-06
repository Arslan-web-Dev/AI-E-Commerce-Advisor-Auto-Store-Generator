import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runDataCollection } from '@/lib/data-collection/orchestrator';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable
    }

    const forceDemo = (body as { force_demo?: boolean }).force_demo === true;

    const result = await runDataCollection(id, user.id, {
      forceDemo,
      isAdmin,
    });

    return NextResponse.json({
      message:
        result.status === 'completed'
          ? 'Data collection completed successfully across all providers'
          : result.status === 'partial'
          ? 'Data collection completed with partial provider coverage'
          : 'Data collection failed',
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    const status = message.includes('Access denied') ? 403 : message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
