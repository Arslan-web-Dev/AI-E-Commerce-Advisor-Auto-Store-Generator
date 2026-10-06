---
name: Autonomous Venture Engine
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#45dfa4'
  on-tertiary: '#003825'
  tertiary-container: '#00b982'
  on-tertiary-container: '#00422c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#68fcbf'
  tertiary-fixed-dim: '#45dfa4'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
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
    letterSpacing: 0.01em
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
    letterSpacing: 0.04em
  metric-val:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
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

The design system targets ambitious SME founders, digital entrepreneurs, and operational strategists who demand institutional-grade clarity without enterprise bloat. The aesthetic is precision-engineered, nocturnal, and catalytic. It conveys high-conviction decision making, machine intelligence, and operational vitality. 

Visually, the system combines deep, atmospheric dark mode surfaces with calibrated glassmorphic structures and high-chroma emerald telemetry accents. Instead of passive flat dark surfaces, it uses layered architectural depths: translucent cards, precise single-pixel hairpins, and localized radial light bleeds that signal algorithmic activity and predictive readiness. The interface feels like an analytical trading floor crossed with an executive command center.

## Colors

The palette operates on structured contrast ratios calibrated specifically for low-light legibility and focused scanning.

### Core Architecture
- **Canvas Base**: `#0b1120` (Root viewport, immersive void)
- **Sub-surface / Neutral Canvas**: `#0f172a` (Sectional layers, sidebars, nested views)
- **Surface Elevation 1 (Card & Shells)**: `#111827` rendered at `85%` alpha over canvas gradients
- **Surface Elevation 2 (Raised Panels & Modals)**: `#1e293b` rendered at `90%` alpha
- **Structural Borders & Separators**: `#334155` at variable opacities (`40%` for dormant states, `80%` on interactive hover)

### Accents & Telemetry
- **Primary Emerald (`#10b981`)**: The functional catalyst. Reserved for affirmative validation, active metrics, final action buttons, and launch controls.
- **Deep Emerald (`#059669`)**: Grounded interactive states, primary active hover backgrounds, and high-impact gradients.
- **Luminous Mint (`#34d399`)**: High-priority micro-highlights, glow reflections, trend upticks, and dynamic focal points.
- **Secondary Cyan (`#06b6d4`)**: Applied to analytical forecasts, AI data extraction vectors, contextual chips, and exploratory parameters.

### Text Contrast Tiers
- **Text High-Emphasis**: `#f8fafc` (Headlines, key metric values, active labels)
- **Text Medium-Emphasis**: `#94a3b8` (Body narrative, parameter labels, dormant tabs)
- **Text Low-Emphasis**: `#64748b` (Watermarks, non-interactive column headers, disabled indicators)

## Typography

The type system blends structural geometric display typography with hyper-readable utilitarian body copy. 

- **Plus Jakarta Sans** delivers modern geometric balance for structural titles, KPI readouts, and section signifiers, avoiding corporate stiffness while preserving technical authority.
- **Inter** handles data-dense tables, analytical assessments, inputs, and systemic documentation, providing neutral legibility under dark-mode irradiation.
- **Metrics & Indicators**: Key financial predictions and viability scores pair the semi-bold weight of Plus Jakarta Sans with tabular lining figures (`font-variant-numeric: tabular-nums`) to prevent jitter across active AI evaluation streams.

## Layout & Spacing

The structural layout uses a responsive 12-column dynamic fluid grid flanked by contextual utility rails.

- **Breakpoints**: 
  - Mobile: `< 768px` (4 columns, `margin-sm`, `gutter-sm`)
  - Tablet: `768px - 1199px` (8 columns, dynamic margins)
  - Desktop: `1200px+` (12 columns, max content container `1440px`, centered with `margin: 2rem`)
- **Vertical Rhythm**: Layout components stack strictly along an 8pt base grid (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 16px, `space-lg` = 24px, `space-xl` = 40px). 
- **Analytical Densities**: Dashboard cards use compact internal padding (`space-lg`) on desktop and downscale to `space-md` on mobile viewports to prioritize viewport real estate. Data metric clusters enforce strict micro-gaps (`space-xs` to `space-sm`) to group dependent analytical markers.

## Elevation & Depth

Visual hierarchy does not use classic drop shadows, which muddy dark canvases. Depth is created through translucent glassmorphism, inner atmospheric reflections, and radiant chromatic glows.

