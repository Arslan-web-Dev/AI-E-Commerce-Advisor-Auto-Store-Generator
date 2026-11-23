interface Props {
  score: number; // 0-100
  competitorCount?: number;
  radiusKm?: number;
}

type Band = { label: string; color: string; bg: string; range: string };

const BANDS: Band[] = [
  { label: 'Low Saturation', color: '#4edea3', bg: '#4edea322', range: '0–25' },
  { label: 'Moderate', color: '#4cd7f6', bg: '#4cd7f622', range: '26–50' },
  { label: 'High Saturation', color: '#f59e0b', bg: '#f59e0b22', range: '51–75' },
  { label: 'Saturated', color: '#ef4444', bg: '#ef444422', range: '76–100' },
];

function getBand(score: number): Band {
  if (score <= 25) return BANDS[0];
  if (score <= 50) return BANDS[1];
  if (score <= 75) return BANDS[2];
  return BANDS[3];
}

export default function SaturationMeter({ score, competitorCount, radiusKm = 10 }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const band = getBand(clamped);
  const pct = clamped;

  return (
    <div style={{ padding: '1.25rem', border: '1px solid #2d3449', borderRadius: '0.5rem', backgroundColor: '#171f33' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#dae2fd' }}>Market Saturation</h3>
        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: band.bg, color: band.color }}>
          {band.label}
        </span>
      </div>

      {/* Arc-style meter using a simple div track */}
      <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
        <div style={{ height: '14px', backgroundColor: '#2d3449', borderRadius: '100px', overflow: 'hidden' }}>
          {/* Band colors */}
          <div style={{ position: 'absolute', left: '0%', width: '25%', height: '14px', backgroundColor: '#4edea333' }} />
          <div style={{ position: 'absolute', left: '25%', width: '25%', height: '14px', backgroundColor: '#4cd7f633' }} />
          <div style={{ position: 'absolute', left: '50%', width: '25%', height: '14px', backgroundColor: '#f59e0b33' }} />
          <div style={{ position: 'absolute', left: '75%', width: '25%', height: '14px', backgroundColor: '#ef444433' }} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: `${pct}%`,
              height: '14px',
              backgroundColor: band.color,
              borderRadius: '100px',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        {/* Needle indicator */}
        <div
          style={{
            position: 'absolute',
            top: '-4px',
            left: `calc(${pct}% - 3px)`,
            width: '6px',
            height: '22px',
            backgroundColor: '#fff',
            borderRadius: '3px',
            boxShadow: `0 0 6px ${band.color}`,
            transition: 'left 0.6s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.6, marginBottom: '0.875rem' }}>
        {BANDS.map((b) => (
          <span key={b.label} style={{ color: b.color }}>
            {b.range}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
        <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0d1829', borderRadius: '0.375rem' }}>
          <p style={{ opacity: 0.6, marginBottom: '0.1rem', fontSize: '0.7rem' }}>Saturation Score</p>
          <p style={{ fontWeight: 800, fontSize: '1.25rem', color: band.color }}>{clamped}</p>
        </div>
        {competitorCount != null && (
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0d1829', borderRadius: '0.375rem' }}>
            <p style={{ opacity: 0.6, marginBottom: '0.1rem', fontSize: '0.7rem' }}>Competitors ({radiusKm}km)</p>
            <p style={{ fontWeight: 800, fontSize: '1.25rem', color: '#dae2fd' }}>{competitorCount}</p>
          </div>
        )}
      </div>
    </div>
  );
}
