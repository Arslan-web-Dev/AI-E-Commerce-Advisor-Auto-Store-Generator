/** Owner-scoped Module 7 persistence for drafts, current config and history. */

import { randomUUID } from 'node:crypto';
import { sanitizeUntrustedText } from '@/lib/ai/prompt-hygiene';
import {
  answersEqual,
  assertValidAnswerDraft,
  assertValidAnswers,
  assertValidThemeConfiguration,
  isValidAnswerDraft,
  isValidThemeConfiguration,
  THEME_SCHEMA_VERSION,
  type ThemeAnswers,
  type ThemeConfiguration,
} from './schema';

type DBError = { message?: string; code?: string } | null;
type DatabaseRow = Record<string, unknown>;

export type ThemePersistenceErrorCode =
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'database';

export class ThemePersistenceError extends Error {
  readonly code: ThemePersistenceErrorCode;
  readonly status: number;

  constructor(code: ThemePersistenceErrorCode, message: string, status = 400) {
    super(message);
    this.name = 'ThemePersistenceError';
    this.code = code;
    this.status = status;
  }
}

export type ThemeHistoryEntry = {
  id: string;
  version: number;
  label: string;
  createdAt: string;
  valid: boolean;
  configuration: unknown;
};

export type ThemeState = {
  project: { id: string; name: string; category: string };
  draft: { answers: Partial<ThemeAnswers> | null; step: number };
  configuration: ThemeConfiguration | null;
  store: { id: string; name: string; status: string; version: number } | null;
  history: ThemeHistoryEntry[];
};

export type SavedTheme = {
  storeId: string;
  version: number;
  previousPreserved: boolean;
  configuration: ThemeConfiguration;
};

/** Minimal structural contract; production uses the cookie-backed Supabase client. */
export type SupabaseLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
};

function throwDatabase(table: string, error: DBError): never {
  if (error?.code === '23505') {
    throw new ThemePersistenceError('conflict', `A unique ${table} record already exists.`, 409);
  }
  const message = sanitizeUntrustedText(error?.message, 160) || `The ${table} query failed.`;
  throw new ThemePersistenceError('database', message, 500);
}

function normalizeLabel(value: unknown, fallback: string): string {
  const candidate = sanitizeUntrustedText(value, 80);
  return candidate.length >= 2 ? candidate : sanitizeUntrustedText(fallback, 80).slice(0, 80);
}

function buildSlug(name: string, projectId: string, attempt: number): string {
  const base = sanitizeUntrustedText(name, 24)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18) || 'theme';
  const suffix = `${projectId.replace(/-/g, '').slice(0, 9)}${attempt > 0 ? randomUUID().slice(0, 4).replace(/-/g, 'a') : ''}`;
  let slug = `${base}-${suffix}`
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  if (slug.length < 3) slug = `theme-${slug || 'store'}`.slice(0, 30);
  slug = slug.replace(/[^a-z0-9]$/, '0');
  return slug;
}

async function assertProjectOwnership(
  supabase: SupabaseLike,
  projectId: string,
  ownerId: string,
): Promise<{ id: string; name: string; category: string }> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, category, custom_category, owner_id')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throwDatabase('project', error);
  if (!data) throw new ThemePersistenceError('not_found', 'Project not found.', 404);
  if (data.owner_id !== ownerId) {
    throw new ThemePersistenceError('forbidden', 'You do not own this project.', 403);
  }

  const category = normalizeLabel(
    data.custom_category || data.category,
    'general store',
  );
  return {
    id: String(data.id),
    name: normalizeLabel(data.title, category),
    category,
  };
}

async function findStore(
  supabase: SupabaseLike,
  projectId: string,
  ownerId: string,
): Promise<DatabaseRow | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, project_id, owner_id, status, theme_config, theme_config_version, updated_at')
    .eq('project_id', projectId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error) throwDatabase('store', error);
  return (data as DatabaseRow | null) ?? null;
}

async function createStore(
  supabase: SupabaseLike,
  project: { id: string; name: string },
  ownerId: string,
): Promise<DatabaseRow> {
  let lastError: DBError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from('stores')
      .insert({
        owner_id: ownerId,
        project_id: project.id,
        name: project.name,
        slug: buildSlug(project.name, project.id, attempt),
        status: 'draft',
        theme_config: {},
        theme_config_version: 0,
        currency: 'PKR',
      })
      .select('id, name, project_id, owner_id, status, theme_config, theme_config_version, updated_at')
      .single();

    if (!error && data) return data as DatabaseRow;
    lastError = error;
    if (!error || error.code !== '23505') break;
  }
  throwDatabase('store', lastError);
}

async function nextVersion(supabase: SupabaseLike, storeId: string): Promise<number> {
  const { data, error } = await supabase
    .from('store_draft_versions')
    .select('version_number, version_label')
    .eq('store_id', storeId)
    .order('version_number', { ascending: false })
    .limit(20);

  if (error) throwDatabase('theme history', error);
  let highest = 0;
  for (const row of data ?? []) {
    const numeric = Number(row?.version_number);
    const labelled = Number(String(row?.version_label ?? '').replace(/^v/i, ''));
    const value = Number.isFinite(numeric) ? numeric : labelled;
    if (Number.isFinite(value) && value > highest) highest = value;
  }
  return highest + 1;
}

async function insertHistory(
  supabase: SupabaseLike,
  input: {
    storeId: string;
    projectId: string;
    ownerId: string;
    version: number;
    manifest: unknown;
  },
): Promise<void> {
  const { error } = await supabase
    .from('store_draft_versions')
    .insert({
      store_id: input.storeId,
      project_id: input.projectId,
      wizard_session_id: null,
      manifest: input.manifest,
      manifest_version: isValidThemeConfiguration(input.manifest)
        ? input.manifest.schemaVersion
        : 'legacy',
      compile_status: 'compiled',
      compile_errors: null,
      approval_ref: null,
      version_number: input.version,
      version_label: `v${input.version}`,
    });

  if (error) throwDatabase('theme history', error);
}

