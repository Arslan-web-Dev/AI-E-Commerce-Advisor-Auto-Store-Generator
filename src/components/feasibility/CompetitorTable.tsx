'use client';

import React, { useState } from 'react';

export interface CompetitorItem {
  id?: string;
  name: string;
  category?: string;
  distance_km?: number;
  rating?: number;
  review_count?: number;
  address?: string;
}

interface Props {
  competitors: CompetitorItem[];
  projectName?: string;
}

export default function CompetitorTable({ competitors, projectName = 'Project' }: Props) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'name'>('distance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = competitors.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.category && c.category.toLowerCase().includes(search.toLowerCase())) ||
    (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
  );

  const sorted = [...filtered].sort((a, b) => {
    let diff = 0;
    if (sortBy === 'distance') {
      diff = (a.distance_km ?? 999) - (b.distance_km ?? 999);
    } else if (sortBy === 'rating') {
      diff = (a.rating ?? 0) - (b.rating ?? 0);
    } else {
      diff = a.name.localeCompare(b.name);
    }
    return sortOrder === 'asc' ? diff : -diff;
  });

  const exportCSV = () => {
    const headers = ['Name', 'Category', 'Distance (km)', 'Rating', 'Reviews', 'Address'];
    const rows = sorted.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.category || 'N/A').replace(/"/g, '""')}"`,
      c.distance_km != null ? c.distance_km.toFixed(2) : 'N/A',
      c.rating != null ? c.rating.toString() : 'N/A',
      c.review_count != null ? c.review_count.toString() : '0',
      `"${(c.address || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${projectName.toLowerCase().replace(/\s+/g, '_')}_competitors.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ backgroundColor: '#171f33', border: '1px solid #2d3449', borderRadius: '0.75rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#dae2fd', margin: 0 }}>Identified Competitors</h3>
          <p style={{ fontSize: '0.75rem', color: '#dae2fd', opacity: 0.6, margin: '0.25rem 0 0' }}>
            {competitors.length} local businesses detected within the target radius
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search competitor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '0.4rem 0.8rem',
              backgroundColor: '#0b1326',
              border: '1px solid #2d3449',
              borderRadius: '0.375rem',
              color: '#dae2fd',
              fontSize: '0.8rem',
            }}
          />
          <button
            onClick={exportCSV}
            style={{
              padding: '0.4rem 0.8rem',
              backgroundColor: '#4edea3',
              color: '#0b1326',
              fontWeight: 600,
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem', color: '#dae2fd' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2d3449', color: '#4cd7f6' }}>
              <th
                onClick={() => { setSortBy('name'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                style={{ padding: '0.6rem', cursor: 'pointer' }}
              >
                Business Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={{ padding: '0.6rem' }}>Category</th>
              <th
                onClick={() => { setSortBy('distance'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                style={{ padding: '0.6rem', cursor: 'pointer' }}
              >
                Distance {sortBy === 'distance' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th
                onClick={() => { setSortBy('rating'); setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); }}
                style={{ padding: '0.6rem', cursor: 'pointer' }}
              >
                Rating {sortBy === 'rating' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={{ padding: '0.6rem' }}>Address</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', opacity: 0.5 }}>
                  No competitor data matches your filter.
                </td>
              </tr>
            ) : (
              sorted.map((c, idx) => (
                <tr key={c.id || idx} style={{ borderBottom: '1px solid #1f283d' }}>
                  <td style={{ padding: '0.6rem', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '0.6rem', opacity: 0.8 }}>{c.category || 'Retail'}</td>
                  <td style={{ padding: '0.6rem', color: '#4cd7f6' }}>
                    {c.distance_km != null ? `${c.distance_km.toFixed(1)} km` : '—'}
                  </td>
                  <td style={{ padding: '0.6rem' }}>
                    {c.rating != null ? (
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>★ {c.rating.toFixed(1)}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ padding: '0.6rem', opacity: 0.6, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.address || 'Punjab, Pakistan'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
