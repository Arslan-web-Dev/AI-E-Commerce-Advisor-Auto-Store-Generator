/**
 * Task 8 / Module 7 — Interactive MCQ Component & Theme Configurator.
 *
 * Run with: node --test tests/module7-theme-configurator.test.mjs
 *
 * All Groq traffic and Supabase queries are mocked in-process. No paid provider,
 * live database, browser session or deployed runtime is contacted. Runtime checks
 * import the real TypeScript modules through tests/helpers/ts-loader.mjs.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import './helpers/ts-loader.mjs';

const {
  clearAIResponseCache,
  InvalidAIOutputError,
  resetAIResilienceState,
  validateAIOutput,
} = await import('../src/lib/ai/gateway/index.ts');
const {
  MODULE7_OPTION_COUNTS,
  PALETTE_OPTIONS,
} = await import('../src/lib/theme/options.ts');
const {
  THEME_OUTPUT_SCHEMA,
  assertValidThemeConfiguration,
  isValidThemeConfiguration,
} = await import('../src/lib/theme/schema.ts');
const {
  contrastRatio,
  evaluatePaletteContrast,
} = await import('../src/lib/theme/contrast.ts');
const { generateThemeConfiguration } = await import('../src/lib/theme/generator.ts');
const {
  getThemeProject,
  getThemeState,
  saveThemeConfiguration,
  saveWizardDraft,
  ThemePersistenceError,
} = await import('../src/lib/theme/persistence.ts');

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const ENV_KEYS = [
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'AI_ADVISORY_PROVIDERS',
  'AI_USER_HOURLY_QUOTA',
  'AI_PROMPT_VERSION',
];
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const savedFetch = globalThis.fetch;
let fetchHandler = () => { throw new Error('Unexpected unmocked fetch call.'); };
let fetchCalls = [];

globalThis.fetch = async (input, init) => {
  fetchCalls.push({ url: String(input), init });
  return fetchHandler(String(input), init);
};

function configureGroq() {
  process.env.GROQ_API_KEY = 'test-groq-key-module7';
  process.env.GROQ_MODEL = 'llama-3.3-70b-versatile-test';
  process.env.OPENAI_API_KEY = '';
  process.env.OPENAI_MODEL = '';
  process.env.GEMINI_API_KEY = '';
  process.env.GEMINI_MODEL = '';
  process.env.AI_ADVISORY_PROVIDERS = '';
  process.env.AI_USER_HOURLY_QUOTA = '1000';
  process.env.AI_PROMPT_VERSION = 'module7-test';
}

function clearState() {
  clearAIResponseCache();
  resetAIResilienceState();
  fetchCalls = [];
}

function groqResponse(content, model = 'llama-3.3-70b-versatile-test', status = 200) {
  return new Response(JSON.stringify({
    model,
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 12, completion_tokens: 8 },
  }), { status, headers: { 'content-type': 'application/json' } });
}

const ANSWERS = {
  paletteId: 'emerald_night',
  navbarStyle: 'split',
  heroStyle: 'split_focus',
  productGrid: 'three_column',
};

const MODEL_OUTPUT = {
  ...ANSWERS,
  primaryColor: '#34D399',
  secondaryColor: '#38BDF8',
  surfaceColor: '#07130F',
};

function makeConfiguration(overrides = {}) {
  const colors = {
    primary: '#34D399',
    secondary: '#38BDF8',
    surface: '#07130F',
    onPrimary: '#07130F',
    onSurface: '#FFFFFF',
  };
  return {
    schemaVersion: 'theme.v1',
    storeName: 'Lahore Studio',
    storeCategory: 'fashion',
    answers: ANSWERS,
    colors: overrides.colors ?? colors,
    generation: {
      provider: 'groq',
      model: 'llama-3.3-70b-versatile-test',
      fallback: false,
      promptVersion: 'theme-prompt-v1',
      generatedAt: '2026-11-26T10:00:00.000Z',
      attempts: 1,
      adjustedColors: [],
      contrast: {
        primaryOnSurface: 9.2,
        secondaryOnSurface: 8.1,
        onPrimaryOnPrimary: 9.2,
        onSurfaceOnSurface: 17.4,
      },
      originalColors: colors,
    },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeSupabase(seed = {}) {
  const tables = {
    projects: seed.projects ?? [{
      id: 'project-1',
      owner_id: 'user-1',
      title: 'Lahore Studio',
      category: 'fashion',
      custom_category: null,
    }],
    stores: seed.stores ?? [],
    store_wizard_sessions: seed.sessions ?? [],
    store_draft_versions: seed.history ?? [],
  };
  const calls = [];

  function matches(row, filters) {
    return Object.entries(filters).every(([key, value]) => row[key] === value);
  }

  function query(table) {
    let filters = {};
    let order = null;
    let limit = null;
    let mode = 'select';
    let pending = null;
    let writePayload = null;

    const listResult = () => {
      let rows = tables[table].filter((row) => matches(row, filters));
      if (order) {
        const [key, options] = order;
        rows = [...rows].sort((a, b) => {
          const left = a[key] ?? 0;
          const right = b[key] ?? 0;
          return options?.ascending === false ? right - left : left - right;
        });
      }
      if (limit !== null) rows = rows.slice(0, limit);
      return { data: rows, error: null };
    };

    const singleResult = () => {
      if (mode === 'insert' && pending?.data) return { data: pending.data, error: null };
      if (mode === 'update') {
        const rows = tables[table].filter((row) => matches(row, filters));
        const updated = { ...(rows[0] ?? {}), ...writePayload };
        if (rows[0]) Object.assign(rows[0], writePayload);
        return { data: rows.length ? updated : null, error: null };
      }
      const rows = listResult().data;
      return { data: rows[0] ?? null, error: null };
    };

    const api = {
      select() { calls.push(['select', table]); return api; },
      eq(key, value) { calls.push(['eq', table, key, value]); filters[key] = value; return api; },
      order(key, options) { calls.push(['order', table, key, options]); order = [key, options]; return api; },
      limit(value) { calls.push(['limit', table, value]); limit = value; return api; },
      maybeSingle() { calls.push(['maybeSingle', table]); return Promise.resolve(singleResult()); },
      single() { calls.push(['single', table]); return Promise.resolve(singleResult()); },
      insert(payload) {
        calls.push(['insert', table, payload]);
        mode = 'insert';
        writePayload = payload;
        const row = { id: randomUUID(), ...payload };
        tables[table].push(row);
        pending = { data: row, error: null };
        return api;
      },
      update(payload) {
        calls.push(['update', table, payload]);
        mode = 'update';
        writePayload = payload;
        return api;
      },
      then(resolve, reject) {
        calls.push(['await', table, mode]);
        const result = mode === 'insert' || mode === 'update' ? singleResult() : listResult();
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return api;
  }

  return {
    from: query,
    tables,
    calls,
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
  };
}

test('FR-7.1 approved option catalogs contain four visual choices per step', () => {
  assert.deepEqual(MODULE7_OPTION_COUNTS, { palette: 4, navbar: 4, hero: 4, productGrid: 4 });
  assert.equal(new Set(PALETTE_OPTIONS.map((option) => option.id)).size, 4);
  for (const option of PALETTE_OPTIONS) {
    assert.match(option.colors.primary, /^#[0-9A-Fa-f]{6}$/);
    assert.match(option.colors.surface, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('FR-7.2 strict theme schema rejects extra properties, bad enums and non-hex colours', () => {
  const valid = JSON.stringify(MODEL_OUTPUT);
  assert.equal(validateAIOutput(valid, THEME_OUTPUT_SCHEMA), JSON.stringify(MODEL_OUTPUT));
  assert.throws(
    () => validateAIOutput(JSON.stringify({ ...MODEL_OUTPUT, injected: '<script>' }), THEME_OUTPUT_SCHEMA),
    InvalidAIOutputError,
  );
  assert.throws(
    () => validateAIOutput(JSON.stringify({ ...MODEL_OUTPUT, paletteId: 'unknown' }), THEME_OUTPUT_SCHEMA),
    InvalidAIOutputError,
  );
  assert.throws(
    () => validateAIOutput(JSON.stringify({ ...MODEL_OUTPUT, primaryColor: 'red; color:blue' }), THEME_OUTPUT_SCHEMA),
    InvalidAIOutputError,
  );
});

test('FR-7.5 WCAG contrast math and deterministic AA adjustment', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  const adjusted = evaluatePaletteContrast({
    primary: '#EEEEEE',
    secondary: '#DDDDDD',
    surface: '#FFFFFF',
    onPrimary: '#FFFFFF',
    onSurface: '#FFFFFF',
  });
  assert.ok(adjusted.contrast.primaryOnSurface >= 3);
  assert.ok(adjusted.contrast.secondaryOnSurface >= 3);
  assert.ok(adjusted.contrast.onPrimaryOnPrimary >= 4.5);
  assert.ok(adjusted.contrast.onSurfaceOnSurface >= 4.5);
  assert.ok(adjusted.adjustedColors.includes('primary'));
  assert.ok(adjusted.adjustedColors.includes('onSurface'));
  assert.notDeepEqual(adjusted.colors, adjusted.originalColors);
});

test('FR-7.2/FR-7.5 Groq success uses env model and produces a validated accessible configuration', async () => {
  configureGroq();
  clearState();
  fetchHandler = (url) => {
    assert.ok(url.includes('api.groq.com'));
    return groqResponse(JSON.stringify(MODEL_OUTPUT));
  };

  const configuration = await generateThemeConfiguration({
    storeName: 'Lahore Studio',
    storeCategory: 'fashion',
    answers: ANSWERS,
    ownerId: 'user-1',
    now: new Date('2026-11-26T10:00:00.000Z'),
  });

  assert.equal(fetchCalls.length, 1);
  const body = JSON.parse(fetchCalls[0].init.body);
  assert.equal(body.model, process.env.GROQ_MODEL);
  assert.equal(body.messages.length, 2);
  assert.ok(body.messages[1].content.includes('Lahore Studio'));
  assert.ok(body.messages[1].content.includes('fashion'));
  assert.ok(body.messages[1].content.includes('emerald_night'));
  assert.ok(!('provider' in body) && !('modelId' in body));
  assert.equal(configuration.generation.provider, 'groq');
  assert.equal(configuration.generation.fallback, false);
  assert.equal(configuration.generation.attempts, 1);
  assert.deepEqual(configuration.answers, ANSWERS);
  assert.ok(configuration.generation.contrast.primaryOnSurface >= 3);
  assert.ok(configuration.generation.contrast.onSurfaceOnSurface >= 4.5);
  assert.doesNotThrow(() => assertValidThemeConfiguration(configuration));
});

test('FR-7.3 invalid Groq output is retried once, then falls back to an approved preset', async () => {
  configureGroq();
  clearState();
  fetchHandler = () => groqResponse(JSON.stringify({ ...MODEL_OUTPUT, extra: 'not-allowed' }));

  const configuration = await generateThemeConfiguration({
    storeName: 'Lahore Studio',
    storeCategory: 'fashion',
    answers: ANSWERS,
    ownerId: 'user-1',
  });

  assert.equal(fetchCalls.length, 2, 'theme policy must attempt exactly two Groq requests');
  assert.equal(configuration.generation.fallback, true);
  assert.equal(configuration.generation.provider, 'rule_fallback');
  assert.equal(configuration.generation.model, 'deterministic');
  assert.equal(configuration.generation.attempts, 2);
  assert.deepEqual(configuration.answers, ANSWERS);
  assert.equal(configuration.colors.primary, '#34D399');
  assert.doesNotThrow(() => assertValidThemeConfiguration(configuration));
});

test('FR-7.3 unavailable Groq is retried once and falls back without an infinite loop', async () => {
  configureGroq();
  clearState();
  fetchHandler = () => groqResponse('{"error":"unavailable"}', 'llama-3.3-70b-versatile-test', 503);

  const configuration = await generateThemeConfiguration({
    storeName: 'Lahore Studio',
    storeCategory: 'fashion',
    answers: ANSWERS,
    ownerId: 'user-1',
  });

  assert.equal(fetchCalls.length, 2);
  assert.equal(configuration.generation.fallback, true);
  assert.equal(configuration.generation.attempts, 2);
});

test('FR-7.3 unconfigured Groq uses deterministic fallback with no external call', async () => {
  configureGroq();
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_MODEL;
  clearState();
  fetchHandler = () => { throw new Error('No provider call expected.'); };

  const configuration = await generateThemeConfiguration({
    storeName: 'Lahore Studio',
    storeCategory: 'fashion',
    answers: ANSWERS,
    ownerId: 'user-1',
  });

  assert.equal(fetchCalls.length, 0);
  assert.equal(configuration.generation.fallback, true);
  assert.equal(configuration.generation.attempts, 0);
  assert.doesNotThrow(() => assertValidThemeConfiguration(configuration));
});

test('FR-7.4/FR-7.6 GET loads only owner-scoped current config, draft and history', async () => {
  const previous = makeConfiguration();
  const supabase = createFakeSupabase({
    stores: [{
      id: 'store-1',
      owner_id: 'user-1',
      project_id: 'project-1',
      name: 'Lahore Studio',
      status: 'draft',
      theme_config: clone(previous),
      theme_config_version: 1,
      updated_at: '2026-11-26T09:00:00.000Z',
    }],
    sessions: [{
      id: 'session-1',
      owner_id: 'user-1',
      project_id: 'project-1',
      answers: { paletteId: 'ocean_blue' },
      current_step: 2,
      updated_at: '2026-11-26T09:30:00.000Z',
    }],
    history: [{
      id: 'version-1',
      store_id: 'store-1',
      project_id: 'project-1',
      version_number: 1,
      version_label: 'v1',
      manifest: clone(previous),
      created_at: '2026-11-26T09:00:00.000Z',
    }],
  });

  const state = await getThemeState(supabase, 'project-1', 'user-1');
  assert.equal(state.project.name, 'Lahore Studio');
  assert.deepEqual(state.draft.answers, { paletteId: 'ocean_blue' });
  assert.equal(state.draft.step, 2);
  assert.ok(isValidThemeConfiguration(state.configuration));
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].valid, true);
  assert.equal(state.history[0].version, 1);
  assert.ok(supabase.calls.some((call) => call[0] === 'eq' && call[2] === 'owner_id' && call[3] === 'user-1'));
});

test('FR-7.1 partial wizard selections persist across steps with a schema version', async () => {
  const supabase = createFakeSupabase();
  const saved = await saveWizardDraft(supabase, 'project-1', 'user-1', { paletteId: 'rose_brand' }, 2);
  assert.deepEqual(saved.answers, { paletteId: 'rose_brand' });
  const session = supabase.tables.store_wizard_sessions[0];
  assert.equal(session.answers_version, 'theme.v1');
  assert.equal(session.current_step, 2);
  assert.equal(session.owner_id, 'user-1');
});

test('FR-7.6 saving a new configuration preserves the previous one as owner-scoped history', async () => {
  const previous = makeConfiguration();
  const replacement = makeConfiguration({
    colors: {
      primary: '#38BDF8',
      secondary: '#A78BFA',
      surface: '#071427',
      onPrimary: '#071427',
      onSurface: '#FFFFFF',
    },
  });
  const supabase = createFakeSupabase({
    stores: [{
      id: 'store-1',
      owner_id: 'user-1',
      project_id: 'project-1',
      name: 'Lahore Studio',
      status: 'draft',
      theme_config: clone(previous),
      theme_config_version: 1,
      updated_at: '2026-11-26T09:00:00.000Z',
    }],
    history: [{
      id: 'version-1',
      store_id: 'store-1',
      project_id: 'project-1',
      version_number: 1,
      version_label: 'v1',
      manifest: clone(previous),
      created_at: '2026-11-26T09:00:00.000Z',
    }],
  });

  const result = await saveThemeConfiguration(supabase, 'project-1', 'user-1', ANSWERS, replacement);
  assert.equal(result.previousPreserved, true);
  assert.equal(result.version, 2);
  assert.equal(supabase.tables.store_draft_versions.length, 2);
  assert.equal(supabase.tables.store_draft_versions[1].version_number, 2);
  assert.deepEqual(supabase.tables.store_draft_versions[1].manifest, clone(previous));
  assert.deepEqual(supabase.tables.stores[0].theme_config, clone(replacement));
  assert.equal(supabase.tables.stores[0].theme_config_version, 2);
});

test('FR-7.4 ownership and published-store guards reject unsafe writes', async () => {
  const foreign = createFakeSupabase({ projects: [{ id: 'project-1', owner_id: 'someone-else', title: 'Other', category: 'retail' }] });
  await assert.rejects(
    () => getThemeProject(foreign, 'project-1', 'user-1'),
    (error) => error instanceof ThemePersistenceError && error.code === 'forbidden',
  );

  const published = createFakeSupabase({
    stores: [{
      id: 'store-1',
      owner_id: 'user-1',
      project_id: 'project-1',
      name: 'Lahore Studio',
      status: 'published',
      theme_config: {},
      theme_config_version: 0,
    }],
  });
  await assert.rejects(
    () => saveThemeConfiguration(published, 'project-1', 'user-1', ANSWERS, makeConfiguration()),
    (error) => error instanceof ThemePersistenceError && error.code === 'conflict',
  );
});

test('FR-7.1–FR-7.6 client, API and migration source contracts', () => {
  const component = read('src/components/theme-configurator/ThemeConfigurator.tsx');
  for (const label of ['Colour palette', 'Navbar style', 'Hero section', 'Product grid layout']) {
    assert.ok(component.includes(label), `missing wizard step: ${label}`);
  }
  assert.ok(component.includes('LivePreview'));
  assert.ok(component.includes('aria-live="polite"'));
  assert.ok(component.includes('aria-current'));
  assert.ok(component.includes('Deterministic preset fallback'));
  assert.ok(component.includes('WCAG AA contrast'));
  assert.ok(component.includes('Saved history'));

  const route = read('src/app/api/projects/[id]/theme-configurator/route.ts');
  assert.ok(route.includes("action === 'save_draft'"));
  assert.ok(route.includes("action === 'generate'"));
  assert.ok(route.includes("action === 'save'"));
  assert.ok(route.includes('supabase.auth.getUser()'));
  assert.ok(!/body\.(model|provider|apiKey)/.test(route), 'client must not override provider or model');

  const page = read('src/app/projects/[id]/storefront-wizard/page.tsx');
  assert.ok(page.includes('<ThemeConfigurator'));

  const migration = read('supabase/migrations/20261126160000_module7_theme_configurator.sql');
  assert.ok(migration.includes('add column if not exists project_id'));
  assert.ok(migration.includes('add column if not exists theme_config_version'));
  assert.ok(migration.includes('add column if not exists version_number'));
  assert.ok(migration.includes('theme history snapshots are append-only'));
  assert.ok(migration.includes('Manual rollback'));
});

test.after(() => {
  globalThis.fetch = savedFetch;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  clearAIResponseCache();
  resetAIResilienceState();
});
