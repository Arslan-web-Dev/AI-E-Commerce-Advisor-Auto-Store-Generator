import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
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

    const { data: project } = await supabase
      .from('projects')
      .select('owner_id')
      .eq('id', id)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';

    if (project.owner_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: observations, error: obsError } = await supabase
      .from('project_market_observations')
      .select('*')
      .eq('project_id', id)
      .order('metric_name', { ascending: true });

    if (obsError) {
      return NextResponse.json({ error: obsError.message }, { status: 500 });
    }

    const { data: trends, error: trendError } = await supabase
      .from('project_demand_trends')
      .select('*')
      .eq('project_id', id)
      .order('retrieved_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (trendError) {
      return NextResponse.json({ error: trendError.message }, { status: 500 });
    }

    return NextResponse.json({
      observations: observations || [],
      demand_trend: trends || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
