/** Publication lifecycle contract shared by owner and admin controls. */

import { buildStoreBaseUrl, isValidStoreSlug } from './tenant';

export type PublicationAction = 'publish' | 'unpublish';

export interface PublicationInput {
  action: PublicationAction;
  notes?: string | null;
}

export interface PublicationResult {
  ok: boolean;
  error?: string;
  status?: 400;
}

export function parsePublicationAction(body: unknown): PublicationResult & { input?: PublicationInput } {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'An explicit publish or unpublish action is required.' };
  }
  const payload = body as Record<string, unknown>;
  const rawAction = payload.action ?? payload.publication_action;
  let action: PublicationAction | null = null;

  if (rawAction === 'publish' || rawAction === 'unpublish') {
    action = rawAction;
  } else if (typeof payload.publish === 'boolean') {
    action = payload.publish ? 'publish' : 'unpublish';
  } else if (typeof payload.is_published === 'boolean') {
    action = payload.is_published ? 'publish' : 'unpublish';
  }

  if (!action) {
    return { ok: false, status: 400, error: 'An explicit publish or unpublish action is required.' };
  }
  const notes = typeof payload.notes === 'string' ? payload.notes.trim().slice(0, 500) : null;
  return { ok: true, input: { action, notes } };
}

export interface PublishedStoreRow {
  id: string;
  slug: string;
  status?: string | null;
  is_banned?: boolean | null;
  custom_domain?: string | null;
  domain_status?: string | null;
  published_at?: string | null;
  unpublished_at?: string | null;
}

export function assertPublishable(row: PublishedStoreRow): PublicationResult {
  if (row.is_banned) {
    return { ok: false, status: 400, error: 'This store is suspended by administration and cannot be published.' };
  }
  if (!isValidStoreSlug(row.slug)) {
    return { ok: false, status: 400, error: 'The store slug is invalid or reserved.' };
  }
  return { ok: true };
}

export function publicationStatus(action: PublicationAction): 'published' | 'draft' {
  return action === 'publish' ? 'published' : 'draft';
}

export function publicationResponse(input: {
  store: PublishedStoreRow;
  action: PublicationAction;
  host?: string | null;
  config?: Parameters<typeof buildStoreBaseUrl>[0]['config'];
}) {
  const status = publicationStatus(input.action);
  const baseUrl = buildStoreBaseUrl({
    slug: input.store.slug,
    host: input.host,
    config: input.config,
  });
  const verifiedDomain =
    input.store.domain_status === 'verified' && input.store.custom_domain
      ? `https://${input.store.custom_domain}`
      : null;

  return {
    id: input.store.id,
    slug: input.store.slug,
    status,
    is_published: status === 'published',
    public_url: status === 'published' ? baseUrl : null,
    wildcard_url: status === 'published' ? baseUrl : null,
    custom_domain_url: status === 'published' ? verifiedDomain : null,
    published_at: input.action === 'publish' ? new Date().toISOString() : null,
    unpublished_at: input.action === 'unpublish' ? new Date().toISOString() : null,
  };
}
