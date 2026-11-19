-- Allow verified administrators to manage model registry entries.
-- Authenticated users retain read-only access through model_registry_read.
drop policy if exists model_registry_admin_manage on public.model_registry;
create policy model_registry_admin_manage on public.model_registry
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
