import { finiteNumber } from './map-validation';

export interface TrendPointInput {
  month: string;
  index: number;
}

export type TrendDirection = 'growing' | 'stable' | 'declining';

export interface TrendAnalysis {
  validPoints: TrendPointInput[];
  invalidCount: number;
  duplicateMonths: string[];
  missingMonths: string[];
  chronological: boolean;
  completeTwelveMonths: boolean;
  firstMonth: string | null;
  lastMonth: string | null;
  average: number | null;
  peak: number | null;
  minimum: number | null;
  direction: TrendDirection | null;
  directionSource: 'stored' | 'calculated' | 'unavailable';
  axis: { min: number; max: number };
}

export interface TrendAnalysisOptions {
  sourceSlope?: 'growing' | 'stable' | 'declining' | null;
  sourceIsUsable?: boolean;
}

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function monthOrdinal(month: string): number | null {
  const match = MONTH_PATTERN.exec(month);
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

function ordinalToMonth(ordinal: number): string {
  const year = Math.floor(ordinal / 12);
  const month = (ordinal % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getTrendAxis(values: number[]): { min: number; max: number } {
  const valid = values.map((value) => finiteNumber(value)).filter((value): value is number => value !== null);
  if (valid.length === 0) return { min: 0, max: 100 };
  const rawMin = Math.min(...valid);
  const rawMax = Math.max(...valid);
  if (rawMin === rawMax) {
    return {
      min: Math.max(0, Math.floor(rawMin - 5)),
      max: Math.min(100, Math.ceil(rawMax + 5)),
    };
  }
  return {
    min: Math.max(0, Math.floor((rawMin - 5) / 5) * 5),
    max: Math.min(100, Math.ceil((rawMax + 5) / 5) * 5),
  };
}

function calculatedDirection(points: TrendPointInput[]): TrendDirection | null {
  if (points.length < 2) return null;
  const values = points.map((point) => point.index);
  const peak = Math.max(...values);
  const low = Math.min(...values);
  if (peak - low < 0.5) return 'stable';

  const meanX = (points.length - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / values.length;
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  const slope = denominator === 0 ? 0 : numerator / denominator;
  if (slope > 0.5) return 'growing';
  if (slope < -0.5) return 'declining';
  return 'stable';
}

/** Validates months and indices without inventing missing observations. */
export function analyzeTrendSeries(
  series: TrendPointInput[] | null | undefined,
  options: TrendAnalysisOptions = {}
): TrendAnalysis {
  const points = Array.isArray(series) ? series : [];
  const seen = new Set<string>();
  const duplicateMonths: string[] = [];
  const valid: TrendPointInput[] = [];
  let invalidCount = 0;
  let chronological = true;
  let previousOrdinal: number | null = null;

  for (const point of points) {
    const ordinal = typeof point?.month === 'string' ? monthOrdinal(point.month) : null;
    const index = finiteNumber(point?.index);
    if (ordinal === null || index === null || index < 0 || index > 100) {
      invalidCount += 1;
      continue;
    }
    if (seen.has(point.month)) {
      duplicateMonths.push(point.month);
      invalidCount += 1;
      continue;
    }
    seen.add(point.month);
    if (previousOrdinal !== null && ordinal < previousOrdinal) chronological = false;
    previousOrdinal = ordinal;
    valid.push({ month: point.month, index });
  }

  const ordered = [...valid].sort((a, b) => (monthOrdinal(a.month) ?? 0) - (monthOrdinal(b.month) ?? 0));
  const missingMonths: string[] = [];
  if (ordered.length > 1) {
    const first = monthOrdinal(ordered[0].month)!;
    const last = monthOrdinal(ordered[ordered.length - 1].month)!;
    for (let ordinal = first + 1; ordinal < last; ordinal += 1) {
      const month = ordinalToMonth(ordinal);
      if (!seen.has(month)) missingMonths.push(month);
    }
  }

  const values = ordered.map((point) => point.index);
  const storedSlope = options.sourceIsUsable ? options.sourceSlope : null;
  const calculated = calculatedDirection(ordered);
  const direction = storedSlope ?? calculated;
  const completeTwelveMonths =
    ordered.length === 12 && missingMonths.length === 0 && invalidCount === 0 && chronological;

  return {
    validPoints: ordered,
    invalidCount,
    duplicateMonths,
    missingMonths,
    chronological,
    completeTwelveMonths,
    firstMonth: ordered[0]?.month ?? null,
    lastMonth: ordered[ordered.length - 1]?.month ?? null,
    average: values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null,
    peak: values.length ? Math.max(...values) : null,
    minimum: values.length ? Math.min(...values) : null,
    direction,
    directionSource: storedSlope ? 'stored' : calculated ? 'calculated' : 'unavailable',
    axis: getTrendAxis(values),
  };
}

export function buildTrendSummary(analysis: TrendAnalysis): string {
  if (analysis.validPoints.length === 0) return 'No valid trend observations are available.';
  const period = `${analysis.firstMonth} to ${analysis.lastMonth}`;
  const completeness = analysis.completeTwelveMonths
    ? 'Twelve complete monthly observations.'
    : `Incomplete series: ${analysis.validPoints.length} valid observation(s); expected 12.`;
  const direction = analysis.direction ? `Direction: ${analysis.direction}.` : 'Direction unavailable.';
  return `${period}. ${completeness} ${direction}`;
}
