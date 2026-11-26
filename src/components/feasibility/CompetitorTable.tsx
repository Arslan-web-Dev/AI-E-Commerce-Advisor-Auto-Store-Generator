'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  filterCompetitors,
  paginateRows,
  sortCompetitors,
  type CompetitorRow,
  type CompetitorSortBy,
  type RatingFilter,
  type SortOrder,
} from '@/lib/visualization/competitor-table';
import { buildCompetitorCsv, safeCsvFilename } from '@/lib/visualization/csv';

export type CompetitorItem = CompetitorRow;

interface Props {
  competitors: CompetitorItem[];
  projectName?: string;
  totalCount?: number;
}

const PAGE_SIZE = 10;
const INPUT_STYLE: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  backgroundColor: '#0b1326',
  border: '1px solid #2d3449',
  borderRadius: '0.375rem',
  color: '#dae2fd',
  fontSize: '0.78rem',
  minWidth: 0,
};
const BUTTON_STYLE: React.CSSProperties = {
  backgroundColor: '#171f33',
  border: '1px solid #2d3449',
  color: '#dae2fd',
  padding: '0.35rem 0.65rem',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  fontSize: '0.75rem',
};

function sortLabel(sortBy: CompetitorSortBy, active: boolean, order: SortOrder): string {
  const text = sortBy === 'name' ? 'Business name' : sortBy === 'distance' ? 'Distance' : 'Rating';
  return `${text}${active ? `, ${order === 'asc' ? 'ascending' : 'descending'}` : ''}`;
}

