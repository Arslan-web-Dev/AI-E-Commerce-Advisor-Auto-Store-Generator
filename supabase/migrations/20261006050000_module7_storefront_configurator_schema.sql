-- ====================================================================
-- Module 7: Theme Configurator, Variant Catalog & Storefront Draft
-- AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator
-- Standard: Structured after SRS v2.0 (FR-7.1–FR-7.6)
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
