# Module 6: Multi-AI Advisory, Risk Engine & Action Matrix

**Scope:** SRS FR-6.1–FR-6.9 only.
**Baseline:** `496ec6a95b85d46163d331efa8c2b1eddbc79a21` (`main` before this work).
**Pre-implementation audit:** [module-6-implementation-gap-report.md](module-6-implementation-gap-report.md).
**Verification suite:** `tests/module6-ai-advisory.test.mjs` (mocked providers, no paid/live calls).

This document records the *repository implementation* status. It does not claim live provider, populated Supabase, browser, or deployed-runtime verification unless a named check below was actually run.

## 1. Requirement status

| FR | Status | Implementation and evidence |
| --- | --- | --- |
| **FR-6.1** AI router | **COMPLETE** | `src/lib/ai/gateway/router.ts` owns the server-side advisory order `openai → gemini → groq`, each task has its own policy, and `AI_ADVISORY_PROVIDERS` may override order with validated provider names. `OPENAI_MODEL`, `GEMINI_MODEL` and `GROQ_MODEL` are mandatory for a provider to be eligible; there are no in-code model fallbacks. Missing key **or** model skips the provider. Adapters are independent implementations in `src/lib/ai/providers/`. Every runtime gateway entry imports the server-only guard. Tests assert order, env model propagation and skip behavior. |
| **FR-6.2** Failover, timeout, logging, circuit | **COMPLETE (single-process limits documented)** | `execute.ts` fails over on 429, 5xx, network errors, aborts/timeouts and strict schema/validation errors. Timeout is 20 s by default, with an `AbortController`, a rejection raced against provider work and timer/listener cleanup in `finally`. Aborts are logged as `timeout`, not `server_error`. `onAttempt` records every attempt, including circuit-skipped and fallback attempts; `createAIAttemptLogger` writes only `owner_id`, `purpose`, `provider`, `success`, `latency_ms` and a whitelisted `error_code` to `ai_call_log`. Three failures in five minutes open a per-provider circuit. The response cache and resilience maps are explicitly process-local; a shared/distributed store is required for identical behavior across serverless instances. |
| **FR-6.3** Deterministic fallback | **COMPLETE** | `executeAIGateway` always owns a required deterministic `fallback`. Quota exhaustion now degrades to that fallback instead of throwing, and provider cancellation/failure exhaustion returns it. The result is identified with `provider: 'rule_fallback'`, `fallback: true` and a successful `rule_fallback` attempt log. `generator.ts` builds bilingual deterministic summaries only from the same stored trusted facts. Tests prove fallback makes no provider call. |
| **FR-6.4** English / Roman Urdu | **COMPLETE** | The advisory page uses `en` / `ur_roman` consistently. `generateAdvisoryReport` makes two separate gateway calls with the same trusted facts and two language-specific system prompts. `response-cache.ts` includes language in the key, so entries are separate. The report publishes `metadata.ai_summary.en`, `metadata.ai_summary.ur_roman`, per-language provider/fallback disclosure and `language_supported: ['en', 'ur_roman']`. `containsUrduScript` detects Perso-Arabic script and the Roman-Urdu validator rejects it. |
| **FR-6.5** Grounded, sanitized JSON | **COMPLETE** | The prompt contains one JSON `trustedFacts` object plus a delimited untrusted project description. `prompt-hygiene.ts` removes control/angle-bracket characters, collapses whitespace, bounds length, whitelists request IDs/error codes, detects Urdu script and rejects numeric tokens not present in trusted facts. Provider requests contain no tools. `validate.ts` requires strict JSON, rejects extra properties, missing/short fields, invalid types and empty output; an unsupported language and empty prompts are rejected before provider selection. Tests cover injection-like descriptions, malformed JSON, wrong/missing/extra fields, empty output and numeric/script violations. |
| **FR-6.6** Risk engine | **COMPLETE (low-budget threshold intentionally unresolved)** | `src/lib/advisory/risk-engine.ts` deterministically combines the stored baseline risk level with the approved rules: rent/budget `> 0.4`, saturation `> 75`, negative trend slope, and low budget ratio. Missing values stay `unknown` and add no escalation. The displayed formula is `baseline severity + triggered flag count`, capped at `critical`, with an explicit non-calibration disclaimer. The SRS names a low-budget ratio flag but supplies no numeric cutoff; no approved value was invented, so that flag is always `unknown` with `threshold: null`. |
| **FR-6.7** Priority action matrix | **COMPLETE** | `src/lib/advisory/action-matrix.ts` produces stable ID-based items from triggered/unknown flags with bilingual title/description, priority, impact, effort, related risk, evidence, status, timestamp and a generated-at value. The API merges owner-scoped ticks from `advisory_action_states`; `PATCH /api/projects/[id]/advisory/actions/[actionId]` accepts only `{ completed: boolean }`, validates the stable ID against the saved report and writes `owner_id` from the authenticated session. The additive migration enforces RLS, `auth.uid()` ownership and `can_access_project()`. |
| **FR-6.8** Budget re-simulation | **COMPLETE** | `POST /api/projects/[id]/advisory/simulation` validates the budget/currency against Module 2 bounds, resolves the latest eligible completed provisional run on the server, re-reads stored Module 3 records, cleans them with `cleanAndValidateData`, recomputes `engineerFeatures` and calls `calculateProvisionalMCDA` through `simulateBudget`. It performs no external fetch, starts no new run, writes nothing and never mutates the original report. Results retain `provisional_mcda`, model/threshold versions and both disclaimers. OI-6 remains open; no supervised model is activated. |
| **FR-6.9** Security and prompt hygiene | **COMPLETE (runtime scope documented)** | Provider calls and model configuration are server-only; no provider key or service-role key is accepted from the request body. Advisory `POST` ignores any client-supplied run ID/provider/owner, verifies the authenticated user and project, and resolves the run server-side. Bodies for action/simulation routes are allowlisted and validated. RLS remains authoritative. Per-user quota defaults to 20/hour and is process-local; the response cache and circuit state are also process-local and must be moved to a shared store before relying on cross-instance guarantees. |

