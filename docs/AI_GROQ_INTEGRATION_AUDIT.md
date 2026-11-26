# AI and Groq Integration Audit

- **Audit date:** 2026-11-26
- **Repository HEAD:** `1b0af8a6157ee029c85f69c135406afd18515147`
- **Method:** read-only source tracing of frontend → API → gateway → provider adapter → external endpoint → validation → logging → response, plus environment-presence checks only.
- **Secret handling:** no key/token/model value was displayed. Presence was reported only as present/non-empty/empty/absent. No live provider request was made.

## 1. Final verdict

| Area | Status |
| --- | --- |
| Single server-only gateway | **IMPLEMENTED** |
| Groq adapter and live-code wiring | **IMPLEMENTED** |
| OpenAI adapter code | **IMPLEMENTED** but locally **BLOCKED** by missing key |
| Gemini adapter code | **IMPLEMENTED** |
| Provider priority/fallback policy | **IMPLEMENTED** |
| Strict JSON and semantic validation | **IMPLEMENTED** |
| Prompt-injection defenses and Roman Urdu handling | **IMPLEMENTED** |
| `ai_call_log` attempt telemetry | **PARTIALLY IMPLEMENTED** |
| Quota/circuit/cache guarantees across serverless instances | **PARTIALLY IMPLEMENTED** |
| Live provider success proof | **UNVERIFIED** |

Groq is genuinely integrated through the existing gateway. There is no separate or duplicated Groq client in `src/`. Theme generation is Groq-only; product descriptions use Groq first; advisory uses Groq as the final provider. Live successful execution was not performed and is not proven by mocked tests.

## 2. Provider configuration observed locally

Only presence was inspected.

| Variable | Local state | Meaning |
| --- | --- | --- |
| `GROQ_API_KEY` | present, non-empty | Groq eligible |
| `GROQ_MODEL` | present, non-empty | Groq eligible |
| `OPENAI_API_KEY` | empty | OpenAI ineligible |
| `OPENAI_MODEL` | present, non-empty | model set but key missing |
| `GEMINI_API_KEY` | present, non-empty | Gemini eligible |
| `GEMINI_MODEL` | present, non-empty | Gemini eligible |
| `AI_ADVISORY_PROVIDERS` | absent | default advisory policy used |
| `AI_USER_HOURLY_QUOTA` | present | 20/hour default or override |
| `AI_PROMPT_VERSION` | present | cache-key versioning |
| `FORCE_DEMO_DATA` | present but not `true` | live providers active |

Provider eligibility requires both an API key and a model (`src/lib/ai/gateway/router.ts:56-60`). Effective local chains:

| Task | Configured order | Effective local order |
| --- | --- | --- |
| `advisory` | `openai → gemini → groq` | `gemini → groq` |
| `theme` | `groq` only, 2 attempts | `groq` |
| `product_description` | `groq → openai → gemini` | `groq → gemini` |

## 3. Provider endpoints

| Provider | Endpoint | Evidence | Status |
| --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1/responses` | `src/lib/ai/providers/openai.ts:4` | **IMPLEMENTED** code, locally ineligible |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/interactions` | `src/lib/ai/providers/gemini.ts:4` | **IMPLEMENTED** code |
| Groq | `https://api.groq.com/openai/v1/chat/completions` | `src/lib/ai/providers/groq.ts:4` | **IMPLEMENTED** code and wired |

All adapters set `store: false`, send no tools, classify 429/5xx/network/timeout/schema errors, and never log raw provider bodies.

## 4. End-to-end traces

### 4.1 Advisory summary (two languages)

1. UI: `src/app/projects/[id]/advisory/page.tsx:194` GET, `:225` POST.
2. API: `src/app/api/projects/[id]/advisory/route.ts:34-90` GET, `:93-128` POST; auth via `supabase.auth.getUser()`.
3. Domain: `src/lib/advisory/generator.ts:91+` reads trusted facts from `project_feasibility_runs` and `project_features`, runs `evaluateRisk`, builds the action matrix, and persists `project_advisory_reports`.
4. Prompt hygiene: untrusted description is delimited (`generator.ts:284-287`); system prompt forbids tool use/number invention (`:296-300`); Roman Urdu requested at `:292-295`.
5. Gateway: `executeAIGateway` at `generator.ts:305-320` with task `advisory`, `SUMMARY_SCHEMA`, `makeSummaryValidator(trustedFacts)`, deterministic fallback and `createAIAttemptLogger(ownerId)`.
6. Gateway execution: `src/lib/ai/gateway/execute.ts:137-234` applies cache, quota, circuit breaker, provider eligibility, timeout, retry, validation and fallback.
7. HTTP: provider adapter `generate(request, signal)`; e.g. `groq.ts:55`.
8. Validation: strict JSON/schema (`validate.ts:99-115`) plus semantic number grounding (`prompt-hygiene.ts:43-58`).
9. Logging: best-effort insert to `ai_call_log` via service-role `src/lib/ai/monitoring/log-attempt.ts:14-21`.
10. Response: parsed summary persisted and rendered.

