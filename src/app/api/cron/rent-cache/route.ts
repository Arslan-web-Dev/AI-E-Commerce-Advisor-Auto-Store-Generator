import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** GET /api/cron/rent-cache — write rent estimates into regional_market_statistics */
export async function GET() {
  const supabase = await createClient();

  // Punjab districts with estimated rent ranges (PKR/month)
  const rentData = [
    { district: 'Lahore', area: 'Gulberg', min_rent: 80000, max_rent: 250000 },
    { district: 'Lahore', area: 'DHA', min_rent: 100000, max_rent: 350000 },
    { district: 'Lahore', area: 'Model Town', min_rent: 60000, max_rent: 180000 },
    { district: 'Lahore', area: 'Johar Town', min_rent: 50000, max_rent: 150000 },
    { district: 'Faisalabad', area: 'D Ground', min_rent: 30000, max_rent: 90000 },
    { district: 'Faisalabad', area: 'Madina Town', min_rent: 25000, max_rent: 80000 },
    { district: 'Rawalpindi', area: 'Saddar', min_rent: 35000, max_rent: 110000 },
    { district: 'Rawalpindi', area: 'Bahria Town', min_rent: 45000, max_rent: 130000 },
    { district: 'Gujranwala', area: 'City Center', min_rent: 20000, max_rent: 65000 },
    { district: 'Multan', area: 'Hussain Agahi', min_rent: 18000, max_rent: 55000 },
    { district: 'Sialkot', area: 'Shahab Pura', min_rent: 15000, max_rent: 45000 },
    { district: 'Bahawalpur', area: 'Civil Lines', min_rent: 12000, max_rent: 40000 },
  ];

  const records = rentData.map((r) => ({
    district: r.district,
    area_name: r.area,
    metric_type: 'commercial_rent_pkr',
    value_min: r.min_rent,
    value_max: r.max_rent,
    value_avg: Math.round((r.min_rent + r.max_rent) / 2),
    source: 'cron_estimate',
    sample_size: 1,
    recorded_at: new Date().toISOString(),
    confidence: 'low',
    notes: 'Automated estimate — not from live market data',
  }));

  const { error } = await supabase
    .from('regional_market_statistics')
    .upsert(records, { onConflict: 'district,area_name,metric_type' });

  if (error) {
    console.error('Rent cache cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: records.length, timestamp: new Date().toISOString() });
}
