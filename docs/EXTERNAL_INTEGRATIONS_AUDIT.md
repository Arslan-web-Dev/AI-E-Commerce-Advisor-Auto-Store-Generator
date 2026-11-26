# External Integrations Audit

- **Audit date:** 2026-11-26
- **Repository HEAD:** `1b0af8a6157ee029c85f69c135406afd18515147`
- **Method:** read-only static inspection plus environment-presence checks only. No live provider call, browser session, deployment call, SQL execution or secret display was performed.

## 1. Status vocabulary

Statuses are limited to: **IMPLEMENTED**, **PARTIALLY IMPLEMENTED**, **NOT IMPLEMENTED**, **BROKEN**, **UNVERIFIED**, **BLOCKED**, **OUT OF SCOPE**. Source-code wiring is not treated as live execution proof.

## 2. Integration summary

| Integration | Code path | Credentials/endpoints | UI connection | Tests | Production readiness | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Supabase Auth | `login`, `auth/callback`, `account/security`, `proxy.ts` | URL/publishable/anon keys present locally; service role server-only | **IMPLEMENTED** | static source tests only | Live RLS/session proof absent; callback redirect guard broken | **PARTIALLY IMPLEMENTED** |
| Supabase Storage | `project-attachments`, `product-images` | private/public buckets, signed URLs | attachments and product image UI wired | static tests/source checks | live bucket policies unexecuted | **PARTIALLY IMPLEMENTED** |
| Supabase RPCs | seven app RPCs | definer functions in late migrations | publish/order/action routes wired | source/static assertions | no live DB execution | **PARTIALLY IMPLEMENTED** |
| Vercel Domains API | `src/lib/store-management/domains.ts` | `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, optional `VERCEL_TEAM_ID`; v10 add, v9 get/verify/delete | **no UI caller found** | mocked/source tests | token/project absent locally; provider API untested live | **PARTIALLY IMPLEMENTED** |
| Wildcard/custom domains | `src/proxy.ts`, `src/lib/store-management/tenant.ts`, public-store helpers | host/root domain env names; verified-domain condition present | storefront routes wired | source/static tests | no wildcard host config proof | **PARTIALLY IMPLEMENTED** |
| GitHub REST sync | `src/app/api/admin/sync/route.ts` | `GITHUB_SYNC_TOKEN`, `GITHUB_SYNC_REPO`, `GITHUB_SYNC_BRANCH` present locally | admin sync button wired | static/source checks | failure path can export empty config; live write not run | **PARTIALLY IMPLEMENTED** |
| Overpass OSM | `src/lib/providers/competitors/overpass.ts` | public endpoints + `OVERPASS_API_URL`, timeout env | collection panel wired | real modules with mocked fetch | live endpoint/fair-use not tested | **PARTIALLY IMPLEMENTED** |
| Google Trends / Pytrends | Python service via `mlClient.getTrends` | `ML_SERVICE_URL`, `ML_SERVICE_API_KEY`; Pytrends unofficial | market page wired | mocked tests; cache file expired/synthetic | live Pytrends not proven | **PARTIALLY IMPLEMENTED** |
| FastAPI ML service | `src/lib/ml-client.ts` → `ml-service/main.py` | key required and placeholder-rejected; CORS allowlist | admin ML routes wired | Python pipeline/auth suites pass | serving blocked by OI-6; no timeouts; standalone config path fragile | **PARTIALLY IMPLEMENTED** |
| OpenAI | `src/lib/ai/providers/openai.ts` | `OPENAI_API_KEY` empty locally; Responses API | advisory/description gateway wired | mocked only | key absent; provider ineligible | **BLOCKED** |
| Gemini | `src/lib/ai/providers/gemini.ts` | key/model present locally; Interactions API | advisory/description gateway wired | mocked only | live call unverified | **PARTIALLY IMPLEMENTED** |
| Groq | `src/lib/ai/providers/groq.ts` | key/model present locally; Chat Completions API | theme/advisory/description wired | mocked only | live call unverified | **PARTIALLY IMPLEMENTED** |
| Vercel web deployment | no checked-in `vercel.json` | `.vercel/` ignored; secrets not inspectable via unauthenticated API | N/A | CI passes build | no deployment manifest/verification | **UNVERIFIED** |
| Stripe | `STRIPE_SECRET_KEY` template/code marks `not_configured` | COD-only product decision | not wired | none | out of current requirement | **OUT OF SCOPE** |

## 3. Vercel domains and DNS

### 3.1 Implemented calls

`src/lib/store-management/domains.ts`:

| Action | Endpoint | Status |
| --- | --- | --- |
| Add | `POST https://api.vercel.com/v10/projects/{projectId}/domains` | **IMPLEMENTED** code |
| Get | `GET .../v9/projects/{projectId}/domains/{domain}` | **IMPLEMENTED** code |
| Verify | `POST .../v9/.../domains/{domain}/verify` | **IMPLEMENTED** code |
| Remove | `DELETE .../v9/.../domains/{domain}` | **IMPLEMENTED** code |

