/** One project resolves to exactly one owned store. */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidStoreSlug } from './tenant';

export interface ProjectStoreResolution {
  ok: boolean;
  status: 200 | 201 | 401 | 403 | 404 | 409 | 500;
  store?: Record<string, unknown>;
  is_new?: boolean;
  error?: string;
}

interface ProjectRow {
  id: string;
  owner_id: string;
  title?: string | null;
  category?: string | null;
}

function slugCandidates(projectId: string, title?: string | null): string[] {
  const base = `store-${projectId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase() || 'shop'}`;
  const names = [base];
  const fromTitle = (title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  if (isValidStoreSlug(fromTitle)) names.unshift(fromTitle);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    names.push(`${base.slice(0, 24)}-${attempt}`);
  }
  return [...new Set(names)].filter(isValidStoreSlug);
}

/**
 * Resolve by project_id, never by owner_id alone. Owner/admin is checked
 * against the project before a store is provisioned for the project owner.
 */
export async function resolveProjectStore(
  supabase: SupabaseClient,
  projectId: string,
  actorId: string,
  isAdmin: boolean,
): Promise<ProjectStoreResolution> {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, owner_id, title, category')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError || !project) return { ok: false, status: 404, error: 'Project not found' };
  const row = project as unknown as ProjectRow;
  if (row.owner_id !== actorId && !isAdmin) {
    return { ok: false, status: 403, error: 'Forbidden: You do not own this project' };
  }

  const { data: existing, error: lookupError } = await supabase
    .from('stores')
    .select('*')
    .eq('project_id', projectId)
    .eq('owner_id', row.owner_id)
    .limit(1)
    .maybeSingle();

  if (lookupError) return { ok: false, status: 500, error: lookupError.message };
  if (existing) return { ok: true, status: 200, store: existing as Record<string, unknown>, is_new: false };

  let lastError: string | null = null;
  for (const slug of slugCandidates(projectId, row.title)) {
    const { data, error } = await supabase
      .from('stores')
      .insert({
        owner_id: row.owner_id,
        project_id: projectId,
        name: row.title?.trim() || `${row.category || 'Retail'} Store`,
        slug,
        status: 'draft',
        currency: 'PKR',
        theme_config: {},
        theme_config_version: 0,
        seo_config: {},
      })
      .select('*')
      .single();

    if (!error && data) return { ok: true, status: 201, store: data as Record<string, unknown>, is_new: true };
    lastError = error?.message ?? 'Unknown store provisioning error.';
    const code = (error as { code?: string } | null)?.code;
    if (code !== '23505') break;
  }

  return { ok: false, status: 500, error: lastError ?? 'Unable to provision store.' };
}
