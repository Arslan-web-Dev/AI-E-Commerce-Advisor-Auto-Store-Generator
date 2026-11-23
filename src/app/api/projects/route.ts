import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateProjectStep } from '@/lib/validation/project';
import { convertUsdToPkr } from '@/lib/currency/exchange-rate';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';

    let query = supabase.from('projects').select('*');
    if (!isAdmin) {
      query = query.eq('owner_id', user.id);
    }

    const { data: projects, error } = await query.order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ projects: projects || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Partial step validation for initializing a draft
    const stepValidation = validateProjectStep(1, body);
    if (!stepValidation.valid && body.category) {
      return NextResponse.json({ error: 'Validation failed', details: stepValidation.errors }, { status: 400 });
    }

    const category = body.category ? String(body.category).trim() : 'Apparel & Fashion';
    const targetLocation = body.target_location ? String(body.target_location).trim() : '';
    const budgetAmount = body.budget_amount ? Number(body.budget_amount) : 250000;
    const budgetCurrency = body.budget_currency === 'USD' ? 'USD' : 'PKR';
    const budgetPkr = budgetCurrency === 'USD' ? convertUsdToPkr(budgetAmount) : Math.round(budgetAmount);

    // Validate coordinates if supplied; do NOT inject false defaults
    let lat: number | null = null;
    let lng: number | null = null;
    if (body.lat !== undefined && body.lat !== null && body.lng !== undefined && body.lng !== null) {
      const parsedLat = Number(body.lat);
      const parsedLng = Number(body.lng);
      if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
        if (parsedLat >= 23.5 && parsedLat <= 37.2 && parsedLng >= 60.8 && parsedLng <= 77.9) {
          lat = parsedLat;
          lng = parsedLng;
        } else {
          return NextResponse.json(
            { error: 'Specified coordinates are outside Pakistan geographic territory (Lat 23.5–37.2, Lng 60.8–77.9).' },
            { status: 400 }
          );
        }
      }
    }

    // Parse simple city if available
    let parsedCity = body.city || null;
    if (!parsedCity && targetLocation.includes(',')) {
      const parts = targetLocation.split(',').map((s: string) => s.trim());
      if (parts.length >= 2) {
        parsedCity = parts[parts.length - 2];
      }
    }

    const newProject = {
      owner_id: user.id, // Strictly derived from server session
      title: body.title ? String(body.title).trim() : `${category} Venture`,
      category,
      custom_category: body.custom_category || null,
      target_location: targetLocation,
      city: parsedCity,
      region: body.region || 'Punjab',
      country: 'Pakistan',
      postal_code: body.postal_code || null,
      lat,
      lng,
      radius_km: body.radius_km ? Math.min(15, Math.max(5, Number(body.radius_km))) : 10.0,
      budget_amount: budgetAmount,
      budget_currency: budgetCurrency,
      budget_pkr: budgetPkr,
      target_audience: body.target_audience || {},
      business_scale: body.business_scale || 'small',
      business_model: body.business_model || 'hybrid',
      storefront_footprint: body.storefront_footprint || 'boutique',
      product_description: body.product_description || '',
      product_types: Array.isArray(body.product_types) ? body.product_types : [],
      current_step: body.current_step ? Number(body.current_step) : 1,
      status: 'draft',
    };

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
