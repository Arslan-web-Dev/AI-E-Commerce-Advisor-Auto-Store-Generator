# Supabase Schema Reconciliation

- **Audit date:** 2026-11-26
- **Repository HEAD:** `1b0af8a6157ee029c85f69c135406afd18515147`
- **Method:** static, read-only inspection of `supabase/combined_schema.sql`, all 30 files in `supabase/migrations/`, `supabase/manual/ai_gateway_runtime.sql`, and `src/**` query/RPC call sites.
- **Execution statement:** **No SQL was executed. No database was accessed. No migration was rerun. No file was modified before this audit-document pass. No credentials or secret values were printed.**

## 1. Final verdict

| Item | Status |
| --- | --- |
| Ordered migrations as the forward-only source of truth | **IMPLEMENTED** |
| `combined_schema.sql` as a standalone install artifact | **BROKEN** |
| App/RPC compatibility with the full migrated schema | **PARTIALLY IMPLEMENTED** |
| RLS/SECURITY DEFINER design | **PARTIALLY IMPLEMENTED** |
| Storage bucket and policy design | **PARTIALLY IMPLEMENTED** |
| Live database/RLS execution proof | **UNVERIFIED** |

The ordered migration sequence is coherent and contains nearly all objects required by the application. `combined_schema.sql` is a stale concatenated artifact: it omits most Module 6–8 work, all late order RPCs, the product-image bucket, and several provenance/freshness columns. It must not be applied as a substitute for the ordered migrations.

## 2. Migration timeline

There are **30** migration files, from `20261004000000_module1_auth_rbac_schema.sql` through `20261127030000_module8_product_image_storage.sql`.

| # | Migration | Purpose |
| ---: | --- | --- |
| 1 | `20261004000000_module1_auth_rbac_schema.sql` | Auth/RBAC, profiles, stores, rent cache, sys config, audit log; base RLS/FORCE RLS. |
| 2 | `20261006000000_module2_projects_wizard_schema.sql` | Projects and wizard state. |
| 3 | `20261006010000_module3_data_collection_schema.sql` | Collection runs and provider records; `can_access_project`. |
| 4 | `20261006020000_module4_feature_processing_schema.sql` | Processing runs and features. |
| 5 | `20261006030000_module5_feasibility_schema.sql` | Model registry and feasibility runs. |
| 6 | `20261006040000_module6_strategic_advisory_schema.sql` | Advisory reports. |
| 7 | `20261006050000_module7_storefront_configurator_schema.sql` | Store wizard sessions/draft versions. |
| 8 | `20261006060000_module8_store_management_schema.sql` | Products, orders, order items, customers, inventory, payment settings. |
| 9 | `20261006070000_module9_analytics_schema.sql` | Store analytics events; public insert policy. Out-of-scope product analytics, but table is used by owner analytics panel. |
| 10 | `20261119000000_module5_model_registry_admin_policy.sql` | Admin model-registry policy. |
| 11 | `20261119010000_module2_default_currency_pkr.sql` | PKR default currency. |
| 12 | `20261119020000_module3_truthful_provider_defaults.sql` | Truthful provider/provenance defaults. |
| 13 | `20261119030000_audit_storage_and_hardening.sql` | Initial storage hardening; later partly superseded. |
| 14 | `20261123000000_ml_pipeline_and_market_intelligence.sql` | ML datasets/jobs, market trends, regional stats. |
| 15 | `20261123010000_storage_and_rbac_hardening.sql` | Private attachments and RBAC hardening. |
| 16 | `20261123020000_module1_module2_remediation.sql` | Profile trigger, radius correction, exchange-rate columns, removed insecure RPC. |
| 17 | `20261124000000_secure_submit_project_rpc.sql` | Secure 1-arg `submit_project_for_feasibility(uuid)`. |
| 18 | `20261124010000_private_attachments_and_password_completion.sql` | Re-hardened private attachments; profile flag completion bypass. |
| 19 | `20261124020000_module2_wizard_district.sql` | Added `projects.district`. |
| 20 | `20261125010000_module3_smart_aggregation.sql` | `competitor_query_cache`, rent enrichment/backfill. |
| 21 | `20261125120000_module3_persistence_hardening.sql` | Freshness/cache columns; active-run uniqueness. |
| 22 | `20261125130000_module4_model_pipeline_hardening.sql` | Unit-bearing feature columns, feasibility provenance, config versions. |
| 23 | `20261126140000_task5_provenance_hardening.sql` | Dataset/model provenance columns. |
| 24 | `20261126150000_module6_advisory_extensions.sql` | `advisory_action_states`. |
| 25 | `20261126160000_module7_theme_configurator.sql` | Store/project linkage, theme versioning, append-only drafts. |
| 26 | `20261127000000_module8_publication_domain_lifecycle.sql` | Domain fields, lifecycle events, slug trigger, admin state RPC. |
| 27 | `20261127010000_module8_order_integrity.sql` | Idempotency key and unique order numbers. |
| 28 | `20261127020000_module8_secure_order_rpcs.sql` | Six secure order/publication RPCs and rate-limit ledger. |
| 29 | `20261127030000_module8_product_image_storage.sql` | Public product-image bucket and manager-only policies. |
| Manual | `supabase/manual/ai_gateway_runtime.sql` | AI cache/usage/provider-state tables and service-role RPCs. |

