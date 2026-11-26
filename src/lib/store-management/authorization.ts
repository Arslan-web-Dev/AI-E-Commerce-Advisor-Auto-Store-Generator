/** Shared owner/admin authorization predicates for store management APIs. */

export interface Actor {
  id: string;
  email?: string | null;
}

export interface StoreOwnership {
  owner_id: string;
  is_banned?: boolean | null;
}

export interface ProfileRole {
  role?: string | null;
}

export function isSystemAdmin(profile: ProfileRole | null | undefined): boolean {
  return profile?.role === 'admin';
}

/** Owner-or-admin rule used by every privileged Module 8 route. */
export function canManageStore(
  actor: Actor | null | undefined,
  store: StoreOwnership | null | undefined,
  profile: ProfileRole | null | undefined,
): boolean {
  if (!actor || !store) return false;
  return actor.id === store.owner_id || isSystemAdmin(profile);
}

export function actorLabel(actor: Actor | null | undefined): string {
  return actor?.email?.trim() || actor?.id || 'system';
}

export interface AuthorizationResult {
  ok: boolean;
  status: 401 | 403 | 404;
  error: string;
}

export function authorizationFailure(kind: 'unauthorized' | 'forbidden' | 'not_found'): AuthorizationResult {
  switch (kind) {
    case 'unauthorized':
      return { ok: false, status: 401, error: 'Unauthorized' };
    case 'forbidden':
      return { ok: false, status: 403, error: 'Forbidden: you do not manage this store' };
    default:
      return { ok: false, status: 404, error: 'Store not found' };
  }
}
