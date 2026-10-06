---
name: Executive Feasibility Advisory
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006947'
  on-tertiary: '#ffffff'
  tertiary-container: '#00855b'
  on-tertiary-container: '#f5fff6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  canvas-bg: '#f8fafc'
  surface-muted: '#f1f5f9'
  surface-card: '#ffffff'
  border-subtle: '#e2e8f0'
  border-strong: '#cbd5e1'
  text-primary: '#0f172a'
  text-secondary: '#475569'
  text-muted: '#94a3b8'
  status-positive: '#059669'
  status-positive-bg: '#ecfdf5'
  status-positive-border: '#a7f3d0'
  status-warning: '#d97706'
  status-warning-bg: '#fffbeb'
  status-critical: '#e11d48'
  status-critical-bg: '#fff1f2'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  metric-val:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.025em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system targets enterprise executives, investment analysts, venture partners, and strategic corporate planners. The emotional tone is decisive, authoritative, and crystal clear. It eliminates cognitive fatigue by prioritizing data density with immaculate visual cleanliness.

Drawing from modern **Corporate / Modern Minimalist** aesthetics with surgical high-clarity SaaS execution:
- **Surface Hierarchy**: Grounded on crisp, pure white cards set against light, cool slate foundations (`#f8fafc` and `#f1f5f9`).
- **Precision Typography**: Dominated by high-contrast Deep Slate (`#0f172a`), creating an authoritative ink-on-paper feeling with modern digital ergonomics.
- **Accents**: High-chroma Emerald Green accents (`#10b981` and `#059669`) serve as functional catalysts for positive viability scores, validated feasibility metrics, and affirmative executive actions.

## Colors

The color system enforces strict WCAG AA contrast ratios across all components, designed for long review sessions and data parsing under standard office or mobile daylight conditions.

### Architectural Canvas & Cards
- **Root Viewport Background**: `#f8fafc` (Canvas Base) creates an airy, low-strain baseline.
- **Container / Secondary Surface**: `#f1f5f9` (Surface Muted) defines structural divisions, table headers, and navigation rails.
- **Primary Interactive Cards**: Pure `#ffffff` framed by crisp, microscopic borders (`#e2e8f0`).
- **Dividers & Structural Borders**: Single-pixel `#e2e8f0` for passive layout separations; `#cbd5e1` for interactive field boundaries.

### Chromatic Accents
- **Primary Emerald (`#059669`)**: Core interactive anchor. Provides a 4.5:1+ contrast ratio against white surfaces for text and interactive primary buttons.
- **Vibrant Accent Emerald (`#10b981`)**: Highlights, metric graphs, telemetry badges, and positive micro-indicators.
- **Deep Slate (`#0f172a`)**: Primary typographic color and secondary structural chrome, maintaining high reading legibility.

### Status Indicators
- **High Feasibility**: `#059669` ink on `#ecfdf5` background with `#a7f3d0` border.
- **Moderate / Caution**: `#d97706` ink on `#fffbeb` background with `#fde68a` border.
- **Infeasible / Risk Alert**: `#e11d48` ink on `#fff1f2` background with `#fecdd3` border.

## Typography

The typographic architecture combines structured editorial precision with data clarity.

- **Plus Jakarta Sans** provides structural gravitas for executive headlines, strategic milestones, and primary metric readouts. Its geometry remains crisp and readable across light backdrops.
- **Inter** handles high-density reporting, comparative feasibility charts, balance sheets, and narrative assessments.
- **Numerical Alignment**: All numerical indicators, feasibility percentages, and KPI tables must enforce tabular figures (`font-variant-numeric: tabular-nums`) to ensure vertical visual balance during live advisory model recalculations.

## Layout & Spacing

The layout is built upon an 8pt spatial grid configured within a 12-column responsive fluid framework.

### Breakpoints & Container Logic
- **Mobile (`< 768px`)**: 4 columns, `margin-sm` (16px), `gutter-sm` (16px). Cards stack linearly with zero horizontal nesting.
- **Tablet (`768px - 1023px`)**: 8 columns, `margin` (32px), `gutter` (24px). Analytical sidebars fold into top-level summary accordions.
- **Desktop (`1024px+`)**: 12 columns, max-width `1440px`, centered with `margin` (32px) and `gutter` (24px). Accommodates dual analytical panels and primary workspace side-by-side.

