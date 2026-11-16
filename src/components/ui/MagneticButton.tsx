use client';

import React, { useRef } from 'react';

type MagneticProps = {
  children: React.ReactNode;
  className?: string;
  /** attraction strength in px */
  strength?: number;
};

/** Wrapper that magnetically pulls its children toward the cursor. */
export default function MagneticButton({ children, className = '', strength = 0.35 }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'translate(0px, 0px)';
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={className}
      style={{ display: 'inline-block', transition: 'transform 0.25s cubic-bezier(0.22,1,0.36,1)' }}
    >
      {children}
    </div>
  );
}
