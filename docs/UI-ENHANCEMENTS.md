# UI Enhancement & 3D Animation Layer

This document describes the visual/3D upgrade applied across the project (Next.js 16 + React 19 + Tailwind 4 + Three.js).

## New components — `src/components/ui/`

| Component | What it does | Where it runs |
|---|---|---|
| `Scene3DBackground` | Full-screen WebGL layer: 1,250+ additive glow particles drifting upward, 4 floating wireframe shapes (icosahedron ×2, torus knot, octahedron), exponential fog, camera parallax that follows the pointer | Every page (mounted in `layout.tsx`) |
| `MouseGlow` | 520px radial glow that trails the cursor with eased lerp | Every page |
| `PageTransition` | Cinematic top sweep + center glow bar on every client-side route change | Every navigation |
| `Reveal` | IntersectionObserver-driven fade + rise + scale entrance; supports `delay`, `y`, `once` | All sections on the landing page; wraps every app page's root |
| `TiltCard` | Pointer-driven 3D tilt (`rotateX/rotateY`) with perspective + moving glare highlight | Landing "Core Capabilities" cards |
| `MagneticButton` | Wrapper that magnetically translates children toward the cursor | Landing hero + header CTAs |
| `AnimatedCounter` | Counts up when scrolled into view (eased, configurable decimals/suffix) | Available for stat numbers |

## Hero upgrade — `src/components/Hero3DVisual.tsx`

- **Drag-to-rotate**: press & drag anywhere on the hologram to rotate it freely (clamped pitch).
- **Inertia**: after release, rotation decays smoothly (`vel *= 0.94` per frame).
- Existing mouse-follow parallax retained (slowed base spin so dragging feels responsive).

## Global CSS additions — `src/app/globals.css`

- `.ui-aurora` — animated 3-color radial aurora base layer (26s drift loop)
- `.ui-grid-overlay` — slowly panning perspective grid, radial-masked
- `.glass` / `.glass-strong` — backdrop-blur glass-morphism surfaces
- Keyframes/utilities: `animate-float`, `animate-float-slow`, `animate-pulse-glow`, `ui-shimmer`, `animate-spin-slow`, `animate-orbit`, `ui-gradient-text` (animated gradient headline text)
- `.ui-card-3d` — hover lift + emerald ring + soft glow shadow
- `.ui-glow-divider` — gradient hairline with glow
- Enhanced gradient scrollbar & `:focus-visible` rings

## Accessibility & performance

- **Reduced motion honored everywhere**: every new component checks `prefers-reduced-motion` and renders static fallbacks (e.g. Scene3DBackground collapses to the CSS aurora; Hero3DVisual shows the static radar panel).
- **WebGL fallback**: `Scene3DBackground` and `Hero3DVisual` detect context creation failure and degrade to pure-CSS visuals.
- Background renderer caps `devicePixelRatio` at 1.5 and uses additive low-opacity materials to stay cheap; the fixed canvas is `pointer-events-none` so it never blocks input.
- All Three.js geometries/materials are disposed on unmount.

## Pages integrated

- `/` — sections wrapped in staggered `Reveal`; capability cards are `TiltCard`s with glare; hero & header CTAs are `MagneticButton`s; hero hologram is draggable with inertia.
- `/login`, `/reset-password`, `/update-password` — root wrapped in `Reveal`; auth cards upgraded to `glass-strong ui-card-3d`.
- `/projects`, `/projects/[id]`, `/admin`, `/account/security` — root wrapped in `Reveal`.
- `/wizard`, `/wizard/[id]` — wizard wrapped in `Reveal`.

## How to reuse elsewhere

```tsx
import Reveal from '@/components/ui/Reveal';
import TiltCard from '@/components/ui/TiltCard';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

<Reveal delay={120}>
  <TiltCard className="glass ui-card-3d rounded-2xl p-6">
    <AnimatedCounter value={94} suffix="%" className="font-display text-3xl font-bold text-[#4edea3]" />
  </TiltCard>
</Reveal>
```
