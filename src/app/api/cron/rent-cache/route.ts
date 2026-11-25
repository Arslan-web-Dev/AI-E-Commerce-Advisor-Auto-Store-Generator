import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertCronAuthorized } from '@/lib/security/cron-auth';
import { PUNJAB_RENT_ESTIMATE_SEEDS } from '@/lib/data-collection/rent-estimates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/rent-cache
 *
 * Secure scheduled job that upserts aggregated commercial rent estimates into
 * `rent_cache`. Records are explicitly labelled `manual_estimate` — they are
 * not live scraped market averages.
 *
 * Analysis paths must read `rent_cache` only and never scrape live.
 */
export async function GET(request: Request) {
  const auth = assertCronAuthorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Supabase admin client is not configured for rent-cache cron',
      },
      { status: 503 }
    );
  }

  const collectedAt = new Date().toISOString();
  const records = PUNJAB_RENT_ESTIMATE_SEEDS.map((seed) => ({
    city: seed.city,
    area: seed.area,
    district: seed.district,
    province: seed.province,
    lat: seed.lat,
    lng: seed.lng,
    rent_per_sqft_pkr: seed.rent_avg_pkr,
    rent_min_pkr: seed.rent_min_pkr,
    rent_max_pkr: seed.rent_max_pkr,
    rent_avg_pkr: seed.rent_avg_pkr,
    currency: 'PKR',
    sample_size: seed.sample_size,
    source: 'punjab_manual_rent_estimate_corpus',
    provenance: 'manual_estimate',
    confidence: seed.confidence,
    notes: seed.notes,
    scraped_at: collectedAt,
  }));

  const { error } = await admin.from('rent_cache').upsert(records, {
    onConflict: 'city,area',
  });

  if (error) {
    console.error('Rent cache cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    updated: records.length,
    provenance: 'manual_estimate',
    source: 'punjab_manual_rent_estimate_corpus',
    coverage: 'Punjab',
    note: 'Stored aggregated Punjab rent estimates only. Not live market observations.',
    timestamp: collectedAt,
  });
}
