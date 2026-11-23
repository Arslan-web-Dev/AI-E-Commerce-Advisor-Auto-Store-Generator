interface TrendPoint {
  month: string;
  index: number;
}

interface Props {
  trendSeries: TrendPoint[];
  category?: string;
  slope?: 'growing' | 'stable' | 'declining';
  isCached?: boolean;
  cachedAt?: string;
}

export default function TrendChart({ trendSeries, category, slope, isCached, cachedAt }: Props) {
  if (!trendSeries || trendSeries.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, border: '1px solid #2d3449', borderRadius: '0.5rem' }}>
        No trend data available
      </div>
    );
  }

  const values = trendSeries.map((p) => p.index);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values);
  const height = 120;
  const width = 500;
  const pad = { top: 10, bottom: 24, left: 32, right: 10 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xStep = plotW / Math.max(trendSeries.length - 1, 1);
  const yScale = (v: number) => plotH - ((v - 0) / (maxVal + 5)) * plotH;

  const points = trendSeries.map((p, i) => ({
    x: pad.left + i * xStep,
    y: pad.top + yScale(p.index),
    label: p.month,
    value: p.index,
  }));

  const pathD =
    'M ' + points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');

  const fillD =
    pathD +
    ` L ${points[points.length - 1].x},${pad.top + plotH} L ${points[0].x},${pad.top + plotH} Z`;

  const slopeColor = slope === 'growing' ? '#4edea3' : slope === 'declining' ? '#ef4444' : '#4cd7f6';

  return (
    <div style={{ padding: '1.25rem', border: '1px solid #2d3449', borderRadius: '0.5rem', backgroundColor: '#171f33' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#dae2fd' }}>
            {category ? `${category} — ` : ''}Search Trend (12 months)
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {slope && (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '100px', backgroundColor: `${slopeColor}22`, color: slopeColor }}>
              {slope === 'growing' ? '↑ Growing' : slope === 'declining' ? '↓ Declining' : '→ Stable'}
            </span>
          )}
          {isCached && (
            <span style={{ fontSize: '0.65rem', opacity: 0.5 }} title={cachedAt ? `Cached at ${cachedAt}` : 'Cached data'}>
              🕐 Cached
            </span>
          )}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: '100%' }}>
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((v) => {
            const y = pad.top + yScale(v);
            return (
              <g key={v}>
                <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#2d3449" strokeWidth="1" />
                <text x={pad.left - 4} y={y + 4} textAnchor="end" fontSize="8" fill="#dae2fd" opacity={0.5}>{v}</text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={fillD} fill={slopeColor} fillOpacity={0.08} />

          {/* Line */}
          <path d={pathD} fill="none" stroke={slopeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3" fill={slopeColor} stroke="#171f33" strokeWidth="1.5" />
              {/* X labels (every 2 months on small width) */}
              {i % 2 === 0 && (
                <text
                  x={p.x}
                  y={height - 4}
                  textAnchor="middle"
                  fontSize="7"
                  fill="#dae2fd"
                  opacity={0.5}
                >
                  {p.label.slice(5)}
                </text>
              )}
              {/* Tooltip (SVG title) */}
              <title>{p.label}: {p.value}</title>
            </g>
          ))}
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.6, marginTop: '0.5rem' }}>
        <span>Avg: {Math.round(values.reduce((a, b) => a + b, 0) / values.length)}</span>
        <span>Peak: {maxVal}</span>
        <span>Low: {minVal}</span>
      </div>
    </div>
  );
}
