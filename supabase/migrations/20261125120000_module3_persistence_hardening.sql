-- ====================================================================
-- Module 3 (Task 4): persistence and idempotency hardening.
-- Additive/forward-only where possible. This migration:
--   1. Adds per-record provenance columns that Module 3 providers emit.
--   2. Records when a manual rent estimate was curated, separately from
--      the legacy `scraped_at` column.
--   3. Prevents duplicate active collection runs for the same project.
--
-- Rollback guidance:
--   drop index if exists public.uq_collection_runs_active_project;
--   alter table public.project_competitors
--     drop column if exists freshness,
--     drop column if exists cache_retrieved_at;
--   alter table public.project_market_observations
--     drop column if exists freshness;
--   alter table public.project_demand_trends
--     drop column if exists requested_geo_scope,
--     drop column if exists actual_geo_scope,
--     drop column if exists cache_retrieved_at,
--     drop column if exists is_stale;
--   alter table public.project_cost_estimates
--     drop column if exists freshness;
--   alter table public.rent_cache
--     drop column if exists recorded_at;
-- ====================================================================

-- 1. Per-record freshness provenance emitted by the Module 3 providers.
alter table public.project_competitors
  add column if not exists freshness text check (freshness in (
    'live', 'cached', 'stale_cache', 'verified_benchmark',
    'manual_estimate', 'synthetic_demo', 'unavailable'
  )),
  add column if not exists cache_retrieved_at timestamptz;

alter table public.project_market_observations
  add column if not exists freshness text check (freshness in (
    'live', 'cached', 'stale_cache', 'verified_benchmark',
    'manual_estimate', 'synthetic_demo', 'unavailable'
  ));

alter table public.project_demand_trends
  add column if not exists requested_geo_scope text,
  add column if not exists actual_geo_scope text,
  add column if not exists cache_retrieved_at timestamptz,
  add column if not exists is_stale boolean not null default false;

alter table public.project_cost_estimates
  add column if not exists freshness text check (freshness in (
    'live', 'cached', 'stale_cache', 'verified_benchmark',
    'manual_estimate', 'synthetic_demo', 'unavailable'
  ));

-- 2. Manual rent estimates must not imply a live scrape timestamp.
alter table public.rent_cache
  add column if not exists recorded_at timestamptz;

-- 3. Retire duplicate active runs before adding the uniqueness guard.
--    Only surplus active runs are marked failed; historical completed runs
--    and their records are untouched.
with ranked_active_runs as (
  select id,
         row_number() over (
           partition by project_id
           order by started_at desc nulls last, created_at desc nulls last
         ) as active_rank
  from public.project_collection_runs
  where status in ('pending', 'running')
)
update public.project_collection_runs r
set status = 'failed',
    completed_at = now(),
    providers_status = coalesce(r.providers_status, '{}'::jsonb) || jsonb_build_object(
      '_system', jsonb_build_object(
        'status', 'failed',
        'provider', 'orchestrator',
        'provenance', 'manual_estimate',
        'item_count', 0,
        'error', 'Superseded duplicate active collection run.'
      )
    )
from ranked_active_runs a
where r.id = a.id
  and a.active_rank > 1
  and r.status in ('pending', 'running');

create unique index if not exists uq_collection_runs_active_project
  on public.project_collection_runs (project_id)
  where status in ('pending', 'running');
