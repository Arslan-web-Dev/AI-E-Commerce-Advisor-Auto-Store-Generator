-- ==============================================================================
-- Module 1 & 2 Security Remediation: Private Attachments & Forced-Password Completion
-- Migration: 20261124010000_private_attachments_and_password_completion.sql
--
-- Forward-only. Two independent hardening steps:
--   A. Correct any deployed environment where the project-attachments bucket is
--      still public, and enforce strictly owner-isolated access.
--   B. Let the trusted server-only service role complete a privileged profile
--      update (must_change_password = false) after a verified server-side
--      password change. Browser sessions remain fully restricted.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. Project attachments must be strictly private.
-- ------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then

    -- Ensure the bucket exists and is PRIVATE (public = false). Corrects any
    -- earlier public configuration on already-deployed environments.
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'project-attachments',
      'project-attachments',
      false, -- STRICTLY PRIVATE
      5242880, -- 5 MB per file
      array['application/pdf', 'text/csv', 'application/json', 'image/png', 'image/jpeg', 'image/webp']
    )
    on conflict (id) do update set
      public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf', 'text/csv', 'application/json', 'image/png', 'image/jpeg', 'image/webp'];

    -- Remove every legacy and public-read policy.
    drop policy if exists "Public can view project attachments" on storage.objects;
    drop policy if exists "Authenticated users can upload attachments" on storage.objects;
    drop policy if exists "Users can update their attachments" on storage.objects;
    drop policy if exists "Users can delete their attachments" on storage.objects;
    drop policy if exists "Owner can upload attachments" on storage.objects;
    drop policy if exists "Owner can read own attachments" on storage.objects;
    drop policy if exists "Owner can update own attachments" on storage.objects;
    drop policy if exists "Owner can delete own attachments" on storage.objects;

    -- Enforce authenticated, owner-isolated access.
    -- Object path convention: {user_id}/{project_id}/{unique_file_name}
    create policy "Owner can upload attachments"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'project-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

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

-- ------------------------------------------------------------------------------
-- B. Allow the trusted server-only service role to complete privileged profile
--    updates. Non-admin browser sessions are unaffected and remain blocked from
--    changing their own role or must_change_password flag.
-- ------------------------------------------------------------------------------
create or replace function public.enforce_profile_update_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_jwt_role text;
begin
  -- Resolve the JWT role claim robustly across PostgREST versions. Only the
  -- server-held service-role credential ever resolves to 'service_role'.
  v_jwt_role := nullif(current_setting('request.jwt.claim.role', true), '');
  if v_jwt_role is null then
    v_jwt_role := coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
      ''
    );
  end if;

  if v_jwt_role = 'service_role' then
    return new;
  end if;

  -- If the updating user is not an administrator, forbid modification of
  -- privileged columns.
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Unauthorized: Non-admin users cannot alter their role';
    end if;
    if new.must_change_password is distinct from old.must_change_password then
      raise exception 'Unauthorized: Non-admin users cannot alter must_change_password';
    end if;
    if new.id is distinct from old.id then
      raise exception 'Unauthorized: User ID cannot be modified';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_update_integrity on public.profiles;
create trigger trg_enforce_profile_update_integrity
  before update on public.profiles
  for each row
  execute function public.enforce_profile_update_integrity();

revoke all on function public.enforce_profile_update_integrity() from public;
revoke all on function public.enforce_profile_update_integrity() from anon;
grant execute on function public.enforce_profile_update_integrity() to authenticated;
