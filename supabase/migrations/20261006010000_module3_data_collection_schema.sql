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