### Spacing Density
- Card interiors enforce `space-lg` (24px) padding on desktop and `space-md` (16px) on mobile.
- Form inputs, metrics groupings, and key/value pair lists adhere strictly to `space-sm` (8px) and `space-md` (16px) vertical gaps.

## Elevation & Depth

Visual hierarchy relies on low-contrast structural boundaries and subtle ambient light scattering.

- **Level 0 (Canvas Base)**: Flat `#f8fafc` background.
- **Level 1 (Card & Module Layer)**: Pure `#ffffff` surface, framed by a `1px solid #e2e8f0` border and an ultra-soft ambient shadow: `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.03), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
- **Level 2 (Hover / Elevated States)**: Pure `#ffffff`, `1px solid #cbd5e1`, with expanded soft elevation: `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Modals & Overlays)**: Surface `#ffffff`, `1px solid #e2e8f0`, supported by a clean projection: `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`. Accompanied by a muted backdrop wash (`rgba(15, 23, 42, 0.35)` with `backdrop-filter: blur(4px)`).

## Shapes

The design uses a clean, architectural curvature scale (`roundedness: 2`).

- **Executive Cards & Panels**: Styled with `rounded-lg` (0.75rem / 12px) to `rounded-xl` (1rem / 16px) corners, delivering structured composure without severe boxiness.
- **Interactive Controls (Buttons, Inputs)**: Grounded at `0.5rem` (8px) for crisp ergonomics.
- **Pills, Badges & Chips**: Strict full pill morphology (`rounded-full` / `9999px`) to create clear contrast between metadata indicators and clickable rectangular buttons.

## Components

### Buttons
- **Primary Button**: Solid `#059669` background with white (`#ffffff`) text, semibold weight, `0.5rem` radius, and 40px height. Hover shifts to `#047857` with subtle elevation. Focus ring applies `0 0 0 2px #ffffff, 0 0 0 4px #10b981`.
- **Secondary Button**: Solid `#ffffff` background, `1px solid #cbd5e1`, text `#0f172a`. Hover state introduces `#f8fafc` surface tint with `#94a3b8` border.
- **Tertiary / Ghost Button**: Transparent background, text `#475569`. Hover triggers `#f1f5f9` surface wash with text `#0f172a`.

### Cards & Analytical Containers
- Pure white background (`#ffffff`), `1px solid #e2e8f0` border, `rounded-xl` geometry, and Level 1 elevation.
- **Feasibility Metric Cards**: Feature a dedicated top accent bar (2px height) colored dynamically (`#10b981` for high viability, `#e2e8f0` for pending states).

### Input Fields
- Height 40px, background `#ffffff`, border `1px solid #cbd5e1`, corner radius `0.5rem`, text `#0f172a`, placeholder text `#94a3b8`.
- Focus state activates `border-color: #059669` with an outer ring: `box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15)`.

### Chips & Status Indicators
- **High Feasibility Chip**: Background `#ecfdf5`, border `1px solid #a7f3d0`, text `#065f46`, font size 11px uppercase with `0.04em` letter spacing. Includes an inline 6px emerald dot (`#10b981`).
- **Neutral Parameter Chip**: Background `#f1f5f9`, border `1px solid #e2e8f0`, text `#475569`.

### Checkboxes & Radio Buttons
- 18x18px box, border `1px solid #cbd5e1`, background `#ffffff`, radius `4px` (checkbox) or `9999px` (radio).
- Checked state: `#059669` background, `#ffffff` check icon, with no harsh drop shadows.

### Feasibility Score Gauge (Specialized Component)
- A compact readout combining a `metric-val` Plus Jakarta Sans score indicator (e.g., "88/100") paired with an 8px track height segmented progress bar: background `#f1f5f9`, filled segment `#059669`, with micro-callouts highlighting sensitivity thresholds.