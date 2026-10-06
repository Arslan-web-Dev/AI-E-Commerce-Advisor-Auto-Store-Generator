import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateProjectStep } from '@/lib/validation/project';
import { EXCHANGE_RATE_USD_TO_PKR } from '@/types/project';

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

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Role check for admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';

    // Strictly enforce ownership
    if (project.owner_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Access denied: You do not own this project' }, { status: 403 });
    }

    return NextResponse.json({ project });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

    // Fetch existing project to verify ownership and draft status
    const { data: existingProject, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';

    if (existingProject.owner_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Access denied: You do not own this project' }, { status: 403 });
    }

    // Prevent modifying submitted projects
    if (existingProject.status !== 'draft' && !isAdmin) {
      return NextResponse.json(
        { error: 'Cannot modify a project that has already been submitted for analysis' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Partial step validation if step specified
    if (body.current_step) {
      const stepVal = validateProjectStep(Number(body.current_step), { ...existingProject, ...body });
      if (!stepVal.valid) {
        return NextResponse.json({ error: 'Validation failed', details: stepVal.errors }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.category !== undefined) updates.category = body.category;
    if (body.custom_category !== undefined) updates.custom_category = body.custom_category;
    if (body.target_location !== undefined) updates.target_location = body.target_location;
    if (body.city !== undefined) updates.city = body.city;
    if (body.region !== undefined) updates.region = body.region;
    if (body.country !== undefined) updates.country = body.country;
    if (body.postal_code !== undefined) updates.postal_code = body.postal_code;
    if (body.lat !== undefined) updates.lat = Number(body.lat);
    if (body.lng !== undefined) updates.lng = Number(body.lng);
    if (body.radius_km !== undefined) updates.radius_km = Number(body.radius_km);
    if (body.budget_amount !== undefined) {
      const amt = Number(body.budget_amount);
      updates.budget_amount = amt;
      const curr = (body.budget_currency || existingProject.budget_currency) as 'USD' | 'PKR';
      updates.budget_pkr =
        curr === 'PKR' ? Math.round(amt) : Math.round(amt * EXCHANGE_RATE_USD_TO_PKR);
    }
    if (body.budget_currency !== undefined) {
      updates.budget_currency = body.budget_currency;
      const amt = updates.budget_amount !== undefined ? Number(updates.budget_amount) : Number(existingProject.budget_amount);
      updates.budget_pkr =
        body.budget_currency === 'PKR' ? Math.round(amt) : Math.round(amt * EXCHANGE_RATE_USD_TO_PKR);
    }
    if (body.target_audience !== undefined) updates.target_audience = body.target_audience;
    if (body.business_scale !== undefined) updates.business_scale = body.business_scale;
    if (body.business_model !== undefined) updates.business_model = body.business_model;
    if (body.storefront_footprint !== undefined) updates.storefront_footprint = body.storefront_footprint;
    if (body.product_description !== undefined) updates.product_description = body.product_description;
    if (body.product_types !== undefined) updates.product_types = body.product_types;
    if (body.product_file_url !== undefined) updates.product_file_url = body.product_file_url;
    if (body.product_file_name !== undefined) updates.product_file_name = body.product_file_name;
    if (body.product_file_size !== undefined) updates.product_file_size = body.product_file_size;
    if (body.current_step !== undefined) updates.current_step = Number(body.current_step);
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ project: updatedProject });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const { data: existingProject } = await supabase
      .from('projects')
      .select('owner_id, status')
      .eq('id', id)
      .maybeSingle();

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (existingProject.owner_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (existingProject.status !== 'draft') {
      return NextResponse.json({ error: 'Cannot delete submitted projects' }, { status: 400 });
    }

    const { error: deleteError } = await supabase.from('projects').delete().eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Draft deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
