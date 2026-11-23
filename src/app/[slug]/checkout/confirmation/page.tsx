'use client';

import { useSearchParams } from 'next/navigation';
import { useParams } from 'next/navigation';

export default function OrderConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const orderNumber = searchParams?.get('order') || 'N/A';

  const primary = 'var(--store-primary, #4edea3)';
  const radius = 'var(--store-radius, 0.5rem)';

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', paddingTop: '3rem' }}>
      <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>✅</div>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: primary, marginBottom: '1rem' }}>Order Placed!</h1>
      <p style={{ fontSize: '1.125rem', opacity: 0.85, marginBottom: '0.5rem' }}>
        Thank you for your order. Your order number is:
      </p>
      <div
        style={{
          display: 'inline-block',
          padding: '0.75rem 2rem',
          border: `2px solid ${primary}`,
          borderRadius: radius,
          fontSize: '1.5rem',
          fontWeight: 800,
          letterSpacing: '0.1em',
          margin: '1rem 0 2rem',
          color: primary,
        }}
      >
        #{orderNumber}
      </div>
      <div
        style={{
          padding: '1.25rem',
          borderRadius: radius,
          backgroundColor: `var(--store-primary, #4edea3)11`,
          border: `1px solid var(--store-primary, #4edea3)33`,
          marginBottom: '2rem',
          textAlign: 'left',
        }}
      >
        <h2 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>What happens next?</h2>
        <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: 0.85 }}>
          <li>The store will confirm your order and prepare it for dispatch.</li>
          <li>You will be contacted on the phone number you provided.</li>
          <li>Your order will be delivered within Punjab, Pakistan.</li>
          <li>Pay <strong>Cash on Delivery</strong> when it arrives.</li>
        </ol>
      </div>
      <a
        href={`/${slug}`}
        style={{
          display: 'inline-block',
          padding: '0.75rem 2rem',
          backgroundColor: primary,
          color: 'var(--store-bg, #0b1326)',
          borderRadius: radius,
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: '1rem',
        }}
      >
        Continue Shopping
      </a>
    </div>
  );
}
