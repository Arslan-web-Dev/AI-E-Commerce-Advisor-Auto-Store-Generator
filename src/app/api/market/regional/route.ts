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
      return NextResponse.json({ districts: data });
    }
  } catch {
    // fallback
  }

  // Fallback to verified baseline data
  if (district) {
    const matched = PUNJAB_DISTRICT_BENCHMARKS.find(
      (d) => d.district.toLowerCase() === district.toLowerCase()
    );
    return NextResponse.json({ districts: matched ? [matched] : [] });
  }

  return NextResponse.json({ districts: PUNJAB_DISTRICT_BENCHMARKS });
}
