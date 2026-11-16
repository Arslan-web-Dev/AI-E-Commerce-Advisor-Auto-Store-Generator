'use client';

import React, { useRef } from 'react';

type TiltCardProps = {
  children: React.ReactNode;
  className?: string;
  /** max tilt in degrees */
  maxTilt?: number;
  /** show moving glare highlight */
  glare?: boolean;
};

/** 3D tilt-on-hover card with optional moving glare. Pointer-driven. */
export default function TiltCard({ children, className = '', maxTilt = 10, glare = true }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;   // 0..1
    const py = (e.clientY - rect.top) / rect.height;   // 0..1
    const rx = (0.5 - py) * maxTilt * 2;
    const ry = (px - 0.5) * maxTilt * 2;

    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    el.style.transition = 'transform 0.08s ease-out';

    const g = glareRef.current;
    if (g) {
      g.style.opacity = '1';
      g.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.14) 0%, transparent 55%)`;
    }
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0)';
    el.style.transition = 'transform 0.6s cubic-bezier(0.22,1,0.36,1)';
    const g = glareRef.current;
    if (g) g.style.opacity = '0';
  };

  return (
    <div style={{ perspective: '900px' }}>
      <div
        ref={ref}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        className={className}
        style={{ transformStyle: 'preserve-3d', position: 'relative' }}
      >
        {glare && (
          <div
            ref={glareRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300"
          />
        )}
        {children}
      </div>
    </div>
  );
}
