-- ==============================================================================
-- MIGRATION FILE: 20261004000000_module1_auth_rbac_schema.sql
-- ==============================================================================
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




-- ==============================================================================
-- MIGRATION FILE: 20261006000000_module2_projects_wizard_schema.sql
-- ==============================================================================
-- ====================================================================
-- Module 2: Business Idea Input and Project Creation Schema
-- AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator
-- Standard: Structured after SRS v2.0 (FR-2.1, FR-2.2, FR-2.6)
-- ====================================================================

-- 1. Enums for Project Status & Scale
do $$ begin
  create type public.project_status as enum ('draft', 'submitted', 'analyzing', 'completed', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.business_scale as enum ('small', 'medium', 'large');
exception
  when duplicate_object then null;
end $$;

-- 2. Projects Table
create table if not exists public.projects (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users(id) on delete cascade,
  title                text,
  category             text not null,
  custom_category      text,
  target_location      text not null,
  city                 text,
  district             text,
  region               text,
  country              text default 'Pakistan',
  postal_code          text,
  lat                  double precision,
  lng                  double precision,
  radius_km            numeric(4,1) not null default 10.0 check (radius_km between 1.0 and 50.0),
  budget_amount        numeric(12,2) not null check (budget_amount > 0),
  budget_currency      text not null default 'USD' check (budget_currency in ('USD', 'PKR')),
  budget_pkr           bigint,
  
  -- FR-2.2 Advanced Input Options
  target_audience      jsonb not null default '{}'::jsonb, -- { age_group, gender, income_level }
  business_scale       public.business_scale not null default 'small',
  business_model       text not null default 'hybrid' check (business_model in ('d2c', 'hybrid', 'physical')),
  storefront_footprint text default 'boutique', -- 'kiosk', 'boutique', 'commercial', 'flagship'
  product_description  text,
  product_types        text[] not null default '{}',
  product_file_url     text,
  product_file_name    text,
  product_file_size    integer,
  
  -- Draft State & Metadata
  current_step         integer not null default 1 check (current_step between 1 and 5),
  form_version         integer not null default 1,
  metadata             jsonb not null default '{}'::jsonb,
  
  -- Lifecycle Status & Analysis Linkage
  status               public.project_status not null default 'draft',
  report_id            uuid references public.feasibility_reports(id) on delete set null,
  
  -- Timestamps
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  submitted_at         timestamptz
);

-- Indexes for efficient queries
create index if not exists idx_projects_owner_updated 
  on public.projects (owner_id, updated_at desc);

create index if not exists idx_projects_status 
  on public.projects (status);

-- Updated_at trigger
drop trigger if exists trg_projects_updated on public.projects;
create trigger trg_projects_updated
  before update on public.projects
  for each row execute function public.set_updated_at();

-- 3. Row Level Security (RLS)
alter table public.projects enable row level security;
alter table public.projects force row level security;

-- Owners can view their own projects; Admins can view all
drop policy if exists projects_owner_select on public.projects;
create policy projects_owner_select on public.projects
  for select
  using (owner_id = (select auth.uid()) or public.is_admin());

-- Owners can insert projects for themselves
drop policy if exists projects_owner_insert on public.projects;
create policy projects_owner_insert on public.projects
  for insert
  with check (owner_id = (select auth.uid()));

-- Owners can update their projects only while in 'draft' status; Admins can update all
drop policy if exists projects_owner_update on public.projects;
create policy projects_owner_update on public.projects
  for update
  using (
    (owner_id = (select auth.uid()) and status = 'draft')
    or public.is_admin()
  )
  with check (
    owner_id = (select auth.uid()) or public.is_admin()
  );

-- Owners can delete their own drafts; Admins can delete all
drop policy if exists projects_owner_delete on public.projects;
create policy projects_owner_delete on public.projects
  for delete
  using (
    (owner_id = (select auth.uid()) and status = 'draft')
    or public.is_admin()
  );




-- ==============================================================================
-- MIGRATION FILE: 20261006010000_module3_data_collection_schema.sql
-- ==============================================================================
-- ====================================================================
-- Module 3: Data Collection and Provider Integration Schema
-- AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator
-- Standard: Structured after SRS v2.0 (FR-3.1, FR-3.2, FR-3.3)
-- ====================================================================

-- 1. Collection Runs Table
create table if not exists public.project_collection_runs (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'running', 'completed', 'partial', 'failed', 'unavailable')),
  providers_status jsonb not null default '{}'::jsonb,
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_collection_runs_project 
  on public.project_collection_runs (project_id, created_at desc);

-- 2. Competitor POI Records (FR-3.1)
create table if not exists public.project_competitors (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  run_id       uuid references public.project_collection_runs(id) on delete cascade,
  name         text not null,
  category     text not null,
  provider     text not null default 'overpass_osm',
  provenance   text not null default 'external_api' check (provenance in ('external_api', 'synthetic_demo', 'licensed_dataset', 'manual_estimate')),
  lat          double precision not null,
  lng          double precision not null,
  distance_km  numeric(6,2) not null,
  rating       numeric(3,2),
  review_count integer,
  price_level  text,
  address      text,
  raw_data     jsonb,
  retrieved_at timestamptz not null default now()
);

create index if not exists idx_competitors_project 
  on public.project_competitors (project_id, distance_km);

