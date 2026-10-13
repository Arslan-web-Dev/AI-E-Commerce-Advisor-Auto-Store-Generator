-- ==============================================================================
-- Module 9: Generated Store Analytics, Customer Behavior & Event Tracking
-- Migration: 20261006070000_module9_analytics_schema.sql
-- ==============================================================================

-- 1. Store Analytics Events Table
create table if not exists public.store_analytics_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  session_id text not null, -- Pseudonymous session hash (privacy-safe, no personal data)
  event_type text not null check (
    event_type in ('page_view', 'product_view', 'add_to_cart', 'remove_from_cart', 'begin_checkout', 'purchase')
  ),
  product_id uuid references public.products(id) on delete set null,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2. Indexes for fast aggregation and time-range filtering
create index if not exists idx_store_events_store_date 
  on public.store_analytics_events(store_id, created_at desc);

create index if not exists idx_store_events_store_type 
  on public.store_analytics_events(store_id, event_type);

create index if not exists idx_store_events_product 
  on public.store_analytics_events(product_id);

create index if not exists idx_store_events_session 
  on public.store_analytics_events(store_id, session_id);

-- 3. Row-Level Security
alter table public.store_analytics_events enable row level security;
alter table public.store_analytics_events force row level security;

-- Only authorized store owners or system admins can read analytics events
create policy "store_owners_select_events" on public.store_analytics_events
  for select
  using (can_manage_store(store_id));

-- Public storefront visitors can insert telemetry events only for unbanned, valid stores
create policy "public_insert_store_events" on public.store_analytics_events
  for insert
  with check (
    exists (
      select 1 from public.stores s 
      where s.id = store_id and s.is_banned = false
    )
  );

-- Store owners can purge their own events for privacy or retention maintenance
create policy "store_owners_delete_events" on public.store_analytics_events
  for delete
  using (can_manage_store(store_id));
