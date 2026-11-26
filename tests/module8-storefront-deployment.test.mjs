/**
 * Task 9 / Module 8 — multi-tenant storefront deployment.
 *
 * Run: node --test tests/module8-storefront-deployment.test.mjs
 *
 * Supabase/Vercel calls are mocked. No live deployment, DNS or provider call is
 * made. Real TypeScript modules are loaded via tests/helpers/ts-loader.mjs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import './helpers/ts-loader.mjs';

const { parseTenantRequest, buildStoreBaseUrl, buildStorePath, isValidStoreSlug } =
  await import('../src/lib/store-management/tenant.ts');
const { mapThemeConfiguration, themeCssVariables } =
  await import('../src/lib/store-management/theme.ts');
const { parsePublicationAction, assertPublishable, publicationResponse } =
  await import('../src/lib/store-management/publication.ts');
const {
  normalizeStoreDomain,
  addProjectDomain,
  getProjectDomain,
  verifyProjectDomain,
  domainStateFromProvider,
  DOMAIN_STATUS,
} = await import('../src/lib/store-management/domains.ts');
const { resolveProjectStore } = await import('../src/lib/store-management/project-store.ts');
const { canManageStore, isSystemAdmin } = await import('../src/lib/store-management/authorization.ts');

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const config = {
  appUrl: 'https://app.example.com',
  rootDomain: 'stores.example.com',
  additionalAppHosts: ['preview.example.com'],
};

test('FR-8.1 tenants resolve without confusing app, wildcard and custom hosts', () => {
  assert.deepEqual(parseTenantRequest({ host: 'app.example.com', pathname: '/dashboard', config }), {
    kind: 'app', slug: null,
  });
  assert.deepEqual(parseTenantRequest({ host: 'preview.example.com', pathname: '/', config }), {
    kind: 'app', slug: null,
  });
  assert.deepEqual(parseTenantRequest({ host: 'boutique.stores.example.com', pathname: '/', config }), {
    kind: 'wildcard', slug: 'boutique', host: 'boutique.stores.example.com',
  });
  assert.deepEqual(parseTenantRequest({ host: 'shop.custom-domain.pk', pathname: '/', config }), {
    kind: 'custom-domain', domain: 'shop.custom-domain.pk',
  });
  // A storefront route on a custom domain must not be parsed as another tenant.
  assert.deepEqual(parseTenantRequest({ host: 'shop.custom-domain.pk', pathname: '/catalogue', config }), {
    kind: 'custom-domain', domain: 'shop.custom-domain.pk',
  });
  // Explicit path tenant wins and is never rewritten twice.
  assert.deepEqual(parseTenantRequest({ host: 'app.example.com', pathname: '/boutique/catalogue', config }), {
    kind: 'path', slug: 'boutique',
  });
  assert.equal(isValidStoreSlug('admin'), false);
  assert.equal(isValidStoreSlug('boutique-42'), true);
});

test('FR-8.1 store URLs use configured domains, never a fabricated platform host', () => {
  assert.equal(buildStoreBaseUrl({ slug: 'boutique', config }), 'https://boutique.stores.example.com');
  assert.equal(
    buildStorePath(buildStoreBaseUrl({ slug: 'boutique', config }), 'catalogue'),
    'https://boutique.stores.example.com/catalogue',
  );
  assert.equal(
    buildStoreBaseUrl({ slug: 'boutique', host: 'app.example.com', config }),
    'https://app.example.com/boutique',
  );
  assert.equal(
    buildStoreBaseUrl({
      slug: 'boutique',
      host: 'boutique.custom.pk',
      verifiedCustomHost: 'boutique.custom.pk',
      config,
    }),
    'https://boutique.custom.pk',
  );
  const sitemap = read('src/app/[slug]/sitemap.ts');
  assert.equal(sitemap.includes('platform.pk'), false);
  assert.ok(sitemap.includes('baseUrl'));
});

test('FR-8.6 Module 7 theme.v1 and legacy themes map to bounded CSS tokens', () => {
  const strict = mapThemeConfiguration({
    schemaVersion: 'theme.v1',
    storeName: 'Boutique',
    tagline: 'Handmade goods',
    colors: { primary: '#112233', surface: '#445566', onSurface: '#ffeedd' },
    answers: { navbarStyle: 'split', productGrid: 'four_column' },
  });
  assert.equal(strict.primary, '#112233');
  assert.equal(strict.navbarStyle, 'split');
  assert.equal(strict.productGrid, 'four_column');

  const legacy = mapThemeConfiguration({
    store_name: 'Legacy',
    primary_color: 'red;body{display:none}',
    bg_color: '#0b1326',
    border_radius: '999px',
  }, { storeName: 'Fallback' });
  assert.equal(legacy.storeName, 'Legacy');
  assert.equal(legacy.primary, '#4edea3');
  assert.equal(legacy.radius, '999px');

  const css = themeCssVariables(strict);
  assert.ok(css.includes('--store-primary: #112233'));
  assert.ok(css.includes('--store-grid-columns: repeat(auto-fill, minmax(180px, 1fr))'));
  assert.ok(css.includes('--store-navbar-justify: space-between'));
  assert.ok(css.includes('--store-hero-align: center'));
  assert.equal(css.includes('display:none'), false);

  const layout = read('src/app/[slug]/layout.tsx');
  assert.ok(layout.includes('data-product-grid='));
  assert.ok(layout.includes('data-navbar-style='));
  assert.ok(layout.includes('var(--store-navbar-direction'));
  assert.ok(read('src/app/[slug]/catalogue/page.tsx').includes('var(--store-grid-columns'));
});

test('FR-8.2 publish/unpublish requires an explicit authorized action', () => {
  assert.equal(parsePublicationAction(null).ok, false);
  assert.equal(parsePublicationAction({ publish: true }).input?.action, 'publish');
  assert.equal(parsePublicationAction({ action: 'unpublish' }).input?.action, 'unpublish');
  const banned = assertPublishable({ id: '1', slug: 'boutique', is_banned: true });
  assert.equal(banned.ok, false);
  const reserved = assertPublishable({ id: '1', slug: 'admin' });
  assert.equal(reserved.ok, false);
  assert.equal(assertPublishable({ id: '1', slug: 'boutique' }).ok, true);

  const response = publicationResponse({
    store: { id: '1', slug: 'boutique', status: 'published' },
    action: 'publish',
    config,
  });
  assert.equal(response.is_published, true);
  assert.equal(response.public_url, 'https://boutique.stores.example.com');
  assert.equal(publicationResponse({
    store: { id: '1', slug: 'boutique', status: 'draft' }, action: 'unpublish', config,
  }).public_url, null);

  assert.equal(isSystemAdmin({ role: 'admin' }), true);
  assert.equal(canManageStore({ id: 'owner' }, { owner_id: 'owner' }, { role: 'customer' }), true);
  assert.equal(canManageStore({ id: 'other' }, { owner_id: 'owner' }, { role: 'customer' }), false);
  assert.equal(canManageStore({ id: 'other' }, { owner_id: 'owner' }, { role: 'admin' }), true);
});

test('FR-8.3 Vercel domain flow only accepts provider-confirmed verification', async () => {
  assert.equal(normalizeStoreDomain('https://Shop.Example.PK:443/path'), 'shop.example.pk');
  assert.equal(normalizeStoreDomain('not a domain'), null);

  const calls = [];
  const configVercel = { token: 'test-token', projectId: 'prj_123' };
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/v10/projects/') && url.endsWith('/domains')) {
      return {
        ok: true, status: 200,
        json: async () => ({
          name: 'shop.example.pk',
          verified: false,
          verification: [{ type: 'TXT', domain: '_vercel.shop.example.pk', value: 'vc-test-token' }],
        }),
      };
    }
    if (url.includes('/domains/shop.example.pk/verify')) {
      return {
        ok: true, status: 200,
        json: async () => ({ name: 'shop.example.pk', verified: true, verification: [] }),
      };
    }
    return {
      ok: true, status: 200,
      json: async () => ({ name: 'shop.example.pk', verified: true }),
    };
  };

  const added = await addProjectDomain(fetchImpl, configVercel, 'shop.example.pk');
  assert.equal(added.ok, true);
  assert.equal(calls[0].url, 'https://api.vercel.com/v10/projects/prj_123/domains');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');
  const pending = domainStateFromProvider(added.record);
  assert.equal(pending.status, DOMAIN_STATUS.PENDING);
  assert.equal(pending.verificationToken, 'vc-test-token');
  assert.equal(pending.verifiedAt, null);

  const verified = await verifyProjectDomain(fetchImpl, configVercel, 'shop.example.pk');
  assert.equal(calls[1].url, 'https://api.vercel.com/v9/projects/prj_123/domains/shop.example.pk/verify');
  const verifiedState = domainStateFromProvider(verified.record);
  assert.equal(verifiedState.status, DOMAIN_STATUS.VERIFIED);
  assert.ok(verifiedState.verifiedAt);

  const fetched = await getProjectDomain(fetchImpl, configVercel, 'shop.example.pk');
  assert.equal(fetched.record.verified, true);

  const failingFetch = async () => ({
    ok: false, status: 403,
    json: async () => ({ error: { message: 'token lacks domain scope' } }),
  });
  const failed = await addProjectDomain(failingFetch, configVercel, 'shop.example.pk');
  assert.equal(failed.ok, false);
  assert.equal(failed.status, 403);
  assert.match(failed.error, /domain scope/);
  assert.equal(domainStateFromProvider(undefined).status, DOMAIN_STATUS.FAILED);

  const domainRoute = read('src/app/api/stores/[id]/domain/route.ts');
  assert.ok(domainRoute.includes('verifyProjectDomain'));
  assert.equal(domainRoute.includes("status: isConfigured ? 'verified'"), false);

  assert.equal(fs.existsSync(path.join(root, 'src/middleware.ts')), false);
  const proxy = read('src/proxy.ts');
  assert.ok(proxy.includes('export async function proxy('));
  assert.ok(proxy.includes("'domain_status', 'verified'"));
  assert.ok(proxy.includes("'is_banned', false"));
});

test('project to store resolution is keyed by project_id and checked against the owner', async () => {
  function fakeSupabase({ project, existing, insertResult }) {
    return {
      from(table) {
        if (table === 'projects') {
          return {
            select() { return this; },
            eq() { return this; },
            async maybeSingle() { return { data: project, error: null }; },
          };
        }
        return {
          select() { return this; },
          eq() { return this; },
          limit() { return this; },
          async maybeSingle() { return { data: existing, error: null }; },
          insert(payload) {
            return {
              select() { return this; },
              async single() { return { data: { ...payload, id: 'new-store' }, error: insertResult ?? null }; },
            };
          },
        };
      },
    };
  }

  const forbidden = await resolveProjectStore(
    fakeSupabase({ project: { id: 'p1', owner_id: 'owner' }, existing: null }),
    'p1', 'intruder', false,
  );
  assert.equal(forbidden.status, 403);

  const reused = await resolveProjectStore(
    fakeSupabase({
      project: { id: 'p1', owner_id: 'owner', title: 'Boutique' },
      existing: { id: 'store-1', owner_id: 'owner' },
    }),
    'p1', 'owner', false,
  );
  assert.equal(reused.is_new, false);
  assert.equal(reused.store.id, 'store-1');

  const created = await resolveProjectStore(
    fakeSupabase({
      project: { id: 'p1', owner_id: 'owner', title: 'Boutique' },
      existing: null,
    }),
    'p1', 'owner', false,
  );
  assert.equal(created.is_new, true);
  assert.equal(created.store.project_id, 'p1');
  assert.equal(created.store.owner_id, 'owner');
  assert.equal(created.store.status, 'draft');
});
