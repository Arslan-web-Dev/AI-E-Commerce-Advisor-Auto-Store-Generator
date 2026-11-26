import { calculateSaturation } from '@/lib/visualization/saturation';
import { SATURATION_BANDS } from '@/lib/visualization/module5-config';
import { formatMapNumber } from '@/lib/visualization/map-validation';

interface Props {
  /** Raw stored unit: competitors per 100,000 residents. */
  saturationPer100k?: number | null;
  /** Raw documented unit: competitors per square kilometre. */
  competitorDensityPerKm2?: number | null;
  competitorCount?: number | null;
  population?: number | null;
  radiusKm?: number | null;
}

function bandRange(min: number, max: number | null): string {
  return max === null ? `${min}+` : `${min}–${max}`;
}

export default function SaturationMeter({
  saturationPer100k,
  competitorDensityPerKm2,
  competitorCount,
  population,
  radiusKm,
}: Props) {
  const calculation = calculateSaturation({
    saturationPer100k,
    competitorCount,
    population,
  });
  const index = calculation.normalizedIndex;
  const band = calculation.band;
  const color = band?.color ?? '#94a3b8';
  const fill = index ?? 0;

  return (
    <section
      aria-label="Market saturation"
      style={{ padding: '1.25rem', border: '1px solid #2d3449', borderRadius: '0.5rem', backgroundColor: '#171f33' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#dae2fd', margin: 0 }}>Market Saturation</h3>
        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: band ? band.bg : '#94a3b822', color }}>
          {band?.label ?? 'N/A'}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={index == null ? undefined : Math.round(index)}
        aria-label="Normalized saturation index from 0 to 100"
        style={{ position: 'relative', height: '14px', backgroundColor: '#2d3449', borderRadius: '100px', overflow: 'hidden' }}
      >
        {SATURATION_BANDS.map((segment) => (
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
        {index !== null && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: `${fill}%`,
              height: '100%',
              backgroundColor: color,
              borderRadius: '100px',
              transition: 'width 0.6s ease',
            }}
          />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.65, marginBottom: '0.875rem', gap: '0.25rem', flexWrap: 'wrap' }}>
        {SATURATION_BANDS.map((segment) => (
          <span key={segment.label} style={{ color: segment.color }}>
            {bandRange(segment.minInclusive, segment.maxExclusive)}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', fontSize: '0.8rem' }}>
        <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0d1829', borderRadius: '0.375rem' }}>
          <p style={{ opacity: 0.6, marginBottom: '0.1rem', fontSize: '0.7rem' }}>Normalised index</p>
          <p style={{ fontWeight: 800, fontSize: '1.25rem', color }}>{index === null ? 'N/A' : index.toFixed(1)}</p>
        </div>
        <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0d1829', borderRadius: '0.375rem' }}>
          <p style={{ opacity: 0.6, marginBottom: '0.1rem', fontSize: '0.7rem' }}>Competitors / 100k residents</p>
          <p style={{ fontWeight: 800, fontSize: '1.25rem', color: '#dae2fd' }}>{formatMapNumber(calculation.competitorsPer100k, 2)}</p>
        </div>
        {competitorDensityPerKm2 != null && Number.isFinite(Number(competitorDensityPerKm2)) && (
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0d1829', borderRadius: '0.375rem' }}>
            <p style={{ opacity: 0.6, marginBottom: '0.1rem', fontSize: '0.7rem' }}>Competitors / km²</p>
            <p style={{ fontWeight: 800, fontSize: '1.25rem', color: '#dae2fd' }}>{Number(competitorDensityPerKm2).toFixed(4)}</p>
          </div>
        )}
        {competitorCount != null && Number.isFinite(Number(competitorCount)) && (
          <div style={{ textAlign: 'center', padding: '0.5rem', backgroundColor: '#0d1829', borderRadius: '0.375rem' }}>
            <p style={{ opacity: 0.6, marginBottom: '0.1rem', fontSize: '0.7rem' }}>Observed competitors ({radiusKm ?? 'N/A'} km)</p>
            <p style={{ fontWeight: 800, fontSize: '1.25rem', color: '#dae2fd' }}>{Number(competitorCount)}</p>
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.68rem', opacity: 0.6, margin: '0.6rem 0 0 0', lineHeight: 1.5 }}>
        Raw competitors per 100,000 residents is the stored measure; the 0–100 index is presentation-only
        (`min(100, raw × 10)`). Labels are Underserved / Balanced / Crowded / Saturated.
        {!calculation.hasPopulationDenominator && ' No valid population denominator or stored raw value is available, so the index is N/A.'}
      </p>
    </section>
  );
}