## 2. Runtime flow

1. `POST /api/projects/[id]/advisory` authenticates the session, verifies project access, and calls `resolveLatestEligibleFeasibilityRun`. No client run ID is accepted.
2. `generateAdvisoryReport` loads the feasibility run, its features and project from the owner-scoped Supabase client. It computes allocations, deterministic insights, the risk evaluation and the action matrix from those stored facts.
3. Two independent gateway requests are made (English and Roman Urdu). Each reserves quota, checks its language cache, tries configured providers in policy order, validates strict JSON, writes attempt telemetry and returns either provider content or deterministic fallback.
4. The report is inserted with `status: 'completed'`, bilingual summaries, provider/fallback disclosure, risk metadata and the action matrix.
5. `GET` returns the newest report with the caller's own checklist ticks merged.
6. Budget simulation is a separate, read-only POST that recomputes provisional MCDA from stored analysis data.

## 3. API additions

See [api.md](api.md), section 4B:

- `GET /api/projects/[id]/advisory`
- `POST /api/projects/[id]/advisory`
- `PATCH /api/projects/[id]/advisory/actions/[actionId]`
- `POST /api/projects/[id]/advisory/simulation`

## 4. Data additions

A single additive migration was introduced:

- `supabase/migrations/20261126150000_module6_advisory_extensions.sql`
- Creates `public.advisory_action_states` with a unique `(report_id, owner_id, item_key)` constraint, cascading FKs, RLS and forced RLS.
- No Module 1–5 table is altered; no existing advisory row is rewritten.
- Rollback, only after application code is reverted:
  ```sql
  drop policy if exists advisory_action_states_access on public.advisory_action_states;
  drop table if exists public.advisory_action_states;
  ```

## 5. Environment configuration

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
AI_PROMPT_VERSION=v1
AI_USER_HOURLY_QUOTA=20
AI_ADVISORY_PROVIDERS=openai,gemini,groq
```

A provider is eligible only when **both** its key and model are present. The sample model IDs are operator configuration, not hard-coded runtime fallbacks; retire/replace them as provider model lines change. `AI_ADVISORY_PROVIDERS` is validated against the three known provider names. Never use `NEXT_PUBLIC_*` for any provider key.

## 6. Acceptance evidence

Local checks executed for this work:

- `node --test tests/module6-ai-advisory.test.mjs` — 10 sections, all pass.
- `node --test tests/*.mjs` — full Node suite.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `git diff --check`.
- `node scripts/verify-module3.mjs`, `python -B ml-service/test_pipeline.py`, `python -B ml-service/test_auth_security.py` — unchanged-module regressions.

The Module 6 suite uses mocked provider HTTP responses and mocked Supabase query chains. It does **not** make paid provider calls. Live Supabase/RLS, provider credentials, browser rendering and deployed runtime are not claimed by it.

## 7. Known limitations

- Cache, hourly quota and circuit breaker are process-local. On a multi-instance/serverless deployment they are per-instance, not global. A durable shared store is required before claiming platform-wide quota/circuit guarantees.
- `ai_call_log` writes are best-effort: telemetry failure never blocks advisory generation or fallback.
- The low-budget risk cutoff remains deliberately unresolved because the SRS and approved configuration do not define one.
- `advisory` reports continue to label scoring as `provisional_mcda`; OI-6 and the supervised production gate are unchanged.
- Location recommendations remain explicitly unavailable because no verified comparable spatial dataset is configured. No market data is fabricated.
