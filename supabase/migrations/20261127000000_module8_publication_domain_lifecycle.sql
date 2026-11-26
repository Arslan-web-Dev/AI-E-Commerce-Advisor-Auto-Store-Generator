-- ==============================================================================
-- Task 9 / Module 8: publication, custom-domain lifecycle and slug guard
-- Migration: 20261127000000_module8_publication_domain_lifecycle.sql
--
-- Forward-only and strictly additive:
--   * No existing table, row, enum (public.store_status), is_banned flag,
--     project_id, theme_config_version or append-only store_draft_versions row
--     is dropped, rewritten or relaxed.
--   * All new columns are defaulted or nullable, so existing stores stay valid.
--   * The new lifecycle-events table is FORCE-RLS protected with a single
--     owner/admin SELECT policy. There are deliberately no anon write policies;
--     writes are performed only by SECURITY DEFINER RPCs.
--   * No browser role receives service-role capability anywhere in this file.
--   * public.set_store_admin_state is an admin-only SECURITY DEFINER RPC; the
--     caller-supplied p_actor_id is audit metadata only and never authorizes.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. Publication / custom-domain state on public.stores.
--    domain_status is defaulted so legacy rows immediately read as
--    'not_configured'; the other fields are nullable and start empty.
-- ------------------------------------------------------------------------------
alter table public.stores
  add column if not exists domain_status text not null default 'not_configured'
    check (domain_status in ('not_configured', 'pending', 'verified', 'failed', 'provider_unavailable')),
  add column if not exists domain_verification_token text,
  add column if not exists domain_challenges jsonb not null default '[]'::jsonb,
  add column if not exists domain_verified_at timestamptz,
  add column if not exists domain_attached_at timestamptz,
  add column if not exists domain_provider_reference text,
  add column if not exists domain_last_error text,
  add column if not exists published_at timestamptz,
  add column if not exists unpublished_at timestamptz,
  add column if not exists suspended_at timestamptz;

comment on column public.stores.domain_status is
  'Server-owned custom-domain state machine: not_configured -> pending -> verified | failed | provider_unavailable';
comment on column public.stores.domain_challenges is
  'DNS/HTTP challenge descriptors issued by the server; never includes secrets supplied by a browser';

-- ------------------------------------------------------------------------------
-- 2. Append-style store lifecycle audit events.
-- ------------------------------------------------------------------------------
create table if not exists public.store_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (
    action in ('publish', 'unpublish', 'suspend', 'unsuspend', 'domain_add', 'domain_verify', 'domain_remove')
  ),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_store_lifecycle_events_store_created
  on public.store_lifecycle_events (store_id, created_at desc);

create index if not exists idx_store_lifecycle_events_action
  on public.store_lifecycle_events (store_id, action, created_at desc);

alter table public.store_lifecycle_events enable row level security;
alter table public.store_lifecycle_events force row level security;

-- Drop/recreate (never "create policy if not exists", which is not valid SQL).
drop policy if exists "Store owners and admins read lifecycle events" on public.store_lifecycle_events;
create policy "Store owners and admins read lifecycle events"
  on public.store_lifecycle_events
  for select
  to authenticated
  using (public.can_manage_store(store_id));

-- Intentionally NO insert/update/delete policy and NO anon policy. Only
-- SECURITY DEFINER RPCs (owned by the migration role) write to this table.
revoke all on public.store_lifecycle_events from public;
revoke all on public.store_lifecycle_events from anon;
grant select on public.store_lifecycle_events to authenticated;

-- ------------------------------------------------------------------------------
-- 3. One project can back at most one store.
--    Fail closed on pre-existing duplicates: this migration never deletes,
--    reassigns or otherwise mutates stores to make the index buildable.
-- ------------------------------------------------------------------------------
do $$
declare
  v_duplicate_projects integer;
begin
  select count(*)
  into v_duplicate_projects
  from (
    select project_id
    from public.stores
    where project_id is not null
    group by project_id
    having count(*) > 1
  ) as d;

  if v_duplicate_projects > 0 then
    raise exception
      'Cannot create unique index uq_stores_project_id_task9: % project_id value(s) are linked to multiple stores. Resolve them manually; this migration will not delete or mutate stores.',
      v_duplicate_projects;
  end if;
end $$;

create unique index if not exists uq_stores_project_id_task9
  on public.stores (project_id)
  where project_id is not null;

