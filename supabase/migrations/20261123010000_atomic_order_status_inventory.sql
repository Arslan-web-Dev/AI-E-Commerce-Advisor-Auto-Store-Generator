-- =============================================================================
-- Atomic Module 8 order status + inventory transition
-- Keeps the order state, stock levels, inventory ledger and history in one
-- transaction. The caller must be the store owner or an administrator.
-- =============================================================================

create or replace function public.transition_store_order(
  p_store_id uuid,
  p_order_id uuid,
  p_target_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_new_stock integer;
  v_actor text;
  v_restore boolean := false;
  v_decrement boolean := false;
  v_history jsonb;
begin
  if auth.uid() is null or not public.can_manage_store(p_store_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if p_target_status not in ('pending','confirmed','packed','shipped','delivered','cancelled','returned') then
    raise exception 'Invalid order status' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and store_id = p_store_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.status = p_target_status then
    raise exception 'Order is already in the requested status' using errcode = '22023';
  end if;

  if not (
    (v_order.status = 'pending' and p_target_status in ('confirmed','cancelled')) or
    (v_order.status = 'confirmed' and p_target_status in ('packed','cancelled')) or
    (v_order.status = 'packed' and p_target_status in ('shipped','cancelled')) or
    (v_order.status = 'shipped' and p_target_status in ('delivered','returned')) or
    (v_order.status = 'delivered' and p_target_status = 'returned')
  ) then
    raise exception 'Invalid order status transition: % -> %', v_order.status, p_target_status
      using errcode = '22023';
  end if;

  v_decrement := v_order.status = 'pending' and p_target_status = 'confirmed';
  v_restore := (
    (v_order.status in ('confirmed','packed') and p_target_status = 'cancelled') or
    (v_order.status in ('shipped','delivered') and p_target_status = 'returned')
  );
  v_actor := coalesce(auth.jwt()->>'email', auth.uid()::text);

  if v_decrement or v_restore then
    -- Stable lock order reduces deadlock risk when an order has multiple SKUs.
    for v_item in
      select oi.product_id, sum(oi.quantity)::integer as quantity
      from public.order_items oi
      where oi.order_id = v_order.id and oi.product_id is not null
      group by oi.product_id
      order by oi.product_id
    loop
      if v_decrement then
        update public.products
        set stock = stock - v_item.quantity
        where id = v_item.product_id
          and store_id = p_store_id
          and stock >= v_item.quantity
        returning stock into v_new_stock;

        if not found then
          raise exception 'Insufficient stock to confirm order' using errcode = '23514';
        end if;

        insert into public.inventory_logs (
          store_id, product_id, delta, previous_stock, new_stock, reason, actor_id
        )
        values (
          p_store_id, v_item.product_id, -v_item.quantity,
          v_new_stock + v_item.quantity, v_new_stock, 'order_placed', auth.uid()
        );
      else
        update public.products
        set stock = stock + v_item.quantity
        where id = v_item.product_id and store_id = p_store_id
        returning stock into v_new_stock;

        if not found then
          raise exception 'Order product no longer belongs to this store' using errcode = '23503';
        end if;

        insert into public.inventory_logs (
          store_id, product_id, delta, previous_stock, new_stock, reason, actor_id
        )
        values (
          p_store_id, v_item.product_id, v_item.quantity,
          v_new_stock - v_item.quantity, v_new_stock,
          case when p_target_status = 'cancelled' then 'order_cancelled' else 'restock' end,
          auth.uid()
        );
      end if;
    end loop;
  end if;

  v_history := coalesce(v_order.status_history, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'status', p_target_status,
      'changed_at', now(),
      'actor', v_actor,
      'notes', nullif(btrim(coalesce(p_notes, '')), '')
    )
  );

  update public.orders
  set status = p_target_status,
      status_history = v_history,
      fulfillment_status = case
        when p_target_status = 'delivered' then 'fulfilled'
        when p_target_status = 'cancelled' then 'cancelled'
        when p_target_status = 'returned' then 'returned'
        else fulfillment_status
      end,
      payment_status = case
        when p_target_status = 'delivered' and payment_method = 'cod' then 'paid'
        else payment_status
      end
  where id = v_order.id
  returning * into v_order;

  return jsonb_build_object('order', to_jsonb(v_order));
end;
$$;

revoke all on function public.transition_store_order(uuid, uuid, text, text) from public;
grant execute on function public.transition_store_order(uuid, uuid, text, text) to authenticated;

comment on function public.transition_store_order(uuid, uuid, text, text)
is 'Atomically validates order transition, adjusts stock and writes inventory history for the authenticated store owner/admin.';
