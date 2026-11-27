-- ==============================================================================
-- Batch 1 root-cause fix: Project currency-provenance schema sync (FR-2.4)
-- Migration: 20261127040000_batch1_project_currency_provenance_sync.sql
--
-- The application's POST/PATCH project routes persist exchange_rate,
-- exchange_rate_source and exchange_rate_timestamp. The columns were declared in
-- 20261123020000_module1_module2_remediation.sql, but the deployed schema cache
-- does not expose them, so every draft write fails with:
--   "Could not find the 'exchange_rate' column of 'projects' in the schema cache"
-- Later migrations (for example the district column) are present, which means the
-- original remediation cannot simply be edited and re-run. This forward-only,
-- idempotent migration repairs the deployed schema and explicitly reloads the
-- PostgREST schema cache. No existing row, policy, trigger or ownership rule is
-- changed; only the three provenance columns are created/backfilled.
-- ==============================================================================

alter table public.projects
  add column if not exists exchange_rate numeric(10,4),
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_timestamp timestamptz;

-- Keep defaults aligned with the PKR-first wizard default (migration 2026111901).
alter table public.projects
  alter column exchange_rate set default 1.0000,
  alter column exchange_rate_source set default 'Canonical PKR',
  alter column exchange_rate_timestamp set default now();

comment on column public.projects.exchange_rate is
  'Canonical FX rate applied to the supplied budget (Rs. per 1 USD; 1.0 for PKR).';
comment on column public.projects.exchange_rate_source is
  'Provenance of exchange_rate (State Bank of Pakistan Benchmark or Canonical PKR).';
comment on column public.projects.exchange_rate_timestamp is
  'Time at which the provenance rate was applied to this project.';

-- Backfill legacy rows only where provenance is genuinely absent.
update public.projects
set
  exchange_rate = 278.0000,
  exchange_rate_source = 'State Bank of Pakistan Benchmark',
  exchange_rate_timestamp = coalesce(updated_at, now())
where exchange_rate is null
  and upper(coalesce(budget_currency, 'PKR')) = 'USD';

update public.projects
set
  exchange_rate = 1.0000,
  exchange_rate_source = 'Canonical PKR',
  exchange_rate_timestamp = coalesce(updated_at, now())
where exchange_rate is null;

-- Make the repaired schema visible to PostgREST immediately, without requiring a
-- dashboard restart or an out-of-band cache refresh.
notify pgrst, 'reload schema';
