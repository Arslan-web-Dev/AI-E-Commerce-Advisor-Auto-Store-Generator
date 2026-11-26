import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/admin/usage — platform-wide aggregated usage and sanitized AI call log. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [stores, products, orders, customers, aiCalls] = await Promise.all([
    supabase.from('stores').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_archived', false),
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('ai_call_log').select('purpose, provider, success, latency_ms, error_code, created_at').order('created_at', { ascending: false }).limit(500),
  ]);

  const calls = aiCalls.data ?? [];
  const byPurpose = calls.reduce<Record<string, { total: number; success: number; failed: number }>>((acc, call) => {
    const key = String(call.purpose || 'unknown');
    const bucket = acc[key] ?? { total: 0, success: 0, failed: 0 };
    bucket.total += 1;
    if (call.success) bucket.success += 1;
    else bucket.failed += 1;
    acc[key] = bucket;
    return acc;
  }, {});

  return NextResponse.json({
    usage: {
      store_count: stores.count ?? 0,
      active_product_count: products.count ?? 0,
      order_count: orders.count ?? 0,
      customer_count: customers.count ?? 0,
      ai_calls_in_sample: calls.length,
      ai_calls_by_purpose: byPurpose,
    },
    // Only sanitized telemetry fields; no owner IDs, prompts, emails or tokens.
    recent_ai_calls: calls.slice(0, 20).map((call) => ({
      purpose: call.purpose,
      provider: call.provider,
      success: call.success,
      latency_ms: call.latency_ms,
      error_code: call.error_code,
      created_at: call.created_at,
    })),
    sampled: calls.length === 500,
  });
}
