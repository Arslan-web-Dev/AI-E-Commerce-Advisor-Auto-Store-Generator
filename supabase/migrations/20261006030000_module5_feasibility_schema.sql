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
