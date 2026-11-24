-- ==============================================================================
-- Module 2 / Task 3: Add explicit Punjab district to project drafts
-- Migration: 20261124020000_module2_wizard_district.sql
--
-- The three-step feasibility wizard captures an explicit Province (fixed
-- "Punjab"), District and City for every commercial location. `city` already
-- exists on public.projects; this forward-only migration adds a nullable
-- `district` column so the validated district selection is persisted and can be
-- re-validated server-side. Existing rows keep `district = null` (the column is
-- nullable), so the migration is safe to apply to populated tables and does not
-- rewrite or invalidate any existing data.
-- ==============================================================================

alter table public.projects
  add column if not exists district text;

comment on column public.projects.district is
  'Punjab district selected in the wizard Step 1 location fields; validated server-side against the approved district/city dataset (Task 3 §4).';
