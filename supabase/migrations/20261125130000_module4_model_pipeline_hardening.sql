-- ====================================================================
-- Module 4 (Task 5): Feature/model provenance hardening
--
-- Forward-only, additive migration. Existing rows remain valid because every
-- new column is nullable or has a non-destructive default. No existing value
-- is rewritten and no permission is widened for anonymous/public roles.
--
-- Rollback guidance (manual, only after application code is reverted):
--   drop policy if exists ml_scoring_config_versions_read on public.ml_scoring_config_versions;
--   drop policy if exists ml_scoring_config_versions_admin_insert on public.ml_scoring_config_versions;
--   alter table public.ml_scoring_config_versions
--     drop constraint if exists ml_scoring_config_versions_bounds_check;
--   drop table if exists public.ml_scoring_config_versions;
--   alter table public.project_feasibility_runs
--     drop column if exists model_version,
--     drop column if exists threshold_version,
--     drop column if exists risk_level,
--     drop column if exists evaluation_metrics,
--     drop column if exists training_provenance,
--     drop column if exists disclaimer;
--   alter table public.project_features
--     drop column if exists competitor_density_per_km2,
--     drop column if exists avg_competitor_rating,
--     drop column if exists rent_per_sqft,
--     drop column if exists estimated_monthly_rent,
--     drop column if exists rent_to_budget_ratio,
--     drop column if exists budget_to_setup_cost_ratio,
--     drop column if exists demand_score,
--     drop column if exists saturation_index;
--   alter table public.model_registry
--     drop column if exists artifact_version,
--     drop column if exists artifact_sha256,
--     drop column if exists dataset_fingerprint,
--     drop column if exists label_approval_status,
--     drop column if exists training_provenance;
-- ====================================================================

-- FR-4.1: explicit, unit-bearing SRS features. All values are nullable because
-- an unavailable source must remain N/A rather than being silently zeroed.
alter table public.project_features
  add column if not exists competitor_density_per_km2 numeric(14,6),
  add column if not exists avg_competitor_rating numeric(3,2),
  add column if not exists rent_per_sqft numeric(10,2),
  add column if not exists estimated_monthly_rent numeric(14,2),
  add column if not exists rent_to_budget_ratio numeric(10,4),
  add column if not exists budget_to_setup_cost_ratio numeric(10,4),
  add column if not exists demand_score numeric(6,2),
  add column if not exists saturation_index numeric(14,8);

comment on column public.project_features.competitor_density_per_km2 is 'competitor_count / search area in square kilometres; null when radius is unavailable or invalid';
comment on column public.project_features.avg_competitor_rating is 'Mean of available competitor ratings (0-5); null when no rating is available';
comment on column public.project_features.rent_per_sqft is 'PKR per square foot from labelled rent cache; null when no sourced rent record exists';
comment on column public.project_features.estimated_monthly_rent is 'Monthly rent in the feature currency (canonical PKR for project analysis); null when unavailable';
comment on column public.project_features.rent_to_budget_ratio is 'estimated_monthly_rent / monthly-equivalent budget; null when denominator is unavailable or zero';
comment on column public.project_features.budget_to_setup_cost_ratio is 'user_budget / total_estimated_setup_cost; null when denominator is unavailable or zero';
comment on column public.project_features.demand_score is 'Normalised 0-100 demand index from fresh, in-scope trend observations; null when unavailable, stale or cross-region';
comment on column public.project_features.saturation_index is 'competitors per 100,000 residents; null when population is unavailable, zero or out of scope';

-- FR-4.4 / FR-4.5 / FR-4.7: first-class report provenance instead of relying
-- only on nested explanatory JSON.
alter table public.project_feasibility_runs
  add column if not exists model_version text,
  add column if not exists threshold_version text,
  add column if not exists risk_level text check (risk_level in ('low', 'moderate', 'high', 'critical')),
  add column if not exists evaluation_metrics jsonb,
  add column if not exists training_provenance jsonb,
  add column if not exists disclaimer text;

-- FR-4.5: artifact-level identity and honest approval state on the registry.
alter table public.model_registry
  add column if not exists artifact_version text,
  add column if not exists artifact_sha256 text,
  add column if not exists dataset_fingerprint text,
  add column if not exists label_approval_status text not null default 'BLOCKED'
    check (label_approval_status in ('BLOCKED', 'APPROVED')),
  add column if not exists training_provenance jsonb;

-- FR-4.8: versioned, append-only threshold configuration changes.
create table if not exists public.ml_scoring_config_versions (
  id          uuid primary key default gen_random_uuid(),
  version     text not null unique,
  config      jsonb not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Idempotent even if an earlier partial run created the table without the
-- invariant. The CASE form refuses missing/non-numeric keys instead of letting
-- a NULL comparison silently satisfy the CHECK.
alter table public.ml_scoring_config_versions
  drop constraint if exists ml_scoring_config_versions_bounds_check;
alter table public.ml_scoring_config_versions
  add constraint ml_scoring_config_versions_bounds_check check (
    case
      when config ?& array['version', 'low_risk_min', 'moderate_risk_min', 'high_risk_min']
        and length(btrim(config->>'version')) > 0
        and (config->>'low_risk_min') ~ '^-?[0-9]+([.][0-9]+)?$'
        and (config->>'moderate_risk_min') ~ '^-?[0-9]+([.][0-9]+)?$'
        and (config->>'high_risk_min') ~ '^-?[0-9]+([.][0-9]+)?$'
      then (config->>'low_risk_min')::numeric > (config->>'moderate_risk_min')::numeric
        and (config->>'moderate_risk_min')::numeric > (config->>'high_risk_min')::numeric
        and (config->>'high_risk_min')::numeric > 0
        and (config->>'low_risk_min')::numeric <= 1
      else false
    end
  );

alter table public.ml_scoring_config_versions enable row level security;
alter table public.ml_scoring_config_versions force row level security;

drop policy if exists ml_scoring_config_versions_read on public.ml_scoring_config_versions;
create policy ml_scoring_config_versions_read on public.ml_scoring_config_versions
  for select
  to authenticated
  using (true);

drop policy if exists ml_scoring_config_versions_admin_insert on public.ml_scoring_config_versions;
create policy ml_scoring_config_versions_admin_insert on public.ml_scoring_config_versions
  for insert
  to authenticated
  with check (public.is_admin());

-- Seed the default version without changing any existing system_config row.
insert into public.ml_scoring_config_versions (version, config)
values (
  'v1.0-srs-fr4.4',
  '{"version": "v1.0-srs-fr4.4", "low_risk_min": 0.75, "moderate_risk_min": 0.55, "high_risk_min": 0.35}'::jsonb
)
on conflict (version) do nothing;
