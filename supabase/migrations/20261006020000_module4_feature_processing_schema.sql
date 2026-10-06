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
