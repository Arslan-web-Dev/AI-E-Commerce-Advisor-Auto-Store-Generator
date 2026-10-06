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

    // Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id, owner_id, status')
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

    // Fetch latest collection run
    const { data: latestRun } = await supabase
      .from('project_collection_runs')
      .select('*')
      .eq('project_id', id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch count summaries
    const { count: compCount } = await supabase
      .from('project_competitors')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id);

    const { count: marketCount } = await supabase
      .from('project_market_observations')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id);

    const { count: trendCount } = await supabase
      .from('project_demand_trends')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id);

    const { count: costCount } = await supabase
      .from('project_cost_estimates')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id);

    return NextResponse.json({
      latest_run: latestRun || null,
      has_data: (compCount || 0) + (marketCount || 0) + (trendCount || 0) + (costCount || 0) > 0,
      summary: {
        competitor_count: compCount || 0,
        market_metric_count: marketCount || 0,
        has_trend_data: (trendCount || 0) > 0,
        cost_estimate_count: costCount || 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
