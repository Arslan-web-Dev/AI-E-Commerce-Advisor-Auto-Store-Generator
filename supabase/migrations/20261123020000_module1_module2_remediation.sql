-- ==============================================================================
-- Module 1 & Module 2 Remediation: Non-Recursive Profile RLS, Radius Harmonization & Atomic Project Submission
-- Migration: 20261123020000_module1_module2_remediation.sql
-- ==============================================================================

-- 1. Fix Profile RLS Recursion (Eliminate self-referencing subqueries in WITH CHECK)
-- Replace with clean row-matching check and enforce role/flag protection in a BEFORE UPDATE trigger.

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Trigger to guarantee non-admin users cannot alter their role, must_change_password flag, or id
create or replace function public.enforce_profile_update_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- If updating user is not an administrator, forbid modification of privileged columns
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Unauthorized: Non-admin users cannot alter their role';
    end if;
    if new.must_change_password is distinct from old.must_change_password then
      raise exception 'Unauthorized: Non-admin users cannot alter must_change_password';
    end if;
    if new.id is distinct from old.id then
      raise exception 'Unauthorized: User ID cannot be modified';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_update_integrity on public.profiles;
create trigger trg_enforce_profile_update_integrity
  before update on public.profiles
  for each row
  execute function public.enforce_profile_update_integrity();

grant execute on function public.enforce_profile_update_integrity() to authenticated;

-- 2. Harmonize Radius Constraints between Projects (1-50 km -> 5-15 km) and Feasibility Reports (10-15 km -> 5-15 km)
do $$
begin
  -- Reconcile feasibility_reports radius constraint
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'feasibility_reports_radius_km_check'
      and table_name = 'feasibility_reports'
  ) then
    alter table public.feasibility_reports drop constraint feasibility_reports_radius_km_check;
  end if;
  alter table public.feasibility_reports add constraint feasibility_reports_radius_km_check check (radius_km between 5 and 15);

  -- Reconcile projects radius constraint
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'projects_radius_km_check'
      and table_name = 'projects'
  ) then
    alter table public.projects drop constraint projects_radius_km_check;
  end if;
  alter table public.projects add constraint projects_radius_km_check check (radius_km between 5.0 and 15.0);
end $$;

-- 3. Add Exchange Rate & Currency Provenance metadata columns to Projects (FR-2.4)
alter table public.projects
  add column if not exists exchange_rate numeric(10,4),
  add column if not exists exchange_rate_source text,
  add column if not exists exchange_rate_timestamp timestamptz;

-- 4. Atomic and Idempotent Project Submission RPC (FR-2.6)
create or replace function public.submit_project_for_feasibility(
  p_project_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_proj record;
  v_report_id uuid;
  v_submitted_at timestamptz := now();
begin
  -- 1. Acquire row-level lock on the target project to prevent concurrent submission races
  select *
  into v_proj
  from public.projects
  where id = p_project_id
    and owner_id = p_user_id
  for update;

  if not found then
    raise exception 'Project not found or you do not have permission to submit this project' using errcode = 'P0002';
  end if;

  -- 2. Idempotency safeguard: if already submitted, return existing state
  if v_proj.status in ('submitted', 'analyzing', 'completed') then
    return jsonb_build_object(
      'success', true,
      'already_submitted', true,
      'project_id', v_proj.id,
      'report_id', v_proj.report_id,
      'status', v_proj.status,
      'submitted_at', v_proj.submitted_at
    );
  end if;

  -- 3. Validate mandatory fields on the locked row
  if v_proj.category is null or trim(v_proj.category) = '' then
    raise exception 'Category selection is required for feasibility submission';
  end if;

  if v_proj.target_location is null or trim(v_proj.target_location) = '' then
    raise exception 'Target commercial location is required';
  end if;

  if v_proj.city is null or trim(v_proj.city) = '' then
    raise exception 'Target city is required';
  end if;

  if v_proj.lat is null or v_proj.lng is null or
     v_proj.lat < 23.5 or v_proj.lat > 37.2 or
     v_proj.lng < 60.8 or v_proj.lng > 77.9 then
    raise exception 'Valid Pakistan geographic coordinates are required';
  end if;

  if v_proj.budget_pkr is null or v_proj.budget_pkr < 10000 or v_proj.budget_pkr > 50000000 then
    raise exception 'Investment budget must be between Rs. 10,000 and Rs. 50,000,000 PKR';
  end if;

  if v_proj.radius_km is null or v_proj.radius_km < 5 or v_proj.radius_km > 15 then
    raise exception 'Competitor analysis radius must be between 5 km and 15 km';
  end if;

  -- 4. Create or reuse linked feasibility_reports row
  if v_proj.report_id is not null then
    v_report_id := v_proj.report_id;
    update public.feasibility_reports
    set
      category = v_proj.category,
      idea_text = coalesce(v_proj.product_description, v_proj.category || ' venture at ' || v_proj.target_location),
      city = v_proj.city,
      area = v_proj.target_location,
      lat = v_proj.lat,
      lng = v_proj.lng,
      radius_km = round(v_proj.radius_km)::smallint,
      budget_pkr = v_proj.budget_pkr,
      status = 'pending'
    where id = v_report_id
      and owner_id = p_user_id;
  else
    insert into public.feasibility_reports (
      owner_id,
      category,
      idea_text,
      city,
      area,
      lat,
      lng,
      radius_km,
      budget_pkr,
      status
    ) values (
      p_user_id,
      v_proj.category,
      coalesce(v_proj.product_description, v_proj.category || ' venture at ' || v_proj.target_location),
      v_proj.city,
      v_proj.target_location,
      v_proj.lat,
      v_proj.lng,
      round(v_proj.radius_km)::smallint,
      v_proj.budget_pkr,
      'pending'
    )
    returning id into v_report_id;
  end if;

  -- 5. Atomically transition project status to 'submitted'
  update public.projects
  set
    status = 'submitted',
    submitted_at = v_submitted_at,
    report_id = v_report_id,
    current_step = 3
  where id = p_project_id;

  -- 6. Enqueue collection request into project_collection_runs if table exists
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'project_collection_runs'
  ) then
    insert into public.project_collection_runs (
      project_id,
      status
    ) values (
      p_project_id,
      'pending'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'already_submitted', false,
    'project_id', p_project_id,
    'report_id', v_report_id,
    'status', 'submitted',
    'submitted_at', v_submitted_at
  );
end;
$$;

grant execute on function public.submit_project_for_feasibility(uuid, uuid) to authenticated;