-- 3. Regional Demographics & Market Observations (FR-3.2)
create table if not exists public.project_market_observations (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  run_id          uuid references public.project_collection_runs(id) on delete cascade,
  metric_name     text not null,
  metric_value    numeric(14,2) not null,
  unit            text not null,
  geography       text not null,
  period_year     integer not null default 2024,
  provider        text not null default 'pbs_census',
  provenance      text not null default 'licensed_dataset' check (provenance in ('external_api', 'synthetic_demo', 'licensed_dataset', 'manual_estimate')),
  source_citation text,
  retrieved_at    timestamptz not null default now()
);

create index if not exists idx_market_obs_project 
  on public.project_market_observations (project_id, metric_name);

-- 4. Category Demand & Search Trends (FR-3.2)
create table if not exists public.project_demand_trends (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  run_id       uuid references public.project_collection_runs(id) on delete cascade,
  category     text not null,
  region       text not null default 'PK',
  trend_series jsonb not null default '[]'::jsonb, -- array of { month: string, index: number }
  avg_interest numeric(5,2) not null,
  trend_slope  text not null default 'stable' check (trend_slope in ('growing', 'stable', 'declining')),
  provider     text not null default 'google_trends',
  provenance   text not null default 'external_api' check (provenance in ('external_api', 'synthetic_demo', 'licensed_dataset', 'manual_estimate')),
  retrieved_at timestamptz not null default now()
);

create index if not exists idx_demand_trends_project 
  on public.project_demand_trends (project_id);

-- 5. Cost Baselines & Estimates (FR-3.3)
create table if not exists public.project_cost_estimates (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  run_id         uuid references public.project_collection_runs(id) on delete cascade,
  cost_type      text not null check (cost_type in ('setup', 'rent_monthly', 'marketing_initial', 'logistics_per_order')),
  amount_min     numeric(12,2) not null,
  amount_max     numeric(12,2) not null,
  currency       text not null default 'PKR' check (currency in ('USD', 'PKR')),
  period_or_unit text not null default 'one-time',
  assumptions    text,
  provider       text not null default 'rent_cache_model',
  provenance     text not null default 'manual_estimate' check (provenance in ('external_api', 'synthetic_demo', 'licensed_dataset', 'manual_estimate')),
  retrieved_at   timestamptz not null default now()
);

create index if not exists idx_cost_estimates_project 
  on public.project_cost_estimates (project_id, cost_type);

-- ====================================================================
-- 6. Row-Level Security (RLS) Enforcement on Data Collection Tables
-- ====================================================================
alter table public.project_collection_runs enable row level security;
alter table public.project_collection_runs force row level security;

alter table public.project_competitors enable row level security;
alter table public.project_competitors force row level security;

alter table public.project_market_observations enable row level security;
alter table public.project_market_observations force row level security;

alter table public.project_demand_trends enable row level security;
alter table public.project_demand_trends force row level security;

alter table public.project_cost_estimates enable row level security;
alter table public.project_cost_estimates force row level security;

-- RLS Helper: Project ownership verification
create or replace function public.can_access_project(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects
    where id = p_id
      and (owner_id = auth.uid() or public.is_admin())
  );
$$;

-- Collection Runs Policies
drop policy if exists collection_runs_access on public.project_collection_runs;
create policy collection_runs_access on public.project_collection_runs
  for all
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

-- Competitors Policies
drop policy if exists competitors_access on public.project_competitors;
create policy competitors_access on public.project_competitors
  for all
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

-- Market Observations Policies
drop policy if exists market_obs_access on public.project_market_observations;
create policy market_obs_access on public.project_market_observations
  for all
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

-- Demand Trends Policies
drop policy if exists demand_trends_access on public.project_demand_trends;
create policy demand_trends_access on public.project_demand_trends
  for all
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

-- Cost Estimates Policies
drop policy if exists cost_estimates_access on public.project_cost_estimates;
create policy cost_estimates_access on public.project_cost_estimates
  for all
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));




-- ==============================================================================
-- MIGRATION FILE: 20261006020000_module4_feature_processing_schema.sql
-- ==============================================================================
-- ====================================================================
-- Module 4: Data Processing and Feature Engineering Schema
-- AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator
-- Standard: Structured after SRS v2.0 (FR-4.1, FR-4.2)
-- ====================================================================

