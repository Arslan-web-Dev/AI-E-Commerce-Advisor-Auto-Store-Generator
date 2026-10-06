-- ====================================================================
-- Module 1: User Authentication, RBAC Engine & System Configuration Sync
-- AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator
-- Standard: Structured after SRS v2.0 (IEEE 830 / ISO/IEC/IEEE 29148)
-- ====================================================================

-- 1. Extensions & utility triggers
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. App roles & profiles
do $$ begin
  create type public.app_role as enum ('owner', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'owner',
  must_change_password boolean not null default false,
  created_at timestamptz not null default now()
);

-- Admin check helper: runs with security definer and pinned search path
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- Secure new user profile creation:
-- Role is ALWAYS hardcoded to 'owner' regardless of any client metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'owner',
    false
  )
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end;
$$;

-- Trigger on auth.users table
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Stores & Feasibility Reports (Foundation for Module 1 account cascades)
do $$ begin
  create type public.store_status as enum ('draft', 'published', 'suspended');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.report_status as enum ('pending', 'processing', 'complete', 'failed');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.feasibility_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  idea_text text,
  city text not null,
  area text,
  lat double precision not null check (lat between 23.5 and 37.2),
  lng double precision not null check (lng between 60.8 and 77.9),
  radius_km smallint not null default 10 check (radius_km between 10 and 15),
  budget_pkr bigint not null check (budget_pkr > 0),
  features jsonb,
  feasibility_score numeric(3,2) check (feasibility_score between 0 and 1),
  risk_level text check (risk_level in ('low', 'moderate', 'high', 'critical')),
  model_version text,
  competitors jsonb,
  trend_series jsonb,
  advisory jsonb,
  data_quality numeric(3,2),
  status public.report_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_feasibility_reports_owner_created 
  on public.feasibility_reports (owner_id, created_at desc);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references public.feasibility_reports(id) on delete set null,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$'),
  custom_domain text unique,
  status public.store_status not null default 'draft',
  theme_config jsonb not null default '{}'::jsonb,
  seo_config jsonb not null default '{}'::jsonb,
  currency text not null default 'PKR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stores_owner on public.stores (owner_id);

drop trigger if exists trg_stores_updated on public.stores;
create trigger trg_stores_updated
  before update on public.stores
  for each row execute function public.set_updated_at();

-- 4. Shared Reference & Rent Cache
create table if not exists public.rent_cache (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  area text not null,
  rent_per_sqft_pkr numeric(10,2) not null,
  sample_size integer,
  source text,
  scraped_at timestamptz not null default now(),
  unique (city, area)
);

create table if not exists public.ai_call_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  purpose text not null,
  provider text not null,
  success boolean not null,
  latency_ms integer,
  error_code text,
  created_at timestamptz not null default now()
);

-- 5. System Configuration & GitHub Sync Audit Log (FR-1.6)
create table if not exists public.system_config (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique,
  description text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.config_sync_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  repository text not null,
  branch text not null default 'main',
  commit_sha text,
  status text not null check (status in ('success', 'failed')),
  exported_keys text[] not null default '{}',
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_audit_created 
  on public.config_sync_audit_log (created_at desc);

-- Pre-seed default non-sensitive system configuration items
insert into public.system_config (config_key, description, payload)
values 
  (
    'scoring_thresholds',
    'XGBoost risk level and viability score boundaries',
    '{"low_risk_min": 0.75, "moderate_risk_min": 0.55, "high_risk_min": 0.35, "critical_risk_max": 0.34}'::jsonb
  ),
  (
    'theme_presets',
    'Curated Pakistani SME brand themes and layout options',
    '{"presets": [{"id": "terracotta-craft", "name": "Artisanal Craft", "primary": "#10b981", "secondary": "#03b5d3"}, {"id": "karachi-modern", "name": "Urban Retail", "primary": "#4edea3", "secondary": "#4cd7f6"}]}'::jsonb
  ),
  (
    'seed_commercial_hubs',
    'Pre-seeded commercial centers for quick location picker',
    '{"cities": [{"city": "Lahore", "hubs": ["Gulberg III", "Liberty Market", "DHA Phase 5", "Anarkali"]}, {"city": "Karachi", "hubs": ["Clifton Block 2", "Saddar", "Zamzama", "Tariq Road"]}, {"city": "Islamabad", "hubs": ["Blue Area", "F-7 Markaz", "F-10 Markaz", "I-8 Markaz"]}]}'::jsonb
  )
on conflict (config_key) do nothing;

-- 6. Row-Level Security (RLS) Enforcement
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.feasibility_reports enable row level security;
alter table public.rent_cache enable row level security;
alter table public.ai_call_log enable row level security;
alter table public.system_config enable row level security;
alter table public.config_sync_audit_log enable row level security;

-- Force RLS on tenant tables
alter table public.stores force row level security;
alter table public.feasibility_reports force row level security;

-- PROFILES POLICIES
-- Users can read their own profile; Admin can read all profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select
  using (id = (select auth.uid()) or public.is_admin());

-- Users can update only approved non-privileged fields on their own profile
-- Users CANNOT change their role or must_change_password
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = (select p.role from public.profiles p where p.id = (select auth.uid()))
    and must_change_password = (select p.must_change_password from public.profiles p where p.id = (select auth.uid()))
  );

-- Admin can manage all profiles
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- FEASIBILITY REPORTS POLICIES
drop policy if exists reports_owner_all on public.feasibility_reports;
create policy reports_owner_all on public.feasibility_reports
  for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists reports_admin_read on public.feasibility_reports;
create policy reports_admin_read on public.feasibility_reports
  for select
  using (public.is_admin());

-- STORES POLICIES
drop policy if exists stores_owner_all on public.stores;
create policy stores_owner_all on public.stores
  for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists stores_public_read on public.stores;
create policy stores_public_read on public.stores
  for select
  using (status = 'published');

drop policy if exists stores_admin_all on public.stores;
create policy stores_admin_all on public.stores
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- RENT CACHE POLICIES
drop policy if exists rent_read_auth on public.rent_cache;
create policy rent_read_auth on public.rent_cache
  for select
  to authenticated
  using (true);

-- AI CALL LOG POLICIES
drop policy if exists ailog_admin_read on public.ai_call_log;
create policy ailog_admin_read on public.ai_call_log
  for select
  using (public.is_admin());

-- SYSTEM CONFIG POLICIES
-- Authenticated users can read config; only admins can write/update
drop policy if exists system_config_read on public.system_config;
create policy system_config_read on public.system_config
  for select
  to authenticated
  using (true);

drop policy if exists system_config_admin_all on public.system_config;
create policy system_config_admin_all on public.system_config
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- CONFIG SYNC AUDIT LOG POLICIES
-- Only admins can read or write config sync audit logs
drop policy if exists sync_audit_admin_all on public.config_sync_audit_log;
create policy sync_audit_admin_all on public.config_sync_audit_log
  for all
  using (public.is_admin())
  with check (public.is_admin());
