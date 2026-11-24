-- ==============================================================================
-- Module 1 & 2 Security Remediation: Secure Atomic Project Submission RPC
-- Migration: 20261124000000_secure_submit_project_rpc.sql
--
-- Forward-only. Replaces the caller-trusted two-argument RPC (which accepted a
-- project id plus a caller-supplied user id) with a single-argument version that
-- derives the authenticated identity exclusively from auth.uid(). A caller-supplied
-- user id must never determine authorization inside a SECURITY DEFINER function.
-- ==============================================================================

-- 1. Remove every prior signature so the insecure two-argument form cannot
--    remain as an alternate, caller-trusted code path. This is safe to run
--    repeatedly and only removes functions owned by this project schema.
--    The RPC has no dependent database objects (it is invoked over the API),
--    so a plain DROP succeeds; if a dependency ever existed, the migration
--    fails loudly instead of silently leaving an insecure function behind.
drop function if exists public.submit_project_for_feasibility(uuid, uuid);
drop function if exists public.submit_project_for_feasibility(uuid);

-- 2. Create the secure single-argument RPC. Identity is never accepted from
--    the caller; it is resolved from the verified PostgREST JWT via auth.uid().
create or replace function public.submit_project_for_feasibility(
  p_project_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_proj record;
  v_report_id uuid;
  v_submitted_at timestamptz := now();
begin
  -- 0. Reject unauthenticated execution outright.
  if v_user_id is null then
    raise exception 'Authentication required: no authenticated session' using errcode = '28000';
  end if;

  -- 1. Acquire a row-level lock on the caller's OWN project to prevent
  --    concurrent submission races. Ownership is enforced here and only here,
  --    using the server-derived identity.
  select *
  into v_proj
  from public.projects
  where id = p_project_id
    and owner_id = v_user_id
  for update;

  if not found then
    raise exception 'Project not found or you do not have permission to submit this project' using errcode = 'P0002';
  end if;

  -- 2. Idempotency safeguard: if already submitted, return the existing state.
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

  -- 3. Validate mandatory fields on the locked row.
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

  -- 4. Create or reuse the linked feasibility_reports row. Reuse is restricted
  --    to a report the caller already owns.
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
      and owner_id = v_user_id;
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
      v_user_id,
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

  -- 5. Atomically transition the caller's own project to 'submitted'.
  update public.projects
  set
    status = 'submitted',
    submitted_at = v_submitted_at,
    report_id = v_report_id,
    current_step = 3
  where id = p_project_id
    and owner_id = v_user_id;

  -- 6. Enqueue a collection request when the Module 3 table exists.
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

-- 3. Lock down execution privileges. Functions default to EXECUTE for PUBLIC,
--    so PUBLIC and anon must be revoked explicitly before granting to the
--    intended authenticated role only.
revoke all on function public.submit_project_for_feasibility(uuid) from public;
revoke all on function public.submit_project_for_feasibility(uuid) from anon;
grant execute on function public.submit_project_for_feasibility(uuid) to authenticated;

-- 4. Defensive: ensure no stale two-argument grant remains (the function is
--    already dropped above, so this is a no-op when executed in order).
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'submit_project_for_feasibility'
      and p.pronargs = 2
  ) then
    raise exception 'Insecure two-argument submit RPC still present after migration';
  end if;
end $$;
