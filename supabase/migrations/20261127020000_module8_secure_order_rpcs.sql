-- ==============================================================================
-- Task 9 / Module 8: secure, transactional store order + publication RPCs
-- Migration: 20261127020000_module8_secure_order_rpcs.sql
--
-- Forward-only and additive. All existing Modules 1-7 objects (store_status
-- enum, is_banned, project_id, theme_config_version, append-only
-- store_draft_versions, FORCE RLS and private attachments) are left untouched.
--
-- Security model:
--   * Every function below is SECURITY DEFINER with a pinned search_path and
--     explicit, pinned grants. EXECUTE is revoked from PUBLIC (and anon for the
--     authenticated-only RPCs) before being granted to the intended role.
--     No browser role is ever given a service-role key or service-role bypass.
--   * Authorization always comes from auth.uid() / public.is_admin() /
--     public.can_manage_store(). p_actor and p_actor_id are audit labels only.
--   * Prices, statuses, ownership and stock effects are computed exclusively
--     from database rows under row locks. Clients never supply any of them.
--
-- Error-code note: PostgreSQL SQLSTATEs are exactly five characters, so the
-- symbolic application codes expected by TypeScript cannot themselves be
-- SQLSTATEs. public.store_rpc_error maps each symbolic code to a deterministic
-- five-character custom SQLSTATE AND emits the symbolic code verbatim as the
-- message prefix (e.g. "STORE_UNAVAILABLE: Store is not available for orders.").
-- Map the prefix (or the 5-char companion) to the TS error code in the client.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 0. Shared error raiser. Symbolic -> five-character custom SQLSTATE mapping.
--    The symbolic token is also the message prefix so clients can classify the
--    failure without parsing prose.
-- ------------------------------------------------------------------------------
create or replace function public.store_rpc_error(p_code text, p_message text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_state text;
begin
  v_state := case p_code
    when 'STORE_UNAVAILABLE'   then 'STORE'
    when 'PRODUCT_UNAVAILABLE' then 'PRDCT'
    when 'INSUFFICIENT_STOCK'  then 'STOCK'
    when 'INVALID_CHECKOUT'    then 'CHKIN'
    when 'FORBIDDEN'           then 'FORBD'
    when 'ORDER_NOT_FOUND'     then 'ORDNF'
    when 'INVALID_TRANSITION'  then 'INVTR'
    when 'RATE_LIMITED'        then 'RATEL'
    else 'P0001'
  end;

  raise exception using
    errcode = v_state,
    message = p_code || ': ' || p_message;
end;
$$;

revoke all on function public.store_rpc_error(text, text) from public;
revoke all on function public.store_rpc_error(text, text) from anon;

-- ------------------------------------------------------------------------------
-- 1. Private, hashed-IP rate-limit ledger for guest checkout.
--    No anon/authenticated table privilege and no RLS policy: only the
--    SECURITY DEFINER functions below can read or write it. The IP is
--    pseudonymised with a one-way md5 hash (core PostgreSQL, no extension
--    dependency) combined with the store id; raw IPs are never persisted.
-- ------------------------------------------------------------------------------
create table if not exists public.store_order_rate_limits (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  ip_hash text not null,
  window_start timestamptz not null default date_trunc('minute', now()),
  order_count integer not null default 0 check (order_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, ip_hash, window_start)
);

create index if not exists idx_store_order_rate_limits_window
  on public.store_order_rate_limits (window_start);

alter table public.store_order_rate_limits enable row level security;
alter table public.store_order_rate_limits force row level security;

revoke all on public.store_order_rate_limits from public;
revoke all on public.store_order_rate_limits from anon;
revoke all on public.store_order_rate_limits from authenticated;

-- ------------------------------------------------------------------------------
-- 2. place_store_order: the ONLY anonymous order-write path.
--    Validation, locking, item pricing, customer upsert, idempotency handling
--    and rate limiting all happen in one transaction. Stock is NOT decremented
--    here; that happens atomically on pending -> confirmed.
-- ------------------------------------------------------------------------------
create or replace function public.place_store_order(
  p_store_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_shipping_address text,
  p_city text,
  p_items jsonb,
  p_idempotency_key text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_existing record;
  v_elem jsonb;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_normalized jsonb;
  v_priced jsonb := '[]'::jsonb;
  v_pid uuid;
  v_qty integer;
  v_num numeric;
  v_product record;
  v_subtotal bigint := 0;
  v_ip_hash text;
  v_hits integer;
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
  v_address text := btrim(coalesce(p_shipping_address, ''));
  v_city text := btrim(coalesce(p_city, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_key text := btrim(coalesce(p_idempotency_key, ''));
begin
  -- Store must be published and unbanned (bypassing RLS is intentional here;
  -- the explicit check below is the authoritative visibility rule).
  select s.id
  into v_store_id
  from public.stores s
  where s.slug = p_store_slug
    and s.status = 'published'
    and s.is_banned = false
  for share;

  if not found then
    perform public.store_rpc_error('STORE_UNAVAILABLE', 'Store is not available for orders.');
  end if;

  -- Idempotent replay: return the original order, never create a second one.
  if v_key <> '' then
    select o.id, o.order_number, o.status, o.subtotal_pkr, o.shipping_fee_pkr, o.total_pkr
    into v_existing
    from public.orders o
    where o.store_id = v_store_id
      and o.idempotency_key = v_key;

    if found then
      return jsonb_build_object(
        'order_id', v_existing.id,
        'order_number', v_existing.order_number,
        'status', v_existing.status,
        'subtotal_pkr', v_existing.subtotal_pkr,
        'shipping_fee_pkr', v_existing.shipping_fee_pkr,
        'total_pkr', v_existing.total_pkr,
        'idempotent', true
      );
    end if;
  end if;

  -- Customer / notes validation (mirrors the server-side TS validator).
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'Customer name must be 2-120 characters.');
  end if;
  if v_phone !~ '^[0-9+()[:space:]-]{7,20}$' then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'Enter a valid phone number.');
  end if;
  if char_length(v_address) < 5 or char_length(v_address) > 300 then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'Shipping address must be 5-300 characters.');
  end if;
  if char_length(v_city) < 2 or char_length(v_city) > 80 then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'City must be 2-80 characters.');
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'Order notes must be at most 500 characters.');
  end if;

  if v_key = '' or char_length(v_key) < 8 or char_length(v_key) > 128
     or v_key !~ '^[A-Za-z0-9._-]+$' then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'A valid idempotency key is required.');
  end if;

  -- Items: array of 1-50 objects; product_id is a UUID string, quantity is an
  -- integer 1-100. Duplicate product ids are combined rather than rejected.
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'Cart must be a JSON array.');
  end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'Cart must contain between 1 and 50 line items.');
  end if;

  for v_elem in select x.value from jsonb_array_elements(p_items) as x(value) loop
    if jsonb_typeof(v_elem) <> 'object'
       or not (v_elem ? 'product_id')
       or jsonb_typeof(v_elem -> 'product_id') is distinct from 'string'
       or (v_elem ->> 'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      perform public.store_rpc_error('INVALID_CHECKOUT', 'Invalid product identifier.');
    end if;

    if not (v_elem ? 'quantity')
       or jsonb_typeof(v_elem -> 'quantity') is distinct from 'number' then
      perform public.store_rpc_error('INVALID_CHECKOUT', 'Each quantity must be an integer from 1 to 100.');
    end if;

    v_num := (v_elem ->> 'quantity')::numeric;
    if v_num is null or v_num <> floor(v_num) or v_num < 1 or v_num > 100 then
      perform public.store_rpc_error('INVALID_CHECKOUT', 'Each quantity must be an integer from 1 to 100.');
    end if;

    v_pid := (v_elem ->> 'product_id')::uuid;
    v_qty := v_num::integer;
    v_items := v_items || jsonb_build_array(
      jsonb_build_object('product_id', v_pid::text, 'quantity', v_qty)
    );
  end loop;

  select coalesce(
    jsonb_agg(jsonb_build_object('product_id', g.pid, 'quantity', g.qty) order by g.pid),
    '[]'::jsonb
  )
  into v_normalized
  from (
    select (x.e ->> 'product_id')::uuid as pid,
           sum((x.e ->> 'quantity')::integer)::integer as qty
    from jsonb_array_elements(v_items) as x(e)
    group by 1
  ) as g;

  -- Price everything from the database only. Products must belong to this
  -- store, be active and not archived. FOR SHARE blocks concurrent deletion.
  for v_item in select x.value from jsonb_array_elements(v_normalized) as x(value) loop
    v_pid := (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::integer;

    if v_qty is null or v_qty < 1 or v_qty > 100 then
      perform public.store_rpc_error('INVALID_CHECKOUT', 'Combined quantity exceeds the allowed limit.');
    end if;

    select p.id, p.name, p.sku, p.price_pkr
    into v_product
    from public.products p
    where p.id = v_pid
      and p.store_id = v_store_id
      and p.is_active = true
      and p.is_archived = false
    for share;

    if not found then
      perform public.store_rpc_error('PRODUCT_UNAVAILABLE', 'A product in your cart is not available.');
    end if;

    v_subtotal := v_subtotal + v_product.price_pkr::bigint * v_qty;
    v_priced := v_priced || jsonb_build_array(jsonb_build_object(
      'product_id', v_pid::text,
      'name', v_product.name,
      'sku', v_product.sku,
      'unit_price_pkr', v_product.price_pkr,
      'quantity', v_qty
    ));
  end loop;

  -- Per-IP + per-store, per-minute rate limit (10 orders/minute).
  v_ip_hash := md5(
    coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for',
      ''
    ) || '|' || v_store_id::text
  );

  insert into public.store_order_rate_limits (store_id, ip_hash, window_start, order_count)
  values (v_store_id, v_ip_hash, date_trunc('minute', now()), 1)
  on conflict (store_id, ip_hash, window_start)
  do update set
    order_count = store_order_rate_limits.order_count + 1,
    updated_at = now()
  returning order_count into v_hits;

  if v_hits > 10 then
    perform public.store_rpc_error('RATE_LIMITED', 'Too many orders. Please try again later.');
  end if;

  v_order_number := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-'
                    || upper(left(replace(gen_random_uuid()::text, '-', ''), 10));

  -- The unique index from 20261127010000 makes concurrent replays safe. A
  -- conflict means another request with the same key already created the order.
  insert into public.orders (
    store_id,
    order_number,
    customer_name,
    customer_phone,
    shipping_address,
    city,
    payment_method,
    payment_status,
    fulfillment_status,
    subtotal_pkr,
    shipping_fee_pkr,
    tax_pkr,
    total_pkr,
    status,
    status_history,
    notes,
    idempotency_key
  )
  values (
    v_store_id,
    v_order_number,
    v_name,
    v_phone,
    v_address,
    v_city,
    'cod',
    'pending',
    'unfulfilled',
    v_subtotal,
    0,
    0,
    v_subtotal,
    'pending',
    jsonb_build_array(jsonb_build_object(
      'status', 'pending',
      'changed_at', now(),
      'actor', 'guest_checkout',
      'notes', null
    )),
    v_notes,
    v_key
  )
  on conflict (store_id, idempotency_key) where idempotency_key is not null do nothing
  returning id into v_order_id;

  if v_order_id is null then
    select o.id, o.order_number, o.status, o.subtotal_pkr, o.shipping_fee_pkr, o.total_pkr
    into v_existing
    from public.orders o
    where o.store_id = v_store_id
      and o.idempotency_key = v_key;

    return jsonb_build_object(
      'order_id', v_existing.id,
      'order_number', v_existing.order_number,
      'status', v_existing.status,
      'subtotal_pkr', v_existing.subtotal_pkr,
      'shipping_fee_pkr', v_existing.shipping_fee_pkr,
      'total_pkr', v_existing.total_pkr,
      'idempotent', true
    );
  end if;

  insert into public.order_items (
    order_id, product_id, name, sku, unit_price_pkr, quantity, total_price_pkr
  )
  select
    v_order_id,
    (x.value ->> 'product_id')::uuid,
    x.value ->> 'name',
    x.value ->> 'sku',
    (x.value ->> 'unit_price_pkr')::bigint,
    (x.value ->> 'quantity')::integer,
    (x.value ->> 'unit_price_pkr')::bigint * (x.value ->> 'quantity')::integer
  from jsonb_array_elements(v_priced) as x(value);

  insert into public.customers (
    store_id, full_name, phone, email, city, address,
    total_orders, total_spend_pkr, last_order_at
  )
  values (
    v_store_id, v_name, v_phone, null, v_city, v_address,
    1, v_subtotal, now()
  )
  on conflict (store_id, phone) do update set
    full_name = excluded.full_name,
    city = excluded.city,
    address = excluded.address,
    total_orders = customers.total_orders + 1,
    total_spend_pkr = customers.total_spend_pkr + excluded.total_spend_pkr,
    last_order_at = now();

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending',
    'subtotal_pkr', v_subtotal,
    'shipping_fee_pkr', 0,
    'total_pkr', v_subtotal,
    'idempotent', false
  );
