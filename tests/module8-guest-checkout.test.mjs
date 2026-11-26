/**
 * Task 9 / Module 8 — secure guest COD checkout.
 *
 * Run: node --test tests/module8-guest-checkout.test.mjs
 * Supabase RPC calls are mocked; no live database, payment or AI call occurs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import './helpers/ts-loader.mjs';

const {
  validateGuestCheckout,
  checkoutRpcArguments,
  createIdempotencyKey,
  placeGuestOrder,
  symbolicRpcCode,
} = await import('../src/lib/store-management/guest-checkout.ts');
const { validateProductImages } = await import('../src/lib/store-management/product-images.ts');

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const VALID_ITEMS = [{ product_id: '123e4567-e89b-42d3-a456-426614174000', quantity: 2 }];
const VALID_BODY = {
  customer_name: 'Ayesha Khan',
  phone: '+92 300 1234567',
  shipping_address: '12 Main Boulevard, Lahore',
  city: 'Lahore',
  notes: 'Call before delivery',
  items: VALID_ITEMS,
};

test('FR-8.7 guest checkout validates only customer input, never prices or status', () => {
  const validated = validateGuestCheckout(VALID_BODY);
  assert.equal(validated.ok, true);
  assert.deepEqual(validated.value.items, VALID_ITEMS);
  assert.equal(Object.hasOwn(validated.value, 'price_pkr'), false);
  assert.equal(Object.hasOwn(validated.value, 'status'), false);

  // Legacy delivery_address is accepted, but canonical output is shipping_address.
  const legacy = validateGuestCheckout({ ...VALID_BODY, delivery_address: VALID_BODY.shipping_address, shipping_address: undefined });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.value.shipping_address, VALID_BODY.shipping_address);

  assert.equal(validateGuestCheckout({ ...VALID_BODY, phone: 'call me' }).ok, false);
  assert.equal(validateGuestCheckout({ ...VALID_BODY, city: '' }).ok, false);
  assert.equal(validateGuestCheckout({ ...VALID_BODY, items: [] }).ok, false);
  assert.equal(validateGuestCheckout({ ...VALID_BODY, items: [{ product_id: 'not-a-uuid', quantity: 1 }] }).ok, false);
  assert.equal(validateGuestCheckout({ ...VALID_BODY, items: [{ ...VALID_ITEMS[0], quantity: 101 }] }).ok, false);
  assert.equal(validateGuestCheckout({ ...VALID_BODY, items: [VALID_ITEMS[0], VALID_ITEMS[0]] }).ok, false);
});

test('FR-8.7 checkout RPC receives tenant slug, DB-derived cart and idempotency key', async () => {
  const args = checkoutRpcArguments(validateGuestCheckout(VALID_BODY).value, 'order-key-1');
  assert.equal(args.p_store_slug, '');
  assert.deepEqual(args.p_items, VALID_ITEMS);
  assert.equal(args.p_idempotency_key, 'order-key-1');
  assert.equal(Object.hasOwn(args, 'price_pkr'), false);

  assert.match(createIdempotencyKey('valid-key_123'), /valid-key_123/);
  assert.match(createIdempotencyKey('bad key'), /^[0-9a-f-]{36}$/);

  let received = null;
  const supabase = {
    async rpc(name, parameters) {
      received = { name, parameters };
      return {
        data: {
          order_id: 'order-1',
          order_number: 'ORD-TEST-1',
          status: 'pending',
          subtotal_pkr: 1998,
          shipping_fee_pkr: 0,
          total_pkr: 1998,
          idempotent: true,
        },
        error: null,
      };
    },
  };
  const outcome = await placeGuestOrder(supabase, 'boutique', validateGuestCheckout(VALID_BODY).value, 'order-key-1');
  assert.equal(outcome.ok, true);
  assert.equal(received.name, 'place_store_order');
  assert.equal(received.parameters.p_store_slug, 'boutique');
  assert.equal(received.parameters.p_idempotency_key, 'order-key-1');
  assert.equal(outcome.result.idempotent, true);
  assert.equal(outcome.result.total_pkr, 1998);
});

test('symbolic RPC errors are classified without relying on five-character SQLSTATEs', async () => {
  assert.equal(symbolicRpcCode('STORE_UNAVAILABLE: Store is not available.', 'STORE'), 'STORE_UNAVAILABLE');
  assert.equal(symbolicRpcCode('RATE_LIMITED: Too many.', 'RATEL'), 'RATE_LIMITED');
  assert.equal(symbolicRpcCode(undefined, 'PRDCT'), 'PRODUCT_UNAVAILABLE');
  assert.equal(symbolicRpcCode(undefined, 'STOCK'), 'INSUFFICIENT_STOCK');

  async function outcomeFor(error) {
    const supabase = { async rpc() { return { data: null, error }; } };
    return placeGuestOrder(supabase, 'boutique', validateGuestCheckout(VALID_BODY).value, 'key-2');
  }
  assert.equal((await outcomeFor({ message: 'STORE_UNAVAILABLE: Store is not available.', code: 'STORE' })).status, 404);
  assert.equal((await outcomeFor({ message: 'RATE_LIMITED: Too many.', code: 'RATEL' })).status, 429);
  assert.equal((await outcomeFor({ message: 'INSUFFICIENT_STOCK: Only 1 left.', code: 'STOCK' })).status, 409);
});

test('checkout SQL derives prices server-side and does not decrement stock at placement', () => {
  const sql = read('supabase/migrations/20261127020000_module8_secure_order_rpcs.sql');
  assert.ok(sql.includes('create or replace function public.place_store_order'));
  assert.ok(sql.includes('security definer'));
  assert.ok(sql.includes('for share') || sql.includes('for update'));
  assert.match(sql, /p_items\s+jsonb/);
  assert.equal(/p_price|client_price|p_unit_price/.test(sql), false);
  assert.ok(sql.includes('unit_price_pkr'));
  const placement = sql.slice(sql.indexOf('function public.place_store_order'), sql.indexOf('function public.transition_store_order_status'));
  assert.equal(placement.includes('stock ='), false);
  assert.match(placement, /'status',\s*'pending'/);
  assert.ok(sql.includes('revoke all on function public.place_store_order'));
});

test('FR-8.8 product images are stored in an owner-controlled Supabase bucket', () => {
  const migration = read('supabase/migrations/20261127030000_module8_product_image_storage.sql');
  assert.ok(migration.includes("'product-images'"));
  assert.ok(migration.includes('public.can_manage_store'));
  assert.ok(migration.includes('storage.foldername(name)'));
  assert.ok(migration.includes('5242880'));
  const route = read('src/app/api/stores/[id]/products/images/route.ts');
  assert.ok(route.includes("supabase.storage\n    .from(BUCKET)\n    .upload"));
  assert.ok(route.includes('MIME_EXTENSION[file.type]'));
  assert.ok(route.includes('file.size > MAX_BYTES'));
  assert.ok(route.includes('getPublicUrl(path)'));
  assert.ok(read('src/app/projects/[id]/store/page.tsx').includes('handleUploadProductImage'));
});

test('FR-8.8 product images are bounded and cannot inject script sources', () => {
  const valid = validateProductImages(['https://cdn.example.com/a.png', '/product-b.png']);
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.images, ['https://cdn.example.com/a.png', '/product-b.png']);
  assert.equal(validateProductImages(['javascript:alert(1)']).ok, false);
  assert.equal(validateProductImages(['//evil.example.com/a.png']).ok, false);
  assert.equal(validateProductImages(Array(9).fill('https://cdn.example.com/a.png')).ok, false);
});
