# Multi-Provider AI Gateway Architecture

**Status:** Phase 1 architecture decision
**Scope:** Architecture for introducing model providers without replacing the current deterministic advisor or changing the Supabase schema.

## Existing integration points

- `src/lib/advisory/generator.ts` loads saved feasibility facts, calculates budget allocations and rule-based insights, and persists an advisory report.
- `src/app/api/projects/[id]/advisory/route.ts` is the server route that invokes the advisor.
- `src/lib/storefront/compiler.ts` and `src/lib/storefront/variant-catalog.ts` provide deterministic theme compilation. The current compiler does not call an LLM.
- `public.ai_call_log` already exists for recording provider attempts. Use the authenticated server Supabase client and its RLS policy; do not introduce a new table in the first gateway phase.

## Architecture decision

All provider access will run in server-only modules under `src/lib/ai/`. Browser code will call existing application routes and will never receive provider credentials. The gateway will accept a typed task request, obtain its provider order from server configuration, invoke providers through one adapter contract, validate the result, record each attempt, and return a typed result or a deterministic fallback.

```text
Existing route handler
        |
        v
Task service (advisory / theme / description)
        |
        v
AI Gateway: task policy -> provider adapters -> validation -> attempt log
        |                                      |
        |                                     Supabase ai_call_log
        +--> OpenAI -> Gemini -> Groq           |
        +--> deterministic task fallback <-----+
```

## Provider policy

- The Module 6 advisory chain follows the advanced requirements baseline: **OpenAI -> Gemini -> Groq**. Provider model IDs are environment configuration, not hard-coded throughout feature code.
- Module 7 theme compilation uses **Groq first**, with one retry and the existing deterministic compiler/preset as the final fallback. This task-specific rule does not change the Module 6 chain.
- Additional providers (OpenRouter, Cloudflare Workers AI, SambaNova, Cohere, NVIDIA NIM, Z.ai, Mistral, Ollama) are out of the initial implementation. Add an adapter only after its current API, quota, terms, and task fit have been checked.
- Free-tier limits are variable. The application must treat quota exhaustion as a provider failure and must not promise that hosted inference is permanently free.

## Gateway responsibilities

1. Accept only a named task and validated, minimal input.
2. Build prompts from computed project facts. Treat user text as untrusted delimited data; do not provide tool access.
3. Apply per-task provider order and configured model IDs.
4. Apply a 20-second per-attempt timeout. Try the next provider on timeout, HTTP 429/5xx, malformed response, or task-schema validation failure. Do not retry permanent client/configuration errors indefinitely.
5. Track consecutive provider failures and open a provider circuit for five minutes after three failures. A successful call resets that provider's failure count.
6. Validate structured output before it can affect a report, theme, or product description. AI output must not replace deterministic scoring, pricing, inventory, or order calculations.
7. Log one `ai_call_log` row per provider attempt, including task, provider, success, latency, and a sanitized error code. Never log prompts, API keys, customer PII, or raw provider error bodies.
8. Return deterministic feature-specific fallback content when all providers fail. Label fallback output accurately.
9. Cache by task, source-record version, model/config version, and language. English and Roman Urdu results use separate cache entries. Do not cache sensitive inputs or cross users/tenants.

## Proposed code boundaries

```text
src/lib/ai/
  gateway/
    index.ts             # public server-only gateway entry point
    types.ts             # task, request, response, provider and attempt types
    policy.ts            # task-specific order, timeout and output schema
    execute.ts           # retries, circuit breaker, validation and fallback
  providers/
    openai.ts            # Phase 3
    gemini.ts            # Phase 4
    groq.ts              # Phase 5
  tasks/
    advisory.ts          # adapts verified facts and deterministic insights
    theme.ts             # later integration with storefront compiler
    product-description.ts # later integration with product editing
  monitoring/
    log-attempt.ts       # minimal ai_call_log writer
```

Provider adapters will implement a shared `generate` contract that accepts a validated task payload, abort signal, model ID, and output constraints, and returns text/structured output plus provider/model/usage metadata. Provider-specific SDK and HTTP details remain inside their adapter.

## Configuration and secret boundaries

- Server-only variables: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, model IDs, and gateway feature flags. Never prefix secrets with `NEXT_PUBLIC_`.
- Missing or invalid configuration marks that provider unavailable and moves to the next configured provider; if none are configured, use deterministic output.
- A later admin UI may manage enabled models and priorities, but secrets stay in deployment secret storage. The existing `model_registry` is metadata, not a place to store API keys.

## Rollout order

1. Phase 1: architecture decision (this document).
2. Phase 2: shared provider/task types and server-only boundary.
3. Phase 3: first provider adapter and isolated adapter verification.
4. Phase 4: remaining core adapters.
5. Phase 5: task router, retry/fallback and schema validation.
6. Phase 6: attempt logging, circuit breaker, quotas and safe caching.
7. Phase 7: integrate the existing advisory flow, then theme and product-description tasks.
8. Phase 8: provider administration and end-to-end verification.

The gateway must preserve the existing deterministic advisor and theme compiler at every rollout stage. Numerical feasibility scores and business calculations remain deterministic or come from the separately validated ML service; an LLM may explain evidence but cannot invent or alter it.

## Acceptance criteria for this architecture phase

- A single server-side gateway owns provider routing; features do not call provider SDKs directly.
- Provider order is task-specific and matches the advanced requirements.
- Secrets never enter client bundles, logs, prompts, or repository files.
- Every provider attempt is observable without storing sensitive payloads.
- Invalid/unavailable model output falls back to deterministic behavior.
- No Supabase schema changes are needed for the initial implementation because `ai_call_log` already exists.
