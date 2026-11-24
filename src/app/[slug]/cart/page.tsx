'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface CartItem {
  id: string;
  name: string;
  price_pkr: number;
  images: string[];
  qty: number;
}

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [storeId, setStoreId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [primary, setPrimary] = useState('#4edea3');
  const [bg, setBg] = useState('#0b1326');
  const [radius, setRadius] = useState('0.5rem');

  useEffect(() => {
    const timer = setTimeout(() => {
      // Get storeId from DOM dataset
      const container = document.querySelector('[data-store-id]') as HTMLElement;
      if (container) {
        const id = container.dataset.storeId!;
        setStoreId(id);
        try {
          const stored = JSON.parse(sessionStorage.getItem(`store_cart_${id}`) || '[]');
          setCart(stored);
        } catch {}
      }
      // Read CSS vars
      const root = getComputedStyle(document.documentElement);
      setPrimary(root.getPropertyValue('--store-primary').trim() || '#4edea3');
      setBg(root.getPropertyValue('--store-bg').trim() || '#0b1326');
      setRadius(root.getPropertyValue('--store-radius').trim() || '0.5rem');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const save = (newCart: CartItem[]) => {
    if (!storeId) return;
    setCart(newCart);
    sessionStorage.setItem(`store_cart_${storeId}`, JSON.stringify(newCart));
    // Update badge
    const badge = document.getElementById('cart-count-badge');
    if (badge) {
      const total = newCart.reduce((s, i) => s + i.qty, 0);
      if (total > 0) { badge.textContent = `(${total})`; badge.style.display = 'inline'; }
      else badge.style.display = 'none';
    }
  };

  const updateQty = (id: string, qty: number) => {
    if (qty < 1) return removeItem(id);
    save(cart.map((i) => (i.id === id ? { ...i, qty } : i)));
  };

  const removeItem = (id: string) => save(cart.filter((i) => i.id !== id));

  const subtotal = cart.reduce((s, i) => s + i.price_pkr * i.qty, 0);

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1.5rem' }}>Shopping Cart</h1>

      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
          <p style={{ opacity: 0.6, marginBottom: '1.5rem' }}>Your cart is empty.</p>
          <a href={`/${slug}/catalogue`} style={{ color: primary, textDecoration: 'underline', fontWeight: 600 }}>
            Continue Shopping
          </a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {cart.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  padding: '1rem',
                  border: `1px solid ${primary}22`,
                  borderRadius: radius,
                  backgroundColor: '#171f33',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ width: '72px', height: '72px', borderRadius: '0.375rem', overflow: 'hidden', backgroundColor: '#0d1829', flexShrink: 0 }}>
                  {item.images?.[0] ? (
                    <img src={item.images[0]} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>🛍️</div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>{item.name}</p>
                  <p style={{ color: primary, fontWeight: 800 }}>PKR {(item.price_pkr || 0).toLocaleString('en-PK')}</p>
                </div>
                <div style={{ display: 'flex', border: `1px solid ${primary}`, borderRadius: radius, overflow: 'hidden' }}>
                  <button onClick={() => updateQty(item.id, item.qty - 1)} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: primary, fontWeight: 700 }}>−</button>
                  <span style={{ padding: '0.3rem 0.75rem', lineHeight: 1.8, fontWeight: 700 }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty + 1)} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: primary, fontWeight: 700 }}>+</button>
                </div>
                <p style={{ fontWeight: 700, minWidth: '120px', textAlign: 'right' }}>
                  PKR {(item.price_pkr * item.qty).toLocaleString('en-PK')}
                </p>
                <button onClick={() => removeItem(item.id)} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'transparent', border: `1px solid #ff444488`, borderRadius: '0.25rem', cursor: 'pointer', color: '#ff4444', fontSize: '0.75rem' }}>Remove</button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div style={{ padding: '1.5rem', border: `1px solid ${primary}22`, borderRadius: radius, backgroundColor: '#171f33', maxWidth: '400px', marginLeft: 'auto', width: '100%' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Order Summary</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Subtotal ({cart.reduce((s, i) => s + i.qty, 0)} items)</span>
              <span style={{ fontWeight: 700 }}>PKR {subtotal.toLocaleString('en-PK')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', opacity: 0.7, fontSize: '0.875rem' }}>
              <span>Delivery</span>
              <span>COD (pay on arrival)</span>
            </div>
            <div style={{ borderTop: `1px solid ${primary}33`, paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.125rem' }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: '1.125rem', color: primary }}>PKR {subtotal.toLocaleString('en-PK')}</span>
            </div>
            <button
              onClick={() => router.push(`/${slug}/checkout`)}
              style={{ width: '100%', padding: '0.875rem', backgroundColor: primary, color: bg, border: 'none', borderRadius: radius, fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Proceed to Checkout →
            </button>
            <a href={`/${slug}/catalogue`} style={{ display: 'block', textAlign: 'center', marginTop: '0.75rem', color: primary, fontSize: '0.875rem' }}>
              Continue Shopping
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