Verification state is derived only from provider `verified: true`; DNS challenge records/tokens come from the provider response. That part is **IMPLEMENTED**.

### 3.2 Defects/gaps

- No UI caller for `/api/stores/[id]/domain` was found. **NOT IMPLEMENTED from UI perspective**
- `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` are absent from local `.env.local`; GitHub Actions secrets cannot be inspected via the unauthenticated API. **UNVERIFIED**
- Transient provider failure writes `failed` state and erases DNS challenges while responding `provider_unavailable`; `domain_verified_at` is not cleared. **BROKEN**
- Remove performs Vercel DELETE before DB clear; DB failure leaves provider/state divergence. **PARTIALLY IMPLEMENTED**
- Changing domains can orphan the previous Vercel domain. **PARTIALLY IMPLEMENTED**
- No live Vercel/DNS execution proof. **UNVERIFIED**

## 4. Tenant host rewriting

`src/proxy.ts` rewrites only `kind === 'custom-domain'` and requires all of `custom_domain = host`, `domain_status = 'verified'`, `status = 'published'`, `is_banned = false`. **IMPLEMENTED** with caveats:

- SSR session refresh is skipped on rewritten responses. **PARTIALLY IMPLEMENTED**
- Custom hosts matching `STORE_ROOT_DOMAIN` are classified as wildcard before custom-domain. **PARTIALLY IMPLEMENTED**
- No deployed host/wildcard proof. **UNVERIFIED**

## 5. GitHub REST sync

- Route: `src/app/api/admin/sync/route.ts`; admin gate and service-role config reads are present.
- Endpoint: `https://api.github.com/repos/{repo}/contents/config/latest-system-config.json` with GET/PUT.
- Payload is sanitized: no PII/secrets intended.
- Defect: config fetch errors are logged and sync continues with an empty array, which can overwrite config. Audit insert errors are unchecked. **BROKEN failure path**
- No live GitHub write proof. **UNVERIFIED**

## 6. Overpass, Pytrends, ML service

### Overpass

- Category-mapped shop/amenity queries, 15 km cap, timeout/backoff/alternate endpoints, cache and provenance. **IMPLEMENTED code**
- Live Overpass availability, fair use, and response quality are **UNVERIFIED**.
- Demo providers exist behind `FORCE_DEMO_DATA` and `force_demo`; local value is not `true`, so live providers are selected. **IMPLEMENTED with disclosure**

### Pytrends

- Python service uses `TrendReq(timeout=(10,25), retries=2, backoff_factor=1.5)`, stale-cache fallback, then labeled synthetic baseline. **PARTIALLY IMPLEMENTED**
- Committed `trends_cache.json` contains expired synthetic-baseline entries. **BROKEN state**
- Market-intelligence UI does not display source/staleness fields returned by Python. **PARTIALLY IMPLEMENTED**
- Live Pytrends is **UNVERIFIED**.

### FastAPI ML service

- Real sklearn/XGBoost training, CV, holdout metrics and joblib artifacts. **IMPLEMENTED**
- Production serving is blocked by OI-6 and no active serving artifact exists. **BLOCKED**
- Admin `/predict` sends 13 features while trained artifacts expect ~39 exact ordered columns. **BROKEN**
- No HTTP timeout in `mlClient`; no rate limit/concurrency cap in Python. **BROKEN**
- Standalone deployment path likely cannot find repo-root `config/module4-scoring.json`. **PARTIALLY IMPLEMENTED / UNVERIFIED**

## 7. AI providers

See `docs/AI_GROQ_INTEGRATION_AUDIT.md` for the full trace. In summary: gateway code is **IMPLEMENTED**, Groq/Gemini are locally eligible and Groq is actively selected by policy, OpenAI is **BLOCKED** locally by an empty key, and no live provider success is proven. Token counts are not persisted and quota/circuit/cache are process-local. **PARTIALLY IMPLEMENTED** operationally.

## 8. Deployment and CI

- CI is **IMPLEMENTED**: all 5 jobs passed for HEAD in run `45831018355`.
- No `vercel.json`, Dockerfile, docker-compose, Fly/Netlify/Render config is checked in. **PARTIALLY IMPLEMENTED**
- ML has `Procfile` and `railway.json`, but no container image and incomplete env/config provisioning. **PARTIALLY IMPLEMENTED**
- GitHub Actions secrets were not readable via unauthenticated API; deployment secret state is **UNVERIFIED**.
- Live production URL, deployed runtime behavior, browser checks, performance and accessibility are **UNVERIFIED**.

## 9. Evidence policy

Mocked tests, source-string assertions, screenshots and evidence ZIPs are useful local artifacts but are **not** live integration proof. The only authoritative live evidence captured in this audit is the GitHub Actions check-run result for HEAD and local environment presence booleans with values withheld.