export async function getThemeState(
  supabase: SupabaseLike,
  projectId: string,
  ownerId: string,
): Promise<ThemeState> {
  const project = await assertProjectOwnership(supabase, projectId, ownerId);
  const store = await findStore(supabase, projectId, ownerId);

  const sessionResult = await supabase
    .from('store_wizard_sessions')
    .select('answers, current_step')
    .eq('project_id', projectId)
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (sessionResult.error) throwDatabase('wizard session', sessionResult.error);

  const session = sessionResult.data?.[0] ?? null;
  const draftAnswers = isValidAnswerDraft(session?.answers) ? session.answers : null;
  const stepValue = Number(session?.current_step);
  const draft = {
    answers: draftAnswers,
    step: Number.isInteger(stepValue) && stepValue >= 1 && stepValue <= 4 ? stepValue : 1,
  };

  let history: ThemeHistoryEntry[] = [];
  if (store) {
    const historyResult = await supabase
      .from('store_draft_versions')
      .select('id, version_number, version_label, manifest, created_at')
      .eq('store_id', store.id)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (historyResult.error) throwDatabase('theme history', historyResult.error);
    history = (historyResult.data ?? []).map((row: DatabaseRow) => {
      const numbered = Number(row?.version_number);
      const labelled = Number(String(row?.version_label ?? '').replace(/^v/i, ''));
      const version = Number.isFinite(numbered) && numbered > 0 ? numbered : labelled;
      return {
        id: String(row?.id ?? ''),
        version: Number.isFinite(version) && version > 0 ? version : 0,
        label: String(row?.version_label ?? (Number.isFinite(version) ? `v${version}` : 'legacy')),
        createdAt: String(row?.created_at ?? ''),
        valid: isValidThemeConfiguration(row?.manifest),
        configuration: row?.manifest ?? null,
      };
    });
  }

  const storedConfig = store?.theme_config;
  const configuration = isValidThemeConfiguration(storedConfig) ? storedConfig : null;
  return {
    project,
    draft,
    configuration,
    store: store
      ? {
          id: String(store.id),
          name: String(store.name ?? project.name),
          status: String(store.status ?? 'draft'),
          version: Number(store.theme_config_version ?? 0),
        }
      : null,
    history,
  };
}

export async function saveWizardDraft(
  supabase: SupabaseLike,
  projectId: string,
  ownerId: string,
  answers: Partial<ThemeAnswers>,
  step: number,
): Promise<{ answers: Partial<ThemeAnswers>; step: number }> {
  assertValidAnswerDraft(answers);
  if (!Number.isInteger(step) || step < 1 || step > 4) {
    throw new ThemePersistenceError('validation', 'Wizard step must be between 1 and 4.');
  }
  await assertProjectOwnership(supabase, projectId, ownerId);

  const payload = {
    owner_id: ownerId,
    project_id: projectId,
    answers,
    answers_version: THEME_SCHEMA_VERSION,
    current_step: step,
    status: 'in_progress',
    updated_at: new Date().toISOString(),
  };

  const existing = await supabase
    .from('store_wizard_sessions')
    .select('id')
    .eq('project_id', projectId)
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throwDatabase('wizard session', existing.error);

  if (existing.data?.id) {
    const { error } = await supabase
      .from('store_wizard_sessions')
      .update(payload)
      .eq('id', existing.data.id);
    if (error) throwDatabase('wizard session', error);
  } else {
    const { error } = await supabase.from('store_wizard_sessions').insert(payload);
    if (error) throwDatabase('wizard session', error);
  }

  return { answers, step };
}

export async function saveThemeConfiguration(
  supabase: SupabaseLike,
  projectId: string,
  ownerId: string,
  answers: ThemeAnswers,
  configuration: ThemeConfiguration,
): Promise<SavedTheme> {
  assertValidAnswers(answers);
  assertValidThemeConfiguration(configuration);
  if (!answersEqual(answers, configuration.answers)) {
    throw new ThemePersistenceError('validation', 'Configuration answers do not match the current wizard answers.');
  }

  const project = await assertProjectOwnership(supabase, projectId, ownerId);
  const existingStore = await findStore(supabase, projectId, ownerId);
  if (existingStore && String(existingStore.status) === 'published') {
    throw new ThemePersistenceError('conflict', 'A published store cannot be silently replaced.', 409);
  }
  const store = existingStore ?? await createStore(supabase, project, ownerId);

  const previous = store?.theme_config;
  const hasPrevious = previous && typeof previous === 'object' && Object.keys(previous).length > 0;
  const version = await nextVersion(supabase, String(store.id));
  if (hasPrevious) {
    await insertHistory(supabase, {
      storeId: String(store.id),
      projectId,
      ownerId,
      version,
      manifest: previous,
    });
  }

  const { data, error } = await supabase
    .from('stores')
    .update({
      theme_config: configuration,
      theme_config_version: version,
      theme_updated_at: new Date().toISOString(),
    })
    .eq('id', store.id)
    .eq('owner_id', ownerId)
    .select('id, name, status, theme_config_version')
    .single();

  if (error) throwDatabase('store', error);
  if (!data) throw new ThemePersistenceError('not_found', 'Store could not be updated.', 404);

  return {
    storeId: String(data.id),
    version: Number(data.theme_config_version ?? version),
    previousPreserved: Boolean(hasPrevious),
    configuration,
  };
}

export const getThemeProject = assertProjectOwnership;
