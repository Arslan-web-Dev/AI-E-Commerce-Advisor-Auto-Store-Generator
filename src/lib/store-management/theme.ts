/**
 * Storefront theme adapter.
 *
 * Module 7 persists the strict `theme.v1` configuration. Older store rows may
 * still contain flat legacy keys, so public rendering maps both shapes into a
 * bounded token set. Values are sanitised before being emitted into CSS.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_RADII = new Set(['0.25rem', '0.5rem', '0.75rem', '1rem', '999px']);
const NAVBAR_STYLES = new Set(['classic', 'split', 'centered']);
const HERO_STYLES = new Set(['simple', 'split_focus', 'banner']);
const GRID_STYLES = new Set(['two_column', 'three_column', 'four_column']);
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;

export interface StoreThemeTokens {
  storeName: string;
  tagline: string;
  primary: string;
  secondary: string;
  surface: string;
  onPrimary: string;
  onSurface: string;
  accent: string;
  radius: string;
  fontFamily: string;
  navbarStyle: 'classic' | 'split' | 'centered';
  heroStyle: 'simple' | 'split_focus' | 'banner';
  productGrid: 'two_column' | 'three_column' | 'four_column';
  logoUrl: string | null;
  bannerUrl: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value) ? value : fallback;
}

function safeText(value: unknown, fallback: string, max = 120): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[<>\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned || cleaned.length > max) return fallback;
  return cleaned;
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeRadius(value: unknown): string {
  return typeof value === 'string' && SAFE_RADII.has(value) ? value : '0.5rem';
}

function pickStyle<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value) ? (value as T) : fallback;
}

export function mapThemeConfiguration(
  rawTheme: unknown,
  fallbacks: { storeName?: string | null; tagline?: string | null } = {},
): StoreThemeTokens {
  const theme = isRecord(rawTheme) ? rawTheme : {};
  const colors = isRecord(theme.colors) ? theme.colors : {};
  const answers = isRecord(theme.answers) ? theme.answers : {};
  const seo = isRecord(theme.seo) ? theme.seo : {};
  const isStrict = theme.schemaVersion === 'theme.v1';

  const primary = safeColor(
    isStrict ? colors.primary : theme.primary_color ?? colors.primary,
    '#4edea3',
  );
  const secondary = safeColor(
    isStrict ? colors.secondary : theme.secondary_color ?? colors.secondary,
    '#4cd7f6',
  );
  const surface = safeColor(
    isStrict ? colors.surface : theme.bg_color ?? colors.surface,
    '#0b1326',
  );
  const onPrimary = safeColor(isStrict ? colors.onPrimary : theme.on_primary_color, surface);
  const onSurface = safeColor(
    isStrict ? colors.onSurface : theme.text_color ?? colors.onSurface,
    '#dae2fd',
  );

  return {
    storeName: safeText(
      isStrict ? theme.storeName : theme.store_name,
      safeText(fallbacks.storeName, 'My Store', 80),
      80,
    ),
    tagline: safeText(
      theme.tagline ?? seo.meta_description,
      safeText(fallbacks.tagline, 'Quality products, delivered to your door.', 160),
      160,
    ),
    primary,
    secondary,
    surface,
    onPrimary,
    onSurface,
    accent: safeColor(theme.accent_color, '#f59e0b'),
    radius: safeRadius(isStrict ? '0.5rem' : theme.border_radius),
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    navbarStyle: pickStyle(answers.navbarStyle ?? theme.navbar_style, NAVBAR_STYLES, 'classic'),
    heroStyle: pickStyle(answers.heroStyle ?? theme.hero_style, HERO_STYLES, 'simple'),
    productGrid: pickStyle(answers.productGrid ?? theme.product_grid, GRID_STYLES, 'three_column'),
    logoUrl: safeUrl(theme.logo_url),
    bannerUrl: safeUrl(theme.banner_url),
    contactPhone: safeText(theme.contact_phone, '', 30) || null,
    contactEmail: (() => {
      const email = safeText(theme.contact_email, '', 120);
      return EMAIL.test(email) ? email : null;
    })(),
  };
}

/** Only allowlisted values reach the injected stylesheet. */
export function themeCssVariables(tokens: StoreThemeTokens): string {
  return `
    :root {
      --store-primary: ${tokens.primary};
      --store-secondary: ${tokens.secondary};
      --store-surface: ${tokens.surface};
      --store-on-primary: ${tokens.onPrimary};
      --store-on-surface: ${tokens.onSurface};
      --store-accent: ${tokens.accent};
      --store-bg: ${tokens.surface};
      --store-text: ${tokens.onSurface};
      --store-font: ${tokens.fontFamily};
      --store-radius: ${tokens.radius};
      --store-grid-columns: ${PRODUCT_GRID_COLUMNS[tokens.productGrid]};
      --store-navbar-justify: ${tokens.navbarStyle === 'centered' ? 'center' : tokens.navbarStyle === 'split' ? 'space-between' : 'space-between'};
      --store-navbar-direction: ${tokens.navbarStyle === 'centered' ? 'column' : 'row'};
      --store-hero-align: ${tokens.heroStyle === 'split_focus' ? 'left' : 'center'};
    }
    body { background-color: var(--store-bg); color: var(--store-text); font-family: var(--store-font); }
    @media (max-width: 640px) {
      [data-navbar-style] nav { gap: 0.35rem; }
      [data-navbar-style] nav > div:last-child { gap: 0.6rem; }
    }
  `;
}

export const PRODUCT_GRID_COLUMNS: Record<StoreThemeTokens['productGrid'], string> = {
  two_column: 'repeat(auto-fill, minmax(260px, 1fr))',
  three_column: 'repeat(auto-fill, minmax(220px, 1fr))',
  four_column: 'repeat(auto-fill, minmax(180px, 1fr))',
};
