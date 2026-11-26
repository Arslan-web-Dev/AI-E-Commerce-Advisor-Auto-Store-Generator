-- ==============================================================================
-- Task 9 / Module 8: product image storage (FR-8.8)
-- Migration: 20261127030000_module8_product_image_storage.sql
--
-- Forward-only and additive. Creates only a new storage bucket and its own
-- policies. Existing private project-attachments bucket/policies are untouched.
--
-- Product marketing images are public-readable (storefront requirement) but
-- writes/deletes require public.can_manage_store() on the store UUID that is
-- the first path folder. Object path convention:
--   product-images/{store_id}/{product_id}_{random}.{extension}
--
-- Rollback removes only the objects, policies and bucket introduced here:
--   delete from storage.objects where bucket_id = 'product-images';
--   drop policy if exists ... on storage.objects;
--   delete from storage.buckets where id = 'product-images';
-- ==============================================================================

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then

    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'product-images',
      'product-images',
      true, -- public marketing assets rendered on published storefronts
      5242880, -- 5 MB per image
      array['image/jpeg', 'image/png', 'image/webp']
    )
    on conflict (id) do nothing;

    drop policy if exists "Public can view store product images" on storage.objects;
    create policy "Public can view store product images"
      on storage.objects for select
      to anon, authenticated
      using (bucket_id = 'product-images');

    drop policy if exists "Store managers can upload product images" on storage.objects;
    create policy "Store managers can upload product images"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.can_manage_store(((storage.foldername(name))[1])::uuid)
      );

    drop policy if exists "Store managers can update product images" on storage.objects;
    create policy "Store managers can update product images"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.can_manage_store(((storage.foldername(name))[1])::uuid)
      )
      with check (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.can_manage_store(((storage.foldername(name))[1])::uuid)
      );

    drop policy if exists "Store managers can delete product images" on storage.objects;
    create policy "Store managers can delete product images"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'product-images'
        and (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and public.can_manage_store(((storage.foldername(name))[1])::uuid)
      );

  end if;
end $$;