export default function CompetitorTable({ competitors, projectName = 'Project', totalCount }: Props) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [minDistance, setMinDistance] = useState<number | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all');
  const [minRating, setMinRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<CompetitorSortBy>('distance');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  // Page state is keyed to the active filter/sort signature. A changed filter
  // derives page 1 directly instead of resetting state from an effect.
  const filterKey = JSON.stringify([
    search,
    category,
    minDistance,
    maxDistance,
    ratingFilter,
    minRating,
    sortBy,
    sortOrder,
  ]);
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  function setCurrentPage(nextPage: number) {
    setPageState({ key: filterKey, page: nextPage });
  }

  const categories = useMemo(
    () => Array.from(new Set(competitors.map((row) => row.category).filter(Boolean))).sort(),
    [competitors]
  ) as string[];

  const filteredSorted = useMemo(
    () =>
      sortCompetitors(
        filterCompetitors(competitors, { search, category, minDistance, maxDistance, ratingFilter, minRating }),
        sortBy,
        sortOrder
      ),
    [competitors, search, category, minDistance, maxDistance, ratingFilter, minRating, sortBy, sortOrder]
  );
  const pagination = useMemo(() => paginateRows(filteredSorted, page, PAGE_SIZE), [filteredSorted, page]);

  function changeSort(next: CompetitorSortBy) {
    if (next === sortBy) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(next);
      setSortOrder('asc');
    }
  }

  function exportCsv() {
    const csv = buildCompetitorCsv(filteredSorted);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeCsvFilename(projectName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const storedTotal = totalCount ?? competitors.length;
  const onFirstPage = pagination.page <= 1;
  const onLastPage = pagination.page >= pagination.totalPages;

  return (
    <section
      aria-label="Competitor details"
      style={{ backgroundColor: '#171f33', border: '1px solid #2d3449', borderRadius: '0.75rem', padding: '1.25rem' }}
    >
      <style>{`
        .competitor-filters { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-end; }
        .competitor-filter-field { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
        .competitor-filter-field label { font-size: 0.68rem; opacity: 0.7; }
        .competitor-table-wrap { overflow-x: auto; }
        .competitor-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
        @media (max-width: 640px) {
          .competitor-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .competitor-table { min-width: 620px; }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#dae2fd', margin: 0 }}>Identified Competitors</h3>
          <p style={{ fontSize: '0.75rem', color: '#dae2fd', opacity: 0.65, margin: '0.25rem 0 0' }}>
            {storedTotal} stored in scope · {pagination.total} match the current filters
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filteredSorted.length === 0}
          style={{ ...BUTTON_STYLE, backgroundColor: filteredSorted.length ? '#4edea3' : '#2d3449', color: filteredSorted.length ? '#0b1326' : '#94a3b8', fontWeight: 600, border: 'none' }}
        >
          Export CSV ({filteredSorted.length})
        </button>
      </div>

      <div className="competitor-filters" style={{ marginBottom: '1rem' }}>
        <div className="competitor-filter-field" style={{ flex: '2 1 180px' }}>
          <label htmlFor={`${id}-search`}>Search</label>
          <input
            id={`${id}-search`}
            type="search"
            placeholder="Name, category or address"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={INPUT_STYLE}
          />
        </div>
        <div className="competitor-filter-field" style={{ flex: '1 1 150px' }}>
          <label htmlFor={`${id}-category`}>Category</label>
          <select id={`${id}-category`} value={category} onChange={(event) => setCategory(event.target.value)} style={INPUT_STYLE}>
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="competitor-filter-field" style={{ flex: '1 1 100px' }}>
          <label htmlFor={`${id}-min-distance`}>Min distance (km)</label>
          <input
            id={`${id}-min-distance`}
            type="number"
            min={0}
            step={0.1}
            value={minDistance ?? ''}
            onChange={(event) => setMinDistance(event.target.value === '' ? null : Number(event.target.value))}
            style={INPUT_STYLE}
          />
        </div>
        <div className="competitor-filter-field" style={{ flex: '1 1 100px' }}>
          <label htmlFor={`${id}-max-distance`}>Max distance (km)</label>
          <input
            id={`${id}-max-distance`}
            type="number"
            min={0}
            step={0.1}
            value={maxDistance ?? ''}
            onChange={(event) => setMaxDistance(event.target.value === '' ? null : Number(event.target.value))}
            style={INPUT_STYLE}
          />
        </div>
        <div className="competitor-filter-field" style={{ flex: '1 1 120px' }}>
          <label htmlFor={`${id}-rating-filter`}>Rating</label>
          <select
            id={`${id}-rating-filter`}
            value={ratingFilter}
            onChange={(event) => setRatingFilter(event.target.value as RatingFilter)}
            style={INPUT_STYLE}
          >
            <option value="all">All</option>
            <option value="rated">Rated</option>
            <option value="unrated">Unrated</option>
            <option value="minimum">Minimum</option>
          </select>
        </div>
        {ratingFilter === 'minimum' && (
          <div className="competitor-filter-field" style={{ flex: '1 1 90px' }}>
            <label htmlFor={`${id}-min-rating`}>Min rating</label>
            <input
              id={`${id}-min-rating`}
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={minRating ?? ''}
              onChange={(event) => setMinRating(event.target.value === '' ? null : Number(event.target.value))}
              style={INPUT_STYLE}
            />
          </div>
        )}
      </div>

      <div className="competitor-table-wrap">
        <table className="competitor-table" style={{ color: '#dae2fd', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2d3449', color: '#4cd7f6' }}>
              <th scope="col" aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ padding: '0.6rem' }}>
                <button type="button" onClick={() => changeSort('name')} aria-label={sortLabel('name', sortBy === 'name', sortOrder)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit', padding: 0 }}>
                  Business Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th scope="col" style={{ padding: '0.6rem' }}>Category</th>
              <th scope="col" aria-sort={sortBy === 'distance' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ padding: '0.6rem' }}>
                <button type="button" onClick={() => changeSort('distance')} aria-label={sortLabel('distance', sortBy === 'distance', sortOrder)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit', padding: 0 }}>
                  Distance {sortBy === 'distance' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th scope="col" aria-sort={sortBy === 'rating' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ padding: '0.6rem' }}>
                <button type="button" onClick={() => changeSort('rating')} aria-label={sortLabel('rating', sortBy === 'rating', sortOrder)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', font: 'inherit', padding: 0 }}>
                  Rating {sortBy === 'rating' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              <th scope="col" style={{ padding: '0.6rem' }}>Address</th>
            </tr>
          </thead>
          <tbody>
            {pagination.items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.6 }}>
                  No competitor data matches the current filters.
                </td>
              </tr>
            ) : (
              pagination.items.map((row, index) => (
                <tr key={row.id || `${row.name}-${index}`} style={{ borderBottom: '1px solid #1f283d' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 600 }}>{row.name}</td>
                  <td style={{ padding: '0.6rem', opacity: 0.8 }}>{row.category || 'Retail'}</td>
                  <td style={{ padding: '0.6rem', color: '#4cd7f6' }}>
                    {row.distance_km == null || !Number.isFinite(Number(row.distance_km)) ? '—' : `${Number(row.distance_km).toFixed(1)} km`}
                  </td>
                  <td style={{ padding: '0.6rem' }}>
                    {row.rating == null || !Number.isFinite(Number(row.rating)) ? '—' : <span style={{ color: '#f59e0b', fontWeight: 600 }}>★ {Number(row.rating).toFixed(1)}</span>}
                  </td>
                  <td style={{ padding: '0.6rem', opacity: 0.6, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.address || 'Address unavailable'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.85rem', fontSize: '0.72rem', opacity: 0.8 }}>
        <span>
          Showing {pagination.start}–{pagination.end} of {pagination.total} filtered ({storedTotal} stored)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button type="button" onClick={() => setCurrentPage(Math.max(1, page - 1))} disabled={onFirstPage} style={BUTTON_STYLE} aria-label="Previous competitor page">Previous</button>
          <span>Page {pagination.page} / {pagination.totalPages}</span>
          <button type="button" onClick={() => setCurrentPage(Math.min(pagination.totalPages, page + 1))} disabled={onLastPage} style={BUTTON_STYLE} aria-label="Next competitor page">Next</button>
        </span>
      </div>
    </section>
  );
}
