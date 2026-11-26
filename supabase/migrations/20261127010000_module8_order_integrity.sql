-- ==============================================================================
-- Task 9 / Module 8: order integrity (idempotency + unique order numbers)
-- Migration: 20261127010000_module8_order_integrity.sql
--
-- Forward-only and non-destructive:
--   * No order, order item, customer or store row is deleted.
--   * Pre-existing duplicate (store_id, order_number) pairs are made unique by
--     deterministically suffixing every row except the oldest one; the first
--     row by (created_at, id) keeps its original number.
--   * All new indexes are additive; existing constraints and FORCE RLS stay in
--     place. No client-supplied price/status/owner is accepted here.
-- ==============================================================================

begin;

-- 1. Idempotency key: nullable so legacy orders are untouched; uniqueness is
--    only enforced for rows that actually carry a key.
alter table public.orders
  add column if not exists idempotency_key text null;

create unique index if not exists uq_orders_store_idempotency_key
  on public.orders (store_id, idempotency_key)
  where idempotency_key is not null;

-- 2. Deterministic, data-preserving cleanup of duplicate order numbers.
--    The keep-first rule is stable across runs: once duplicates are removed a
--    subsequent execution is a no-op. Nothing is deleted or reassigned.
with ranked as (
  select
    id,
    row_number() over (
      partition by store_id, order_number
      order by created_at asc, id asc
    ) as rn
  from public.orders
)
update public.orders o
set order_number = o.order_number || '-' || left(o.id::text, 8)
from ranked r
where r.id = o.id
  and r.rn > 1;

-- 3. One order number per store from now on. Creation fails loudly (unique
--    violation) rather than silently ignoring a conflicting write.
create unique index if not exists uq_orders_store_order_number
  on public.orders (store_id, order_number);

-- 4. Query support: guest lookup (store slug resolves to store_id in the RPC)
--    and lifecycle-event auditing. The lifecycle events table and its primary
--    index were created in 20261127000000; this additional action index helps
--    filtered admin audits without touching that table's RLS policies.
create index if not exists idx_orders_order_number
  on public.orders (order_number);

create index if not exists idx_orders_store_number_phone
  on public.orders (store_id, order_number, customer_phone);

create index if not exists idx_store_lifecycle_events_action_task9
  on public.store_lifecycle_events (action, created_at desc);

commit;

-- ------------------------------------------------------------------------------
-- Manual rollback (only after application code is reverted). These are additive
-- indexes/columns; the deterministic suffixing of duplicate order numbers is
-- not automatically reversible, but no row was deleted. Never drop the orders
-- table or any pre-existing Module 1-7 object.
--   drop index if exists public.idx_store_lifecycle_events_action_task9;
--   drop index if exists public.idx_orders_store_number_phone;
--   drop index if exists public.idx_orders_order_number;
--   drop index if exists public.uq_orders_store_order_number;
--   drop index if exists public.uq_orders_store_idempotency_key;
--   alter table public.orders drop column if exists idempotency_key;
-- ------------------------------------------------------------------------------
