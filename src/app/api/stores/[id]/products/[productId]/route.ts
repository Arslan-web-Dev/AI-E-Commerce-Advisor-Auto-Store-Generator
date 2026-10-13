import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string; productId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id: storeId, productId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).single();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('store_id', storeId)
    .single();

  if (prodErr || !product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ product });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: storeId, productId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).single();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updateData: Record<string, any> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'Product name cannot be empty.' }, { status: 400 });
      }
      updateData.name = body.name.trim();
    }

    if (body.price_pkr !== undefined) {
      const priceNum = Number(body.price_pkr);
      if (isNaN(priceNum) || priceNum < 0) {
        return NextResponse.json({ error: 'Price must be non-negative.' }, { status: 400 });
      }
      updateData.price_pkr = Math.round(priceNum);
    }

    if (body.compare_at_price_pkr !== undefined) {
      updateData.compare_at_price_pkr = body.compare_at_price_pkr
        ? Math.round(Number(body.compare_at_price_pkr))
        : null;
    }

    if (body.stock !== undefined) {
      const stockNum = Number(body.stock);
      if (isNaN(stockNum) || stockNum < 0) {
        return NextResponse.json({ error: 'Stock cannot be negative.' }, { status: 400 });
      }
      updateData.stock = Math.round(stockNum);
    }

    if (body.low_stock_threshold !== undefined) {
      const thresholdNum = Number(body.low_stock_threshold);
      if (isNaN(thresholdNum) || thresholdNum < 0) {
        return NextResponse.json({ error: 'Threshold cannot be negative.' }, { status: 400 });
      }
      updateData.low_stock_threshold = Math.round(thresholdNum);
    }

    if (body.sku !== undefined) updateData.sku = body.sku ? String(body.sku).trim() : null;
    if (body.description !== undefined) updateData.description = body.description ? String(body.description).trim() : null;
    if (body.category !== undefined) updateData.category = body.category ? String(body.category).trim() : null;
    if (body.images !== undefined && Array.isArray(body.images)) updateData.images = body.images;
    if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active);
    if (body.is_archived !== undefined) updateData.is_archived = Boolean(body.is_archived);
    if (body.seo !== undefined && typeof body.seo === 'object') updateData.seo = body.seo;

    const { data: updatedProduct, error: updateErr } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .eq('store_id', storeId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ product: updatedProduct });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Malformed update payload' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id: storeId, productId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).single();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Soft archive to preserve historical order integrity
  const { error: archiveErr } = await supabase
    .from('products')
    .update({ is_archived: true, is_active: false })
    .eq('id', productId)
    .eq('store_id', storeId);

  if (archiveErr) {
    return NextResponse.json({ error: archiveErr.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Product archived successfully', productId });
}
