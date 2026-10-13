import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id: storeId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify store ownership
  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).single();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.toLowerCase() || '';
  const category = url.searchParams.get('category') || '';
  const showArchived = url.searchParams.get('archived') === 'true';

  let query = supabase.from('products').select('*').eq('store_id', storeId);

  if (!showArchived) {
    query = query.eq('is_archived', false);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data: products, error: prodErr } = await query.order('created_at', { ascending: false });

  if (prodErr) {
    return NextResponse.json({ error: prodErr.message }, { status: 500 });
  }

  let filtered = products || [];
  if (search) {
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        (p.description && p.description.toLowerCase().includes(search)) ||
        (p.sku && p.sku.toLowerCase().includes(search))
    );
  }

  return NextResponse.json({ products: filtered, count: filtered.length });
}

export async function POST(request: Request, context: RouteContext) {
  const { id: storeId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).single();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      name,
      slug: customSlug,
      sku,
      description,
      price_pkr,
      compare_at_price_pkr,
      cost_price_pkr,
      stock = 0,
      low_stock_threshold = 5,
      category,
      images = [],
      variants = [],
      seo = {},
      is_active = true,
    } = body;

    // Server-side validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Product title is required and cannot be empty.' }, { status: 400 });
    }

    const priceNum = Number(price_pkr);
    if (isNaN(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: 'Price must be a valid non-negative number in PKR.' }, { status: 400 });
    }

    const stockNum = Number(stock);
    if (isNaN(stockNum) || stockNum < 0) {
      return NextResponse.json({ error: 'Stock cannot be negative.' }, { status: 400 });
    }

    const thresholdNum = Number(low_stock_threshold);
    if (isNaN(thresholdNum) || thresholdNum < 0) {
      return NextResponse.json({ error: 'Low stock threshold must be a non-negative number.' }, { status: 400 });
    }

    const compareNum = compare_at_price_pkr ? Number(compare_at_price_pkr) : null;
    if (compareNum !== null && compareNum < priceNum) {
      return NextResponse.json(
        { error: 'Original compare-at price must be greater than or equal to the selling price.' },
        { status: 400 }
      );
    }

    // Generate clean slug
    const generatedSlug = (customSlug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'product';

    const { data: newProduct, error: insertErr } = await supabase
      .from('products')
      .insert({
        store_id: storeId,
        name: name.trim(),
        slug: generatedSlug,
        sku: sku?.trim() || null,
        description: description?.trim() || null,
        price_pkr: Math.round(priceNum),
        compare_at_price_pkr: compareNum ? Math.round(compareNum) : null,
        cost_price_pkr: cost_price_pkr ? Math.round(Number(cost_price_pkr)) : null,
        stock: Math.round(stockNum),
        low_stock_threshold: Math.round(thresholdNum),
        category: category?.trim() || null,
        images: Array.isArray(images) ? images : [],
        variants: Array.isArray(variants) ? variants : [],
        seo: typeof seo === 'object' ? seo : {},
        is_active: Boolean(is_active),
        is_archived: false,
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json(
          { error: `A product with slug '${generatedSlug}' already exists in this store. Please use a unique title or SKU.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Record initial inventory log if initial stock was configured
    if (stockNum > 0) {
      await supabase.from('inventory_logs').insert({
        store_id: storeId,
        product_id: newProduct.id,
        delta: Math.round(stockNum),
        previous_stock: 0,
        new_stock: Math.round(stockNum),
        reason: 'initial_setup',
        actor_id: user.id,
      });
    }

    return NextResponse.json({ product: newProduct }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Malformed product payload' }, { status: 400 });
  }
}
