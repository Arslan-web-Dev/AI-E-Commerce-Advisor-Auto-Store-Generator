import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient } from '@/lib/ml-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keywordsParam = searchParams.get('keywords');
  const geo = searchParams.get('geo') || 'PK';
  const timeframe = searchParams.get('timeframe') || 'today 12-m';

  if (!keywordsParam) {
    return NextResponse.json({ error: 'keywords parameter is required (comma-separated)' }, { status: 400 });
  }

  const keywords = keywordsParam.split(',').map((k) => k.trim()).filter(Boolean);

  try {
    const trends = await mlClient.getTrends(keywords, geo, timeframe);

    // Optionally cache query in Supabase
    try {
      const supabase = await createClient();
      for (const kw of keywords) {
        const itemAnalytics = trends.analytics?.[kw];
        await supabase.from('market_trend_queries').insert({
          keyword: kw,
          geo,
          timeframe,
          interest_over_time: trends.interest_over_time,
          related_queries: trends.related_queries?.[kw] || {},
          trend_slope: itemAnalytics?.trend_slope,
          trend_direction: itemAnalytics?.trend_direction,
          peak_month: itemAnalytics?.peak_month,
        });
      }
    } catch {
      // Non-blocking caching
    }

    return NextResponse.json({ trends });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to fetch Google Trends';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