end;
$$;

revoke all on function public.place_store_order(text, text, text, text, text, jsonb, text, text) from public;
revoke all on function public.place_store_order(text, text, text, text, text, jsonb, text, text) from anon;
grant execute on function public.place_store_order(text, text, text, text, text, jsonb, text, text) to anon;
grant execute on function public.place_store_order(text, text, text, text, text, jsonb, text, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. transition_store_order_status: the only status writer. Stock effects are
--    applied under product row locks and can never leave a partial state.
-- ------------------------------------------------------------------------------
create or replace function public.transition_store_order_status(
  p_store_id uuid,
  p_order_id uuid,
  p_target_status text,
  p_actor text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_old text;
  v_target text := lower(btrim(coalesce(p_target_status, '')));
  v_actor_label text;
  v_item record;
  v_product record;
  v_new_stock integer;
  v_reason text;
  v_payment_status text;
  v_fulfillment_status text;
  v_history jsonb;
begin
  if v_uid is null or not public.can_manage_store(p_store_id) then
    perform public.store_rpc_error('FORBIDDEN', 'Not allowed to manage this store.');
  end if;

  if v_target not in ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned') then
    perform public.store_rpc_error('INVALID_TRANSITION', 'Unknown target status.');
  end if;

  select *
  into v_order
  from public.orders o
  where o.id = p_order_id
    and o.store_id = p_store_id
  for update;

  if not found then
    perform public.store_rpc_error('ORDER_NOT_FOUND', 'Order not found.');
  end if;

  v_old := v_order.status::text;

  if not (
       (v_old = 'pending'   and v_target in ('confirmed', 'cancelled'))
    or (v_old = 'confirmed' and v_target in ('packed', 'cancelled'))
    or (v_old = 'packed'    and v_target in ('shipped', 'cancelled'))
    or (v_old = 'shipped'   and v_target in ('delivered', 'cancelled', 'returned'))
    or (v_old = 'delivered' and v_target = 'returned')
  ) then
    perform public.store_rpc_error(
      'INVALID_TRANSITION',
      'Transition ' || v_old || ' -> ' || v_target || ' is not allowed.'
    );
  end if;

  -- Decrement only on confirmation; restore on the matching cancel/return branches.
  if v_old = 'pending' and v_target = 'confirmed' then
    v_reason := 'order_placed';
  elsif v_target = 'cancelled' and v_old in ('confirmed', 'packed', 'shipped') then
    v_reason := 'order_cancelled';
  elsif v_target = 'returned' and v_old in ('shipped', 'delivered') then
    v_reason := 'restock';
  else
    v_reason := null;
  end if;

  if v_reason is not null then
    for v_item in
      select oi.product_id, oi.quantity
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.product_id is not null
      order by oi.id
    loop
      select p.id, p.name, p.stock
      into v_product
      from public.products p
      where p.id = v_item.product_id
        and p.store_id = p_store_id
      for update;

      -- A product deleted after checkout cannot be stock-adjusted; skip it.
      if not found then
        continue;
      end if;

      if v_reason = 'order_placed' then
        if v_product.stock < v_item.quantity then
          perform public.store_rpc_error(
            'INSUFFICIENT_STOCK',
            'Insufficient stock for ' || v_product.name || '.'
          );
        end if;
        v_new_stock := v_product.stock - v_item.quantity;
      else
        v_new_stock := v_product.stock + v_item.quantity;
      end if;

      update public.products p
      set stock = v_new_stock
      where p.id = v_product.id
        and p.store_id = p_store_id;

      insert into public.inventory_logs (
        store_id, product_id, delta, previous_stock, new_stock, reason, actor_id
      )
      values (
        p_store_id,
        v_product.id,
        v_new_stock - v_product.stock,
        v_product.stock,
        v_new_stock,
        v_reason,
        v_uid
      );
    end loop;
  end if;

  -- COD consistency. The existing payment_status check allows
  -- pending/paid/refunded/failed (no 'cancelled' value), so a cancelled COD
  -- order keeps payment_status='pending' (nothing was captured).
  v_payment_status := case
    when v_target = 'delivered' then 'paid'
    when v_target = 'returned' then 'refunded'
    else 'pending'
  end;
  v_fulfillment_status := case
    when v_target = 'cancelled' then 'cancelled'
    when v_target = 'returned' then 'returned'
    when v_target in ('shipped', 'delivered') then 'fulfilled'
    else 'unfulfilled'
  end;

  v_actor_label := coalesce(nullif(btrim(coalesce(p_actor, '')), ''), v_uid::text, 'system');
  v_history := coalesce(v_order.status_history, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'status', v_target,
      'changed_at', now(),
      'actor', v_actor_label,
      'notes', p_notes
    )
  );

  update public.orders o
  set status = v_target,
      payment_status = v_payment_status,
      fulfillment_status = v_fulfillment_status,
      status_history = v_history
  where o.id = p_order_id
    and o.store_id = p_store_id
    and o.status = v_old;

  if not found then
    perform public.store_rpc_error('INVALID_TRANSITION', 'Order changed concurrently; retry with the current status.');
  end if;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'store_id', p_store_id,
    'order_number', v_order.order_number,
    'previous_status', v_old,
    'status', v_target,
    'payment_status', v_payment_status,
    'fulfillment_status', v_fulfillment_status,
    'status_history', v_history
  );
