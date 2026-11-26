/** Shared SEO primitives for tenant metadata, structured data and crawl files. */

import { buildStoreBaseUrl, buildStorePath, tenantConfigFromEnv, type TenantConfig } from './tenant';

export const SEO_LIMITS = {
  title: { min: 15, max: 60 },
  description: { min: 50, max: 160 },
  keywords: { max: 12 },
} as const;

export interface SeoValidation {
  valid: boolean;
  issues: string[];
}

export function validateSeoMetadata(title: unknown, description: unknown): SeoValidation {
  const issues: string[] = [];
  const titleText = typeof title === 'string' ? title.trim() : '';
  const descriptionText = typeof description === 'string' ? description.trim() : '';

  if (titleText.length < SEO_LIMITS.title.min) issues.push(`Title must be at least ${SEO_LIMITS.title.min} characters.`);
  if (titleText.length > SEO_LIMITS.title.max) issues.push(`Title must be at most ${SEO_LIMITS.title.max} characters.`);
  if (descriptionText.length < SEO_LIMITS.description.min) issues.push(`Description must be at least ${SEO_LIMITS.description.min} characters.`);
  if (descriptionText.length > SEO_LIMITS.description.max) issues.push(`Description must be at most ${SEO_LIMITS.description.max} characters.`);
  if (/[<>\u0000-\u001F\u007F]/.test(titleText + descriptionText)) issues.push('Metadata contains unsafe characters.');

  return { valid: issues.length === 0, issues };
}

function cleanMetadataText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
}

function boundedText(value: unknown, fallback: string, min: number, max: number): string {
  const clean = cleanMetadataText(value);
  const base = clean || fallback;
  let result = base.slice(0, max).trim();
  if (result.length < min) {
    const extended = `${result} ${fallback}`.replace(/\s+/g, ' ').trim();
    result = extended.slice(0, max).trim();
  }
  return result;
}

/**
 * Every public metadata export goes through this helper. Invalid stored SEO
 * JSON can never emit oversized, empty or script-breaking title/description.
 */
export function resolveSeoMetadata(input: {
  title?: unknown;
  description?: unknown;
  fallbackTitle: string;
  fallbackDescription: string;
}): { title: string; description: string; validation: SeoValidation } {
  const title = boundedText(
    input.title,
    input.fallbackTitle,
    SEO_LIMITS.title.min,
    SEO_LIMITS.title.max,
  );
  const description = boundedText(
    input.description,
    input.fallbackDescription,
    SEO_LIMITS.description.min,
    SEO_LIMITS.description.max,
  );
  return { title, description, validation: validateSeoMetadata(title, description) };
}

/** Owner-supplied SEO JSON is normalized before it is stored or rendered. */
export function normalizeStoredSeo(
  value: unknown,
  fallbackTitle: string,
  fallbackDescription: string,
): { meta_title: string; meta_description: string; keywords: string[] } {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const { title, description } = resolveSeoMetadata({
    title: record.meta_title,
    description: record.meta_description,
    fallbackTitle,
    fallbackDescription,
  });
  return {
    meta_title: title,
    meta_description: description,
    keywords: safeSeoKeywords(record.keywords),
  };
}

export function safeSeoKeywords(value: unknown, fallback: string[] = []): string[] {
  const source = Array.isArray(value) ? value : fallback;
  const keywords = source
    .filter((keyword): keyword is string => typeof keyword === 'string')
    .map((keyword) => cleanMetadataText(keyword).slice(0, 60))
    .filter((keyword) => keyword && !/[\\/:]/.test(keyword));
  return [...new Set(keywords)].slice(0, SEO_LIMITS.keywords.max);
}

/** JSON-LD must not be able to terminate its own <script> element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function storeJsonLd(input: {
  name: string;
  description: string;
  url: string;
  logo?: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.logo ? { image: input.logo } : {}),
    ...(input.email || input.phone
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            ...(input.email ? { email: input.email } : {}),
            ...(input.phone ? { telephone: input.phone } : {}),
          },
        }
      : {}),
  };
}

export function productJsonLd(input: {
  name: string;
  description: string;
  url: string;
  images: string[];
  pricePkr: number;
  inStock: boolean;
  sku?: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    url: input.url,
    image: input.images.filter(Boolean),
    ...(input.sku ? { sku: input.sku } : {}),
    offers: {
      '@type': 'Offer',
      url: input.url,
      priceCurrency: 'PKR',
      price: input.pricePkr,
      availability: input.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url?: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

export function buildCanonicalUrl(input: {
  slug: string;
  host?: string | null;
  verifiedCustomHost?: string | null;
  path?: string;
  config?: TenantConfig;
}): string {
  const base = buildStoreBaseUrl({
    slug: input.slug,
    host: input.host,
    verifiedCustomHost: input.verifiedCustomHost,
    config: input.config ?? tenantConfigFromEnv(),
  });
  return buildStorePath(base, input.path ?? '');
}

export interface RobotsDocument {
  rules: Array<{ userAgent: string; allow: string; disallow: string[] }>;
  sitemap: string;
}

export function buildRobotsDocument(input: {
  slug: string;
  host?: string | null;
  verifiedCustomHost?: string | null;
  config?: TenantConfig;
}): RobotsDocument {
  const base = buildStoreBaseUrl({
    slug: input.slug,
    host: input.host,
    verifiedCustomHost: input.verifiedCustomHost,
    config: input.config ?? tenantConfigFromEnv(),
  });
  const tenantPrefix = base.includes('://') && new URL(base).pathname === '/' ? '' : `/${input.slug}`;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [`${tenantPrefix}/cart`, `${tenantPrefix}/checkout`, `${tenantPrefix}/checkout/*`],
      },
    ],
    sitemap: `${base.replace(/\/$/, '')}/sitemap.xml`,
  };
}

export interface SeoScoreResult {
  score: number;
  issues: string[];
}

/**
 * Transparent, deterministic storefront SEO score. It describes on-page
 * readiness only; it is not a Google ranking or Lighthouse result.
 */
export function computeStoreSeoScore(input: {
  title?: string | null;
  description?: string | null;
  keywords?: string[] | null;
  hasImage?: boolean;
  hasCanonical?: boolean;
  hasJsonLd?: boolean;
  hasBreadcrumbs?: boolean;
}): SeoScoreResult {
  let score = 0;
  const issues: string[] = [];
  const title = (input.title ?? '').trim();
  const description = (input.description ?? '').trim();
  const keywords = (input.keywords ?? []).filter((keyword) => typeof keyword === 'string' && keyword.trim());

  if (title.length >= SEO_LIMITS.title.min && title.length <= SEO_LIMITS.title.max) score += 25;
  else issues.push(`Title should be ${SEO_LIMITS.title.min}-${SEO_LIMITS.title.max} characters.`);

  if (description.length >= SEO_LIMITS.description.min && description.length <= SEO_LIMITS.description.max) score += 25;
  else issues.push(`Description should be ${SEO_LIMITS.description.min}-${SEO_LIMITS.description.max} characters.`);

  if (keywords.length > 0 && keywords.length <= SEO_LIMITS.keywords.max) score += 15;
  else issues.push(`Provide 1-${SEO_LIMITS.keywords.max} relevant keywords.`);

  if (input.hasImage) score += 10;
  else issues.push('Add at least one product image.');

  if (input.hasCanonical) score += 10;
  else issues.push('Add a canonical URL.');

  if (input.hasJsonLd) score += 10;
  else issues.push('Add structured data.');

  if (input.hasBreadcrumbs) score += 5;
  else issues.push('Add breadcrumb structured data on product pages.');

  return { score: Math.min(100, score), issues };
}