## 3. Canonical objects introduced after the baseline

| Object | Key columns / behavior | Status |
| --- | --- | --- |
| `competitor_query_cache` | `cache_key`, category/lat/lng/radius, provider/query version, payload, provenance, attribution, TTL | **IMPLEMENTED** in migration 20 |
| `ml_scoring_config_versions` | versioned threshold config with bounds check | **IMPLEMENTED** in migration 22 |
| `advisory_action_states` | owner/report/item-scoped action ticks | **IMPLEMENTED** in migration 24 |
| `store_lifecycle_events` | append-only store action audit | **IMPLEMENTED** in migration 26 |
| `store_order_rate_limits` | store/IP-hash/window ledger; no browser grants | **IMPLEMENTED** in migration 28 |
| `stores` domain fields | `domain_status`, verification token/challenges, verified/attached timestamps, provider reference, last error | **IMPLEMENTED** in migration 26 |
| `stores` publication fields | `published_at`, `unpublished_at`, `suspended_at` | **IMPLEMENTED** in migrations 26/28 |
| `stores.project_id`, theme version fields | one-store-per-project guard, theme version metadata | **IMPLEMENTED** in migration 25 |
| `orders.idempotency_key` | partial unique `(store_id, idempotency_key)` | **IMPLEMENTED** in migration 27 |
| `product-images` bucket | public reads, manager-only writes under store UUID folder, 5 MB, JPEG/PNG/WebP | **PARTIALLY IMPLEMENTED** |
| `ai_gateway_cache`, `ai_gateway_usage`, `ai_gateway_provider_state` | service-role-only runtime tables/RPCs | **PARTIALLY IMPLEMENTED**; no `src/` caller found |

## 4. Constraints, indexes, triggers, functions

### 4.1 Foreign keys and uniqueness

Core FKs exist for `profiles.id → auth.users`, `stores.owner_id`, `projects.owner_id`, collection/processing/advisory records, products/orders/items/customers/inventory/payment settings, ML datasets/jobs, advisory action states, lifecycle events, and rate limits.

Important unique constraints include:

- `stores.slug`, `stores.custom_domain` — **IMPLEMENTED**
- `products(store_id, slug)` — **IMPLEMENTED**
- `customers(store_id, phone)` — **IMPLEMENTED**
- `model_registry(name, version)` and one active model per scoring mode — **IMPLEMENTED**
- `regional_market_statistics(district, tehsil)` — **IMPLEMENTED**
- `uq_collection_runs_active_project` — **IMPLEMENTED**
- `uq_store_draft_versions_store_version` — **IMPLEMENTED**
- `uq_stores_project_id_task9` fail-closed guard — **IMPLEMENTED**
- `uq_orders_store_idempotency_key`, `uq_orders_store_order_number` — **IMPLEMENTED**
- `store_order_rate_limits(store_id, ip_hash, window_start)` — **IMPLEMENTED**

### 4.2 CHECK constraints

Baseline checks cover camera-style PKR amounts, statuses, provenance, reasons, risk levels and non-negative values. Later checks add cache/rent freshness domains, risk level values, approval/training mode, action keys, domain status, rate-limit counts and AI gateway enums. The radius was corrected from `10–15` / `1–50` to `5–15` in migration 16.

### 4.3 Triggers

