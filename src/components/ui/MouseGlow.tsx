use client';

import React, { useEffect, useRef } from 'react';

/** Soft glow that follows the cursor across the whole app. */
export default function MouseGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const el = ref.current;
    if (!el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x, cy = y;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const loop = () => {
      cx += (x - cx) * 0.08;
      cy += (y - cy) * 0.08;
      el.style.transform = `translate(${cx - 260}px, ${cy - 260}px)`;
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[1] w-[520px] h-[520px] rounded-full opacity-25 mix-blend-screen"
      style={{
        background:
          'radial-gradient(circle, rgba(78,222,163,0.35) 0%, rgba(76,215,246,0.12) 40%, transparent 70%)',
      }}
    />
  );
}
