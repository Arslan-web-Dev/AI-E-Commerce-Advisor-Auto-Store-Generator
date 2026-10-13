-- ==============================================================================
-- Module 8: Generated Store Management Schema
-- Products, Inventory, Orders, Customers, Invoices, Payment Settings & RLS
-- ==============================================================================

-- Helper check function for store management access
create or replace function public.can_manage_store(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.stores
    where id = p_store_id
      and (owner_id = auth.uid() or public.is_admin())
  );
$$;

-- ------------------------------------------------------------------------------
-- 1. Products Table
-- ------------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  sku text,
  description text,
  price_pkr bigint not null check (price_pkr >= 0),
  compare_at_price_pkr bigint check (compare_at_price_pkr is null or compare_at_price_pkr >= price_pkr),
  cost_price_pkr bigint check (cost_price_pkr is null or cost_price_pkr >= 0),
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  category text,
  images text[] not null default '{}',
  variants jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create index if not exists idx_products_store_active on public.products (store_id, is_active, is_archived);
create index if not exists idx_products_store_stock on public.products (store_id, stock);

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 2. Orders Table
-- ------------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_number text not null,
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null check (char_length(customer_phone) between 7 and 20),
  customer_email text,
  shipping_address text not null check (char_length(shipping_address) >= 5),
  city text not null,
  payment_method text not null default 'cod' check (payment_method in ('cod', 'stripe', 'paypal', 'card_mock')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'refunded', 'failed')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'fulfilled', 'cancelled', 'returned')),
  subtotal_pkr bigint not null check (subtotal_pkr >= 0),
  shipping_fee_pkr bigint not null default 0 check (shipping_fee_pkr >= 0),
  tax_pkr bigint not null default 0 check (tax_pkr >= 0),
  total_pkr bigint not null check (total_pkr >= 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned')),
  status_history jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_store_status on public.orders (store_id, status, created_at desc);

drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. Order Items Table
-- ------------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  sku text,
  unit_price_pkr bigint not null check (unit_price_pkr >= 0),
  quantity integer not null check (quantity > 0),
  total_price_pkr bigint not null check (total_price_pkr >= 0)
);

create index if not exists idx_order_items_order on public.order_items (order_id);

-- ------------------------------------------------------------------------------
-- 4. Store Customers Table (Aggregated Profiles)
-- ------------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  city text,
  address text,
  total_orders integer not null default 0 check (total_orders >= 0),
  total_spend_pkr bigint not null default 0 check (total_spend_pkr >= 0),
  last_order_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, phone)
);

create index if not exists idx_customers_store_spend on public.customers (store_id, total_spend_pkr desc);

drop trigger if exists trg_customers_updated on public.customers;
create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 5. Inventory Logs Table (Audit Trail)
-- ------------------------------------------------------------------------------
create table if not exists public.inventory_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  delta integer not null,
  previous_stock integer not null check (previous_stock >= 0),
  new_stock integer not null check (new_stock >= 0),
  reason text not null check (reason in ('manual_adjustment', 'order_placed', 'order_cancelled', 'restock', 'damage', 'initial_setup')),
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_logs_product on public.inventory_logs (product_id, created_at desc);

-- ------------------------------------------------------------------------------
-- 6. Store Payment Settings Table
-- ------------------------------------------------------------------------------
create table if not exists public.store_payment_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade unique,
  cod_enabled boolean not null default true,
  stripe_enabled boolean not null default false,
  stripe_account_id text,
  paypal_enabled boolean not null default false,
  paypal_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 7. Row-Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.products force row level security;

alter table public.orders enable row level security;
alter table public.orders force row level security;

alter table public.order_items enable row level security;
alter table public.order_items force row level security;

alter table public.customers enable row level security;
alter table public.customers force row level security;

alter table public.inventory_logs enable row level security;
alter table public.inventory_logs force row level security;

alter table public.store_payment_settings enable row level security;
alter table public.store_payment_settings force row level security;

-- Policies for products
create policy "Owners manage store products"
  on public.products
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

create policy "Public can view active products of published stores"
  on public.products
  for select
  to public
  using (
    is_active = true and is_archived = false and exists (
      select 1 from public.stores where id = products.store_id and status = 'published'
    )
  );

-- Policies for orders
create policy "Owners manage store orders"
  on public.orders
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Policies for order items
create policy "Owners manage store order items"
  on public.order_items
  for all
  to authenticated
  using (
    exists (
      select 1 from public.orders where id = order_items.order_id and public.can_manage_store(orders.store_id)
    )
  )
  with check (
    exists (
      select 1 from public.orders where id = order_items.order_id and public.can_manage_store(orders.store_id)
    )
  );

-- Policies for customers
create policy "Owners manage store customers"
  on public.customers
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));

-- Policies for inventory logs
create policy "Owners view store inventory logs"
  on public.inventory_logs
  for select
  to authenticated
  using (public.can_manage_store(store_id));

create policy "Owners insert store inventory logs"
  on public.inventory_logs
  for insert
  to authenticated
  with check (public.can_manage_store(store_id));

-- Policies for payment settings
create policy "Owners manage store payment settings"
  on public.store_payment_settings
  for all
  to authenticated
  using (public.can_manage_store(store_id))
  with check (public.can_manage_store(store_id));