**Status:** **PARTIALLY IMPLEMENTED**. Code and mocked tests are complete; POST ownership is not explicit (`advisory/route.ts:102-110` relies on RLS), and no live provider or populated Supabase run was executed.

### 4.2 Theme configurator (Groq)

`src/components/theme-configurator/ThemeConfigurator.tsx:280,303` → `src/app/api/projects/[id]/theme-configurator/route.ts:74-133` → `src/lib/theme/generator.ts:91` → Groq-only gateway task → `groq.ts:55` → strict schema/contrast checks → deterministic preset fallback → `src/lib/theme/persistence.ts:105-370` writes `stores`, `store_draft_versions` and wizard session state.

**Status:** **PARTIALLY IMPLEMENTED**. Code and 12 mocked tests exist; live Groq/Supabase/browser proof is absent.

### 4.3 Product description writer

`src/app/projects/[id]/store/page.tsx:279-312` → `src/app/api/stores/[id]/products/[productId]/description/route.ts:24-107` → gateway task `product_description` (`groq → openai → gemini`) → validation/fallback → sanitized `ai_call_log`. The endpoint explicitly does **not** save the generated text; the owner must edit/save through product CRUD.

**Status:** **PARTIALLY IMPLEMENTED**. Generation is wired; `validateSeoMetadata(description.slice(0,160), description)` at `description/route.ts:84` passes a description as the title argument, producing incorrect length guidance. Live provider proof is absent.

### 4.4 Dead AI route

`src/app/api/projects/[id]/storefront-wizard/route.ts:59-103` also calls the `theme` gateway task and writes theme data, but the UI page only renders `ThemeConfigurator`. **Status: NOT IMPLEMENTED from UI perspective / dead backend path.**

## 5. Gateway controls

| Control | Evidence | Status |
| --- | --- | --- |
| Server-only boundary | `src/lib/ai/gateway/server-only.ts:1-4`; imported by gateway/adapters | **IMPLEMENTED** |
| Timeout | `execute.ts:51-54,66-95`; 20 s task policies, capped 120 s | **IMPLEMENTED** |
| Retry | only `theme` has 2 attempts; retry requires `retryable` | **IMPLEMENTED** |
| Circuit breaker | 3 failures / 5 min in `resilience.ts:4-5,52-66` | **PARTIALLY IMPLEMENTED** process-local |
| Per-user quota | 20/hour default, env override capped 1000; fallback never error page | **PARTIALLY IMPLEMENTED** process-local |
| Provider 429/5xx handling | classified retryable in all adapters | **IMPLEMENTED** |
| Strict structured output | `validate.ts:31-115`, `additionalProperties:false`, enums/pattern/length | **IMPLEMENTED** |
| Semantic grounding | `makeSummaryValidator`, `numbersAreGrounded` | **IMPLEMENTED** |
| Prompt injection | control/angle bracket sanitization, delimiters, "treat as data", no tools | **IMPLEMENTED** |
| Language allowlist | only `en` / `ur_roman`; Perso-Arabic rejected | **IMPLEMENTED** |
| Roman Urdu instruction | advisory and description prompts | **IMPLEMENTED** |
| Token usage persistence | adapters return token counts; `ai_call_log` insert omits them | **PARTIALLY IMPLEMENTED** |
| Response cache | 10 min, 500 entries, owner/task/language/prompt-version/model/schema key | **PARTIALLY IMPLEMENTED** process-local |
| No gateway bypass | no direct OpenAI/Gemini/Groq SDK usage found outside adapters | **IMPLEMENTED** |

## 6. Telemetry and operational caveats

- `ai_call_log` stores `owner_id`, purpose, provider, success, latency and error code; token counts are returned by adapters but not persisted. **PARTIALLY IMPLEMENTED**
- `createAIAttemptLogger` swallows all logging failures so user experience remains available. **PARTIALLY IMPLEMENTED**
- `resilience.ts`, `response-cache.ts` and circuit state are in-memory Maps. On serverless/multi-instance deployment, quota/cache/circuit guarantees reset per instance. **PARTIALLY IMPLEMENTED**
- `supabase/manual/ai_gateway_runtime.sql` defines shared tables/RPCs, but no `src/` caller was found. **NOT IMPLEMENTED in application path**
- `OPENAI_API_KEY` empty locally means the documented OpenAI→Gemini→Groq three-provider chain is not currently active end to end. The missing key is an environment prerequisite, not a code defect. **BLOCKED locally**
- Mocked tests (`tests/module6-ai-advisory.test.mjs`, `tests/module7-theme-configurator.test.mjs`) prove local contracts only; they are not live provider evidence. **UNVERIFIED**

## 7. Groq-specific conclusion

- Groq is not cosmetic: it is the only provider for `theme`, first provider for `product_description`, and final fallback for `advisory`.
- The adapter uses the correct OpenAI-compatible Chat Completions endpoint and strict request/response handling.
- No second Groq client was added during this audit, and none exists in the audited source.
- Live Groq success, latency, quota behavior and model retirement compatibility remain **UNVERIFIED**.