### Tiers of Depth
- **Level 0 (Canvas Void)**: Base tone `#0b1120` accented with slow-moving ambient radial gradients: `radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.04) 0%, transparent 60%)`.
- **Level 1 (Sub-Panel Panels / Glass Cards)**: Translucent fill `rgba(17, 24, 39, 0.75)` with `backdrop-filter: blur(16px)` and a precise hairline border: `1px solid rgba(51, 65, 85, 0.45)`.
- **Level 2 (Active Focus / Selected Modules)**: Translucent fill `rgba(30, 41, 59, 0.85)` with `backdrop-filter: blur(24px)`, framed by `1px solid rgba(16, 185, 129, 0.3)`. Light bleeding is applied via outer ambient aura: `box-shadow: 0 0 25px -5px rgba(16, 185, 129, 0.15)`.
- **Level 3 (Overlays & Dialogs)**: Deep translucent fill `#111827` at `95%` opacity, `backdrop-filter: blur(32px)`, bordered by `1px solid rgba(51, 65, 85, 0.8)` with a multi-layered boundary: `0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)`.

## Shapes

The geometric signature centers on generous, fluid card bounds contrasted against sharp internal mechanics.

- **Cards & Primary Modules**: Enforced `rounded-2xl` (1rem to 1.5rem) border radius, giving analytical panels a polished, hardware-inspired finish.
- **Interactive Inputs & Buttons**: Standardized at `0.5rem` to `0.75rem` radius, preserving clear structural affordances.
- **Status Pills, Badges & Chips**: Full pill morphology (`rounded-full` / `9999px`) to create distinction between actionable controls and passive systemic feedback.

## Components

### Buttons
- **Primary Launch Action**: Solid `#10b981` background, `#042f2e` high-contrast typography, semibold 14px. On hover, background shifts to `#34d399` with an emerald glow: `box-shadow: 0 0 20px rgba(16, 185, 129, 0.4)`. Transitions are rapid (`150ms ease-out`).
- **Secondary (Analytical/Forecast)**: Slate surface `rgba(30, 41, 59, 0.7)`, border `1px solid #334155`, text `#f8fafc`. Hover triggers cyan lighting: border transitions to `#06b6d4`, subtle cyan glow `box-shadow: 0 0 16px rgba(6, 182, 212, 0.25)`.
- **Ghost Action**: Transparent background, text `#94a3b8`. Hover transitions to text `#f8fafc` with subtle background tint `rgba(51, 65, 85, 0.3)`.

### Cards & Panels
- Constructed using `rounded-2xl` corners, `1px solid rgba(51, 65, 85, 0.4)` border, and dark-glass tint. Hovering interactive cards activates an inset border illumination from `#334155` to `rgba(16, 185, 129, 0.4)` with an ambient soft lift (`transform: translateY(-2px)`).

### Metric & Feasibility Pills
- Compact, full-pill badges (`padding: 4px 10px`, `11px label-sm`).
- **High Viability**: Background `rgba(16, 185, 129, 0.12)`, border `1px solid rgba(16, 185, 129, 0.3)`, text `#34d399`. Includes a pulsing leading green dot (`#10b981`).
- **In-Analysis / Computing**: Background `rgba(6, 182, 212, 0.12)`, border `1px solid rgba(6, 182, 212, 0.3)`, text `#06b6d4`.
- **Risk Flag**: Background `rgba(244, 63, 94, 0.12)`, border `1px solid rgba(244, 63, 94, 0.3)`, text `#fb7185`.

### Input Fields & Controls
- Height: 44px. Background `rgba(15, 23, 42, 0.6)`, border `1px solid #334155`, radius `0.5rem`, placeholder text `#64748b`. Focus state triggers an immediate crisp border color `#10b981` paired with a focused micro-ring: `0 0 0 1px #10b981, 0 0 12px rgba(16, 185, 129, 0.25)`.

### Checkboxes & Toggle Radios
- Box size: 18x18px. Dormant background: `#0f172a`, border: `1px solid #334155`, radius `4px`.
- Selected state: Background `#10b981` with an interior checkmark in `#042f2e`. Radios follow identical logic with full circular border radius.

### AI Insight Telemetry Stream (Domain-Specific)
- Nested sub-card with a directional radial sheen across the header. Houses an animated gradient trace along the top border (`linear-gradient(90deg, transparent, #10b981, transparent)`), paired with variable-weight typography to highlight automated store-launching recommendations and confidence ratings.