import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStorePaymentProviders } from '@/lib/store-management/payments';

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

  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: store } = await supabase.from('stores').select('id, owner_id').eq('id', storeId).single();
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch or init store payment settings
  let { data: settings } = await supabase
    .from('store_payment_settings')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle();

  if (!settings) {
    settings = {
      store_id: storeId,
      cod_enabled: true,
      stripe_enabled: false,
      paypal_enabled: false,
    };
  }

  const providers = getStorePaymentProviders(settings);

  return NextResponse.json({
    settings,
    providers,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: storeId } = await context.params;
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
    const { cod_enabled, stripe_enabled, stripe_account_id, notes } = body;

    const upsertData: Record<string, any> = {
      store_id: storeId,
    };

    if (cod_enabled !== undefined) upsertData.cod_enabled = Boolean(cod_enabled);
    if (stripe_enabled !== undefined) upsertData.stripe_enabled = Boolean(stripe_enabled);
    if (stripe_account_id !== undefined) upsertData.stripe_account_id = stripe_account_id ? String(stripe_account_id).trim() : null;
    if (notes !== undefined) upsertData.notes = notes ? String(notes).trim() : null;

    const { data: updated, error: upsertErr } = await supabase
      .from('store_payment_settings')
      .upsert(upsertData, { onConflict: 'store_id' })
      .select()
      .single();

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });

    const providers = getStorePaymentProviders(updated);

    return NextResponse.json({
      settings: updated,
      providers,
      message: 'Payment configuration updated successfully.',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Malformed payment settings payload' }, { status: 400 });
  }
}
