'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProductInfo {
  id: string;
  name: string;
  price_pkr: number;
  images: string[];
}

interface Props {
  product: ProductInfo;
  storeId: string;
  storeSlug: string;
  inStock: boolean;
  primary: string;
  bg: string;
  radius: string;
}

export default function AddToCartButton({ product, storeId, storeSlug, inStock, primary, bg, radius }: Props) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const addToCart = () => {
    try {
      const key = `store_cart_${storeId}`;
      const cart: Array<{ id: string; name: string; price_pkr: number; images: string[]; qty: number }> =
        JSON.parse(sessionStorage.getItem(key) || '[]');
      const existing = cart.find((i) => i.id === product.id);
      if (existing) {
        existing.qty += qty;
      } else {
        cart.push({ ...product, qty });
      }
      sessionStorage.setItem(key, JSON.stringify(cart));
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      // Update badge
      const badge = document.getElementById('cart-count-badge');
      if (badge) {
        const total = cart.reduce((s, i) => s + (i.qty || 0), 0);
        badge.textContent = `(${total})`;
        badge.style.display = 'inline';
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!inStock) {
    return (
      <button disabled style={{ padding: '0.75rem 2rem', borderRadius: radius, backgroundColor: '#333', color: '#888', cursor: 'not-allowed', fontSize: '1rem', fontWeight: 700, border: 'none' }}>
        Out of Stock
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', border: `1px solid ${primary}`, borderRadius: radius, overflow: 'hidden' }}>
        <button onClick={() => setQty((q) => Math.max(1, q - 1))} style={{ padding: '0.5rem 0.875rem', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: primary, fontSize: '1.25rem', fontWeight: 700 }}>−</button>
        <span style={{ padding: '0.5rem 1rem', fontSize: '1rem', fontWeight: 700, lineHeight: 2 }}>{qty}</span>
        <button onClick={() => setQty((q) => q + 1)} style={{ padding: '0.5rem 0.875rem', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: primary, fontSize: '1.25rem', fontWeight: 700 }}>+</button>
      </div>
      <button
        onClick={addToCart}
        style={{
          padding: '0.75rem 2rem',
          borderRadius: radius,
          backgroundColor: added ? '#4edea3' : primary,
          color: bg,
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 700,
          transition: 'background-color 0.2s',
        }}
      >
        {added ? '✓ Added to Cart' : 'Add to Cart'}
      </button>
      <button
        onClick={() => { addToCart(); router.push(`/${storeSlug}/cart`); }}
        style={{
          padding: '0.75rem 2rem',
          borderRadius: radius,
          backgroundColor: 'transparent',
          color: primary,
          border: `1px solid ${primary}`,
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 700,
        }}
      >
        Buy Now
      </button>
    </div>
  );
}
