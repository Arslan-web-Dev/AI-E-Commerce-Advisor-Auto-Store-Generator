import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasProjectAccess } from '@/lib/visualization/access';
import {
  fetchScopedRentRows,
  type RentCacheQueryClient,
} from '@/lib/visualization/rent-cache-query';
import { buildRentMap } from '@/lib/visualization/rent-map';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * FR-5.2: authenticated, project-scoped read of stored rent_cache area points.
 * This route never invokes a rent provider and never substitutes another city
 * or province. Geography is filtered in the database query before its row
 * limit, then checked again by the pure `buildRentMap` helper.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
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

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, owner_id, city, district, region, lat, lng, radius_km')
      .eq('id', id)
      .maybeSingle();

    if (projectError) {
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!hasProjectAccess({ userId: user.id, ownerId: project.owner_id, role: profile?.role })) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Geography predicates are applied in the database query BEFORE the row
    // limit. No global snapshot is read and no unrelated city is substituted.
    const geography = {
      city: project.city,
      district: project.district,
      region: project.region,
    };
    const rentResult = await fetchScopedRentRows(supabase as unknown as RentCacheQueryClient, geography);

    if (rentResult.error) {
      return NextResponse.json({ error: rentResult.error.message }, { status: 500 });
    }

    const payload = buildRentMap(
      rentResult.rows,
      {
        ...geography,
        lat: project.lat,
        lng: project.lng,
        radiusKm: project.radius_km,
      },
      new Date()
    );

    return NextResponse.json({
      ...payload,
      sourceNote:
        'Stored rent_cache area estimates only. Centroid markers indicate sourced areas; no boundary polygons are stored or inferred.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