| Trigger | Purpose | Status |
| --- | --- | --- |
| `on_auth_user_created` | owner-only profile creation | **IMPLEMENTED** |
| `trg_stores_updated`, `trg_projects_updated`, wizard/product/order/customer updated triggers | timestamp maintenance | **IMPLEMENTED** |
| `trg_enforce_profile_update_integrity` | prevent self-role escalation/flag tampering | **IMPLEMENTED** |
| `trg_stores_project_owner` | store/project owner consistency | **IMPLEMENTED** |
| `trg_store_draft_versions_immutable` | append-only theme drafts | **IMPLEMENTED** |
| `trg_stores_slug_reserved_validation` | slug format/reserved-word guard | **IMPLEMENTED** |

### 4.4 SECURITY DEFINER functions

All reviewed `SECURITY DEFINER` functions pin `search_path` (`public, pg_temp` or `pg_catalog, public`). Caller-supplied actor IDs are treated as audit labels, not authorization inputs.

| Function | Access | Status |
| --- | --- | --- |
| `is_admin()`, `can_access_project()`, `can_manage_store()` | policy helpers | **IMPLEMENTED** |
| `submit_project_for_feasibility(uuid)` | authenticated; revoked public/anon | **IMPLEMENTED** |
| `set_store_admin_state(...)` | authenticated; admin recheck | **IMPLEMENTED** |
| `place_store_order(...)` | anon + authenticated; server-derived prices and rate limit | **PARTIALLY IMPLEMENTED** |
| `transition_store_order_status(...)`, `adjust_store_inventory(...)` | authenticated owner/admin via `can_manage_store` | **IMPLEMENTED** |
| `set_store_publication(...)` | authenticated owner/admin | **IMPLEMENTED** |
| `lookup_store_order(...)` | anon + authenticated; masked data | **PARTIALLY IMPLEMENTED** |
| AI gateway RPCs | service_role only | **IMPLEMENTED** |

Residual risks: the guest checkout rate limit trusts `x-forwarded-for`, analytics event insert is public, market trend cache rows allow authenticated writes with `with check (true)`, and the profile trigger depends on trusted JWT role claims. These are **PARTIALLY IMPLEMENTED** controls requiring deployment review.

## 5. RLS and storage

- RLS is enabled on the baseline tables and `FORCE ROW LEVEL SECURITY` is applied to most Module 2–9 and late Module 6–8 tables. `profiles`, `rent_cache`, `ai_call_log`, `system_config`, `config_sync_audit_log` are enabled but not forced.
- `profiles` uses a non-recursive update policy plus a trigger to block role/flag self-escalation. **Status: PARTIALLY IMPLEMENTED** until live attack tests pass.
- Public storefront reads require published, unbanned stores. **Status: PARTIALLY IMPLEMENTED** statically; live RLS proof is **UNVERIFIED**.
- `project-attachments` is private with `{user_id}/{project_id}` owner isolation and 1-hour signed URLs. **Status: IMPLEMENTED** statically.
- `product-images` is public with manager-only writes under store UUID folder, 5 MB and MIME allowlist. **Status: PARTIALLY IMPLEMENTED**; policy is store-folder-level, not per-product object-level, and the API relies on client-declared MIME/size.

## 6. `combined_schema.sql` reconciliation

### 6.1 Missing from the combined artifact

The combined file omits all or part of migrations 16–29 and the manual AI gateway runtime file. Specifically missing:

- profile integrity trigger and 5–15 km radius constraints
- `projects.exchange_rate*` columns
- secure 1-arg `submit_project_for_feasibility`
- `competitor_query_cache`
- rent-cache enrichment and freshness columns
- unit-bearing feature columns and feasibility provenance columns
- `ml_scoring_config_versions`
- dataset/model provenance columns
- `advisory_action_states`
- `stores.project_id`, theme version fields, `store_draft_versions.version_number`, theme triggers
- domain/publication fields, `store_lifecycle_events`, slug trigger, `set_store_admin_state`
- `orders.idempotency_key` and order uniqueness indexes
- all six secure order/publication RPCs and `store_order_rate_limits`
- `product-images` bucket and policies
- AI gateway runtime tables/RPCs

**Status: BROKEN.** Applying the combined artifact alone would break large parts of the app.

### 6.2 Duplicate/conflicting definitions

| Issue | Evidence | Status |
| --- | --- | --- |
| `stores_public_read` defined twice; first lacks `is_banned = false` | `combined_schema.sql:268-271`, `1315-1318` | **BROKEN** |
| Module 8 policies created twice without drops in the earlier block | `combined_schema.sql:1118-1186`, `1321-1401` | **BROKEN** |
| Analytics policies lack `drop policy if exists` | `combined_schema.sql:1238-1255` | **BROKEN** |
| Recursive profile policy retained | `combined_schema.sql:232-240` | **BROKEN** |
| Stale `20261119030000` header with private storage body and stale internal `20261006080000` header | `combined_schema.sql:1301-1305`, `1403-1420` | **BROKEN** |
| ML block has no migration header | `combined_schema.sql:1478+` | **PARTIALLY IMPLEMENTED** documentation |

