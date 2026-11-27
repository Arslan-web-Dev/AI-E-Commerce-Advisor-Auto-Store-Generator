-- ==============================================================================
-- Batch 1: Project currency-provenance schema repair
-- File: supabase/manual/batch1_project_currency_provenance.sql
--
-- WHERE TO RUN
--   Supabase Dashboard -> SQL Editor -> New query -> paste this entire file -> Run.
--
-- WHY
--   The project API writes projects.exchange_rate, exchange_rate_source and
--   exchange_rate_timestamp, but the deployed PostgREST schema cache does not
--   expose them. That causes:
--     "Could not find the 'exchange_rate' column of 'projects' in the schema cache"
--   This script is ADDITIVE and IDEMPOTENT: it never drops a table, column,
--   policy, trigger or row. Re-running it is safe.
--
-- RELATED
--   Migrations are authoritative: see
--   supabase/migrations/20261127040000_batch1_project_currency_provenance_sync.sql
-- ==============================================================================

-- 1. Create the three provenance columns if they are still missing.
alter table public.projects
  add column if not exists exchange_rate numeric(10,4),
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_timestamp timestamptz;

-- 2. Align defaults with the PKR-first wizard default.
alter table public.projects
  alter column exchange_rate set default 1.0000,
  alter column exchange_rate_source set default 'Canonical PKR',
  alter column exchange_rate_timestamp set default now();

-- 3. Document the provenance fields.
comment on column public.projects.exchange_rate is
  'Canonical FX rate applied to the supplied budget (Rs. per 1 USD; 1.0 for PKR).';
comment on column public.projects.exchange_rate_source is
  'Provenance of exchange_rate (State Bank of Pakistan Benchmark or Canonical PKR).';
comment on column public.projects.exchange_rate_timestamp is
  'Time at which the provenance rate was applied to this project.';

-- 4. Backfill legacy rows that predate these columns.
--    Rs. 278 / USD is the same benchmark used by src/lib/currency/exchange-rate.ts.
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

-- 5. Refresh the PostgREST schema cache immediately.
notify pgrst, 'reload schema';

-- 6. Verification: all three queries below should succeed after the run.
--    Expected: one row per column with data_type numeric / text / timestamp with time zone.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'projects'
  and column_name in ('exchange_rate', 'exchange_rate_source', 'exchange_rate_timestamp')
order by column_name;

--    Expected: zero rows (no remaining un-backfilled projects).
select id, budget_currency, exchange_rate
from public.projects
where exchange_rate is null;

--    Expected: row count > 0 when USD drafts exist; provenance is explicit.
select budget_currency, exchange_rate, exchange_rate_source, count(*)
from public.projects
group by budget_currency, exchange_rate, exchange_rate_source
order by budget_currency;
