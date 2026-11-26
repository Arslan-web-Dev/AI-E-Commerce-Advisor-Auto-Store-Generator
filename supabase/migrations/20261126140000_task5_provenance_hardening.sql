-- ====================================================================
-- Module 4 / Task 5: background-job and artifact provenance hardening
--
-- Forward-only, additive migration. No existing value is rewritten and no
-- permission is widened. Every new column is nullable or has a non-destructive
-- default so existing registry rows remain valid.
--
-- Rollback guidance (manual, only after application code is reverted):
--   alter table public.model_registry
--     drop column if exists comparison_report_path,
--     drop column if exists feature_schema_version,
--     drop column if exists training_mode,
--     drop column if exists job_id;
-- ====================================================================

alter table public.ml_datasets
  add column if not exists data_source text not null default 'uploaded_unverified',
  add column if not exists dataset_fingerprint text,
  add column if not exists schema_version text;

comment on column public.ml_datasets.data_source is
  'synthetic for sandbox fixtures; uploaded_unverified for user uploads. Never treated as verified market evidence.';

alter table public.model_registry
  add column if not exists training_mode text not null default 'experimental_sandbox'
    check (training_mode in ('production', 'experimental_sandbox')),
  add column if not exists feature_schema_version text,
  add column if not exists comparison_report_path text,
  add column if not exists job_id text;

comment on column public.model_registry.training_mode is
  'production only when OI-6 approval is genuine and the training data is not synthetic; experimental sandbox artifacts cannot be activated';
comment on column public.model_registry.feature_schema_version is
  'Frozen input-column/schema contract used by the persisted preprocessing pipeline';
comment on column public.model_registry.comparison_report_path is
  'Server-side JSON report with all candidate metrics, CV folds and provenance';

-- Reinforce, rather than widen, the existing approval invariant. Existing
-- BLOCKED rows are untouched; an APPROVED row with an experimental mode is a
-- contradiction and is rejected by the application gate.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'model_registry_training_mode_check'
      and conrelid = 'public.model_registry'::regclass
  ) then
    alter table public.model_registry
      add constraint model_registry_training_mode_check
      check (training_mode in ('production', 'experimental_sandbox'));
  end if;
end $$;
