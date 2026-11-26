-- ====================================================================
-- Module 7: Theme Configurator persistence hardening (additive only)
-- Adds per-project store linkage, explicit theme version metadata,
-- stable history numbering and append-only protection for snapshots.
-- This file is a checked-in migration; it does not prove execution.
-- ====================================================================

begin;

-- 1. Per-project current configuration. Nullable so existing rows are untouched.
alter table public.stores
  add column if not exists project_id uuid null references public.projects(id) on delete set null;

alter table public.stores
  add column if not exists theme_config_version integer not null default 0;

alter table public.stores
  add column if not exists theme_updated_at timestamptz null;

create index if not exists idx_stores_project_theme
  on public.stores (project_id, updated_at desc);

-- 2. Stable, owner-scoped history lookup and unique version numbering.
alter table public.store_draft_versions
  add column if not exists version_number integer null;

create index if not exists idx_store_draft_versions_project
  on public.store_draft_versions (project_id, created_at desc);

create unique index if not exists uq_store_draft_versions_store_version
  on public.store_draft_versions (store_id, version_number)
  where version_number is not null;

-- 3. A store may only point to a project owned by the same user.
-- This complements, rather than replaces, the existing forced RLS policies.
create or replace function public.enforce_store_project_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.project_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.projects p
    where p.id = new.project_id
      and p.owner_id = new.owner_id
  ) then
    raise exception 'store project_id must belong to the store owner';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stores_project_owner on public.stores;
create trigger trg_stores_project_owner
  before insert or update of project_id, owner_id on public.stores
  for each row execute function public.enforce_store_project_owner();

-- 4. Theme history is append-only. Service-role maintenance remains possible.
create or replace function public.prevent_store_draft_version_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'theme history snapshots are append-only';
end;
$$;

drop trigger if exists trg_store_draft_versions_immutable on public.store_draft_versions;
create trigger trg_store_draft_versions_immutable
  before update or delete on public.store_draft_versions
  for each row execute function public.prevent_store_draft_version_mutation();

commit;

-- Manual rollback (only if this additive migration must be reversed):
--   drop trigger if exists trg_store_draft_versions_immutable on public.store_draft_versions;
--   drop trigger if exists trg_stores_project_owner on public.stores;
--   drop function if exists public.prevent_store_draft_version_mutation();
--   drop function if exists public.enforce_store_project_owner();
--   drop index if exists public.uq_store_draft_versions_store_version;
--   drop index if exists public.idx_store_draft_versions_project;
--   drop index if exists public.idx_stores_project_theme;
--   alter table public.store_draft_versions drop column if exists version_number;
--   alter table public.stores drop column if exists theme_updated_at;
--   alter table public.stores drop column if exists theme_config_version;
--   alter table public.stores drop column if exists project_id;
