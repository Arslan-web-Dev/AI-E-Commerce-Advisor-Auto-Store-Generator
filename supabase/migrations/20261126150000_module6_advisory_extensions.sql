-- ====================================================================
-- Module 6 / Task 7: persistent action-matrix completion state
--
-- Forward-only and additive. No Module 1-5 table is changed and no existing
-- advisory row is rewritten. Checklist ticks are owner-scoped: a non-admin can
-- only read or write their own row, and access is still gated by the report's
-- project via can_access_project().
--
-- Rollback guidance (manual, only after application code is reverted):
--   drop policy if exists advisory_action_states_access
--     on public.advisory_action_states;
--   drop table if exists public.advisory_action_states;
-- ====================================================================

create table if not exists public.advisory_action_states (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.project_advisory_reports(id) on delete cascade,
  owner_id      uuid not null references auth.users(id) on delete cascade,
  item_key      text not null check (item_key ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  is_completed  boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint advisory_action_states_owner_item_unique
    unique (report_id, owner_id, item_key)
);

create index if not exists idx_advisory_action_states_report_owner
  on public.advisory_action_states (report_id, owner_id);

comment on table public.advisory_action_states is
  'Owner-isolated completion state for stable Module 6 action-matrix item ids.';

alter table public.advisory_action_states enable row level security;
alter table public.advisory_action_states force row level security;

drop policy if exists advisory_action_states_access on public.advisory_action_states;
create policy advisory_action_states_access on public.advisory_action_states
  for all
  to authenticated
  using (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.project_advisory_reports report
      where report.id = report_id
        and public.can_access_project(report.project_id)
    )
  )
  with check (
    owner_id = auth.uid()
    and exists (
      select 1
      from public.project_advisory_reports report
      where report.id = report_id
        and public.can_access_project(report.project_id)
    )
  );
