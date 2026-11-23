-- =============================================================================
-- Security and checkout hardening
-- 1) Make project attachments private and owner-readable only.
-- 2) Add an atomic, server-priced guest COD order creation function.
--
-- This migration is additive. Existing order and product records are preserved.
-- Guest checkout is limited to published, non-banned stores and COD.
-- Stock is checked here and is decremented atomically when an owner confirms
-- the order (the confirmation transition is handled in a follow-up migration).
-- =============================================================================

-- Project attachments contain private business/project material.
update storage.buckets
set public = false
where id = 'project-attachments';

drop policy if exists "Public can view project attachments" on storage.objects;
drop policy if exists "Users can view their attachments" on storage.objects;
create policy "Users can view their attachments"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public, server-priced COD checkout. Client input contains product IDs and
-- quantities only; names, SKUs and prices are always read from the database.
create or replace function public.create_store_cod_order(
  p_store_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_shipping_address text,
  p_city text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store public.stores%rowtype;
  v_product public.products%rowtype;
  v_item record;
  v_order public.orders%rowtype;
  v_validated_items jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_shipping_fee bigint := 200;
  v_quantity integer;
  v_line_total bigint;
  v_order_number text;
begin
  if p_store_id is null then
    raise exception 'Store is required' using errcode = '22023';
  end if;

  if p_customer_name is null or char_length(btrim(p_customer_name)) not between 1 and 120
     or p_customer_phone is null or char_length(btrim(p_customer_phone)) not between 7 and 20
     or p_shipping_address is null or char_length(btrim(p_shipping_address)) not between 5 and 500
     or p_city is null or char_length(btrim(p_city)) not between 1 and 120 then
    raise exception 'Valid customer name, phone, address and city are required' using errcode = '22023';
  end if;

  if p_customer_email is not null and char_length(btrim(p_customer_email)) > 254 then
    raise exception 'Customer email is too long' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Order must contain between 1 and 50 line items' using errcode = '22023';
  end if;

  select * into v_store
  from public.stores
  where id = p_store_id
    and status = 'published'
    and coalesce(is_banned, false) = false;

  if not found then
    raise exception 'Store is not available for checkout' using errcode = 'P0002';
  end if;

  -- Aggregate duplicate product IDs to prevent quantity splitting.
  for v_item in
    select
      (entry->>'product_id')::uuid as product_id,
      sum((entry->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as entry
    group by (entry->>'product_id')::uuid
  loop
    v_quantity := v_item.quantity;
    if v_item.product_id is null or v_quantity < 1 or v_quantity > 1000 then
      raise exception 'Invalid product or quantity' using errcode = '22023';
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id
      and store_id = p_store_id
      and is_active = true
      and is_archived = false
    for update;

    if not found then
      raise exception 'One or more products are unavailable' using errcode = 'P0002';
    end if;

    if v_product.stock < v_quantity then
      raise exception 'Insufficient stock for product: %', v_product.name using errcode = '23514';
    end if;

    v_line_total := v_product.price_pkr * v_quantity;
    v_subtotal := v_subtotal + v_line_total;
    v_validated_items := v_validated_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'sku', v_product.sku,
      'unit_price_pkr', v_product.price_pkr,
      'quantity', v_quantity,
      'total_price_pkr', v_line_total
    ));
  end loop;

  if jsonb_array_length(v_validated_items) = 0 then
    raise exception 'Order must contain at least one valid product' using errcode = '22023';
  end if;

  v_order_number := 'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.orders (
    store_id, order_number, customer_name, customer_phone, customer_email,
    shipping_address, city, payment_method, payment_status, fulfillment_status,
    subtotal_pkr, shipping_fee_pkr, tax_pkr, total_pkr, status, status_history
  )
  values (
    p_store_id, v_order_number, btrim(p_customer_name), btrim(p_customer_phone),
    nullif(btrim(coalesce(p_customer_email, '')), ''),
    btrim(p_shipping_address), btrim(p_city), 'cod', 'pending', 'unfulfilled',
    v_subtotal, v_shipping_fee, 0, v_subtotal + v_shipping_fee, 'pending',
    jsonb_build_array(jsonb_build_object(
      'status', 'pending',
      'changed_at', now(),
      'actor', 'guest',
      'notes', 'Guest COD order placed'
    ))
  )
  returning * into v_order;

  insert into public.order_items (
    order_id, product_id, name, sku, unit_price_pkr, quantity, total_price_pkr
  )
  select
    v_order.id,
    line.product_id,
    line.name,
    line.sku,
    line.unit_price_pkr,
    line.quantity,
    line.total_price_pkr
  from jsonb_to_recordset(v_validated_items) as line(
    product_id uuid,
    name text,
    sku text,
    unit_price_pkr bigint,
    quantity integer,
    total_price_pkr bigint
  );

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'order_number', v_order_number
  );
end;
$$;

revoke all on function public.create_store_cod_order(uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.create_store_cod_order(uuid, text, text, text, text, text, jsonb) to anon, authenticated;

comment on function public.create_store_cod_order(uuid, text, text, text, text, text, jsonb)
is 'Creates a guest COD order using database product prices; validates published store and stock, and inserts order plus items in one transaction.';
