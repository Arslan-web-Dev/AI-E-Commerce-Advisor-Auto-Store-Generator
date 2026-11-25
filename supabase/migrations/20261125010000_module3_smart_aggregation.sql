-- ====================================================================
-- Module 3 (Task 4): Smart Data Aggregation hardening
-- Additive, forward-only migration for competitor query cache and
-- richer rent-cache provenance metadata.
--
-- Rollback guidance:
--   drop table if exists public.competitor_query_cache;
--   alter table public.rent_cache
--     drop column if exists rent_min_pkr,
--     drop column if exists rent_max_pkr,
--     drop column if exists rent_avg_pkr,
--     drop column if exists currency,
--     drop column if exists confidence,
--     drop column if exists provenance,
--     drop column if exists district,
--     drop column if exists province,
--     drop column if exists lat,
--     drop column if exists lng,
--     drop column if exists notes;
-- ====================================================================

-- 1. Seven-day competitor query cache (FR-3.2)
create table if not exists public.competitor_query_cache (
  id              uuid primary key default gen_random_uuid(),
  cache_key       text not null unique,
  category        text not null,
  lat_rounded     numeric(8,3) not null,
  lng_rounded     numeric(8,3) not null,
  radius_km       numeric(5,2) not null,
  provider        text not null default 'overpass_osm',
  query_version   text not null default 'v1',
  item_count      integer not null default 0,
  payload         jsonb not null default '[]'::jsonb,
  provenance      text not null default 'external_api'
                    check (provenance in ('external_api', 'synthetic_demo', 'licensed_dataset', 'manual_estimate')),
  attribution     text not null default '© OpenStreetMap contributors',
  retrieved_at    timestamptz not null default now(),
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_competitor_query_cache_expires
  on public.competitor_query_cache (expires_at);

create index if not exists idx_competitor_query_cache_lookup
  on public.competitor_query_cache (category, lat_rounded, lng_rounded, radius_km);

alter table public.competitor_query_cache enable row level security;
alter table public.competitor_query_cache force row level security;

-- Authenticated users may read shared cache entries (no PII).
drop policy if exists competitor_cache_read_auth on public.competitor_query_cache;
create policy competitor_cache_read_auth on public.competitor_query_cache
  for select
  to authenticated
  using (true);

-- Writes are performed by the server service role only (bypasses RLS).

-- 2. Enrich rent_cache with aggregation metadata (FR-3.3 / FR-3.4)
alter table public.rent_cache
  add column if not exists rent_min_pkr numeric(12,2),
  add column if not exists rent_max_pkr numeric(12,2),
  add column if not exists rent_avg_pkr numeric(12,2),
  add column if not exists currency text not null default 'PKR',
  add column if not exists confidence text not null default 'low'
    check (confidence in ('high', 'medium', 'low', 'none')),
  add column if not exists provenance text not null default 'manual_estimate'
    check (provenance in ('external_api', 'synthetic_demo', 'licensed_dataset', 'manual_estimate')),
  add column if not exists district text,
  add column if not exists province text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists notes text;

-- Backfill avg from the legacy single-value column when missing.
update public.rent_cache
set rent_avg_pkr = rent_per_sqft_pkr
where rent_avg_pkr is null
  and rent_per_sqft_pkr is not null;

create index if not exists idx_rent_cache_city_area
  on public.rent_cache (lower(city), lower(area));

create index if not exists idx_rent_cache_district
  on public.rent_cache (lower(coalesce(district, city)));

create index if not exists idx_rent_cache_coords
  on public.rent_cache (lat, lng)
  where lat is not null and lng is not null;