-- 1. Feature Processing Runs Table (FR-4.2 Auditable Lifecycle)
create table if not exists public.project_processing_runs (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  collection_run_id    uuid references public.project_collection_runs(id) on delete set null,
  status               text not null default 'pending' check (status in ('pending', 'running', 'completed', 'partial', 'failed')),
  quality_score        numeric(5,2) not null default 0.00 check (quality_score >= 0.00 and quality_score <= 100.00),
  data_completeness    text not null default 'unavailable' check (data_completeness in ('complete', 'partial', 'unavailable')),
  imputations_count    integer not null default 0,
  deduplication_stats  jsonb not null default '{}'::jsonb,
  domain_completeness  jsonb not null default '{}'::jsonb,
  provenance_summary   jsonb not null default '{}'::jsonb,
  error_log            text,
  started_at           timestamptz not null default now(),
  completed_at         timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists idx_processing_runs_project 
  on public.project_processing_runs (project_id, created_at desc);

-- 2. Project Features Table (FR-4.1 ML-ready Engineered Features)
create table if not exists public.project_features (
  id                          uuid primary key default gen_random_uuid(),
  project_id                  uuid not null references public.projects(id) on delete cascade,
  processing_run_id           uuid not null references public.project_processing_runs(id) on delete cascade,
  competitors_count           integer not null default 0,
  category_saturation         numeric(16,8), -- competitors_count / population (null if population unavailable)
  budget_ratio                numeric(10,4), -- user_budget / estimated_total_cost
  avg_demand_index            numeric(6,2),  -- 0.00 to 100.00
  trend_slope                 text check (trend_slope in ('growing', 'stable', 'declining')),
  trend_slope_score           numeric(4,2),  -- +1.00 (growing), 0.00 (stable), -1.00 (declining)
  population                  bigint,
  internet_penetration_pct    numeric(5,2),
  ecommerce_growth_rate_pct   numeric(5,2),
  total_estimated_setup_cost  numeric(14,2), -- In project currency
  total_estimated_monthly_cost numeric(14,2), -- In project currency
  total_estimated_annual_cost numeric(14,2), -- In project currency
  user_budget                 numeric(14,2),
  currency                    text not null default 'PKR',
  engineered_vector           jsonb not null default '{}'::jsonb, -- ML-ready normalized features
  feature_version             text not null default 'v1.0',
  created_at                  timestamptz not null default now()
);

create index if not exists idx_features_project 
  on public.project_features (project_id, created_at desc);

create index if not exists idx_features_run 
  on public.project_features (processing_run_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

alter table public.project_processing_runs enable row level security;
alter table public.project_processing_runs force row level security;

alter table public.project_features enable row level security;
alter table public.project_features force row level security;

-- Processing Runs Policies
drop policy if exists processing_runs_access on public.project_processing_runs;
create policy processing_runs_access on public.project_processing_runs
  for all
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));

-- Project Features Policies
drop policy if exists features_access on public.project_features;
create policy features_access on public.project_features
  for all
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));




-- ==============================================================================
-- MIGRATION FILE: 20261006030000_module5_feasibility_schema.sql
-- ==============================================================================
-- ====================================================================
-- Module 5: Feasibility Prediction and Score Classification Schema
-- AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator
-- Standard: Structured after SRS v2.0 (FR-5.1, FR-5.2, FR-5.3)
-- ====================================================================

-- 1. Model Registry Table (FR-5.3 Admin Retraining Controls)
create table if not exists public.model_registry (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  version              text not null,
  scoring_mode         text not null check (scoring_mode in ('supervised_model', 'provisional_mcda')),
  is_active            boolean not null default false,
  configuration        jsonb not null default '{}'::jsonb, -- Weights for MCDA or model refs
  evaluation_metrics   jsonb,
  training_dataset_ref text,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  unique(name, version)
);

create unique index if not exists idx_model_registry_active on public.model_registry (scoring_mode) where is_active = true;

-- 2. Feasibility Runs Table (FR-5.1, FR-5.2)
create table if not exists public.project_feasibility_runs (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  processing_run_id    uuid not null references public.project_processing_runs(id) on delete cascade,
  model_id             uuid references public.model_registry(id) on delete set null,
  score_value          numeric(5,4) check (score_value >= 0.0 and score_value <= 1.0),
  scoring_mode         text not null check (scoring_mode in ('supervised_model', 'provisional_mcda', 'unavailable')),
  classification       text check (classification in ('High Feasibility', 'Medium Feasibility', 'Low Feasibility', 'Not Feasible')),
  explanations         jsonb not null default '{}'::jsonb,
  status               text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_log            text,
  created_at           timestamptz not null default now()
);

create index if not exists idx_feasibility_runs_project on public.project_feasibility_runs (project_id, created_at desc);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

alter table public.model_registry enable row level security;
alter table public.model_registry force row level security;

alter table public.project_feasibility_runs enable row level security;
alter table public.project_feasibility_runs force row level security;

-- Model Registry Policies: Read-only for authenticated, write restricted to super_admin via RPC/direct backend access
drop policy if exists model_registry_read on public.model_registry;
create policy model_registry_read on public.model_registry
  for select
  to authenticated
  using (true);

-- Feasibility Runs Policies: Bound to project access
drop policy if exists feasibility_runs_access on public.project_feasibility_runs;
create policy feasibility_runs_access on public.project_feasibility_runs
  for all
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));




-- ==============================================================================
-- MIGRATION FILE: 20261006040000_module6_strategic_advisory_schema.sql
-- ==============================================================================
-- ====================================================================
-- Module 6: Strategic Advisory and Budget Allocation Schema
-- AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator
-- Standard: Structured after SRS v2.0 (FR-6.1, FR-6.2, FR-6.3)
-- ====================================================================

-- 1. Advisory Reports Table
create table if not exists public.project_advisory_reports (
  id                        uuid primary key default gen_random_uuid(),
  project_id                uuid not null references public.projects(id) on delete cascade,
  feasibility_run_id        uuid not null references public.project_feasibility_runs(id) on delete cascade,
  processing_run_id         uuid not null references public.project_processing_runs(id) on delete cascade,
  
  -- Dynamic Budget Allocation Planning Scenario
  budget_currency           text not null default 'PKR',
  budget_total              numeric(14,2) not null,
  budget_allocations        jsonb not null default '{}'::jsonb, -- { inventory, marketing, operations, contingency }
  
  -- Structured Insights (Deterministic)
  insights                  jsonb not null default '{}'::jsonb, -- { strengths: [], risks: [], immediate_actions: [] }
  
  -- Location / Commercial Hub Recommendations
  location_recommendations  jsonb not null default '{"status": "unavailable", "reason": "No comparable spatial hub data available in current scope"}'::jsonb,
  
  -- Audit and Metadata
  advisory_version          text not null default 'v1.0',
  metadata                  jsonb not null default '{}'::jsonb, -- language, currency conversion rates
  status                    text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  error_log                 text,
  created_at                timestamptz not null default now()
);