end;
$$;

revoke all on function public.transition_store_order_status(uuid, uuid, text, text, text) from public;
revoke all on function public.transition_store_order_status(uuid, uuid, text, text, text) from anon;
grant execute on function public.transition_store_order_status(uuid, uuid, text, text, text) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. adjust_store_inventory: owner/admin only, allowlisted reasons, atomic
--    stock update + audit log with a true (signed) delta.
-- ------------------------------------------------------------------------------
create or replace function public.adjust_store_inventory(
  p_store_id uuid,
  p_product_id uuid,
  p_new_stock integer,
  p_reason text,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_reason text := lower(btrim(coalesce(p_reason, '')));
  v_product record;
begin
  if v_uid is null or not public.can_manage_store(p_store_id) then
    perform public.store_rpc_error('FORBIDDEN', 'Not allowed to manage this store.');
  end if;

  if v_reason not in ('manual_adjustment', 'restock', 'damage') then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'Unsupported inventory adjustment reason.');
  end if;

  if p_new_stock is null or p_new_stock < 0 then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'Stock cannot be negative.');
  end if;

  select p.id, p.stock
  into v_product
  from public.products p
  where p.id = p_product_id
    and p.store_id = p_store_id
  for update;

  if not found then
    perform public.store_rpc_error('PRODUCT_UNAVAILABLE', 'Product not found in this store.');
  end if;

  update public.products p
  set stock = p_new_stock
  where p.id = p_product_id
    and p.store_id = p_store_id;

  insert into public.inventory_logs (
    store_id, product_id, delta, previous_stock, new_stock, reason, actor_id
  )
  values (
    p_store_id,
    p_product_id,
    p_new_stock - v_product.stock,
    v_product.stock,
    p_new_stock,
    v_reason,
    v_uid
  );

  return jsonb_build_object(
    'success', true,
    'store_id', p_store_id,
    'product_id', p_product_id,
    'previous_stock', v_product.stock,
    'new_stock', p_new_stock,
    'delta', p_new_stock - v_product.stock,
    'reason', v_reason
  );
