/** Server-side public storefront reads against the canonical Module 8 schema. */

import { createClient } from '@/lib/supabase/server';
import { mapThemeConfiguration, type StoreThemeTokens } from './theme';
import {
  buildStoreBaseUrl,
  normalizeHost,
  parseTenantRequest,
  tenantConfigFromEnv,
  type TenantConfig,
} from './tenant';

const STORE_COLUMNS = [
  'id', 'slug', 'status', 'is_banned', 'name', 'theme_config', 'seo_config',
  'custom_domain', 'domain_status', 'domain_verified_at', 'project_id',
  'projects(title, description)',
].join(', ');

export interface PublicStore {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: 'published';
  theme: StoreThemeTokens;
  seo: {
    meta_title?: string;
    meta_description?: string;
    keywords: string[];
  };
  projectId: string | null;
  customDomain: string | null;
  baseUrl: string;
  verifiedHost: string | null;
}

interface StoreRow {
  id: string;
  slug: string;
  status: string;
  is_banned?: boolean | null;
  name?: string | null;
  theme_config?: unknown;
  seo_config?: unknown;
  custom_domain?: string | null;
  domain_status?: string | null;
  project_id?: string | null;
  projects?: unknown;
}

function firstProject(row: StoreRow): { title?: string; description?: string } | undefined {
  const value = row.projects;
  const project = Array.isArray(value) ? value[0] : value;
  if (!project || typeof project !== 'object') return undefined;
  return project as { title?: string; description?: string };
}

function readSeo(value: unknown): PublicStore['seo'] {
  if (!value || typeof value !== 'object') return { keywords: [] };
  const seo = value as Record<string, unknown>;
  const keywords = Array.isArray(seo.keywords)
    ? seo.keywords.filter((keyword): keyword is string => typeof keyword === 'string' && Boolean(keyword.trim()))
    : [];
  return {
    ...(typeof seo.meta_title === 'string' ? { meta_title: seo.meta_title } : {}),
    ...(typeof seo.meta_description === 'string' ? { meta_description: seo.meta_description } : {}),
    keywords,
  };
}

export async function getPublicStore(
  slug: string,
  input: { host?: string | null; config?: TenantConfig } = {},
): Promise<PublicStore | null> {
  const config = input.config ?? tenantConfigFromEnv();
  const host = normalizeHost(input.host);
  const resolution = parseTenantRequest({ host, pathname: `/${slug}`, config });

  // A custom-host request must match a verified domain on this exact store.
  // Wildcard hosts must name the same tenant as the path being rendered.
  if (resolution.kind === 'wildcard' && resolution.slug !== slug) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stores')
    .select(STORE_COLUMNS)
    .eq('slug', slug)
    .eq('status', 'published')
    .eq('is_banned', false)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as unknown as StoreRow;
  let verifiedHost: string | null = null;

  if (resolution.kind === 'custom-domain' && host) {
    if (
      normalizeHost(row.custom_domain) !== host ||
      row.domain_status !== 'verified'
    ) return null;
    verifiedHost = host;
  } else if (resolution.kind === 'wildcard') {
    verifiedHost = resolution.host;
  }

  const project = firstProject(row);
  const theme = mapThemeConfiguration(row.theme_config, {
    storeName: row.name ?? project?.title,
    tagline: project?.description,
  });
  const seo = readSeo(row.seo_config);
  const baseUrl = buildStoreBaseUrl({
    slug,
    host,
    verifiedCustomHost: verifiedHost,
    config,
  });

  return {
    id: row.id,
    slug: row.slug,
    name: theme.storeName,
    description: theme.tagline || project?.description || `Shop at ${theme.storeName}`,
    status: 'published',
    theme,
    seo,
    projectId: row.project_id ?? null,
    customDomain: row.custom_domain ?? null,
    baseUrl,
    verifiedHost,
  };
}

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  price_pkr: number;
  compare_at_price_pkr: number | null;
  category: string | null;
  images: string[];
  stock: number;
  seo: PublicStore['seo'];
  updated_at: string | null;
}

function mapProduct(row: Record<string, unknown>): PublicProduct {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    slug: String(row.slug ?? ''),
    sku: typeof row.sku === 'string' ? row.sku : null,
    description: typeof row.description === 'string' ? row.description : null,
    price_pkr: Number(row.price_pkr ?? 0),
    compare_at_price_pkr: row.compare_at_price_pkr == null ? null : Number(row.compare_at_price_pkr),
    category: typeof row.category === 'string' ? row.category : null,
    images: Array.isArray(row.images) ? row.images.filter((image): image is string => typeof image === 'string') : [],
    stock: Number(row.stock ?? 0),
    seo: readSeo(row.seo),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

export async function listPublicProducts(storeId: string, limit = 12): Promise<PublicProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, sku, description, price_pkr, compare_at_price_pkr, category, images, stock, seo, updated_at')
    .eq('store_id', storeId)
    .eq('is_active', true)
    .eq('is_archived', false)
    .gt('stock', 0)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown as Array<Record<string, unknown>>).map(mapProduct);
}

export async function getPublicProduct(storeId: string, productId: string): Promise<PublicProduct | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, sku, description, price_pkr, compare_at_price_pkr, category, images, stock, seo, updated_at')
    .eq('store_id', storeId)
    .eq('id', productId)
    .eq('is_active', true)
    .eq('is_archived', false)
    .maybeSingle();

  if (error || !data) return null;
  return mapProduct(data as unknown as Record<string, unknown>);
}
