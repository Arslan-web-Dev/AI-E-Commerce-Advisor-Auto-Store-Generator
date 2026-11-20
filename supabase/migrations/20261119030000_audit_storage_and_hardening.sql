-- ==============================================================================
-- Additive Schema Hardening & Storage Configuration
-- Migration: 20261006080000_audit_storage_and_hardening.sql
-- Conforms to: FINAL_DELIVERY_BASELINE.md and requirements-traceability.md
-- SAFETY: Purely additive. Preserves all tables, rows, and relationships.
-- ==============================================================================

-- 1. Ensure `is_banned` exists on stores with default false
alter table public.stores 
  add column if not exists is_banned boolean not null default false;

-- 2. Update stores public read policy to exclude banned stores
drop policy if exists stores_public_read on public.stores;
create policy stores_public_read on public.stores
  for select
  using (status = 'published' and is_banned = false);

-- 3. Idempotent Policy Hardening for Store Products (Module 8)
drop policy if exists "Owners manage store products" on public.products;
create policy "Owners manage store products"
  on public.products
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

drop policy if exists "Public can view active products of published stores" on public.products;
create policy "Public can view active products of published stores"
  on public.products
  for select
  to public
  using (
    is_active = true and is_archived = false and exists (
      select 1 from public.stores 
      where id = products.store_id 
        and status = 'published' 
        and is_banned = false
    )
  );

-- 4. Idempotent Policy Hardening for Orders and Order Items
drop policy if exists "Owners manage store orders" on public.orders;
create policy "Owners manage store orders"
  on public.orders
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

drop policy if exists "Owners manage store order items" on public.order_items;
create policy "Owners manage store order items"
  on public.order_items
  for all
  to authenticated
  using (
    exists (
      select 1 from public.orders 
      where id = order_items.order_id 
        and public.can_manage_store(orders.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders 
      where id = order_items.order_id 
        and public.can_manage_store(orders.store_id)
    )
  );

-- 5. Idempotent Policy Hardening for Customers, Inventory Logs, Payment Settings
drop policy if exists "Owners manage store customers" on public.customers;
create policy "Owners manage store customers"
  on public.customers
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

drop policy if exists "Owners view store inventory logs" on public.inventory_logs;
create policy "Owners view store inventory logs"
  on public.inventory_logs
  for select
  to authenticated
  using (public.can_manage_store(store_id));

drop policy if exists "Owners insert store inventory logs" on public.inventory_logs;
create policy "Owners insert store inventory logs"
  on public.inventory_logs
  for insert
  to authenticated
  with check (public.can_manage_store(store_id));

drop policy if exists "Owners manage store payment settings" on public.store_payment_settings;
create policy "Owners manage store payment settings"
  on public.store_payment_settings
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- 6. Storage Bucket Configuration (FR-2.2 & NFR-C4: Project Attachment Uploads)
-- Safely register the project-attachments bucket if storage extension is available
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'project-attachments',
      'project-attachments',
      true,
      5242880, -- 5 MB
      array['application/pdf', 'text/csv', 'application/json', 'image/png', 'image/jpeg', 'image/webp']
    )
    on conflict (id) do update set
      public = true,
      file_size_limit = 5242880;

    -- Storage Object Policies
    drop policy if exists "Authenticated users can upload attachments" on storage.objects;
    create policy "Authenticated users can upload attachments"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'project-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    drop policy if exists "Users can update their attachments" on storage.objects;
    create policy "Users can update their attachments"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'project-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    drop policy if exists "Users can delete their attachments" on storage.objects;
    create policy "Users can delete their attachments"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'project-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    drop policy if exists "Public can view project attachments" on storage.objects;
    create policy "Public can view project attachments"
      on storage.objects for select
      using (bucket_id = 'project-attachments');
  end if;
end $$;
