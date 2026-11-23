interface Props {
  rentMin: number;
  rentMax: number;
  budget: number;
  area?: string;
  confidence?: 'low' | 'medium' | 'high';
}

export default function RentBudgetGauge({ rentMin, rentMax, budget, area, confidence = 'medium' }: Props) {
  const avg = (rentMin + rentMax) / 2;
  const ratio = budget > 0 ? Math.min((avg / budget) * 100, 150) : 100;

  let band: { label: string; color: string; bg: string };
  if (ratio < 30) band = { label: 'Well within budget', color: '#4edea3', bg: '#4edea322' };
  else if (ratio < 60) band = { label: 'Comfortable', color: '#4cd7f6', bg: '#4cd7f622' };
  else if (ratio < 85) band = { label: 'Tight — consider negotiating', color: '#f59e0b', bg: '#f59e0b22' };
  else band = { label: 'Over budget', color: '#ef4444', bg: '#ef444422' };

  const fillPct = Math.min(ratio, 100);

  return (
    <div style={{ padding: '1.25rem', border: '1px solid #2d3449', borderRadius: '0.5rem', backgroundColor: '#171f33' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.25rem', color: '#dae2fd' }}>Rent vs Budget</h3>
          {area && <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>{area}</p>}
        </div>
        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '100px',
            fontSize: '0.7rem',
            fontWeight: 700,
            backgroundColor: band.bg,
            color: band.color,
          }}
        >
          {band.label}
        </span>
      </div>

      {/* Gauge track */}
      <div style={{ position: 'relative', height: '12px', backgroundColor: '#2d3449', borderRadius: '100px', overflow: 'hidden', marginBottom: '0.5rem' }}>
        {/* Bands */}
        <div style={{ position: 'absolute', left: '0%', width: '30%', height: '100%', backgroundColor: '#4edea322' }} />
        <div style={{ position: 'absolute', left: '30%', width: '30%', height: '100%', backgroundColor: '#4cd7f622' }} />
        <div style={{ position: 'absolute', left: '60%', width: '25%', height: '100%', backgroundColor: '#f59e0b22' }} />
        <div style={{ position: 'absolute', left: '85%', width: '15%', height: '100%', backgroundColor: '#ef444422' }} />
        {/* Fill */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${fillPct}%`,
            height: '100%',
            backgroundColor: band.color,
            borderRadius: '100px',
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', opacity: 0.65, marginBottom: '0.75rem' }}>
        <span>Low risk</span>
        <span>Moderate</span>
        <span>Tight</span>
        <span>Over</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ opacity: 0.6, marginBottom: '0.1rem' }}>Est. Rent</p>
          <p style={{ fontWeight: 700, color: '#dae2fd' }}>PKR {avg.toLocaleString('en-PK')}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ opacity: 0.6, marginBottom: '0.1rem' }}>Your Budget</p>
          <p style={{ fontWeight: 700, color: '#4edea3' }}>PKR {budget.toLocaleString('en-PK')}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ opacity: 0.6, marginBottom: '0.1rem' }}>Rent % of Budget</p>
          <p style={{ fontWeight: 700, color: band.color }}>{Math.round(ratio)}%</p>
        </div>
      </div>

      {confidence === 'low' && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.7rem', opacity: 0.5, fontStyle: 'italic' }}>
          ⚠️ Low-confidence estimate — verify with a local agent
        </p>
      )}
    </div>
  );
}
