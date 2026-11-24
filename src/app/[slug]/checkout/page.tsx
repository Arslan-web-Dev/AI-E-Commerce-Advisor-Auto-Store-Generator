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

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [storeId, setStoreId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [primary, setPrimary] = useState('#4edea3');
  const [bg, setBg] = useState('#0b1326');
  const [radius, setRadius] = useState('0.5rem');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    delivery_address: '',
    city: '',
    notes: '',
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const container = document.querySelector('[data-store-id]') as HTMLElement;
      if (container) {
        const id = container.dataset.storeId!;
        setStoreId(id);
        try {
          const stored = JSON.parse(sessionStorage.getItem(`store_cart_${id}`) || '[]');
          setCart(stored);
          if (stored.length === 0) router.replace(`/${slug}/cart`);
        } catch {}
      }
      const root = getComputedStyle(document.documentElement);
      setPrimary(root.getPropertyValue('--store-primary').trim() || '#4edea3');
      setBg(root.getPropertyValue('--store-bg').trim() || '#0b1326');
      setRadius(root.getPropertyValue('--store-radius').trim() || '0.5rem');
    }, 0);
    return () => clearTimeout(timer);
  }, [slug, router]);

  const subtotal = cart.reduce((s, i) => s + i.price_pkr * i.qty, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId || cart.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/storefront/${slug}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          ...form,
          items: cart.map((i) => ({ product_id: i.id, qty: i.qty })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Order failed. Please try again.');
        return;
      }

      // Clear cart
      sessionStorage.removeItem(`store_cart_${storeId}`);
      router.push(`/${slug}/checkout/confirmation?order=${data.order_number}`);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    border: `1px solid ${primary}44`,
    borderRadius: radius,
    backgroundColor: '#0d1829',
    color: 'inherit',
    fontSize: '1rem',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = { display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.4rem', opacity: 0.85 };

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '1.5rem' }}>Checkout</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* Form */}
        <form onSubmit={handleSubmit}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.25rem' }}>Delivery Details</h2>

          {error && (
            <div style={{ padding: '0.875rem 1rem', borderRadius: radius, backgroundColor: '#ff444422', border: '1px solid #ff4444', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input required style={inputStyle} value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} placeholder="Your full name" />
            </div>
            <div>
              <label style={labelStyle}>Phone Number *</label>
              <input required type="tel" style={inputStyle} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="03XX-XXXXXXX" pattern="[0-9+\-\s]{10,15}" />
            </div>
            <div>
              <label style={labelStyle}>Delivery Address *</label>
              <textarea required rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={form.delivery_address} onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))} placeholder="House #, Street, Area" />
            </div>
            <div>
              <label style={labelStyle}>City *</label>
              <select required style={inputStyle} value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}>
                <option value="">Select city</option>
                {['Lahore', 'Faisalabad', 'Rawalpindi', 'Gujranwala', 'Multan', 'Sialkot', 'Bahawalpur', 'Sargodha', 'Sheikhupura', 'Jhang', 'Other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Order Notes (optional)</label>
              <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any special instructions..." />
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1rem', borderRadius: radius, backgroundColor: `${primary}0d`, border: `1px solid ${primary}22`, fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            💰 <strong>Payment: Cash on Delivery</strong><br />
            <span style={{ opacity: 0.7 }}>Pay when your order is delivered to your door.</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '0.875rem',
              backgroundColor: submitting ? '#888' : primary,
              color: bg,
              border: 'none',
              borderRadius: radius,
              fontSize: '1rem',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Placing Order...' : `Place Order — PKR ${subtotal.toLocaleString('en-PK')}`}
          </button>
        </form>

        {/* Order Summary */}
        <div style={{ padding: '1.5rem', border: `1px solid ${primary}22`, borderRadius: radius, backgroundColor: '#171f33' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>Order Summary</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {cart.map((i) => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span>{i.name} × {i.qty}</span>
                <span style={{ fontWeight: 600 }}>PKR {(i.price_pkr * i.qty).toLocaleString('en-PK')}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${primary}33`, paddingTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: '1.125rem' }}>Total</strong>
            <strong style={{ fontSize: '1.125rem', color: primary }}>PKR {subtotal.toLocaleString('en-PK')}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