-- Index for efficient querying of a project's latest advisory report
create index if not exists idx_advisory_reports_project 
  on public.project_advisory_reports (project_id, created_at desc);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

alter table public.project_advisory_reports enable row level security;
alter table public.project_advisory_reports force row level security;

drop policy if exists advisory_reports_access on public.project_advisory_reports;
create policy advisory_reports_access on public.project_advisory_reports
  for all
  using (public.can_access_project(project_id))
  with check (public.can_access_project(project_id));




-- ==============================================================================
-- MIGRATION FILE: 20261006050000_module7_storefront_configurator_schema.sql
-- ==============================================================================
-- ====================================================================
-- Module 7: Theme Configurator, Variant Catalog & Storefront Draft
-- AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator
-- Standard: Structured after SRS v2.0 (FR-7.1â€“FR-7.6)
-- ====================================================================

-- 1. Store Wizard Answers (persisted MCQ state per project attempt)
create table if not exists public.store_wizard_sessions (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users(id) on delete cascade,
  project_id           uuid references public.projects(id) on delete set null,
  
  -- MCQ answers (schema-versioned JSONB; never executable)
  answers              jsonb not null default '{}'::jsonb,
  answers_version      text not null default 'v1.0',
  
  -- Derived recommendation
  recommended_template text,          -- allowlisted template ID
  recommended_variants jsonb,         -- { section_id -> variant_id }
  
  -- State
  current_step         integer not null default 1 check (current_step between 1 and 4),
  status               text not null default 'in_progress'
                       check (status in ('in_progress', 'completed', 'abandoned')),
  
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists trg_wizard_sessions_updated on public.store_wizard_sessions;
create trigger trg_wizard_sessions_updated
  before update on public.store_wizard_sessions
  for each row execute function public.set_updated_at();

create index if not exists idx_wizard_sessions_owner
  on public.store_wizard_sessions (owner_id, updated_at desc);

-- 2. Store Draft Versions (versioned theme manifests; immutable after compile)
create table if not exists public.store_draft_versions (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null references public.stores(id) on delete cascade,
  wizard_session_id    uuid references public.store_wizard_sessions(id) on delete set null,
  project_id           uuid references public.projects(id) on delete set null,
  feasibility_run_id   uuid references public.project_feasibility_runs(id) on delete set null,

  -- Validated manifest (variant IDs + props only; no executable code)
  manifest             jsonb not null default '{}'::jsonb,
  manifest_version     text not null default 'v1.0',
  
  -- Compilation metadata
  compile_status       text not null default 'pending'
                       check (compile_status in ('pending', 'compiled', 'failed')),
  compile_errors       jsonb,
  
  -- Approval gate: stores must remain in 'draft' status until published by a future workflow
  -- Users cannot self-approve; this column is set server-side only
  approval_ref         text,
  
  version_label        text,  -- e.g. "v1", "v2-adjusted-hero"
  created_at           timestamptz not null default now()
);

create index if not exists idx_store_drafts_store
  on public.store_draft_versions (store_id, created_at desc);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

alter table public.store_wizard_sessions enable row level security;
alter table public.store_wizard_sessions force row level security;

alter table public.store_draft_versions enable row level security;
alter table public.store_draft_versions force row level security;

-- Wizard sessions: owner can manage their own
drop policy if exists wizard_sessions_owner_all on public.store_wizard_sessions;
create policy wizard_sessions_owner_all on public.store_wizard_sessions
  for all
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()));

-- Draft versions: owner of the parent store can read/write
drop policy if exists store_drafts_owner_all on public.store_draft_versions;
create policy store_drafts_owner_all on public.store_draft_versions
  for all
  using (
    exists (
      select 1 from public.stores s
      where s.id = store_id
        and (s.owner_id = (select auth.uid()) or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.stores s
      where s.id = store_id
        and s.owner_id = (select auth.uid())
    )
  );




-- ==============================================================================
-- MIGRATION FILE: 20261006060000_module8_store_management_schema.sql
-- ==============================================================================
-- ==============================================================================
-- Module 8: Generated Store Management Schema
-- Products, Inventory, Orders, Customers, Invoices, Payment Settings & RLS
-- ==============================================================================

-- Helper check function for store management access
create or replace function public.can_manage_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stores
    where id = p_store_id
      and (owner_id = auth.uid() or public.is_admin())
  );
$$;

-- ------------------------------------------------------------------------------
-- 1. Products Table
-- ------------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sku text,
  description text,
  price_pkr bigint not null check (price_pkr >= 0),
  compare_at_price_pkr bigint check (compare_at_price_pkr is null or compare_at_price_pkr >= price_pkr),
  cost_price_pkr bigint check (cost_price_pkr is null or cost_price_pkr >= 0),
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  category text,
  images text[] not null default '{}',
  variants jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create index if not exists idx_products_store_active on public.products (store_id, is_active, is_archived);
