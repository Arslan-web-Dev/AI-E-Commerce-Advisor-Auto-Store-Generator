import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PUNJAB_DISTRICT_BENCHMARKS } from '@/lib/constants/punjab-benchmarks';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const district = searchParams.get('district');

  try {
    const supabase = await createClient();
    let query = supabase.from('regional_market_statistics').select('*');
    if (district) {
      query = query.ilike('district', district);
    }
    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      return NextResponse.json({
        districts: data,
        coverage: { status: 'verified', source: 'regional_market_statistics' },
      });
    }
  } catch {
    // fallback
  }

  // Fallback to the verified Punjab benchmark corpus, explicitly labelled as
  // Punjab coverage. A non-Punjab district is never substituted with Punjab data.
  if (district) {
    const matched = PUNJAB_DISTRICT_BENCHMARKS.find(
      (d) => d.district.toLowerCase() === district.toLowerCase()
    );
    return NextResponse.json({
      districts: matched ? [matched] : [],
      coverage: matched
        ? { status: 'verified', scope: 'Punjab', source: 'punjab_district_benchmarks' }
        : {
            status: 'unavailable',
            scope: 'Punjab',
            district,
            source: 'punjab_district_benchmarks',
            source_note:
              'Verified regional benchmark coverage is currently Punjab-only; no data is substituted for this district.',
          },
    });
  }

  return NextResponse.json({
    districts: PUNJAB_DISTRICT_BENCHMARKS,
    coverage: { status: 'verified', scope: 'Punjab', source: 'punjab_district_benchmarks' },
  });
}
