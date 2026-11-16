use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Plays a cinematic sweep + glow pulse on every route change.
 * Purely decorative: pointer-events-none, respects reduced motion.
 */
export default function PageTransition() {
  const pathname = usePathname();
  const [sweeping, setSweeping] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setSweeping(true);
    const t = setTimeout(() => setSweeping(false), 650);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[70] transition-all ease-out"
        style={{
          opacity: sweeping ? 1 : 0,
          transform: sweeping ? 'translateY(0)' : 'translateY(-100%)',
          transitionDuration: '650ms',
          background:
            'linear-gradient(180deg, rgba(78,222,163,0.10) 0%, rgba(11,19,38,0.55) 45%, transparent 100%)',
          boxShadow: '0 2px 30px rgba(78,222,163,0.25)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 z-[70] h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#4edea3] to-transparent transition-all duration-500"
        style={{ width: sweeping ? '60%' : '0%', opacity: sweeping ? 1 : 0 }}
      />
    </>
  );
}
