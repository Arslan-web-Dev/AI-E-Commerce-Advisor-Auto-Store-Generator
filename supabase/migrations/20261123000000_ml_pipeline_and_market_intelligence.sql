-- ====================================================================
-- Module A & B: Multiple-Model ML Pipeline & Punjab Market Intelligence
-- AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator
-- Standard: Production Schema for ML Model Lifecycle & Market Analytics
-- ====================================================================

-- 1. Extend Model Registry for Multiple-Model Algorithms & Explainability
alter table public.model_registry 
  add column if not exists algorithm text,
  add column if not exists problem_type text check (problem_type in ('classification', 'regression')),
  add column if not exists artifact_path text,
  add column if not exists feature_names jsonb not null default '[]'::jsonb,
  add column if not exists feature_importances jsonb not null default '[]'::jsonb,
  add column if not exists hyperparameters jsonb not null default '{}'::jsonb,
  add column if not exists validation_metrics jsonb not null default '{}'::jsonb,
  add column if not exists cv_metrics jsonb not null default '{}'::jsonb,
  add column if not exists confusion_matrix jsonb not null default '[]'::jsonb;

-- 2. ML Datasets Table
create table if not exists public.ml_datasets (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  description          text,
  file_name            text not null,
  file_path            text not null,
  file_size_bytes      bigint not null default 0,
  row_count            integer not null default 0,
  column_count         integer not null default 0,
  target_column        text,
  problem_type         text check (problem_type in ('classification', 'regression')),
  columns_metadata     jsonb not null default '[]'::jsonb,
  data_quality_report  jsonb not null default '{}'::jsonb,
  is_sample            boolean not null default false,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Link model_registry to ml_datasets if dataset exists
alter table public.model_registry
  add column if not exists dataset_id uuid references public.ml_datasets(id) on delete set null;

-- 3. ML Training Jobs Table
create table if not exists public.ml_training_jobs (
  id                   uuid primary key default gen_random_uuid(),
  dataset_id           uuid references public.ml_datasets(id) on delete cascade,
  target_column        text not null,
  problem_type         text not null check (problem_type in ('classification', 'regression')),
  candidate_algorithms jsonb not null default '[]'::jsonb,
  validation_strategy  text not null default 'stratified_kfold',
  cv_folds             integer not null default 5,
  test_size            numeric(3,2) not null default 0.20,
  status               text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  progress_pct         numeric(5,2) not null default 0,
  current_step         text,
  results              jsonb not null default '{}'::jsonb,
  best_model_id        uuid references public.model_registry(id) on delete set null,
  error_message        text,
  started_at           timestamptz,
  completed_at         timestamptz,
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now()
);

-- Link model_registry to ml_training_jobs
alter table public.model_registry
  add column if not exists training_job_id uuid references public.ml_training_jobs(id) on delete set null;

-- 4. Google Trends Queries & Caching Table
create table if not exists public.market_trend_queries (
  id                   uuid primary key default gen_random_uuid(),
  keyword              text not null,
  geo                  text not null default 'PK',
  timeframe            text not null default 'today 12-m',
  category             integer not null default 0,
  interest_over_time   jsonb not null default '[]'::jsonb,
  related_topics       jsonb not null default '[]'::jsonb,
  related_queries      jsonb not null default '[]'::jsonb,
  regional_breakdown   jsonb not null default '[]'::jsonb,
  trend_slope          numeric(8,4),
  trend_direction      text check (trend_direction in ('rising', 'falling', 'stable', 'volatile')),
  peak_month           text,
  seasonality_index    numeric(5,2),
  expires_at           timestamptz not null default (now() + interval '24 hours'),
  created_at           timestamptz not null default now()
);

create index if not exists idx_market_trends_lookup 
  on public.market_trend_queries (keyword, geo, timeframe, expires_at desc);

-- 5. Regional Market Statistics (Punjab Demographic & Economic Baselines)
create table if not exists public.regional_market_statistics (
  id                        uuid primary key default gen_random_uuid(),
  province                  text not null default 'Punjab',
  district                  text not null,
  tehsil                    text not null default 'All',
  division                  text not null,
  population_total          bigint not null,
  population_urban          bigint not null,
  urbanization_rate         numeric(5,2) not null,
  literacy_rate             numeric(5,2),
  household_size            numeric(4,2),
  commercial_rent_sqft_min  numeric(10,2) not null,
  commercial_rent_sqft_max  numeric(10,2) not null,
  commercial_rent_sqft_avg  numeric(10,2) not null,
  purchasing_power_index    numeric(5,2) not null check (purchasing_power_index >= 0 and purchasing_power_index <= 100),
  retail_density_score      numeric(5,2) not null check (retail_density_score >= 0 and retail_density_score <= 100),
  primary_commercial_hubs   jsonb not null default '[]'::jsonb,
  economic_drivers          jsonb not null default '[]'::jsonb,
  source_references         jsonb not null default '[]'::jsonb,
  updated_at                timestamptz not null default now(),
  unique(district, tehsil)
);

-- Seed Punjab Major Commercial & Regional Centers (PBS 2023 Census & Industry Benchmarks)
insert into public.regional_market_statistics (
  province, district, tehsil, division, population_total, population_urban, urbanization_rate, 
  literacy_rate, household_size, commercial_rent_sqft_min, commercial_rent_sqft_max, commercial_rent_sqft_avg, 
  purchasing_power_index, retail_density_score, primary_commercial_hubs, economic_drivers, source_references
) values
(
  'Punjab', 'Lahore', 'All', 'Lahore', 13004135, 13004135, 100.0, 78.5, 6.2,
  120.0, 450.0, 240.0, 88.5, 92.0,
  '["Gulberg (MM Alam / Main Blvd)", "DHA (Y / H / Z Blocks)", "Mall Road", "Johar Town / Emporium Hub", "Liberty Market", "Anarkali"]'::jsonb,
  '["Financial & Corporate Services", "Retail & Hospitality", "Textiles & Fashion", "Tech & Logistics Hub"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}, {"agency": "Punjab Development Statistics", "year": "2023"}]'::jsonb
),
(
  'Punjab', 'Rawalpindi', 'All', 'Rawalpindi', 5537045, 3105000, 56.1, 82.3, 5.9,
  90.0, 350.0, 195.0, 82.0, 80.5,
  '["Saddar Commercial", "Bahria Town Commercial Hubs", "Murree Road", "Raja Bazaar", "Peshawar Road"]'::jsonb,
  '["Services & Government", "Defense & Logistics", "Wholesale Trading", "Real Estate Development"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Faisalabad', 'All', 'Faisalabad', 8838883, 3691999, 41.8, 70.1, 6.4,
  70.0, 280.0, 150.0, 75.0, 78.0,
  '["D-Ground Peoples Colony", "Clock Tower 8 Bazaars", "Susan Road", "Jaranwala Road Commercial", "Sargodha Road Hub"]'::jsonb,
  '["Textile Manufacturing & Exports", "Ginning & Milling", "Agricultural Trade & Machinery", "Fast Moving Consumer Goods"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Multan', 'All', 'Multan', 5362305, 2315000, 43.2, 61.2, 6.5,
  60.0, 240.0, 130.0, 68.0, 69.5,
  '["Cantonment Saddar", "Gulgasht Colony Commercial", "Bosan Road Hub", "Hussain Agahi", "Chowk Kachehri"]'::jsonb,
  '["Cotton & Mango Agro-Processing", "Fertilizers & Chemicals", "Regional Wholesale Hub for South Punjab"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Gujranwala', 'All', 'Gujranwala', 5988110, 3100000, 51.8, 73.5, 6.6,
  65.0, 260.0, 140.0, 74.0, 76.0,
  '["Satellite Town Market", "Model Town Commercial", "GT Road Commercial Belt", "Rail Bazaar"]'::jsonb,
  '["Sanitary & Ceramics", "Light Engineering & Cutlery", "Electrical Appliances & Motors", "Rice Processing"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Sialkot', 'All', 'Gujranwala', 4499394, 1520000, 33.8, 74.8, 6.3,
  70.0, 270.0, 145.0, 79.0, 74.0,
  '["Cantonment Mall Area", "Kashmir Road Commercial", "Paris Road", "Defense Road"]'::jsonb,
  '["Surgical Instruments Export", "Sports Goods Export", "Leather Garments & Footwear", "Light Aviation"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Bahawalpur', 'All', 'Bahawalpur', 4284964, 1280000, 29.9, 53.4, 6.4,
  45.0, 180.0, 95.0, 58.0, 56.0,
  '["Circular Road Bazaar", "Model Town Commercial", "Satellite Town", "Farid Gate Market"]'::jsonb,
  '["Agriculture Trade (Cotton & Wheat)", "Education Hub", "Tourism & Handicrafts"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Sargodha', 'All', 'Sargodha', 4595230, 1480000, 32.2, 65.8, 6.3,
  50.0, 200.0, 105.0, 62.0, 61.0,
  '["Kutchery Bazaar", "Satellite Town", "University Road Hub", "Fatima Jinnah Road"]'::jsonb,
  '["Citrus (Kinnow) Agro-Industry", "Defense Services Base", "Grain & Sugarcane Processing"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Sahiwal', 'All', 'Sahiwal', 2881511, 720000, 25.0, 64.2, 6.2,
  40.0, 170.0, 90.0, 60.0, 58.0,
  '["High Street Commercial", "Liaquat Road", "Fateh Sher Road", "Farid Town"]'::jsonb,
  '["Dairy Processing & Livestock", "Cotton & Tobacco Trading", "Edible Oil Processing"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
),
(
  'Punjab', 'Sheikhupura', 'All', 'Lahore', 4049861, 1420000, 35.1, 65.4, 6.5,
  45.0, 190.0, 100.0, 64.0, 62.0,
  '["Main Bazaar", "Housing Colony Commercial", "Lahore-Sargodha Road Hub", "Bhikhi Road"]'::jsonb,
  '["Industrial Processing (Rice & Paper)", "Automotive Assembly", "Proximity to Lahore Logistics"]'::jsonb,
  '[{"agency": "Pakistan Bureau of Statistics", "publication": "7th Population & Housing Census 2023"}]'::jsonb
)
on conflict (district, tehsil) do update set
  population_total = excluded.population_total,
  population_urban = excluded.population_urban,
  urbanization_rate = excluded.urbanization_rate,
  literacy_rate = excluded.literacy_rate,
  household_size = excluded.household_size,
  commercial_rent_sqft_min = excluded.commercial_rent_sqft_min,
  commercial_rent_sqft_max = excluded.commercial_rent_sqft_max,
  commercial_rent_sqft_avg = excluded.commercial_rent_sqft_avg,
  purchasing_power_index = excluded.purchasing_power_index,
  retail_density_score = excluded.retail_density_score,
  primary_commercial_hubs = excluded.primary_commercial_hubs,
  economic_drivers = excluded.economic_drivers,
  source_references = excluded.source_references,
  updated_at = now();

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

alter table public.ml_datasets enable row level security;
alter table public.ml_datasets force row level security;

alter table public.ml_training_jobs enable row level security;
alter table public.ml_training_jobs force row level security;

alter table public.market_trend_queries enable row level security;
alter table public.market_trend_queries force row level security;

alter table public.regional_market_statistics enable row level security;
alter table public.regional_market_statistics force row level security;

-- ML Datasets: Authenticated users can view datasets; Admins can insert/update/delete
drop policy if exists ml_datasets_read on public.ml_datasets;
create policy ml_datasets_read on public.ml_datasets
  for select
  to authenticated
  using (true);

drop policy if exists ml_datasets_manage on public.ml_datasets;
create policy ml_datasets_manage on public.ml_datasets
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ML Training Jobs: Authenticated users can view training jobs; Admins can launch/manage
drop policy if exists ml_training_jobs_read on public.ml_training_jobs;
create policy ml_training_jobs_read on public.ml_training_jobs
  for select
  to authenticated
  using (true);

drop policy if exists ml_training_jobs_manage on public.ml_training_jobs;
create policy ml_training_jobs_manage on public.ml_training_jobs
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Market Trend Queries: Authenticated users can read cached trends and insert newly fetched results
drop policy if exists market_trends_read on public.market_trend_queries;
create policy market_trends_read on public.market_trend_queries
  for select
  to authenticated
  using (true);

drop policy if exists market_trends_insert on public.market_trend_queries;
create policy market_trends_insert on public.market_trend_queries
  for insert
  to authenticated
  with check (true);

-- Regional Statistics: Authenticated users can read regional stats; Admins can manage
drop policy if exists regional_stats_read on public.regional_market_statistics;
create policy regional_stats_read on public.regional_market_statistics
  for select
  to authenticated
  using (true);

drop policy if exists regional_stats_manage on public.regional_market_statistics;
create policy regional_stats_manage on public.regional_market_statistics
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
