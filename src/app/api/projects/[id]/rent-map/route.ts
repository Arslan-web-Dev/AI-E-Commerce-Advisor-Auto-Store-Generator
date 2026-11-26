import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasProjectAccess } from '@/lib/visualization/access';
import { buildRentMap, type RentMapCacheRow } from '@/lib/visualization/rent-map';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const RENT_MAP_SELECT = [
  'id',
  'city',
  'area',
  'district',
  'province',
  'lat',
  'lng',
  'rent_per_sqft_pkr',
  'rent_min_pkr',
  'rent_max_pkr',
  'rent_avg_pkr',
  'sample_size',
  'source',
  'scraped_at',
  'recorded_at',
  'confidence',
  'provenance',
  'notes',
  'currency',
].join(', ');

/**
 * FR-5.2: authenticated, project-scoped read of stored rent_cache area points.
 * This route never invokes a rent provider and never substitutes another city
 * or province. Geography guards live in the pure `buildRentMap` helper.
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

    // Bounded snapshot; the pure helper applies strict city/district/province
    // scoping and rejects fields without safe coordinates or values.
    const { data: rows, error: rentError } = await supabase
      .from('rent_cache')
      .select(RENT_MAP_SELECT)
      .order('city', { ascending: true })
      .order('area', { ascending: true })
      .limit(500);

    if (rentError) {
      return NextResponse.json({ error: rentError.message }, { status: 500 });
    }

    const payload = buildRentMap(
      (rows ?? []) as unknown as RentMapCacheRow[],
      {
        city: project.city,
        district: project.district,
        region: project.region,
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
