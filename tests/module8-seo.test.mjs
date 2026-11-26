/**
 * Task 9 / Module 8 — SEO-1..SEO-5 storefront metadata and crawl controls.
 * Run: node --test tests/module8-seo.test.mjs
 * Pure functions are exercised directly; no network call is made.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import './helpers/ts-loader.mjs';

const {
  SEO_LIMITS,
  validateSeoMetadata,
  serializeJsonLd,
  buildCanonicalUrl,
  buildRobotsDocument,
  computeStoreSeoScore,
  resolveSeoMetadata,
  normalizeStoredSeo,
  safeSeoKeywords,
  storeJsonLd,
  productJsonLd,
  breadcrumbJsonLd,
} = await import('../src/lib/store-management/seo.ts');

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const config = { appUrl: 'https://app.example.com', rootDomain: 'stores.example.com' };

test('SEO-1 metadata is bounded and rejects unsafe characters', () => {
  assert.equal(validateSeoMetadata('Boutique Store Pakistan', 'Handmade goods delivered across Punjab with cash on delivery.').valid, true);
  assert.equal(validateSeoMetadata('Short', 'x'.repeat(50)).valid, false);
  assert.equal(validateSeoMetadata('A'.repeat(15), 'x'.repeat(161)).valid, false);
  assert.equal(validateSeoMetadata('Bad </title>', 'x'.repeat(50)).valid, false);
  assert.equal(SEO_LIMITS.title.max, 60);
});

test('SEO-2 JSON-LD cannot terminate its script element', () => {
  const serialized = serializeJsonLd(storeJsonLd({
    name: '</script><script>alert(1)</script>',
    description: 'A & B',
    url: 'https://boutique.stores.example.com',
  }));
  assert.equal(serialized.includes('</script>'), false);
  assert.ok(serialized.includes('\\u003c/script\\u003e'));
  assert.ok(serialized.includes('\\u0026'));

  const product = productJsonLd({
    name: 'Shirt', description: 'Cotton shirt', url: 'https://boutique.stores.example.com/products/1',
    images: ['https://cdn.example.com/1.png'], pricePkr: 2500, inStock: true, sku: 'SH-1',
  });
  assert.equal(product.offers.priceCurrency, 'PKR');
  assert.equal(product.offers.availability, 'https://schema.org/InStock');

  const breadcrumbs = breadcrumbJsonLd([{ name: 'Home', url: 'https://example.com' }, { name: 'Shirt' }]);
  assert.equal(breadcrumbs.itemListElement[1].position, 2);
  assert.equal(Object.hasOwn(breadcrumbs.itemListElement[1], 'item'), false);
  const legacyComponent = read('src/components/store-management/SeoScore.tsx');
  assert.ok(legacyComponent.includes('computeSeoScore'));
});

test('SEO-3 canonical URLs and SEO-4 sitemap/robots use configured tenant domains', () => {
  assert.equal(
    buildCanonicalUrl({ slug: 'boutique', config, path: 'products/42' }),
    'https://boutique.stores.example.com/products/42',
  );
  assert.equal(
    buildCanonicalUrl({ slug: 'boutique', host: 'app.example.com', config }),
    'https://app.example.com/boutique',
  );
  const robots = buildRobotsDocument({
    slug: 'boutique',
    host: 'boutique.stores.example.com',
    config,
  });
  assert.equal(robots.sitemap, 'https://boutique.stores.example.com/sitemap.xml');
  assert.ok(robots.rules[0].disallow.includes('/checkout'));

  const sitemap = read('src/app/[slug]/sitemap.ts');
  assert.ok(sitemap.includes('getPublicStore'));
  assert.ok(sitemap.includes(".eq('status', 'published')") === false);
  assert.equal(sitemap.includes('platform.pk'), false);
  const layout = read('src/app/[slug]/layout.tsx');
  assert.ok(layout.includes('alternates: { canonical: store.baseUrl }'));
  assert.ok(layout.includes('serializeJsonLd'));
  assert.ok(layout.includes('themeCssVariables'));
});

test('SEO-5 score is transparent on-page readiness, not a ranking claim', () => {
  const perfect = computeStoreSeoScore({
    title: 'Boutique Store Pakistan',
    description: 'Handmade goods delivered across Punjab with cash on delivery.',
    keywords: ['handmade', 'boutique'],
    hasImage: true,
    hasCanonical: true,
    hasJsonLd: true,
    hasBreadcrumbs: true,
  });
  assert.equal(perfect.score, 100);
  assert.deepEqual(perfect.issues, []);

  const poor = computeStoreSeoScore({ title: 'x', description: 'y' });
  assert.ok(poor.score < 50);
  assert.ok(poor.issues.length >= 5);

  const tests = read('tests/module8-seo.test.mjs');
  assert.ok(tests.includes('not a ranking claim'));
});

test('stored SEO JSON is normalized before metadata or storage', () => {
  const resolved = resolveSeoMetadata({
    title: '</title>Short<script>',
    description: 'x'.repeat(300),
    fallbackTitle: 'Boutique Store Pakistan — Online Collection',
    fallbackDescription: 'Handmade goods delivered across Punjab with cash on delivery.',
  });
  assert.equal(resolved.validation.valid, true);
  assert.ok(resolved.title.length >= SEO_LIMITS.title.min && resolved.title.length <= SEO_LIMITS.title.max);
  assert.ok(resolved.description.length >= SEO_LIMITS.description.min && resolved.description.length <= SEO_LIMITS.description.max);
  assert.equal(/[<>\u0000-\u001F\u007F]/.test(resolved.title + resolved.description), false);

  const stored = normalizeStoredSeo(
    { meta_title: '', meta_description: 'x'.repeat(300), keywords: ['cotton', '</script>', 'cotton'] },
    'Cotton Shirt — Buy Online in Pakistan',
    'Cotton shirt with cash on delivery across Punjab, Pakistan.',
  );
  assert.equal(stored.validation === undefined, true);
  assert.deepEqual(stored.keywords, ['cotton']);
  assert.ok(stored.meta_title.length >= SEO_LIMITS.title.min);
  assert.equal(safeSeoKeywords(Array(20).fill('keyword')).length, 1, 'duplicates are removed');
  assert.equal(safeSeoKeywords(Array.from({ length: 20 }, (_, i) => `keyword-${i}`)).length, SEO_LIMITS.keywords.max);

  for (const route of [
    'src/app/api/stores/[id]/products/route.ts',
    'src/app/api/stores/[id]/products/[productId]/route.ts',
  ]) assert.ok(read(route).includes('normalizeStoredSeo'));
});

test('SEO-1 and SEO-4 are wired on every public route, including client pages', () => {
  const metadataRoutes = [
    'src/app/[slug]/layout.tsx',
    'src/app/[slug]/page.tsx',
    'src/app/[slug]/products/[id]/page.tsx',
    'src/app/[slug]/about/page.tsx',
    'src/app/[slug]/contact/page.tsx',
    'src/app/[slug]/catalogue/layout.tsx',
    'src/app/[slug]/cart/layout.tsx',
    'src/app/[slug]/checkout/layout.tsx',
    'src/app/[slug]/checkout/confirmation/layout.tsx',
  ];
  for (const route of metadataRoutes) {
    const source = read(route);
    assert.ok(source.includes('resolveSeoMetadata'), `${route} must validate metadata`);
    assert.ok(source.includes('alternates: { canonical'), `${route} must set its own canonical URL`);
  }
  const theme = read('src/lib/store-management/theme.ts');
  assert.ok(theme.includes('--store-grid-columns'));
  assert.ok(theme.includes('--store-hero-align'));
  assert.ok(theme.includes('--store-navbar-justify'));
  assert.ok(read('src/app/[slug]/catalogue/page.tsx').includes('var(--store-grid-columns'));
});

test('SEO-5 score is surfaced in owner and admin dashboards', () => {
  const overview = read('src/app/api/stores/[id]/overview/route.ts');
  assert.ok(overview.includes('computeStoreSeoScore'));
  assert.ok(overview.includes('seo_score: seoScore'));
  const adminStores = read('src/app/api/admin/stores/route.ts');
  assert.ok(adminStores.includes('computeStoreSeoScore'));
  assert.ok(adminStores.includes('seo_score:'));
  assert.ok(read('src/app/projects/[id]/store/page.tsx').includes('SEO Score Summary'));
  assert.ok(read('src/app/admin/page.tsx').includes('SEO'));
});

test('FR-8.9 AI description writer accepts review controls and runs keyword/length checks', () => {
  const route = read('src/app/api/stores/[id]/products/[productId]/description/route.ts');
  assert.ok(route.includes("body.tone"));
  assert.ok(route.includes("body.language === 'ur_roman'"));
  assert.ok(route.includes('safeSeoKeywords(body.keywords)'));
  assert.ok(route.includes('validateSeoMetadata'));
  assert.ok(route.includes('requiresReview: true'));
  assert.ok(route.includes('missingKeywords'));
  const page = read('src/app/projects/[id]/store/page.tsx');
  assert.ok(page.includes('Tone: Professional'));
  assert.ok(page.includes('Roman Urdu'));
  assert.ok(page.includes('Generate AI description (review before saving)'));
});

test('all eight public pages and APIs are checked in', () => {
  const pages = [
    'src/app/[slug]/page.tsx',
    'src/app/[slug]/catalogue/page.tsx',
    'src/app/[slug]/products/[id]/page.tsx',
    'src/app/[slug]/cart/page.tsx',
    'src/app/[slug]/checkout/page.tsx',
    'src/app/[slug]/checkout/confirmation/page.tsx',
    'src/app/[slug]/about/page.tsx',
    'src/app/[slug]/contact/page.tsx',
  ];
  for (const page of pages) assert.ok(fs.existsSync(path.join(root, page)), `missing ${page}`);
  for (const api of [
    'src/app/api/storefront/[slug]/products/route.ts',
    'src/app/api/storefront/[slug]/orders/route.ts',
    'src/app/api/stores/[id]/publish/route.ts',
    'src/app/api/stores/[id]/domain/route.ts',
  ]) assert.ok(fs.existsSync(path.join(root, api)), `missing ${api}`);
});
