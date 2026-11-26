# End-to-End Workflow Audit

- **Audit date:** 2026-11-26
- **Repository HEAD:** `1b0af8a6157ee029c85f69c135406afd18515147`
- **Method:** read-only static trace of UI → API → library → database/RPC → external provider → response, cross-checked against tests and CI evidence. No live runtime, browser, SQL, migration or provider call was executed.

## 1. Verdict summary

| Workflow | Status | Main limitation |
| --- | --- | --- |
| Signup/login/OAuth/password recovery | **PARTIALLY IMPLEMENTED** | callback redirect guard defect; live auth unverified |
| Admin RBAC and protected routes | **PARTIALLY IMPLEMENTED** | rely on client gate plus RLS; no live attack tests |
| 3-step wizard → submit | **PARTIALLY IMPLEMENTED** | coordinate validation mismatch for recognized non-Punjab drafts; live DB unverified |
| Collection → processing → feasibility | **PARTIALLY IMPLEMENTED** | real providers coded, mocked tests only; supervised scoring blocked |
| AI advisory and budget simulation | **PARTIALLY IMPLEMENTED** | mocked providers; process-local quota/cache; ownership partly RLS-dependent |
| Theme configurator | **PARTIALLY IMPLEMENTED** | Groq code wired; live provider/RLS/browser proof absent |
| Store publish/unpublish | **PARTIALLY IMPLEMENTED** | owner/admin RPCs wired; wildcard provider readiness not proven |
| Custom domain attach/verify/remove | **PARTIALLY IMPLEMENTED** | backend code complete, **no UI caller**, state-machine defects, no Vercel env/proof |
| Public storefront browsing | **PARTIALLY IMPLEMENTED** | eight pages wired; robots custom-domain host bug; browser proof absent |
| Guest COD checkout | **PARTIALLY IMPLEMENTED** | strong backend RPC; UI omits idempotency key; confirmation spoofable |
| Order fulfilment and inventory | **PARTIALLY IMPLEMENTED** | transactional RPCs correct; merchant POST risky; PATCH stock lacks log |
| Owner/admin KPIs | **PARTIALLY IMPLEMENTED** | SEO score hardcodes three signals; revenue is gross all-time |
| ML training/prediction | **PARTIALLY IMPLEMENTED** / serving **BLOCKED** | OI-6; predict feature mismatch; no timeout/rate limit |
| Rent-cache cron | **PARTIALLY IMPLEMENTED** | handler exists; scheduling/secret deployment unverified |
| GitHub config sync | **PARTIALLY IMPLEMENTED** | can continue with empty config; live write unverified |

## 2. Auth workflow

**Expected:** email/password, Google OAuth/linking, roles, route guards plus RLS, seeded admin/forced password change, reset/session refresh/global sign-out, account deletion cascades, production-disabled demo mode.

**Traced flow:**
`src/app/login/page.tsx` → browser Supabase/auth → `src/app/auth/callback/route.ts` → `profiles.role/must_change_password` → redirect; account page → `/api/auth/signout` and `/api/auth/delete-account`; update-password → `/api/auth/complete-password-change`.

