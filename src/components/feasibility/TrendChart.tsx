import type { DataFreshness } from '@/types/data-collection';
import { analyzeTrendSeries, buildTrendSummary } from '@/lib/visualization/trend-analysis';

interface TrendPoint {
  month: string;
  index: number;
}

interface Props {
  trendSeries: TrendPoint[];
  category?: string;
  slope?: 'growing' | 'stable' | 'declining' | null;
  sourceIsUsable?: boolean;
  isCached?: boolean;
  isStale?: boolean;
  cachedAt?: string;
  retrievedAt?: string;
  provider?: string;
  scope?: string;
  provenance?: string | null;
  freshness?: DataFreshness | null;
}

const DIRECTION_LABEL = {
  growing: '↑ Growing',
  declining: '↓ Declining',
  stable: '→ Stable',
} as const;

function freshnessText(props: Props): string {
  if (props.isStale) return 'stale';
  if (props.freshness) return props.freshness;
  if (props.isCached) return 'cached';
  return 'unavailable';
}

export default function TrendChart({
  trendSeries,
  category,
  slope,
  sourceIsUsable = false,
  isCached = false,
  isStale = false,
  cachedAt,
  retrievedAt,
  provider,
  scope,
  provenance,
  freshness,
}: Props) {
  const props = { trendSeries, category, slope, sourceIsUsable, isCached, isStale, cachedAt, retrievedAt, provider, scope, provenance, freshness };
  const analysis = analyzeTrendSeries(trendSeries, {
    sourceSlope: slope,
    sourceIsUsable,
  });
  const points = analysis.validPoints;
  const direction = analysis.direction ? DIRECTION_LABEL[analysis.direction] : null;
  const directionColor =
    analysis.direction === 'growing' ? '#4edea3' : analysis.direction === 'declining' ? '#ef4444' : '#4cd7f6';

  const height = 150;
  const width = 520;
  const pad = { top: 12, bottom: 26, left: 34, right: 12 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const { min, max } = analysis.axis;
  const span = Math.max(1, max - min);
  const xStep = plotW / Math.max(points.length - 1, 1);
  const yScale = (value: number) => pad.top + plotH - ((value - min) / span) * plotH;
  const chartPoints = points.map((point, index) => ({
    x: pad.left + index * xStep,
    y: yScale(point.index),
    month: point.month,
    value: point.index,
  }));
  const pathD = chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const fillD = chartPoints.length
    ? `${pathD} L ${chartPoints[chartPoints.length - 1].x.toFixed(1)},${pad.top + plotH} L ${chartPoints[0].x.toFixed(1)},${pad.top + plotH} Z`
    : '';
  const gridValues = [0, 1, 2, 3, 4].map((step) => min + (span / 4) * step);

  return (
    <section
      aria-label="Demand trend chart"
      style={{ padding: '1.25rem', border: '1px solid #2d3449', borderRadius: '0.5rem', backgroundColor: '#171f33' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#dae2fd', marginBottom: '0.25rem' }}>
            {category ? `${category} — ` : ''}Search Trend ({points.length} observation{points.length === 1 ? '' : 's'})
          </h3>
          <p style={{ fontSize: '0.7rem', opacity: 0.65, margin: 0, lineHeight: 1.5 }}>
            Provider: {provider ?? 'N/A'} · Scope: {scope ?? 'N/A'} · Provenance: {provenance ?? 'N/A'} · Freshness: {freshnessText(props)}
            {(isCached || cachedAt || retrievedAt) && ` · ${cachedAt ? `Cached ${cachedAt}` : retrievedAt ? `Retrieved ${retrievedAt}` : 'Cached'}`}
          </p>
        </div>
        {direction && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '100px', backgroundColor: `${directionColor}22`, color: directionColor }}>
            {DIRECTION_LABEL[analysis.direction!]} <span style={{ opacity: 0.7, fontWeight: 400 }}>({analysis.directionSource})</span>
          </span>
        )}
      </div>

      {points.length === 0 ? (
        <div
          role="status"
          style={{ padding: '2rem', textAlign: 'center', opacity: 0.75, border: '1px solid #2d3449', borderRadius: '0.5rem', fontSize: '0.8rem', lineHeight: 1.6 }}
        >
          {isStale
            ? 'The stored trend is stale; no chart is shown.'
            : 'No valid in-scope trend observations are available. No synthetic curve is substituted.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: '100%' }} role="img" aria-label={buildTrendSummary(analysis)}>
            {gridValues.map((value, index) => {
              const y = yScale(value);
              return (
                <g key={index}>
                  <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#2d3449" strokeWidth="1" />
                  <text x={pad.left - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#dae2fd" opacity={0.5}>
                    {value.toFixed(0)}
                  </text>
                </g>
              );
            })}

            <path d={fillD} fill={directionColor} fillOpacity={0.08} />
            <path d={pathD} fill="none" stroke={directionColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {chartPoints.map((point, index) => (
              <g key={point.month}>
                <circle cx={point.x} cy={point.y} r="3" fill={directionColor} stroke="#171f33" strokeWidth="1.5" />
                {(index === 0 || index === chartPoints.length - 1 || index % 3 === 0) && (
                  <text x={point.x} y={height - 5} textAnchor="middle" fontSize="7" fill="#dae2fd" opacity={0.55}>
                    {point.month.slice(2)}
                  </text>
                )}
                <title>{`${point.month}: ${point.value}`}</title>
              </g>
            ))}
          </svg>
        </div>
      )}

      <p role="status" style={{ fontSize: '0.72rem', opacity: 0.72, margin: '0.6rem 0 0', lineHeight: 1.55 }}>
        {buildTrendSummary(analysis)} Average: {analysis.average ?? 'N/A'} · Peak: {analysis.peak ?? 'N/A'} · Minimum: {analysis.minimum ?? 'N/A'}.
      </p>
      {(analysis.invalidCount > 0 || analysis.duplicateMonths.length > 0 || analysis.missingMonths.length > 0 || !analysis.chronological) && (
        <p style={{ fontSize: '0.7rem', color: '#fca5a5', margin: '0.4rem 0 0', lineHeight: 1.5 }}>
          Data quality: {analysis.invalidCount} invalid observation(s), {analysis.duplicateMonths.length} duplicate month(s), {analysis.missingMonths.length} missing month(s).
          {!analysis.chronological && ' Source order was not chronological; points are displayed chronologically.'}
        </p>
      )}
      {!analysis.completeTwelveMonths && points.length > 0 && (
        <p style={{ fontSize: '0.7rem', color: '#f59e0b', margin: '0.4rem 0 0' }}>
          Incomplete series: twelve monthly observations are expected; missing months are not invented.
        </p>
      )}
    </section>
  );
}
