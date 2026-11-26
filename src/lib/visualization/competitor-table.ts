import { finiteNumber } from './map-validation';

export interface CompetitorRow {
  id?: string;
  name: string;
  category?: string;
  distance_km?: number;
  rating?: number;
  review_count?: number;
  address?: string;
}

export type CompetitorSortBy = 'name' | 'distance' | 'rating';
export type SortOrder = 'asc' | 'desc';
export type RatingFilter = 'all' | 'rated' | 'unrated' | 'minimum';

export interface CompetitorFilters {
  search?: string;
  category?: string;
  minDistance?: number | null;
  maxDistance?: number | null;
  ratingFilter?: RatingFilter;
  minRating?: number | null;
}

function validDistance(value: number | null | undefined): number | null {
  const distance = finiteNumber(value);
  return distance !== null && distance >= 0 ? distance : null;
}

function validRating(value: number | null | undefined): number | null {
  const rating = finiteNumber(value);
  return rating !== null && rating >= 0 && rating <= 5 ? rating : null;
}

export function filterCompetitors(rows: CompetitorRow[], filters: CompetitorFilters): CompetitorRow[] {
  const search = (filters.search ?? '').trim().toLowerCase();
  const category = (filters.category ?? 'all').trim().toLowerCase();
  const minDistance = validDistance(filters.minDistance ?? null);
  const maxDistance = validDistance(filters.maxDistance ?? null);
  const minRating = validRating(filters.minRating ?? null);
  const ratingFilter = filters.ratingFilter ?? 'all';

  return rows.filter((row) => {
    if (search) {
      const haystack = [row.name, row.category, row.address].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (category !== 'all' && (row.category ?? '').trim().toLowerCase() !== category) return false;

    const distance = validDistance(row.distance_km);
    if (minDistance !== null && (distance === null || distance < minDistance)) return false;
    if (maxDistance !== null && (distance === null || distance > maxDistance)) return false;

    const rating = validRating(row.rating);
    if (ratingFilter === 'rated' && rating === null) return false;
    if (ratingFilter === 'unrated' && rating !== null) return false;
    if (ratingFilter === 'minimum' && (rating === null || minRating === null || rating < minRating)) return false;
    return true;
  });
}

export function sortCompetitors(
  rows: CompetitorRow[],
  sortBy: CompetitorSortBy,
  sortOrder: SortOrder
): CompetitorRow[] {
  const factor = sortOrder === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortBy === 'name') {
      const nameDiff = String(a.name ?? '').localeCompare(String(b.name ?? ''));
      return nameDiff === 0 ? String(a.id ?? '').localeCompare(String(b.id ?? '')) : nameDiff * factor;
    }

    const aValue = sortBy === 'distance' ? validDistance(a.distance_km) : validRating(a.rating);
    const bValue = sortBy === 'distance' ? validDistance(b.distance_km) : validRating(b.rating);
    // Unavailable values are always last, in either direction.
    if (aValue === null && bValue === null) return String(a.name).localeCompare(String(b.name));
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    const diff = aValue - bValue;
    return diff === 0 ? String(a.name).localeCompare(String(b.name)) : diff * factor;
  });
}

export interface PaginationResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  start: number;
  end: number;
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number): PaginationResult<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const current = Math.max(1, Math.min(Math.floor(page) || 1, totalPages));
  const startIndex = (current - 1) * size;
  const items = rows.slice(startIndex, startIndex + size);
  return {
    items,
    page: current,
    pageSize: size,
    total,
    totalPages,
    start: total === 0 ? 0 : startIndex + 1,
    end: startIndex + items.length,
  };
}
