-- ==============================================================================
-- Module 1 & 2 Security Hardening: Private Project Attachments & RBAC Verification
-- Migration: 20261123010000_storage_and_rbac_hardening.sql
-- ==============================================================================

-- 1. Ensure storage schema exists and configure private project-attachments bucket
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    
    -- Ensure bucket exists and is strictly PRIVATE (public = false)
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'project-attachments',
      'project-attachments',
      false, -- STRICTLY PRIVATE
      5242880, -- 5 MB limit per file
      array['application/pdf', 'text/csv', 'application/json', 'image/png', 'image/jpeg', 'image/webp']
    )
    on conflict (id) do update set
      public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf', 'text/csv', 'application/json', 'image/png', 'image/jpeg', 'image/webp'];

    -- 2. Drop legacy public storage policies
    drop policy if exists "Public can view project attachments" on storage.objects;
    drop policy if exists "Authenticated users can upload attachments" on storage.objects;
    drop policy if exists "Users can update their attachments" on storage.objects;
    drop policy if exists "Users can delete their attachments" on storage.objects;
    drop policy if exists "Owner can view their own attachments" on storage.objects;

    -- 3. Enforce authenticated, owner-isolated storage policies
    -- Object path convention: {user_id}/{project_id}/{unique_file_name}

    -- INSERT: Users can only upload into their own root directory matching auth.uid()
    create policy "Owner can upload attachments"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'project-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    -- SELECT: Users can only read objects in their own directory, or admins can view all
    create policy "Owner can read own attachments"
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'project-attachments'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.is_admin()
        )
      );

    -- UPDATE: Users can only modify objects in their own directory
    create policy "Owner can update own attachments"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'project-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'project-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    -- DELETE: Users can only delete objects in their own directory
    create policy "Owner can delete own attachments"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'project-attachments'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.is_admin()
        )
      );

  end if;
end $$;

-- 4. Harden profile self-escalation protection
-- Ensure no authenticated user can alter their own role
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and must_change_password = (select p.must_change_password from public.profiles p where p.id = auth.uid())
  );
