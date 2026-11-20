-- AI Gateway durable runtime support (additive, data-preserving)
-- Run once in Supabase SQL Editor after reviewing the project ref.
-- This does not drop or modify existing application tables.

create table if not exists public.ai_gateway_cache (
  cache_key text primary key check (cache_key ~ '^[0-9a-f]{64}$'),
  owner_id uuid not null references auth.users(id) on delete cascade,
  task text not null check (task in ('advisory', 'theme', 'product_description')),
  language text not null default 'en' check (language in ('en', 'ur_roman')),
  content text not null,
  provider text not null check (provider in ('openai', 'gemini', 'groq')),
  model text not null,
  usage jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_gateway_cache_owner_expiry
  on public.ai_gateway_cache (owner_id, expires_at desc);

create index if not exists idx_ai_gateway_cache_expiry
  on public.ai_gateway_cache (expires_at);

create table if not exists public.ai_gateway_usage (
  request_id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  task text not null check (task in ('advisory', 'theme', 'product_description')),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_gateway_usage_owner_created
  on public.ai_gateway_usage (owner_id, created_at desc);

create table if not exists public.ai_gateway_provider_state (
  provider text primary key check (provider in ('openai', 'gemini', 'groq')),
  failure_count integer not null default 0 check (failure_count >= 0),
  window_started_at timestamptz,
  circuit_open_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.ai_gateway_cache enable row level security;
alter table public.ai_gateway_cache force row level security;
alter table public.ai_gateway_usage enable row level security;
alter table public.ai_gateway_usage force row level security;
alter table public.ai_gateway_provider_state enable row level security;
alter table public.ai_gateway_provider_state force row level security;

-- These tables are accessed only by trusted server code using service_role.
revoke all on public.ai_gateway_cache from public, anon, authenticated;
revoke all on public.ai_gateway_usage from public, anon, authenticated;
revoke all on public.ai_gateway_provider_state from public, anon, authenticated;
grant select, insert, update, delete on public.ai_gateway_cache to service_role;
grant select, insert, update, delete on public.ai_gateway_usage to service_role;
grant select, insert, update, delete on public.ai_gateway_provider_state to service_role;

-- Atomically reserve one logical AI request per authenticated user quota window.
create or replace function public.reserve_ai_gateway_request(
  p_request_id uuid,
  p_owner_id uuid,
  p_task text,
  p_hourly_limit integer default 20
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count bigint;
  v_limit integer;
begin
  if p_owner_id is null
     or p_task not in ('advisory', 'theme', 'product_description')
     or p_request_id is null then
    return false;
  end if;

  v_limit := greatest(1, least(coalesce(p_hourly_limit, 20), 1000));
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 0));

  if exists (
    select 1 from public.ai_gateway_usage
    where request_id = p_request_id and owner_id = p_owner_id
  ) then
    return true;
  end if;

  select count(*) into v_count
  from public.ai_gateway_usage
  where owner_id = p_owner_id
    and created_at >= now() - interval '1 hour';

  if v_count >= v_limit then
    return false;
  end if;

  insert into public.ai_gateway_usage (request_id, owner_id, task)
  values (p_request_id, p_owner_id, p_task);
  return true;
end;
$$;

-- Update one shared provider circuit breaker after each completed provider attempt.
create or replace function public.record_ai_gateway_provider_attempt(
  p_provider text,
  p_success boolean,
  p_failure_threshold integer default 3,
  p_window_seconds integer default 300
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_state public.ai_gateway_provider_state%rowtype;
  v_threshold integer := greatest(1, least(coalesce(p_failure_threshold, 3), 20));
  v_window integer := greatest(30, least(coalesce(p_window_seconds, 300), 3600));
begin
  if p_provider not in ('openai', 'gemini', 'groq') then
    return;
  end if;

  insert into public.ai_gateway_provider_state (provider)
  values (p_provider)
  on conflict (provider) do nothing;

  select * into v_state
  from public.ai_gateway_provider_state
  where provider = p_provider
  for update;

  if coalesce(p_success, false) then
    update public.ai_gateway_provider_state
    set failure_count = 0,
        window_started_at = null,
        circuit_open_until = null,
        updated_at = now()
    where provider = p_provider;
    return;
  end if;

  if v_state.window_started_at is null
     or v_state.window_started_at < now() - make_interval(secs => v_window) then
    v_state.failure_count := 1;
    v_state.window_started_at := now();
  else
    v_state.failure_count := v_state.failure_count + 1;
  end if;

  update public.ai_gateway_provider_state
  set failure_count = v_state.failure_count,
      window_started_at = v_state.window_started_at,
      circuit_open_until = case
        when v_state.failure_count >= v_threshold then now() + make_interval(secs => v_window)
        else null
      end,
      updated_at = now()
  where provider = p_provider;
end;
$$;

create or replace function public.is_ai_gateway_provider_open(p_provider text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((
    select circuit_open_until > now()
    from public.ai_gateway_provider_state
    where provider = p_provider
  ), false);
$$;

-- Functions in the exposed public schema must not be callable by browser roles.
revoke all on function public.reserve_ai_gateway_request(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.record_ai_gateway_provider_attempt(text, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.is_ai_gateway_provider_open(text) from public, anon, authenticated;
grant execute on function public.reserve_ai_gateway_request(uuid, uuid, text, integer) to service_role;
grant execute on function public.record_ai_gateway_provider_attempt(text, boolean, integer, integer) to service_role;
grant execute on function public.is_ai_gateway_provider_open(text) to service_role;

-- Optional cache cleanup; run periodically if desired. Expired rows are harmless to reads.
-- delete from public.ai_gateway_cache where expires_at <= now();