-- ------------------------------------------------------------------------------
-- 4. Slug format + reserved-slug guard.
--    Only this new trigger is dropped/recreated; every other stores trigger
--    (including trg_stores_updated and trg_stores_project_owner) is untouched.
-- ------------------------------------------------------------------------------
create or replace function public.validate_store_slug_format()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_reserved text[] := array[
    'api', 'admin', 'login', 'auth', 'logout', 'signup', 'register',
    'dashboard', 'projects', 'wizard', 'market-intelligence', 'account',
    'reset-password', 'update-password', 'health', 'sitemap', 'robots',
    'static', '_next', 'favicon', 'stores', 'storefront', 'cdn', 'www'
  ];
begin
  if new.slug is null
     or new.slug !~ '^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$' then
    raise exception
      'Invalid store slug: use 3-30 lowercase letters, digits and internal hyphens only'
      using errcode = '22023';
  end if;

  if new.slug = any(v_reserved) then
    raise exception 'Reserved store slug: %', new.slug using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stores_slug_reserved_validation on public.stores;
create trigger trg_stores_slug_reserved_validation
  before insert or update of slug on public.stores
  for each row execute function public.validate_store_slug_format();

-- ------------------------------------------------------------------------------
-- 5. Admin-only suspension / unsuspension RPC.
--    Authorization is derived exclusively from auth.uid() and public.is_admin().
--    p_actor_id is accepted for signature compatibility only; it is never used
--    for authorization and the audit actor_id is always auth.uid().
-- ------------------------------------------------------------------------------
create or replace function public.set_store_admin_state(
  p_store_id uuid,
  p_banned boolean,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_banned boolean := coalesce(p_banned, false);
  v_store public.stores%rowtype;
  v_action text;
  v_details jsonb;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Forbidden: admin privileges are required to change store state'
      using errcode = '42501';
  end if;

  select *
  into v_store
  from public.stores
  where id = p_store_id
  for update;

  if not found then
    raise exception 'Store not found' using errcode = 'P0002';
  end if;

  if v_banned then
    update public.stores
    set is_banned = true,
        status = 'draft',
        suspended_at = now()
    where id = p_store_id;
    v_action := 'suspend';
    v_details := jsonb_build_object(
      'from_status', v_store.status::text,
      'to_status', 'draft',
      'from_is_banned', v_store.is_banned,
      'to_is_banned', true
    );
  else
    update public.stores
    set is_banned = false,
        suspended_at = null
    where id = p_store_id;
    v_action := 'unsuspend';
    v_details := jsonb_build_object(
      'from_status', v_store.status::text,
      'to_status', v_store.status::text,
      'from_is_banned', v_store.is_banned,
      'to_is_banned', false
    );
  end if;

  insert into public.store_lifecycle_events (store_id, actor_id, action, details)
  values (p_store_id, v_uid, v_action, v_details);

  return jsonb_build_object(
    'id', p_store_id,
    'is_banned', v_banned,
    'status', case when v_banned then 'draft'::text else v_store.status::text end
  );
end;
$$;

revoke all on function public.set_store_admin_state(uuid, boolean, uuid) from public;
revoke all on function public.set_store_admin_state(uuid, boolean, uuid) from anon;
grant execute on function public.set_store_admin_state(uuid, boolean, uuid) to authenticated;

commit;

-- ------------------------------------------------------------------------------
-- Manual rollback (additive migration; only reverse after application code is
-- reverted). Never drop pre-existing tables, enums or columns from Modules 1-7.
--   drop function if exists public.set_store_admin_state(uuid, boolean, uuid);
--   drop trigger if exists trg_stores_slug_reserved_validation on public.stores;
--   drop function if exists public.validate_store_slug_format();
--   drop index if exists public.uq_stores_project_id_task9;
--   drop policy if exists "Store owners and admins read lifecycle events"
--     on public.store_lifecycle_events;
--   drop table if exists public.store_lifecycle_events;
--   alter table public.stores
--     drop column if exists suspended_at,
--     drop column if exists unpublished_at,
--     drop column if exists published_at,
--     drop column if exists domain_last_error,
--     drop column if exists domain_provider_reference,
--     drop column if exists domain_attached_at,
--     drop column if exists domain_verified_at,
--     drop column if exists domain_challenges,
--     drop column if exists domain_verification_token,
--     drop column if exists domain_status;
-- ------------------------------------------------------------------------------