end;
$$;

revoke all on function public.adjust_store_inventory(uuid, uuid, integer, text, uuid) from public;
revoke all on function public.adjust_store_inventory(uuid, uuid, integer, text, uuid) from anon;
grant execute on function public.adjust_store_inventory(uuid, uuid, integer, text, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 5. set_store_publication: owner/admin only; publishes only an unbanned store
--    whose slug is well-formed and not reserved, and records a lifecycle event.
-- ------------------------------------------------------------------------------
create or replace function public.set_store_publication(
  p_store_id uuid,
  p_publish boolean,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_publish boolean := coalesce(p_publish, false);
  v_store public.stores%rowtype;
  v_action text;
  v_reserved text[] := array[
    'api', 'admin', 'login', 'auth', 'logout', 'signup', 'register',
    'dashboard', 'projects', 'wizard', 'market-intelligence', 'account',
    'reset-password', 'update-password', 'health', 'sitemap', 'robots',
    'static', '_next', 'favicon', 'stores', 'storefront', 'cdn', 'www'
  ];
begin
  if v_uid is null or not public.can_manage_store(p_store_id) then
    perform public.store_rpc_error('FORBIDDEN', 'Not allowed to manage this store.');
  end if;

  select *
  into v_store
  from public.stores s
  where s.id = p_store_id
  for update;

  if not found then
    perform public.store_rpc_error('STORE_UNAVAILABLE', 'Store not found.');
  end if;

  if v_publish and v_store.is_banned then
    perform public.store_rpc_error('STORE_UNAVAILABLE', 'Banned stores cannot be published.');
  end if;

  if v_publish and (
       v_store.slug !~ '^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$'
       or v_store.slug = any(v_reserved)
     ) then
    perform public.store_rpc_error('INVALID_CHECKOUT', 'Invalid or reserved store slug; cannot publish.');
  end if;

  if v_publish then
    update public.stores s
    set status = 'published',
        published_at = coalesce(s.published_at, now()),
        unpublished_at = null
    where s.id = p_store_id;
    v_action := 'publish';
  else
    update public.stores s
    set status = 'draft',
        published_at = null,
        unpublished_at = now()
    where s.id = p_store_id;
    v_action := 'unpublish';
  end if;

  insert into public.store_lifecycle_events (store_id, actor_id, action, details)
  values (
    p_store_id,
    v_uid,
    v_action,
    jsonb_build_object(
      'from_status', v_store.status::text,
      'to_status', case when v_publish then 'published' else 'draft' end,
      'actor', v_uid::text
    )
  );

  return jsonb_build_object(
    'id', p_store_id,
    'slug', v_store.slug,
    'status', case when v_publish then 'published'::text else 'draft'::text end,
    'published_at', case when v_publish then coalesce(v_store.published_at, now()) else null end,
    'unpublished_at', case when v_publish then null else now() end
  );
end;
$$;

revoke all on function public.set_store_publication(uuid, boolean, uuid) from public;
revoke all on function public.set_store_publication(uuid, boolean, uuid) from anon;
grant execute on function public.set_store_publication(uuid, boolean, uuid) to authenticated;

-- ------------------------------------------------------------------------------
-- 6. lookup_store_order: narrowly scoped anonymous READ path. Only the listed
--    columns are returned; address, items and full phone are never exposed.
-- ------------------------------------------------------------------------------
create or replace function public.lookup_store_order(
  p_store_slug text,
  p_order_number text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
  v_order record;
  v_masked text;
begin
  select s.id
  into v_store_id
  from public.stores s
  where s.slug = p_store_slug
    and s.status = 'published'
    and s.is_banned = false;

  if not found then
    perform public.store_rpc_error('ORDER_NOT_FOUND', 'Order not found.');
  end if;

  select o.id, o.order_number, o.status, o.payment_status, o.fulfillment_status,
         o.created_at, o.total_pkr, o.customer_name
  into v_order
  from public.orders o
  where o.store_id = v_store_id
    and o.order_number = btrim(coalesce(p_order_number, ''))
    and o.customer_phone = btrim(coalesce(p_phone, ''));

  if not found then
    perform public.store_rpc_error('ORDER_NOT_FOUND', 'Order not found.');
  end if;

  v_masked := case
    when char_length(v_order.customer_name) <= 1 then v_order.customer_name
    when char_length(v_order.customer_name) = 2 then left(v_order.customer_name, 1) || '*'
    else left(v_order.customer_name, 1)
         || repeat('*', char_length(v_order.customer_name) - 2)
         || right(v_order.customer_name, 1)
  end;

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'fulfillment_status', v_order.fulfillment_status,
    'created_at', v_order.created_at,
    'estimated_total_pkr', v_order.total_pkr,
    'customer_name', v_masked
  );
end;
$$;

revoke all on function public.lookup_store_order(text, text, text) from public;
revoke all on function public.lookup_store_order(text, text, text) from anon;
grant execute on function public.lookup_store_order(text, text, text) to anon;
grant execute on function public.lookup_store_order(text, text, text) to authenticated;

commit;

-- ------------------------------------------------------------------------------
-- Manual rollback (additive migration; only after application code is reverted).
-- Drops only objects introduced by this file; never drop orders/products/
-- stores/customers/inventory_logs or any pre-existing Module 1-7 object.
--   revoke execute on function public.lookup_store_order(text, text, text) from anon;
--   revoke execute on function public.place_store_order(text, text, text, text, text, jsonb, text, text) from anon;
--   drop function if exists public.lookup_store_order(text, text, text);
--   drop function if exists public.set_store_publication(uuid, boolean, uuid);
--   drop function if exists public.adjust_store_inventory(uuid, uuid, integer, text, uuid);
--   drop function if exists public.transition_store_order_status(uuid, uuid, text, text, text);
--   drop function if exists public.place_store_order(text, text, text, text, text, jsonb, text, text);
--   drop table if exists public.store_order_rate_limits;
--   drop function if exists public.store_rpc_error(text, text);
-- ------------------------------------------------------------------------------
