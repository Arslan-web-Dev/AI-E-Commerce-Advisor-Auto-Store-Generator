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
