import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: store, error } = await supabase
    .from('stores')
    .select('id, slug, custom_domain')
    .eq('id', id)
    .maybeSingle();

  if (error || !store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  // Domain verification mock status
  const isConfigured = Boolean(store.custom_domain);
  return NextResponse.json({
    custom_domain: store.custom_domain || null,
    status: isConfigured ? 'verified' : 'unconfigured',
    dns_records: {
      type: 'CNAME',
      name: store.custom_domain || '@',
      value: 'cname.vercel-dns.com',
      ttl: 3600,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const domain = body.custom_domain ? String(body.custom_domain).toLowerCase().trim() : null;

  if (domain && !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\.[a-z]{2,}$/i.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format. Example: mystore.com' }, { status: 400 });
  }

  const { error } = await supabase
    .from('stores')
    .update({ custom_domain: domain })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, custom_domain: domain });
}
