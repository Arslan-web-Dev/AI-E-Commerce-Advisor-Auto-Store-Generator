import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateInvoiceHtml } from '@/lib/store-management/invoice';
import { InvoiceData } from '@/types/store-management';

interface RouteContext {
  params: Promise<{ id: string; orderId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id: storeId, orderId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: store } = await supabase
    .from('stores')
    .select('id, owner_id, name, slug, currency')
    .eq('id', storeId)
    .single();

  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (store.owner_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .eq('store_id', storeId)
    .single();

  if (orderErr || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const invoiceData: InvoiceData = {
    invoice_number: order.order_number,
    invoice_date: new Date(order.created_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    store: {
      name: store.name,
      slug: store.slug,
      currency: store.currency || 'PKR',
    },
    customer: {
      name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email || undefined,
      shipping_address: order.shipping_address,
      city: order.city,
    },
    items: (order.items || []).map((item: any) => ({
      name: item.name,
      sku: item.sku || undefined,
      quantity: item.quantity,
      unit_price_pkr: Number(item.unit_price_pkr),
      total_price_pkr: Number(item.total_price_pkr),
    })),
    subtotal_pkr: Number(order.subtotal_pkr),
    shipping_fee_pkr: Number(order.shipping_fee_pkr || 0),
    tax_pkr: Number(order.tax_pkr || 0),
    total_pkr: Number(order.total_pkr),
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    notes: order.notes || undefined,
  };

  const url = new URL(request.url);
  const format = url.searchParams.get('format');

  if (format === 'json') {
    return NextResponse.json({ invoice: invoiceData });
  }

  const html = generateInvoiceHtml(invoiceData);
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
