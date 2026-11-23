'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  slug: string;
  price_pkr: number;
  images: string[];
  category: string;
  description?: string;
  stock_quantity: number;
}

export default function CataloguePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState(searchParams?.get('category') || '');
  const [sortBy, setSortBy] = useState('newest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/storefront/${slug}/products`)
      .then((r) => r.json())
      .then((d) => { setProducts(d.products || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  const categories = Array.from(new Set(products.map((p) => p.category || 'General')));

  let filtered = products.filter((p) => {
    const matchCat = !categoryFilter || p.category === categoryFilter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (sortBy === 'price_asc') filtered = [...filtered].sort((a, b) => a.price_pkr - b.price_pkr);
  else if (sortBy === 'price_desc') filtered = [...filtered].sort((a, b) => b.price_pkr - a.price_pkr);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const primary = 'var(--store-primary, #4edea3)';
  const bg = 'var(--store-bg, #0b1326)';
  const radius = 'var(--store-radius, 0.5rem)';

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1.5rem' }}>All Products</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="search"
          placeholder="Search products..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid var(--store-primary, #4edea3)',
            borderRadius: radius,
            backgroundColor: 'transparent',
            color: 'inherit',
            flex: '1',
            minWidth: '200px',
          }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          style={{ padding: '0.5rem 1rem', border: '1px solid var(--store-primary, #4edea3)', borderRadius: radius, backgroundColor: bg, color: 'inherit' }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ padding: '0.5rem 1rem', border: '1px solid var(--store-primary, #4edea3)', borderRadius: radius, backgroundColor: bg, color: 'inherit' }}
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.6 }}>Loading products...</div>
      ) : paginated.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.6 }}>No products found.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {paginated.map((p) => (
            <a key={p.id} href={`/${slug}/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ border: '1px solid var(--store-primary, #4edea3)22', borderRadius: radius, overflow: 'hidden', backgroundColor: '#171f33', height: '100%' }}>
                <div style={{ aspectRatio: '4/3', overflow: 'hidden', backgroundColor: '#0d1829' }}>
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, fontSize: '2.5rem' }}>🛍️</div>
                  )}
                </div>
                <div style={{ padding: '0.875rem' }}>
                  <p style={{ fontSize: '0.7rem', color: primary, marginBottom: '0.25rem', fontWeight: 600 }}>{p.category}</p>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem', lineHeight: 1.3 }}>{p.name}</h3>
                  <p style={{ fontWeight: 800, color: primary }}>PKR {(p.price_pkr || 0).toLocaleString('en-PK')}</p>
                  {p.stock_quantity < 5 && p.stock_quantity > 0 && (
                    <p style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.25rem' }}>Only {p.stock_quantity} left!</p>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '2rem' }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              style={{
                padding: '0.4rem 0.875rem',
                borderRadius: radius,
                border: `1px solid ${primary}`,
                backgroundColor: page === i + 1 ? primary : 'transparent',
                color: page === i + 1 ? bg : 'inherit',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* CSV Export */}
      <div style={{ textAlign: 'right', marginTop: '1rem' }}>
        <button
          onClick={() => {
            const rows = [['Name', 'Category', 'Price (PKR)'].join(',')].concat(
              filtered.map((p) => [p.name, p.category, p.price_pkr].join(','))
            );
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
            a.download = 'products.csv';
            a.click();
          }}
          style={{ padding: '0.4rem 1rem', border: `1px solid ${primary}`, borderRadius: radius, backgroundColor: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '0.8rem' }}
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
