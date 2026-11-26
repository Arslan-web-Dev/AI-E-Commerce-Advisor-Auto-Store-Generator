import type { ConfidenceLevel, DataFreshness } from '@/types/data-collection';
import { calculateRentBudget, deriveMonthlyRentRange, formatCurrency } from '@/lib/visualization/rent-budget';
import { RENT_BANDS } from '@/lib/visualization/module5-config';

interface Props {
  monthlyRent: number | null | undefined;
  budget: number | null | undefined;
  rentMin?: number | null;
  rentMax?: number | null;
  rentAvg?: number | null;
  area?: string;
  currency?: 'PKR' | 'USD';
  rentCurrency?: string | null;
  budgetCurrency?: string | null;
  confidence?: ConfidenceLevel | null;
  provenance?: string | null;
  freshness?: DataFreshness | null;
  retrievedAt?: string | null;
}

function provenanceLine(provenance?: string | null, freshness?: DataFreshness | null): string {
  if (!provenance && !freshness) return 'Provenance: N/A';
  return `Provenance: ${provenance || 'N/A'} · Freshness: ${freshness || 'N/A'}`;
}

export default function RentBudgetGauge({
  monthlyRent,
  budget,
  rentMin,
  rentMax,
  rentAvg,
  area,
  currency = 'PKR',
  rentCurrency,
  budgetCurrency,
  confidence,
  provenance,
  freshness,
  retrievedAt,
}: Props) {
  const calc = calculateRentBudget({
    monthlyRent,
    totalBudget: budget,
    rentMin,
    rentMax,
    rentCurrency: rentCurrency ?? currency,
    budgetCurrency: budgetCurrency ?? currency,
  });
  const range = deriveMonthlyRentRange(monthlyRent, rentMin, rentMax, rentAvg);
  const band = calc.band;
  const color = band?.color ?? '#94a3b8';
  const percentage = calc.ratioPercent == null ? 'N/A' : `${calc.ratioPercent.toFixed(0)}%`;

  return (
    <section
      aria-label="Rent versus monthly-equivalent budget"
      style={{ padding: '1.25rem', border: '1px solid #2d3449', borderRadius: '0.5rem', backgroundColor: '#171f33' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.25rem', color: '#dae2fd' }}>Rent vs Monthly Budget Share</h3>
          {area && <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: 0 }}>{area}</p>}
        </div>
        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '100px',
            fontSize: '0.7rem',
            fontWeight: 700,
            backgroundColor: band ? band.bg : '#94a3b822',
            color,
          }}
        >
          {band?.label ?? 'N/A'}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={calc.ratioPercent == null ? undefined : Math.round(calc.fillPercent)}
        aria-label="Monthly rent as a percentage of the monthly-equivalent budget"
        style={{ position: 'relative', height: '12px', backgroundColor: '#2d3449', borderRadius: '100px', overflow: 'hidden', marginBottom: '0.5rem' }}
      >
        {RENT_BANDS.map((segment) => (
          <div
            key={segment.label}
            style={{
              position: 'absolute',
              left: `${segment.minInclusive}%`,
              width: `${segment.maxExclusive === null ? 100 - segment.minInclusive : segment.maxExclusive - segment.minInclusive}%`,
              height: '100%',
              backgroundColor: segment.bg,
            }}
          />
        ))}
        {calc.valid && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: `${calc.fillPercent}%`,
              height: '100%',
              backgroundColor: color,
              borderRadius: '100px',
              transition: 'width 0.5s ease',
            }}
          />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.65, marginBottom: '0.75rem', gap: '0.25rem', flexWrap: 'wrap' }}>
        {RENT_BANDS.map((segment) => (
          <span key={segment.label} style={{ color: segment.color }}>
            {segment.minInclusive}{segment.maxExclusive === null ? '+' : `–${segment.maxExclusive}`}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))', gap: '0.5rem', fontSize: '0.8rem' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ opacity: 0.6, marginBottom: '0.1rem' }}>Monthly rent</p>
          <p style={{ fontWeight: 700, color: '#dae2fd' }}>{formatCurrency(calc.monthlyRent, currency)}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ opacity: 0.6, marginBottom: '0.1rem' }}>Monthly budget share</p>
          <p style={{ fontWeight: 700, color: '#4edea3' }}>{formatCurrency(calc.monthlyBudget, currency)}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ opacity: 0.6, marginBottom: '0.1rem' }}>Rent share</p>
          <p style={{ fontWeight: 700, color }}>{percentage}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ opacity: 0.6, marginBottom: '0.1rem' }}>Total budget</p>
          <p style={{ fontWeight: 700, color: '#dae2fd' }}>{formatCurrency(calc.totalBudget, currency)}</p>
        </div>
      </div>

      {range && (
        <p style={{ fontSize: '0.72rem', opacity: 0.7, lineHeight: 1.5, margin: '0.75rem 0 0' }}>
          Monthly range: {range.hasGenuineRange
            ? `${formatCurrency(range.rentMin, currency)} – ${formatCurrency(range.rentMax, currency)}`
            : 'N/A (single sourced estimate only)'}.
          {' '}{range.note}
        </p>
      )}
      <p style={{ fontSize: '0.72rem', opacity: 0.7, lineHeight: 1.5, margin: '0.5rem 0 0' }}>
        {provenanceLine(provenance, freshness)} · Confidence: {confidence ?? 'N/A'} · Recorded: {retrievedAt ?? 'N/A'}
      </p>
      <p style={{ fontSize: '0.68rem', opacity: 0.6, margin: '0.5rem 0 0', lineHeight: 1.5 }}>
        The denominator is the monthly-equivalent budget (total budget ÷ 12), not the total budget. Bands are documented presentation cutoffs in `config/module5-visualization.json`.
        {calc.reason ? ` ${calc.reason}` : ''}
      </p>
      {!calc.valid && (
        <p role="status" style={{ fontSize: '0.74rem', color: '#fca5a5', margin: '0.5rem 0 0' }}>
          Rent share: N/A. No percentage is shown without valid sourced rent and budget values.
        </p>
      )}
    </section>
  );
}