create index if not exists idx_products_store_stock on public.products (store_id, stock);

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 2. Orders Table
-- ------------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_number text not null,
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null check (char_length(customer_phone) between 7 and 20),
  customer_email text,
  shipping_address text not null check (char_length(shipping_address) >= 5),
  city text not null,
  payment_method text not null default 'cod' check (payment_method in ('cod', 'stripe', 'paypal', 'card_mock')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded', 'failed')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'fulfilled', 'cancelled', 'returned')),
  subtotal_pkr bigint not null check (subtotal_pkr >= 0),
  shipping_fee_pkr bigint not null default 0 check (shipping_fee_pkr >= 0),
  tax_pkr bigint not null default 0 check (tax_pkr >= 0),
  total_pkr bigint not null check (total_pkr >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned')),
  status_history jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_store_status on public.orders (store_id, status, created_at desc);

drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. Order Items Table
-- ------------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  sku text,
  unit_price_pkr bigint not null check (unit_price_pkr >= 0),
  quantity integer not null check (quantity > 0),
  total_price_pkr bigint not null check (total_price_pkr >= 0)
);

create index if not exists idx_order_items_order on public.order_items (order_id);

-- ------------------------------------------------------------------------------
-- 4. Store Customers Table (Aggregated Profiles)
-- ------------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  city text,
  address text,
  total_orders integer not null default 0 check (total_orders >= 0),
  total_spend_pkr bigint not null default 0 check (total_spend_pkr >= 0),
  last_order_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, phone)
);

create index if not exists idx_customers_store_spend on public.customers (store_id, total_spend_pkr desc);

drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 5. Inventory Logs Table (Audit Trail)
-- ------------------------------------------------------------------------------
create table if not exists public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  delta integer not null,
  previous_stock integer not null check (previous_stock >= 0),
  new_stock integer not null check (new_stock >= 0),
  reason text not null check (reason in ('manual_adjustment', 'order_placed', 'order_cancelled', 'restock', 'damage', 'initial_setup')),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_logs_product on public.inventory_logs (product_id, created_at desc);

-- ------------------------------------------------------------------------------
-- 6. Store Payment Settings Table
-- ------------------------------------------------------------------------------
create table if not exists public.store_payment_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade unique,
  cod_enabled boolean not null default true,
  stripe_enabled boolean not null default false,
  stripe_account_id text,
  paypal_enabled boolean not null default false,
  paypal_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 7. Row-Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.products force row level security;

alter table public.orders enable row level security;
alter table public.orders force row level security;

alter table public.order_items enable row level security;
alter table public.order_items force row level security;

alter table public.customers enable row level security;
alter table public.customers force row level security;

alter table public.inventory_logs enable row level security;
alter table public.inventory_logs force row level security;

alter table public.store_payment_settings enable row level security;
alter table public.store_payment_settings force row level security;

-- Policies for products
create policy "Owners manage store products"
  on public.products
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

create policy "Public can view active products of published stores"
  on public.products
  for select
  to public
  using (
    is_active = true and is_archived = false and exists (
      select 1 from public.stores where id = products.store_id and status = 'published'
    )
  );

-- Policies for orders
create policy "Owners manage store orders"
  on public.orders
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Policies for order items
create policy "Owners manage store order items"
  on public.order_items
  for all
  to authenticated
  using (
    exists (
      select 1 from public.orders where id = order_items.order_id and public.can_manage_store(orders.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders where id = order_items.order_id and public.can_manage_store(orders.store_id)
    )
  );

-- Policies for customers
create policy "Owners manage store customers"
  on public.customers
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Policies for inventory logs
create policy "Owners view store inventory logs"
  on public.inventory_logs
  for select
  to authenticated
  using (public.can_manage_store(store_id));

create policy "Owners insert store inventory logs"
  on public.inventory_logs
  for insert
  to authenticated
  with check (public.can_manage_store(store_id));

-- Policies for payment settings
create policy "Owners manage store payment settings"
  on public.store_payment_settings
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));




-- ==============================================================================
-- MIGRATION FILE: 20261006070000_module9_analytics_schema.sql
-- ==============================================================================
-- ==============================================================================
-- Module 9: Generated Store Analytics, Customer Behavior & Event Tracking
-- Migration: 20261006070000_module9_analytics_schema.sql
-- ==============================================================================

-- 0. Ensure stores table has is_banned column
alter table public.stores 
  add column if not exists is_banned boolean not null default false;

-- 1. Store Analytics Events Table
create table if not exists public.store_analytics_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id text not null, -- Pseudonymous session hash (privacy-safe, no personal data)
  event_type text not null check (
    event_type in ('page_view', 'product_view', 'add_to_cart', 'remove_from_cart', 'begin_checkout', 'purchase')
  ),
  product_id uuid references public.products(id) on delete set null,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2. Indexes for fast aggregation and time-range filtering
create index if not exists idx_store_events_store_date 
  on public.store_analytics_events(store_id, created_at desc);

create index if not exists idx_store_events_store_type 
  on public.store_analytics_events(store_id, event_type);

create index if not exists idx_store_events_product 
  on public.store_analytics_events(product_id);

create index if not exists idx_store_events_session 
  on public.store_analytics_events(store_id, session_id);

-- 3. Row-Level Security
alter table public.store_analytics_events enable row level security;
alter table public.store_analytics_events force row level security;

-- Only authorized store owners or system admins can read analytics events
create policy "store_owners_select_events" on public.store_analytics_events
  for select
  using (can_manage_store(store_id));

