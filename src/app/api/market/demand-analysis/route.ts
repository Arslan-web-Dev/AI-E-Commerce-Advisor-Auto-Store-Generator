import { NextResponse } from 'next/server';
import { mlClient } from '@/lib/ml-client';
import { PUNJAB_DISTRICT_BENCHMARKS } from '@/lib/constants/punjab-benchmarks';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { primary_keyword, district, comparison_keywords } = body;

    if (!primary_keyword || !district) {
      return NextResponse.json(
        { error: 'primary_keyword and district are required.' },
        { status: 400 }
      );
    }

    const matchedDistrict = PUNJAB_DISTRICT_BENCHMARKS.find(
      (d) => d.district.toLowerCase() === String(district).toLowerCase()
    );

    // Coverage honesty: verified demand-analysis benchmarks currently exist for
    // the Punjab corpus only. Never substitute another district's (e.g. Lahore's)
    // benchmarks for an uncovered location.
    if (!matchedDistrict) {
      return NextResponse.json(
        {
          analysis: null,
          coverage: {
            status: 'unavailable',
            district: String(district),
            source_note:
              'Verified demand-analysis coverage is currently Punjab-only. No benchmark data exists for this district, and another district\u2019s benchmarks are not substituted.',
          },
        },
        { status: 200 }
      );
    }

    const result = await mlClient.getMarketDemandAnalysis(
      primary_keyword,
      matchedDistrict.district,
      comparison_keywords,
      matchedDistrict
    );

    return NextResponse.json({ analysis: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Market demand analysis failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
