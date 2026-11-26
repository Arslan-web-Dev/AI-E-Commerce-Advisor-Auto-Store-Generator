/**
 * Multi-tenant routing primitives for the single deployed Next.js application.
 *
 * Tenants are addressed in three ways:
 *   1. path tenants:  https://<app-host>/<slug>/...
 *   2. wildcard:      https://<slug>.<STORE_ROOT_DOMAIN>/...
 *   3. custom domain: https://<verified-domain>/...  (mapped by the proxy)
 *
 * Only syntactically safe slugs/hosts are accepted. A host is never trusted as
 * proof of domain ownership; custom-domain hosts must be verified in the DB.
 */

export const RESERVED_STORE_SLUGS = new Set([
  'api', 'admin', 'login', 'auth', 'logout', 'signup', 'register', 'dashboard',
  'projects', 'wizard', 'market-intelligence', 'account', 'reset-password',
  'update-password', 'health', 'sitemap', 'robots', 'static', '_next',
  'favicon', 'stores', 'storefront', 'cdn', 'www',
]);

const STORE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;
const HOST_PATTERN = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function isValidStoreSlug(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const slug = value.toLowerCase();
  return STORE_SLUG_PATTERN.test(slug) && !RESERVED_STORE_SLUGS.has(slug);
}

export function normalizeHost(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().toLowerCase().replace(/^\.+|\.+$/g, '').replace(/:\d+$/, '');
  if (!HOST_PATTERN.test(cleaned)) return null;
  return cleaned;
}

function hostnameFromUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return normalizeHost(url.hostname);
  } catch {
    return null;
  }
}

export interface TenantConfig {
  appUrl?: string | null;
  rootDomain?: string | null;
  additionalAppHosts?: readonly string[] | null;
}

export function tenantConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TenantConfig {
  return {
    appUrl: env.NEXT_PUBLIC_APP_URL || env.APP_BASE_URL || null,
    rootDomain: env.STORE_ROOT_DOMAIN || null,
    additionalAppHosts: (env.APP_HOSTNAMES || '')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean),
  };
}

export function isAppHost(host: unknown, config: TenantConfig = {}): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  const appHost = hostnameFromUrl(config.appUrl);
  if (appHost && (normalized === appHost || normalized.endsWith(`.${appHost}`))) return true;
  for (const candidate of config.additionalAppHosts ?? []) {
    const extra = normalizeHost(candidate);
    if (extra && (normalized === extra || normalized.endsWith(`.${extra}`))) return true;
  }
  return false;
}

export function wildcardSlugFromHost(host: unknown, rootDomain: unknown): string | null {
  const normalized = normalizeHost(host);
  const root = normalizeHost(rootDomain);
  if (!normalized || !root || !normalized.endsWith(`.${root}`)) return null;
  const label = normalized.slice(0, -(root.length + 1));
  if (label.includes('.')) return null;
  return isValidStoreSlug(label) ? label : null;
}

export type TenantResolution =
  | { kind: 'path'; slug: string }
  | { kind: 'wildcard'; slug: string; host: string }
  | { kind: 'custom-domain'; domain: string }
  | { kind: 'app'; slug: null };

/**
 * Decide which tenant namespace a request belongs to. Custom-domain requests
 * are returned for a database lookup; they are never assumed verified here.
 */
export function parseTenantRequest(input: {
  host?: string | null;
  pathname?: string | null;
  config?: TenantConfig;
}): TenantResolution {
  const config = input.config ?? tenantConfigFromEnv();
  const pathname = input.pathname ?? '/';
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  const host = normalizeHost(input.host);

  // No host (or an unknown app host) means path tenants are explicit. On a
  // wildcard/custom host the first path segment is a storefront route, so it
  // must never be mistaken for a second tenant slug.
  if (!host) {
    return firstSegment && isValidStoreSlug(firstSegment)
      ? { kind: 'path', slug: firstSegment.toLowerCase() }
      : { kind: 'app', slug: null };
  }

  const wildcardSlug = wildcardSlugFromHost(host, config.rootDomain);
  if (wildcardSlug) return { kind: 'wildcard', slug: wildcardSlug, host };

  if (isAppHost(host, config)) {
    return firstSegment && isValidStoreSlug(firstSegment)
      ? { kind: 'path', slug: firstSegment.toLowerCase() }
      : { kind: 'app', slug: null };
  }
  return { kind: 'custom-domain', domain: host };
}

function originFromAppUrl(appUrl?: string | null): string {
  if (appUrl) {
    try {
      const url = new URL(appUrl.includes('://') ? appUrl : `https://${appUrl}`);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    } catch {
      // Fall through to a non-routable, explicit placeholder.
    }
  }
  return 'https://localhost';
}

/**
 * Build the canonical public base URL for a tenant. A verified tenant host is
 * used only when the caller has already verified it; otherwise the wildcard
 * root domain or app URL is used. No fabricated `platform.pk` value exists.
 */
export function buildStoreBaseUrl(input: {
  slug: string;
  host?: string | null;
  verifiedCustomHost?: string | null;
  config?: TenantConfig;
}): string {
  const config = input.config ?? tenantConfigFromEnv();
  const root = normalizeHost(config.rootDomain);
  const host = normalizeHost(input.host);
  const verifiedCustomHost = normalizeHost(input.verifiedCustomHost);

  if (verifiedCustomHost && host && host === verifiedCustomHost) {
    return `https://${verifiedCustomHost}`;
  }
  if (host && root && host.endsWith(`.${root}`) && wildcardSlugFromHost(host, root) === input.slug) {
    return `https://${host}`;
  }
  if (host && isAppHost(host, config)) {
    return `${originFromAppUrl(config.appUrl)}/${input.slug}`;
  }

  const rootSlug = root ? `${input.slug}.${root}` : null;
  if (rootSlug && isValidStoreSlug(input.slug)) return `https://${rootSlug}`;
  return `${originFromAppUrl(config.appUrl)}/${input.slug}`;
}

export function buildStorePath(baseUrl: string, path = ''): string {
  const normalized = baseUrl.replace(/\/$/, '');
  const suffix = path && path !== '/' ? `/${path.replace(/^\/+/, '')}` : '';
  return `${normalized}${suffix}`;
}