-- Public storefront visitors can insert telemetry events only for unbanned, valid stores
create policy "public_insert_store_events" on public.store_analytics_events
  for insert
  with check (
    exists (
      select 1 from public.stores s 
      where s.id = store_id and s.is_banned = false
    )
  );

-- Store owners can purge their own events for privacy or retention maintenance
create policy "store_owners_delete_events" on public.store_analytics_events
  for delete
  using (can_manage_store(store_id));




-- ==============================================================================
-- MIGRATION FILE: 20261119000000_module5_model_registry_admin_policy.sql
-- ==============================================================================
-- Allow verified administrators to manage model registry entries.
-- Authenticated users retain read-only access through model_registry_read.
drop policy if exists model_registry_admin_manage on public.model_registry;
create policy model_registry_admin_manage on public.model_registry
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());




-- ==============================================================================
-- MIGRATION FILE: 20261119010000_module2_default_currency_pkr.sql
-- ==============================================================================
-- Pakistan-first intake: default newly created projects to PKR.
alter table public.projects
  alter column budget_currency set default 'PKR';




-- ==============================================================================
-- MIGRATION FILE: 20261119020000_module3_truthful_provider_defaults.sql
-- ==============================================================================
-- Conservative defaults prevent omitted provenance fields from implying live or licensed data.
alter table public.project_market_observations
  alter column provider set default 'curated_regional_reference_estimates',
  alter column provenance set default 'manual_estimate';

alter table public.project_demand_trends
  alter column provider set default 'synthetic_category_trend_curve',
  alter column provenance set default 'synthetic_demo';




-- ==============================================================================
-- MIGRATION FILE: 20261119030000_audit_storage_and_hardening.sql
-- ==============================================================================
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

-- 6. Storage Bucket Configuration (FR-2.2 & NFR-C4: Private Project Attachment Uploads)
-- The project-attachments bucket is STRICTLY PRIVATE. Files are never exposed via
-- public URLs; authorized owners retrieve them through short-lived signed URLs.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'project-attachments',
      'project-attachments',
      false, -- STRICTLY PRIVATE
      5242880, -- 5 MB
      array['application/pdf', 'text/csv', 'application/json', 'image/png', 'image/jpeg', 'image/webp']
    )
    on conflict (id) do update set
      public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf', 'text/csv', 'application/json', 'image/png', 'image/jpeg', 'image/webp'];

    -- Storage Object Policies (authenticated, owner-isolated)
    -- Object path convention: {user_id}/{project_id}/{unique_file_name}
    drop policy if exists "Public can view project attachments" on storage.objects;
    drop policy if exists "Authenticated users can upload attachments" on storage.objects;
    drop policy if exists "Users can update their attachments" on storage.objects;
    drop policy if exists "Users can delete their attachments" on storage.objects;

    drop policy if exists "Owner can upload attachments" on storage.objects;
    create policy "Owner can upload attachments"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'project-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    drop policy if exists "Owner can read own attachments" on storage.objects;
    create policy "Owner can read own attachments"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'project-attachments'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.is_admin()
        )
      );

    drop policy if exists "Owner can update own attachments" on storage.objects;
    create policy "Owner can update own attachments"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'project-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'project-attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );

    drop policy if exists "Owner can delete own attachments" on storage.objects;
    create policy "Owner can delete own attachments"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'project-attachments'
        and (
          (storage.foldername(name))[1] = auth.uid()::text
          or public.is_admin()
        )
      );
  end if;
end $$;






-- ====================================================================
-- Module A & B: Multiple-Model ML Pipeline & Punjab Market Intelligence
-- AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator
-- Standard: Production Schema for ML Model Lifecycle & Market Analytics
-- ====================================================================

-- 1. Extend Model Registry for Multiple-Model Algorithms & Explainability
alter table public.model_registry 
  add column if not exists algorithm text,
  add column if not exists problem_type text check (problem_type in ('classification', 'regression')),
  add column if not exists artifact_path text,
  add column if not exists feature_names jsonb not null default '[]'::jsonb,
  add column if not exists feature_importances jsonb not null default '[]'::jsonb,
  add column if not exists hyperparameters jsonb not null default '{}'::jsonb,
  add column if not exists validation_metrics jsonb not null default '{}'::jsonb,
  add column if not exists cv_metrics jsonb not null default '{}'::jsonb,
  add column if not exists confusion_matrix jsonb not null default '[]'::jsonb;

