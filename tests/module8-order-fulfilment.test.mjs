/**
 * Task 9 / Module 8 — order state machine, stock consistency and KPIs.
 * Run: node --test tests/module8-order-fulfilment.test.mjs
 * All database writes are mocked RPC calls; no live database is contacted.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import './helpers/ts-loader.mjs';

const {
  ALLOWED_STATUS_TRANSITIONS,
  canTransitionOrder,
  shouldDecrementStockOnTransition,
  shouldRestoreStockOnTransition,
  appendStatusHistory,
} = await import('../src/lib/store-management/orders.ts');
const { stockEffect, transitionStoreOrder, adjustStoreInventory } =
  await import('../src/lib/store-management/order-operations.ts');
const { filterLowStockProducts } = await import('../src/lib/store-management/inventory.ts');

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('FR-8.10 order transitions are a closed state machine', () => {
  assert.deepEqual(ALLOWED_STATUS_TRANSITIONS.pending, ['confirmed', 'cancelled']);
  assert.ok(canTransitionOrder('packed', 'shipped'));
  assert.ok(canTransitionOrder('shipped', 'cancelled'));
  assert.ok(canTransitionOrder('delivered', 'returned'));
  assert.equal(canTransitionOrder('cancelled', 'confirmed'), false);
  assert.equal(canTransitionOrder('returned', 'pending'), false);
  assert.equal(canTransitionOrder('pending', 'pending'), false);

  const history = appendStatusHistory([], 'pending', 'system');
  const withConfirmation = appendStatusHistory(history, 'confirmed', 'owner@example.com', 'verified payment');
  assert.equal(withConfirmation.length, 2);
  assert.equal(withConfirmation[1].status, 'confirmed');
  assert.equal(withConfirmation[1].notes, 'verified payment');
});

test('stock is applied once on confirmation and restored on cancellation or return', () => {
  assert.equal(shouldDecrementStockOnTransition('pending', 'confirmed'), true);
  assert.equal(shouldDecrementStockOnTransition('pending', 'cancelled'), false);
  assert.equal(shouldRestoreStockOnTransition('pending', 'cancelled'), false);
  assert.equal(shouldRestoreStockOnTransition('confirmed', 'cancelled'), true);
  assert.equal(shouldRestoreStockOnTransition('packed', 'cancelled'), true);
  assert.equal(shouldRestoreStockOnTransition('shipped', 'cancelled'), true);
  assert.equal(shouldRestoreStockOnTransition('shipped', 'returned'), true);
  assert.equal(shouldRestoreStockOnTransition('delivered', 'returned'), true);
  assert.equal(shouldRestoreStockOnTransition('delivered', 'cancelled'), false);
  assert.equal(stockEffect('pending', 'confirmed'), 'decrement');
  assert.equal(stockEffect('shipped', 'returned'), 'restore');
  assert.equal(stockEffect('confirmed', 'packed'), 'none');
});

test('FR-8.10 transitions and inventory adjustments go through narrow RPCs', async () => {
  const calls = [];
  const supabase = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'transition_store_order_status') {
        return { data: { id: args.p_order_id, status: args.p_target_status }, error: null };
      }
      return { data: { id: args.p_product_id, stock: args.p_new_stock }, error: null };
    },
  };

  const transition = await transitionStoreOrder(supabase, {
    storeId: 'store-1',
    orderId: 'order-1',
    currentStatus: 'confirmed',
    targetStatus: 'packed',
    actor: 'owner@example.com',
  });
  assert.equal(transition.ok, true);
  assert.equal(calls[0].name, 'transition_store_order_status');
  assert.equal(calls[0].args.p_actor, 'owner@example.com');

  const invalid = await transitionStoreOrder(supabase, {
    storeId: 'store-1', orderId: 'order-1', currentStatus: 'cancelled', targetStatus: 'shipped', actor: 'owner',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, 400);

  const adjusted = await adjustStoreInventory(supabase, {
    storeId: 'store-1', productId: 'product-1', newStock: 12, reason: 'restock', actorId: 'owner',
  });
  assert.equal(adjusted.ok, true);
  assert.equal(calls[1].name, 'adjust_store_inventory');
  assert.equal(calls[1].args.p_reason, 'restock');

  const failing = {
    async rpc() { return { data: null, error: { message: 'INVALID_TRANSITION: Order changed concurrently; retry.', code: 'INVTR' } }; },
  };
  const rejected = await transitionStoreOrder(failing, {
    storeId: 'store-1', orderId: 'order-1', currentStatus: 'packed', targetStatus: 'shipped', actor: 'owner',
  });
  assert.equal(rejected.status, 409);
});

test('transition RPC locks rows, validates authorization and appends history atomically', () => {
  const sql = read('supabase/migrations/20261127020000_module8_secure_order_rpcs.sql');
  const transition = sql.slice(
    sql.indexOf('function public.transition_store_order_status'),
    sql.indexOf('function public.adjust_store_inventory'),
  );
  assert.ok(transition.includes('for update'));
  assert.ok(transition.includes('public.can_manage_store'));
  assert.ok(transition.includes('status_history'));
  assert.ok(transition.includes('inventory_logs'));
  assert.ok(transition.includes('v_product.stock < v_item.quantity'));
  assert.ok(transition.includes('revoke all on function public.transition_store_order_status'));
});

test('FR-8.11 owner KPIs exclude terminal orders and surface low stock', () => {
  const low = filterLowStockProducts([
    { id: '1', is_active: true, is_archived: false, stock: 2, low_stock_threshold: 5 },
    { id: '2', is_active: true, is_archived: false, stock: 20, low_stock_threshold: 5 },
  ]);
  assert.equal(low.length, 1);
  const route = read('src/app/api/stores/[id]/overview/route.ts');
  assert.ok(route.includes("o.status !== 'cancelled' && o.status !== 'returned'"));
  assert.ok(route.includes('total_revenue_pkr'));
  assert.ok(route.includes('unfulfilled_orders_count'));
  assert.ok(route.includes('low_stock_products'));
});

test('FR-8.12 admin usage/AI log view and explicit publish action are wired', () => {
  assert.ok(fs.existsSync(path.join(root, 'src/app/api/admin/usage/route.ts')));
  const usage = read('src/app/api/admin/usage/route.ts');
  assert.ok(usage.includes("profile?.role !== 'admin'"));
  assert.ok(usage.includes("from('ai_call_log')"));
  assert.ok(usage.includes('ai_calls_by_purpose'));
  assert.ok(usage.includes('recent_ai_calls'));
  assert.equal(usage.includes('owner_id:'), false);

  const adminPage = read('src/app/admin/page.tsx');
  assert.ok(adminPage.includes('/api/admin/usage'));
  assert.ok(adminPage.includes('Platform Usage &amp; AI Call Log'));
  assert.ok(adminPage.includes('seo_score?.score'));

  const ownerPage = read('src/app/projects/[id]/store/page.tsx');
  assert.ok(ownerPage.includes("body: JSON.stringify({ action })"));
  assert.equal(ownerPage.includes("fetch(`/api/stores/${store.id}/publish`, { method: 'POST' })"), false);
});
