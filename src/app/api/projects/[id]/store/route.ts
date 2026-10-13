import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Verify project exists and belongs to current user
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id, owner_id, category, target_location, business_scale')
    .eq('id', projectId)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Ownership verification
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';

  if (project.owner_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
  }

  // 2. Look for existing store linked to this project/report
  const { data: existingStore } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', project.owner_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingStore) {
    return NextResponse.json({ store: existingStore, is_new: false });
  }

  // 3. If no store exists, provision a clean draft store record for this project
  const sanitizedSlug = `store-${projectId.slice(0, 8).toLowerCase()}`;
  const storeName = `${project.category || 'Retail'} Store`;

  const { data: newStore, error: insertErr } = await supabase
    .from('stores')
    .insert({
      owner_id: user.id,
      name: storeName,
      slug: sanitizedSlug,
      status: 'draft',
      currency: 'PKR',
      theme_config: {},
      seo_config: {},
    })
    .select()
    .single();

  if (insertErr) {
    // If slug collision or DB constraint, return a fallback object or handle error
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ store: newStore, is_new: true });
}
