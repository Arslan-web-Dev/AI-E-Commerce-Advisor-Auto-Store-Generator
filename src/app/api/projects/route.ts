import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateProjectStep } from '@/lib/validation/project';
import { EXCHANGE_RATE_USD_TO_PKR } from '@/types/project';

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

    // Partial step 1 validation minimum for creating a draft
    const stepValidation = validateProjectStep(1, body);
    if (!stepValidation.valid && body.category) {
      return NextResponse.json({ error: 'Validation failed', details: stepValidation.errors }, { status: 400 });
    }

    const category = body.category || 'Apparel & Fashion';
    const targetLocation = body.target_location || 'Gulberg III, Lahore, Pakistan';
    const budgetAmount = body.budget_amount ? Number(body.budget_amount) : 15000;
    const budgetCurrency = body.budget_currency || 'USD';
    const budgetPkr =
      budgetCurrency === 'PKR'
        ? Math.round(budgetAmount)
        : Math.round(budgetAmount * EXCHANGE_RATE_USD_TO_PKR);

    // Parse simple city if available
    let parsedCity = body.city || null;
    if (!parsedCity && targetLocation.includes(',')) {
      const parts = targetLocation.split(',').map((s: string) => s.trim());
      if (parts.length >= 2) {
        parsedCity = parts[parts.length - 2];
      }
    }

    const newProject = {
      owner_id: user.id,
      title: body.title || `${category} - ${parsedCity || 'New Venture'}`,
      category,
      custom_category: body.custom_category || null,
      target_location: targetLocation,
      city: parsedCity,
      region: body.region || null,
      country: body.country || 'Pakistan',
      postal_code: body.postal_code || null,
      lat: body.lat !== undefined ? Number(body.lat) : 31.5204,
      lng: body.lng !== undefined ? Number(body.lng) : 74.3587,
      radius_km: body.radius_km ? Number(body.radius_km) : 10.0,
      budget_amount: budgetAmount,
      budget_currency: budgetCurrency,
      budget_pkr: budgetPkr,
      target_audience: body.target_audience || {},
      business_scale: body.business_scale || 'small',
      business_model: body.business_model || 'hybrid',
      storefront_footprint: body.storefront_footprint || 'boutique',
      product_description: body.product_description || null,
      product_types: Array.isArray(body.product_types) ? body.product_types : [],
      product_file_url: body.product_file_url || null,
      product_file_name: body.product_file_name || null,
      product_file_size: body.product_file_size || null,
      current_step: body.current_step ? Number(body.current_step) : 1,
      form_version: 1,
      metadata: body.metadata || {},
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
