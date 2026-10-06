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