-- 2. ML Datasets Table
create table if not exists public.ml_datasets (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  description          text,
  file_name            text not null,
  file_path            text not null,
  file_size_bytes      bigint not null default 0,
  row_count            integer not null default 0,
  column_count         integer not null default 0,
  target_column        text,
  problem_type         text check (problem_type in ('classification', 'regression')),
  columns_metadata     jsonb not null default '[]'::jsonb,
  data_quality_report  jsonb not null default '{}'::jsonb,
  is_sample            boolean not null default false,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Link model_registry to ml_datasets if dataset exists
alter table public.model_registry
  add column if not exists dataset_id uuid references public.ml_datasets(id) on delete set null;

-- 3. ML Training Jobs Table
create table if not exists public.ml_training_jobs (
  id                   uuid primary key default gen_random_uuid(),
  dataset_id           uuid references public.ml_datasets(id) on delete cascade,
  target_column        text not null,
  problem_type         text not null check (problem_type in ('classification', 'regression')),
  candidate_algorithms jsonb not null default '[]'::jsonb,
  validation_strategy  text not null default 'stratified_kfold',
  cv_folds             integer not null default 5,
  test_size            numeric(3,2) not null default 0.20,
  status               text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress_pct         numeric(5,2) not null default 0,
  current_step         text,
  results              jsonb not null default '{}'::jsonb,
  best_model_id        uuid references public.model_registry(id) on delete set null,
  error_message        text,
  started_at           timestamptz,
  completed_at         timestamptz,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now()
);

-- Link model_registry to ml_training_jobs
alter table public.model_registry
  add column if not exists training_job_id uuid references public.ml_training_jobs(id) on delete set null;

-- 4. Google Trends Queries & Caching Table
create table if not exists public.market_trend_queries (
  id                   uuid primary key default gen_random_uuid(),
  keyword              text not null,
  geo                  text not null default 'PK',
  timeframe            text not null default 'today 12-m',
  category             integer not null default 0,
  interest_over_time   jsonb not null default '[]'::jsonb,
  related_topics       jsonb not null default '[]'::jsonb,
  related_queries      jsonb not null default '[]'::jsonb,
  regional_breakdown   jsonb not null default '[]'::jsonb,
  trend_slope          numeric(8,4),
  trend_direction      text check (trend_direction in ('rising', 'falling', 'stable', 'volatile')),
  peak_month           text,
  seasonality_index    numeric(5,2),
  expires_at           timestamptz not null default (now() + interval '24 hours'),
  created_at           timestamptz not null default now()
);

create index if not exists idx_market_trends_lookup 
  on public.market_trend_queries (keyword, geo, timeframe, expires_at desc);

-- 5. Regional Market Statistics (Punjab Demographic & Economic Baselines)
create table if not exists public.regional_market_statistics (
  id                        uuid primary key default gen_random_uuid(),
  province                  text not null default 'Punjab',
  district                  text not null,
  tehsil                    text not null default 'All',
  division                  text not null,
  population_total          bigint not null,
  population_urban          bigint not null,
  urbanization_rate         numeric(5,2) not null,
  literacy_rate             numeric(5,2),
  household_size            numeric(4,2),
  commercial_rent_sqft_min  numeric(10,2) not null,
  commercial_rent_sqft_max  numeric(10,2) not null,
  commercial_rent_sqft_avg  numeric(10,2) not null,
  purchasing_power_index    numeric(5,2) not null check (purchasing_power_index >= 0 and purchasing_power_index <= 100),
  retail_density_score      numeric(5,2) not null check (retail_density_score >= 0 and retail_density_score <= 100),
  primary_commercial_hubs   jsonb not null default '[]'::jsonb,
  economic_drivers          jsonb not null default '[]'::jsonb,
  source_references         jsonb not null default '[]'::jsonb,
  updated_at                timestamptz not null default now(),
  unique(district, tehsil)
);

-- Seed Punjab Major Commercial & Regional Centers (PBS 2023 Census & Industry Benchmarks)
insert into public.regional_market_statistics (
  province, district, tehsil, division, population_total, population_urban, urbanization_rate, 
  literacy_rate, household_size, commercial_rent_sqft_min, commercial_rent_sqft_max, commercial_rent_sqft_avg, 
  purchasing_power_index, retail_density_score, primary_commercial_hubs, economic_drivers, source_references
) values
(
  'Punjab', 'Lahore', 'All', 'Lahore', 13004135, 13004135, 100.0, 78.5, 6.2,
  120.0, 450.0, 240.0, 88.5, 92.0,
  '["Gulberg (MM Alam / Main Blvd)", "DHA (Y / H / Z Blocks)", "Mall Road", "Johar Town / Emporium Hub", "Liberty Market", "Anarkali"]'::jsonb,
  '["Financial & Corporate Services", "Retail & Hospitality", "Textiles & Fashion", "Tech & Logistics Hub"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}, {"agency": "Punjab Development Statistics", "year": "2023"}]'::jsonb
),
(
  'Punjab', 'Rawalpindi', 'All', 'Rawalpindi', 5537045, 3105000, 56.1, 82.3, 5.9,
  90.0, 350.0, 195.0, 82.0, 80.5,
  '["Saddar Commercial", "Bahria Town Commercial Hubs", "Murree Road", "Raja Bazaar", "Peshawar Road"]'::jsonb,
  '["Services & Government", "Defense & Logistics", "Wholesale Trading", "Real Estate Development"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Faisalabad', 'All', 'Faisalabad', 8838883, 3691999, 41.8, 70.1, 6.4,
  70.0, 280.0, 150.0, 75.0, 78.0,
  '["D-Ground Peoples Colony", "Clock Tower 8 Bazaars", "Susan Road", "Jaranwala Road Commercial", "Sargodha Road Hub"]'::jsonb,
  '["Textile Manufacturing & Exports", "Ginning & Milling", "Agricultural Trade & Machinery", "Fast Moving Consumer Goods"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Multan', 'All', 'Multan', 5362305, 2315000, 43.2, 61.2, 6.5,
  60.0, 240.0, 130.0, 68.0, 69.5,
  '["Cantonment Saddar", "Gulgasht Colony Commercial", "Bosan Road Hub", "Hussain Agahi", "Chowk Kachehri"]'::jsonb,
  '["Cotton & Mango Agro-Processing", "Fertilizers & Chemicals", "Regional Wholesale Hub for South Punjab"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Gujranwala', 'All', 'Gujranwala', 5988110, 3100000, 51.8, 73.5, 6.6,
  65.0, 260.0, 140.0, 74.0, 76.0,
  '["Satellite Town Market", "Model Town Commercial", "GT Road Commercial Belt", "Rail Bazaar"]'::jsonb,
  '["Sanitary & Ceramics", "Light Engineering & Cutlery", "Electrical Appliances & Motors", "Rice Processing"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Sialkot', 'All', 'Gujranwala', 4499394, 1520000, 33.8, 74.8, 6.3,
  70.0, 270.0, 145.0, 79.0, 74.0,
  '["Cantonment Mall Area", "Kashmir Road Commercial", "Paris Road", "Defense Road"]'::jsonb,
  '["Surgical Instruments Export", "Sports Goods Export", "Leather Garments & Footwear", "Light Aviation"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Bahawalpur', 'All', 'Bahawalpur', 4284964, 1280000, 29.9, 53.4, 6.4,
  45.0, 180.0, 95.0, 58.0, 56.0,
  '["Circular Road Bazaar", "Model Town Commercial", "Satellite Town", "Farid Gate Market"]'::jsonb,
  '["Agriculture Trade (Cotton & Wheat)", "Education Hub", "Tourism & Handicrafts"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Sargodha', 'All', 'Sargodha', 4595230, 1480000, 32.2, 65.8, 6.3,
  50.0, 200.0, 105.0, 62.0, 61.0,
  '["Kutchery Bazaar", "Satellite Town", "University Road Hub", "Fatima Jinnah Road"]'::jsonb,
  '["Citrus (Kinnow) Agro-Industry", "Defense Services Base", "Grain & Sugarcane Processing"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Sahiwal', 'All', 'Sahiwal', 2881511, 720000, 25.0, 64.2, 6.2,
  40.0, 170.0, 90.0, 60.0, 58.0,
  '["High Street Commercial", "Liaquat Road", "Fateh Sher Road", "Farid Town"]'::jsonb,
  '["Dairy Processing & Livestock", "Cotton & Tobacco Trading", "Edible Oil Processing"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Sheikhupura', 'All', 'Lahore', 4049861, 1420000, 35.1, 65.4, 6.5,
  45.0, 190.0, 100.0, 64.0, 62.0,
  '["Main Bazaar", "Housing Colony Commercial", "Lahore-Sargodha Road Hub", "Bhikhi Road"]'::jsonb,
  '["Industrial Processing (Rice & Paper)", "Automotive Assembly", "Proximity to Lahore Logistics"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
)
on conflict (district, tehsil) do update set
  population_total = excluded.population_total,
  population_urban = excluded.population_urban,
  urbanization_rate = excluded.urbanization_rate,
  literacy_rate = excluded.literacy_rate,
  household_size = excluded.household_size,
  commercial_rent_sqft_min = excluded.commercial_rent_sqft_min,
  commercial_rent_sqft_max = excluded.commercial_rent_sqft_max,
  commercial_rent_sqft_avg = excluded.commercial_rent_sqft_avg,
  purchasing_power_index = excluded.purchasing_power_index,
  retail_density_score = excluded.retail_density_score,
  primary_commercial_hubs = excluded.primary_commercial_hubs,
  economic_drivers = excluded.economic_drivers,
  source_references = excluded.source_references,
  updated_at = now();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

alter table public.ml_datasets enable row level security;
alter table public.ml_datasets force row level security;

alter table public.ml_training_jobs enable row level security;
alter table public.ml_training_jobs force row level security;

alter table public.market_trend_queries enable row level security;
alter table public.market_trend_queries force row level security;

alter table public.regional_market_statistics enable row level security;
alter table public.regional_market_statistics force row level security;

-- ML Datasets: Authenticated users can view datasets; Admins can insert/update/delete
drop policy if exists ml_datasets_read on public.ml_datasets;
create policy ml_datasets_read on public.ml_datasets
  for select
  to authenticated
  using (true);

drop policy if exists ml_datasets_manage on public.ml_datasets;
create policy ml_datasets_manage on public.ml_datasets
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ML Training Jobs: Authenticated users can view training jobs; Admins can launch/manage
drop policy if exists ml_training_jobs_read on public.ml_training_jobs;
create policy ml_training_jobs_read on public.ml_training_jobs
  for select
  to authenticated
  using (true);

drop policy if exists ml_training_jobs_manage on public.ml_training_jobs;
create policy ml_training_jobs_manage on public.ml_training_jobs
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Market Trend Queries: Authenticated users can read cached trends and insert newly fetched results
drop policy if exists market_trends_read on public.market_trend_queries;
create policy market_trends_read on public.market_trend_queries
  for select
  to authenticated
  using (true);

drop policy if exists market_trends_insert on public.market_trend_queries;
create policy market_trends_insert on public.market_trend_queries
  for insert
  to authenticated
  with check (true);

-- Regional Statistics: Authenticated users can read regional stats; Admins can manage
drop policy if exists regional_stats_read on public.regional_market_statistics;
create policy regional_stats_read on public.regional_market_statistics
  for select
  to authenticated
  using (true);

drop policy if exists regional_stats_manage on public.regional_market_statistics;
create policy regional_stats_manage on public.regional_market_statistics
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