### 6.3 Idempotency

Later migrations mostly use `if not exists`, `create or replace`, and `drop policy if exists`, but early Module 8/9 policy blocks and some 2026-11-23 policies are not safely rerunnable. Several migrations rewrite data (radius constraints, duplicate order numbers, active-run failures, rent average backfill), so they are forward-only. **Status: PARTIALLY IMPLEMENTED.**

## 7. Application/schema compatibility

Tables/RPCs referenced by `src/` were extracted and compared against the full migration set.

### 7.1 Seven app RPCs

| RPC | App caller | Full migrated schema | Combined artifact |
| --- | --- | --- | --- |
| `submit_project_for_feasibility` | `src/app/api/projects/[id]/submit/route.ts:145-147` | **IMPLEMENTED** | **BROKEN** absent |
| `set_store_admin_state` | `src/app/api/admin/stores/[id]/suspend/route.ts:27` | **IMPLEMENTED** | **BROKEN** absent |
| `set_store_publication` | owner/admin publish routes | **IMPLEMENTED** | **BROKEN** absent |
| `place_store_order` | `src/lib/store-management/guest-checkout.ts:169` | **IMPLEMENTED** | **BROKEN** absent |
| `transition_store_order_status` | `src/lib/store-management/order-operations.ts:41` | **IMPLEMENTED** | **BROKEN** absent |
| `adjust_store_inventory` | `src/lib/store-management/order-operations.ts:71` | **IMPLEMENTED** | **BROKEN** absent |
| `lookup_store_order` | `src/app/api/storefront/[slug]/orders/[orderNumber]/route.ts:23-27` | **IMPLEMENTED** | **BROKEN** absent |

### 7.2 Real mismatch remaining after all migrations

`src/lib/store-management/public-store.ts:16` selects `projects(title, description)`, but no migration defines `projects.description`; the canonical column is `product_description`. **Status: BROKEN.** This must be reconciled in a future implementation task, not by editing SQL during this audit.

### 7.3 Other combined-only breakages

`competitor_query_cache`, `advisory_action_states`, `ml_scoring_config_versions`, theme/domain/idempotency columns, provenance columns, rent enrichment columns and the `product-images` bucket are all absent from the combined artifact but required by the app. Each is **BROKEN** if only `combined_schema.sql` is applied.

## 8. Security observations

| Finding | Status |
| --- | --- |
| Definer RPC authorization derives from `auth.uid()`/`is_admin()`/`can_manage_store()` | **IMPLEMENTED** |
| AI gateway tables/RPCs revoke all browser roles and grant service_role only | **IMPLEMENTED** |
| Rate-limit ledger has no browser table rights | **IMPLEMENTED** |
| Public/anonymous analytics event insertion allows arbitrary metadata for any unbanned store and has no rate limit | **BROKEN** |
| Guest checkout rate limit trusts spoofable `x-forwarded-for` and uses no secret salt | **PARTIALLY IMPLEMENTED** |
| Anonymous order lookup has no explicit abuse control | **PARTIALLY IMPLEMENTED** |
| Authenticated users can insert arbitrary `market_trend_queries` cache rows | **PARTIALLY IMPLEMENTED** |
| Profile trigger relies on trusted JWT claim role | **PARTIALLY IMPLEMENTED** |
| Live RLS/cross-tenant attack tests not run | **UNVERIFIED** |

## 9. Required next forensic/implementation actions

1. Regenerate or retire `combined_schema.sql`; do not rerun the current artifact. **Priority P0.**
2. Reconcile `projects.description` vs `projects.product_description` in `public-store.ts`. **Priority P0.**
3. Add read-only and live RLS attack tests for tenant isolation, published-store public reads, guest order abuse and analytics event insertion. **Priority P0.**
4. Move AI gateway cache/quota/circuit state from process memory to the manual runtime tables or document single-instance operation. **Priority P1.**
5. Harden market trend cache writes and inspect edge proxy handling of `x-forwarded-for`. **Priority P1.**
6. Produce an empty-database migration replay report before handover. **Priority P0; UNVERIFIED here.**
