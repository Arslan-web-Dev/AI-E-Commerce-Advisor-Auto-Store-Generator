import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateProjectFields } from '@/lib/validation/project';
import { BENCHMARK_EXCHANGE_RATE, convertUsdToPkr } from '@/lib/currency/exchange-rate';
import {
  buildCoverageSnapshot,
  canonicalRegionName,
  getRegionForDistrict,
  PAKISTAN_BOUNDS,
  PAKISTAN_COUNTRY,
} from '@/lib/geo/pakistan-geography';

export const dynamic = 'force-dynamic';

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

    // Field-level validation: any supplied value is validated server-side. Drafts
    // may be partial, but no draft write may persist an invalid field value
    // (Task 3 §6, §8).
    // A partial geographic update must be validated in the context of the saved
    // region/district; otherwise updating only `city` would fail as "unrecognised"
    // even though the project already has a valid region.
    const geoFields = ['region', 'district', 'city'] as const;
    const hasGeoUpdate = geoFields.some((field) => body[field] !== undefined);
    if (hasGeoUpdate) {
      if (body.region === undefined) body.region = existingProject.region;
      if (body.district === undefined) body.district = existingProject.district;
      if (body.city === undefined) body.city = existingProject.city;
    }

    const fieldValidation = validateProjectFields(body);
    if (!fieldValidation.valid) {
      return NextResponse.json({ error: 'Validation failed', details: fieldValidation.errors }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.category !== undefined) updates.category = body.category;
    if (body.custom_category !== undefined) updates.custom_category = body.custom_category;
    if (body.target_location !== undefined) updates.target_location = String(body.target_location).trim();
    if (body.city !== undefined) updates.city = body.city;
    if (body.district !== undefined) updates.district = body.district ? String(body.district).trim() : null;

    // Resolve the region nationally: canonicalise an explicit value (name or ISO
    // code) or infer it from a recognised district. NEVER default to Punjab.
    if (body.region !== undefined) {
      updates.region = canonicalRegionName(String(body.region)) ?? null;
    } else if (body.district !== undefined && body.district) {
      const inferred = getRegionForDistrict(String(body.district).trim());
      if (inferred) updates.region = inferred.name;
    }
    if (body.country !== undefined) updates.country = PAKISTAN_COUNTRY; // Platform strictly locked to Pakistan
    if (body.postal_code !== undefined) updates.postal_code = body.postal_code;

    // Validate coordinates if being updated
    if (body.lat !== undefined && body.lat !== null && body.lng !== undefined && body.lng !== null) {
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        if (
          lat < PAKISTAN_BOUNDS.minLat ||
          lat > PAKISTAN_BOUNDS.maxLat ||
          lng < PAKISTAN_BOUNDS.minLng ||
          lng > PAKISTAN_BOUNDS.maxLng
        ) {
          return NextResponse.json(
            { error: 'Coordinates must be located within Pakistan territory (Lat: 23.5–37.2, Lng: 60.8–77.9).' },
            { status: 400 }
          );
        }
        updates.lat = lat;
        updates.lng = lng;
      }
    } else if (body.lat === null || body.lng === null) {
      updates.lat = null;
      updates.lng = null;
    }

    if (body.radius_km !== undefined) {
      updates.radius_km = Math.min(15, Math.max(5, Number(body.radius_km)));
    }

    if (body.budget_amount !== undefined) {
      const amt = Number(body.budget_amount);
      updates.budget_amount = amt;
      const curr = (body.budget_currency || existingProject.budget_currency) as 'USD' | 'PKR';
      updates.budget_pkr = curr === 'PKR' ? Math.round(amt) : convertUsdToPkr(amt);
      updates.exchange_rate = curr === 'USD' ? BENCHMARK_EXCHANGE_RATE : 1.0;
      updates.exchange_rate_source = curr === 'USD' ? 'State Bank of Pakistan Benchmark' : 'Canonical PKR';
      updates.exchange_rate_timestamp = new Date().toISOString();
    }
    if (body.budget_currency !== undefined) {
      updates.budget_currency = body.budget_currency;
      const amt = updates.budget_amount !== undefined ? Number(updates.budget_amount) : Number(existingProject.budget_amount);
      updates.budget_pkr = body.budget_currency === 'PKR' ? Math.round(amt) : convertUsdToPkr(amt);
      updates.exchange_rate = body.budget_currency === 'USD' ? BENCHMARK_EXCHANGE_RATE : 1.0;
      updates.exchange_rate_source = body.budget_currency === 'USD' ? 'State Bank of Pakistan Benchmark' : 'Canonical PKR';
      updates.exchange_rate_timestamp = new Date().toISOString();
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

    // Refresh the geographic coverage snapshot in `metadata` whenever any
    // geographic identity field changes. Identity stays national; coverage is a
    // separate, non-restrictive concept stored alongside it (no new columns).
    if (body.region !== undefined || body.district !== undefined || body.city !== undefined) {
      const nextRegion =
        updates.region !== undefined ? (updates.region as string | null) : existingProject.region;
      const nextDistrict =
        updates.district !== undefined ? (updates.district as string | null) : existingProject.district;
      const nextCity =
        updates.city !== undefined ? (updates.city as string | null) : existingProject.city;
      const baseMetadata =
        (updates.metadata as Record<string, unknown> | undefined) ??
        (existingProject.metadata as Record<string, unknown> | undefined) ??
        {};
      updates.metadata = {
        ...baseMetadata,
        geo: buildCoverageSnapshot({ region: nextRegion, district: nextDistrict, city: nextCity }),
      };
    }

    // Never allow updating owner_id from request body
    delete updates.owner_id;

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
