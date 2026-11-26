/**
 * Server-only Vercel Domains client.
 *
 * No verification status is inferred from a stored string. Every status comes
 * from the Vercel REST API response, including the TXT challenge the owner must
 * publish. Tests inject a mock fetch implementation; no live call happens here.
 */

const DOMAIN_PATTERN = /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const VERCEL_API = 'https://api.vercel.com';

export type FetchLike = (input: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface VercelConfig {
  token: string;
  projectId: string;
  teamId?: string;
}

export interface VercelVerificationChallenge {
  type: string;
  domain: string;
  value: string;
  reason?: string;
}

export interface VercelDomainRecord {
  name: string;
  apexName?: string;
  projectId?: string;
  verified: boolean;
  verification?: VercelVerificationChallenge[];
  createdAt?: number;
  updatedAt?: number;
}

export interface ProviderResult {
  ok: boolean;
  status: number;
  record?: VercelDomainRecord;
  error?: string;
}

export const DOMAIN_STATUS = {
  NOT_CONFIGURED: 'not_configured',
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
} as const;

export type DomainStatus = (typeof DOMAIN_STATUS)[keyof typeof DOMAIN_STATUS];

export function normalizeStoreDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let domain = value.trim().toLowerCase();
  if (!domain) return null;
  if (domain.includes('://')) {
    try {
      domain = new URL(domain).hostname;
    } catch {
      return null;
    }
  }
  domain = domain.split('/')[0].replace(/:\d+$/, '').replace(/\.$/, '');
  return DOMAIN_PATTERN.test(domain) ? domain : null;
}

export function isValidStoreDomain(value: unknown): value is string {
  return normalizeStoreDomain(value) === value;
}

export function vercelConfigFromEnv(env: NodeJS.ProcessEnv = process.env): VercelConfig | null {
  const token = env.VERCEL_TOKEN?.trim() || '';
  const projectId = env.VERCEL_PROJECT_ID?.trim() || '';
  if (!token || !projectId) return null;
  return {
    token,
    projectId,
    teamId: env.VERCEL_TEAM_ID?.trim() || env.VERCEL_TEAM_SLUG?.trim() || undefined,
  };
}

function withTeamQuery(path: string, config: VercelConfig): string {
  if (!config.teamId) return path;
  const separator = path.includes('?') ? '&' : '?';
  const key = /^[a-z0-9]+$/i.test(config.teamId) && config.teamId.length === 20 ? 'teamId' : 'slug';
  return `${path}${separator}${key}=${encodeURIComponent(config.teamId)}`;
}

async function callVercel(
  fetchImpl: FetchLike,
  config: VercelConfig,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>,
): Promise<ProviderResult> {
  const response = await fetchImpl(`${VERCEL_API}${withTeamQuery(path, config)}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let payload: Record<string, unknown> = {};
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
  } catch {
    // Providers occasionally return an empty body; keep the HTTP status.
  }

  if (!response.ok) {
    const providerError = typeof payload.error === 'object' && payload.error && 'message' in payload.error
      ? String((payload.error as { message: unknown }).message)
      : typeof payload.error === 'string'
        ? payload.error
        : typeof payload.message === 'string'
          ? payload.message
          : `Vercel request failed with status ${response.status}.`;
    return { ok: false, status: response.status, error: providerError };
  }

  const record = normalizeProviderRecord(payload);
  return { ok: true, status: response.status, ...(record ? { record } : {}) };
}

function normalizeProviderRecord(payload: Record<string, unknown>): VercelDomainRecord | undefined {
  if (typeof payload.name !== 'string' || typeof payload.verified !== 'boolean') return undefined;
  const verification = Array.isArray(payload.verification)
    ? payload.verification.flatMap((item): VercelVerificationChallenge[] => {
        if (!item || typeof item !== 'object') return [];
        const challenge = item as Record<string, unknown>;
        if (
          typeof challenge.type !== 'string' ||
          typeof challenge.domain !== 'string' ||
          typeof challenge.value !== 'string'
        ) return [];
        return [{
          type: challenge.type,
          domain: challenge.domain,
          value: challenge.value,
          ...(typeof challenge.reason === 'string' ? { reason: challenge.reason } : {}),
        }];
      })
    : [];

  return {
    name: payload.name,
    ...(typeof payload.apexName === 'string' ? { apexName: payload.apexName } : {}),
    ...(typeof payload.projectId === 'string' ? { projectId: payload.projectId } : {}),
    verified: payload.verified,
    ...(verification.length ? { verification } : {}),
    ...(typeof payload.createdAt === 'number' ? { createdAt: payload.createdAt } : {}),
    ...(typeof payload.updatedAt === 'number' ? { updatedAt: payload.updatedAt } : {}),
  };
}

export function addProjectDomain(
  fetchImpl: FetchLike,
  config: VercelConfig,
  domain: string,
): Promise<ProviderResult> {
  return callVercel(fetchImpl, config, 'POST', `/v10/projects/${encodeURIComponent(config.projectId)}/domains`, { name: domain });
}

export function getProjectDomain(
  fetchImpl: FetchLike,
  config: VercelConfig,
  domain: string,
): Promise<ProviderResult> {
  return callVercel(
    fetchImpl,
    config,
    'GET',
    `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}`,
  );
}

export function verifyProjectDomain(
  fetchImpl: FetchLike,
  config: VercelConfig,
  domain: string,
): Promise<ProviderResult> {
  return callVercel(
    fetchImpl,
    config,
    'POST',
    `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}/verify`,
  );
}

export function removeProjectDomain(
  fetchImpl: FetchLike,
  config: VercelConfig,
  domain: string,
): Promise<ProviderResult> {
  return callVercel(
    fetchImpl,
    config,
    'DELETE',
    `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}`,
  );
}

export function domainStateFromProvider(record: VercelDomainRecord | undefined): {
  status: DomainStatus;
  verificationToken: string | null;
  challenges: VercelVerificationChallenge[];
  verifiedAt: string | null;
} {
  if (!record) return { status: DOMAIN_STATUS.FAILED, verificationToken: null, challenges: [], verifiedAt: null };
  const challenges = record.verification ?? [];
  const token = challenges.find((challenge) => challenge.type.toUpperCase() === 'TXT')?.value ?? null;
  return {
    status: record.verified ? DOMAIN_STATUS.VERIFIED : DOMAIN_STATUS.PENDING,
    verificationToken: token,
    challenges,
    verifiedAt: record.verified ? new Date().toISOString() : null,
  };
}
