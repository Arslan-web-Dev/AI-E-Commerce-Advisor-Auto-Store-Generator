-- Enforce the revised SRS COD-only checkout rule for all new/updated orders.
-- NOT VALID preserves historical rows created by earlier experimental gateways,
-- while PostgreSQL enforces this constraint on every new or changed row.
alter table public.orders
  drop constraint if exists orders_cod_only;

alter table public.orders
  add constraint orders_cod_only
  check (payment_method = 'cod' or created_at < timestamptz '2026-11-23 00:00:00+00') not valid;

-- Disable online gateway configuration for all existing stores.
update public.store_payment_settings
set stripe_enabled = false,
    paypal_enabled = false,
    stripe_account_id = null,
    paypal_email = null,
    cod_enabled = true;
