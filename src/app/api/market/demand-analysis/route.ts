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
      (d) => d.district.toLowerCase() === district.toLowerCase()
    ) || PUNJAB_DISTRICT_BENCHMARKS[0];

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