**Findings:**
- Email/password and Google OAuth are wired. **IMPLEMENTED** code.
- Callback guard rejects `//` but not `/\`; URL normalization can create an off-origin redirect. **BROKEN**
- Account deletion UI sends only `{confirmation:'DELETE'}`; API requires password/recent session in stale-email cases. **PARTIALLY IMPLEMENTED**
- OAuth/non-email deletion lacks equivalent reauth. **PARTIALLY IMPLEMENTED**
- `profile?.role.toUpperCase()` can throw on null role. **BROKEN** edge.
- Optional demo mode exists via `FORCE_DEMO_DATA`, but production-disabled behavior is not proven. **UNVERIFIED**

**Missing evidence:** live Supabase auth, OAuth callback, RLS attack matrix, all-device sign-out, cascade deletion, production demo-mode check.

## 3. Wizard → submit workflow

**Traced flow:**
`BusinessIdeaWizard.tsx` → `POST/PATCH /api/projects` → `POST /api/projects/[id]/submit` → `submit_project_for_feasibility` RPC → `runDataCollection`.

**Findings:**
- Three steps, autosave/draft restore, category/description, Pakistan geography, PKR/USD fields, optional model/audience/size, radius default/cap are coded. **PARTIALLY IMPLEMENTED**
- Validation permits recognized non-Punjab regions without coordinates, but submit requires finite Pakistan-bounded `lat/lng`; valid UI drafts can fail at submit. **BROKEN**
- Fixed 278 PKR/USD rate is disclosed but duplicated in two files. **PARTIALLY IMPLEMENTED**
- Live Places/Mapbox provider is absent; seeded hub path is the accepted fallback. **IMPLEMENTED fallback**
- Submit RPC is 1-arg, idempotent and explicitly drops old signatures. **IMPLEMENTED** statically.

**Missing evidence:** live draft persistence, idempotent double-submit, migration-from-empty submit, non-Punjab coverage decision.

## 4. Collection → processing → feasibility workflow

**Traced flow:**
`MarketDataPanel`/`submit` → `/api/projects/[id]/collect` → `runDataCollection` → four providers → `project_competitors`, `project_market_observations`, `project_demand_trends`, `project_cost_estimates` → `/process` → `project_processing_runs`, `project_features` → `/feasibility` → `project_feasibility_runs`.

**Findings:**
- Overpass category mapping, timeout/backoff/alternate endpoints and seven-day cache are coded. **IMPLEMENTED** code, **UNVERIFIED** live.
- Rent is cache-only; cron writes manual estimates; nearest/city fallback marks low confidence. **PARTIALLY IMPLEMENTED** because scheduling is unverified.
- Pytrends via ML service with stale cache and labeled synthetic fallback. **PARTIALLY IMPLEMENTED**
- Typed payload and source health are preserved. **IMPLEMENTED** local contract.
- `collect` returns HTTP 200 even for failed collection and infers status from message strings. **PARTIALLY IMPLEMENTED**
- Customer scoring is provisional MCDA; supervised inference is intentionally blocked by OI-6. **BLOCKED** for production ML scoring.

**Missing evidence:** live Overpass/Pytrends, Supabase writes, populated rent cache, p90 performance, empty-database replay.

## 5. Advisory and simulation workflow

**Traced flow:**
`advisory/page.tsx` → `GET/POST /api/projects/[id]/advisory` → `resolveLatestEligibleFeasibilityRun` → `generateAdvisoryReport` → AI gateway → validation/fallback → `project_advisory_reports`; PATCH action ticks; POST simulation.

**Findings:**
- Two-language generation, deterministic fallback, strict JSON, number grounding, prompt delimiters and no tools are coded. **IMPLEMENTED**
- POST checks project existence but no explicit owner predicate; relies on RLS. **UNVERIFIED**
- Quota/circuit/cache are process-local. **PARTIALLY IMPLEMENTED**
- Token counts are returned by adapters but not persisted. **PARTIALLY IMPLEMENTED**
- Simulation is read-only stored-data recomputation. **IMPLEMENTED** local contract.

**Missing evidence:** live provider responses, populated RLS database, 20-call/hour behavior across instances, 80% warning UI.

## 6. Theme configurator workflow

**Traced flow:**
`ThemeConfigurator.tsx` → `GET/POST /api/projects/[id]/theme-configurator` → `theme/generator.ts` → Groq-only gateway → schema/contrast checks → `theme/persistence.ts` → `stores.theme_config`, `store_draft_versions`, wizard session.

**Findings:**
- Four steps, 4/4/4/4 options, live desktop/tablet/mobile preview, review and rerun history. **IMPLEMENTED** code.
- Strict seven-key schema, one retry/two total attempts, deterministic preset fallback, WCAG adjustment. **IMPLEMENTED** local.
- Migration adds table links/version metadata but has not been executed in a live DB. **UNVERIFIED**
- Dead duplicate route `/api/projects/[id]/storefront-wizard` also writes theme data but has no UI caller. **NOT IMPLEMENTED from UI perspective**

**Missing evidence:** live Groq, Supabase/RLS, browser preview and 10 s theme compile measurement.

## 7. Store publish/unpublish workflow

**Traced flow:**
owner store page or admin page → `POST /api/stores/[id]/publish` or `/api/admin/stores/[id]/publish` → `set_store_publication` RPC → lifecycle event → public `getPublicStore`.

**Findings:**
- UI sends `{action}` and parser accepts it; readiness guard checks slug/status only. **IMPLEMENTED**
- RPC rechecks auth/ownership, banned state, reserved slug and writes lifecycle events. **IMPLEMENTED**
- Response synthesizes timestamps instead of reading RPC values; `notes` parsed but not forwarded. **PARTIALLY IMPLEMENTED**
- Publishing an empty store is allowed. **PARTIALLY IMPLEMENTED**
- Wildcard URL is constructed from tenant config; provider readiness is not proven. **UNVERIFIED**

## 8. Custom domain workflow

**Traced flow (backend only):**
`src/lib/store-management/domains.ts` → Vercel v10 add / v9 get, verify, delete → `/api/stores/[id]/domain` → store domain columns/provider status → `proxy.ts` verified-host rewrite.

**Findings:**
- Provider verification is authoritative (`verified: true` only). **IMPLEMENTED**
- DNS challenge values are returned to the caller. **IMPLEMENTED**
- No UI caller found for the domain API. **NOT IMPLEMENTED from UI perspective**
- Provider failure erases challenges/token and writes `failed` while responding `provider_unavailable`; `domain_verified_at` is not cleared. **BROKEN**
- Remove is provider-first/DB-second; failures desynchronize state. **PARTIALLY IMPLEMENTED**
- New domain add can orphan the old provider domain. **PARTIALLY IMPLEMENTED**
- `VERCEL_TOKEN`/`VERCEL_PROJECT_ID` absent locally; no live proof. **UNVERIFIED**

## 9. Storefront browsing workflow

**Traced flow:**
host → `src/proxy.ts` → `[slug]/layout.tsx` and pages → `getPublicStore`, `listPublicProducts`, `getPublicProduct` → theme tokens/SEO metadata/JSON-LD → cart in `sessionStorage`.

**Findings:**
- Eight pages exist: Home, Catalogue, Product, Cart, Checkout, Confirmation, About, Contact. **IMPLEMENTED** code.
- Public reads require published/unbanned stores; custom hosts require verified domain. **IMPLEMENTED** static.
- Catalogue filter/search is applied after the DB `limit`, so matches beyond the first 24 are missed; UI search does not send query params. **PARTIALLY IMPLEMENTED**
- `robots.ts` passes the wrong host argument for verified custom domains, so the sitemap directive can point to wildcard/app URL. **BROKEN**
- 375px responsive behavior is implemented via utilities but not browser-tested. **UNVERIFIED**

## 10. Guest COD checkout workflow

**Traced flow:**
cart → `/checkout` → `POST /api/storefront/[slug]/orders` → `guest-checkout.ts` → RPC `place_store_order` → DB row locks, server-derived prices, rate ledger, order/order items/customer → order number.

**Findings:**
- Client cannot submit price/status/payment fields; DB re-reads price, checks stock/active/archived, computes totals, forces COD. **IMPLEMENTED**
- Backend idempotency via client key and DB unique index is correct. **IMPLEMENTED** backend.
- Checkout UI sends no idempotency key; retries generate a new UUID. **BROKEN**
- Rate limit trusts `x-forwarded-for`; header trust depends on proxy config. **PARTIALLY IMPLEMENTED**
- Confirmation page only echoes `?order=`; the existing lookup API has no UI caller. **PARTIALLY IMPLEMENTED**
- Guest lookup masks data and requires phone; no route-level abuse control. **PARTIALLY IMPLEMENTED**

**Missing evidence:** live guest order, idempotent replay, cross-tenant denial, abuse test.

## 11. Order fulfilment and inventory workflow

**Traced flow:**
owner dashboard → `GET/PATCH /api/stores/[id]/orders/[orderId]` → `transitionStoreOrderStatus` RPC → row locks, allowed transition, conditional stock decrement/restore, status history; inventory POST → `adjust_store_inventory`.

**Findings:**
- Transactional RPC is correct and rechecks ownership. **IMPLEMENTED**
- Product PATCH stock bypasses `adjust_store_inventory` and creates no inventory log. **PARTIALLY IMPLEMENTED**
- Merchant sample-order POST trusts client prices and performs non-atomic writes. **BROKEN** data-integrity path.
- `Number(new_stock)` can produce non-finite values and 500 responses. **PARTIALLY IMPLEMENTED**
- Deleted products during status transition are silently skipped without audit row. **PARTIALLY IMPLEMENTED**

## 12. Owner/admin KPI workflow

**Traced flow:**
store page/analytics panel → owner/admin overview/analytics APIs → aggregates from orders/products/events → SEO score helper.

**Findings:**
- Orders, gross revenue excluding cancelled/returned, active products, low stock and unfulfilled counts are computed. **IMPLEMENTED**
- Revenue has no date filter and ignores `store.currency` normalization. **PARTIALLY IMPLEMENTED**
- SEO score hardcodes `hasCanonical`, `hasJsonLd`, `hasBreadcrumbs` as always true. **PARTIALLY IMPLEMENTED / misleading**
- Admin store list has N+1 queries and no pagination. **PARTIALLY IMPLEMENTED**

## 13. ML training/prediction workflow

**Traced flow:**
admin ML page → `/api/ml/datasets`, `/train`, `/train/sync`, `/models`, `/predict` → `mlClient` → FastAPI endpoints → trainer/joblib artifacts → registry sync.

**Findings:**
- Real CV, holdout metrics and 8×8 candidate training. **IMPLEMENTED** sandbox.
- OI-6 approval file is `BLOCKED`; no production artifact can be activated. **BLOCKED**
- Admin `/predict` sends 13 features; artifacts expect ~39 exact ordered columns. **BROKEN**
- Classification artifacts produce no risk band because risk mapping requires numeric `[0,1]`. **BROKEN**
- No client timeout or rate limit. **BROKEN**
- Registry sync is idempotent but activation spans Python + two DB updates non-atomically. **PARTIALLY IMPLEMENTED**

## 14. Cron and GitHub sync workflows

### Rent-cache cron

Handler + `CRON_SECRET` auth + service-role upserts are **IMPLEMENTED**. Secret absent locally and no scheduler manifest found: **UNVERIFIED** deployment.

### GitHub config sync

Admin sync → sanitized config/rent snapshot → GitHub REST GET/PUT → audit rows. Fetch errors are only logged and sync can continue with empty config: **BROKEN** failure path. No live write proof: **UNVERIFIED**.

## 15. Cross-workflow conclusion

No end-to-end acceptance path has live evidence in the repository. The strongest local evidence is CI success plus mocked/module tests; the strongest code-backed flows are advisory/theme gateways, transactional order RPCs and the ML sandbox. The next implementation task should remove the concrete functional blockers before attempting live end-to-end verification.
