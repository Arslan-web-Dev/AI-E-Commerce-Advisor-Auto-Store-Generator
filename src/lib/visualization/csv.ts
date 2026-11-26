import { finiteNumber } from './map-validation';
import type { CompetitorRow } from './competitor-table';

const DANGEROUS_FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r']);
const CSV_BOM = '\uFEFF';

/** Quote and neutralize spreadsheet formula injection in untrusted cells. */
export function escapeCsvCell(value: unknown, missingValue = 'N/A'): string {
  let text = value == null || value === '' ? missingValue : String(value);
  // Remove control characters that could hide a formula prefix after import.
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  if (text.length > 0 && DANGEROUS_FORMULA_PREFIXES.has(text[0])) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCompetitorCsv(rows: CompetitorRow[]): string {
  const headers = ['Name', 'Category', 'Distance (km)', 'Rating', 'Reviews', 'Address'];
  const data = rows.map((row) => [
    escapeCsvCell(row.name),
    escapeCsvCell(row.category ?? 'N/A'),
    escapeCsvCell(finiteNumber(row.distance_km)?.toFixed(2) ?? 'N/A'),
    escapeCsvCell(finiteNumber(row.rating) ?? 'N/A'),
    escapeCsvCell(finiteNumber(row.review_count) ?? 'N/A'),
    escapeCsvCell(row.address ?? 'N/A'),
  ]);
  const body = [headers.map((header) => escapeCsvCell(header)), ...data]
    .map((cells) => cells.join(','))
    .join('\r\n')
    .concat('\r\n');
  return CSV_BOM + body;
}

export function safeCsvFilename(projectName: string | null | undefined): string {
  const base = (projectName ?? 'project')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
    .toLowerCase();
  return `${base || 'project'}_competitors.csv`;
}
