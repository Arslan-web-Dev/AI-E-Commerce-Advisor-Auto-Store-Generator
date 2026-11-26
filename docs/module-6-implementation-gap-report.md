# Module 6 implementation gap report

**Baseline:** `496ec6a95b85d46163d331efa8c2b1eddbc79a21`
**Method:** code-level audit before edits; no live provider, Supabase or browser calls.
**Authority:** checked-in `docs/SRS.md` FR-6.1–FR-6.9, `docs/FINAL_DELIVERY_BASELINE.md` S6/S9, and gateway architecture decision. The external October 2026 PDF is not in the repository.

The existing `docs/requirements-traceability.md` claim of “Complete” is not supported by code. The baseline document’s “Partial” assessment is accurate.

| Requirement | Audit status | Evidence |
| --- | --- | --- |
| FR-6.1 Provider router | PARTIAL | `router.ts:13-29` has advisory order OpenAI → Gemini → Groq and a 20 s timeout, and missing keys are skipped (`31-47`). Provider order is hard-coded in `TASK_POLICIES`; model IDs have permanent in-code fallbacks (`openai.ts:5,40`, `gemini.ts:5,40`) or require `GROQ_MODEL`; local `.env.local` uses a non-Llama Groq model and no OpenAI key. No server-side task-policy override is supported. |
| FR-6.2 Failover, timeout, logging, circuit | PARTIAL | 429/5xx/malformed/schema-invalid failover and per-attempt DB logging exist (`execute.ts:85-156`, `validate.ts:69-84`, `log-attempt.ts:9-30`). Timeout aborts are logged as `server_error` because provider fetch catches mask the abort reason; cache hits and quota rejection have no attempt log; fallback still runs after parent abort; circuit and quota are process-local `Map`s (`resilience.ts:9-12`) and unsuitable for serverless. |
| FR-6.3 Deterministic fallback | PARTIAL | `execute.ts:141-156` and `generator.ts:196-211` return deterministic bilingual text when providers are exhausted. `reserveUserRequest` at `execute.ts:87` throws before fallback, so quota exhaustion yields no report; fallback is not surfaced in the UI (`page.tsx:14-34`); DB failures still yield no report. |
| FR-6.4 English / Roman Urdu | PARTIAL | UI has a toggle but uses `ur`, gateway uses `ur_roman`, and report metadata uses `['en','ur']` (`page.tsx:5`, `types.ts:8`, `generator.ts:234`). Only one gateway call uses `language:'en'` (`generator.ts:203`); `ai_summary` is never rendered. Cache key includes language (`response-cache.ts:15`) but the second language is never requested. |
| FR-6.5 Grounded strict JSON | PARTIAL | Server facts and strict schema exist (`generator.ts:172-195`, `validate.ts:28-84`), and providers expose no tools. There is no bounded/delimited user-text handling, no check that numbers in free-text output come from approved facts, and `validate.ts` silently accepts absent/unknown `type`. |
| FR-6.6 Risk engine | MISSING | No combined risk engine exists. Generator uses unrelated ad hoc constants (`demand > 60`, raw `category_saturation > 0.05`, `budget_ratio < 0.8`) at `generator.ts:86,113,138`; it ignores `risk_level`, `rent_to_budget_ratio`, `saturation_index` and `trend_slope_score`. No documented low-budget numeric threshold exists in SRS/config; it must remain unresolved rather than invented. |
| FR-6.7 Action matrix | MISSING | `Insight` has no priority, impact, effort, completion or stable ID (`generator.ts:17-24`). UI renders static cards with index keys (`page.tsx:238-249`). No persistence route, column or RLS-safe update path exists. |
| FR-6.8 Budget re-simulation | MISSING | Sliders only mutate local React state (`page.tsx:93-96,186-193`). No API, no feature recomputation, no scoring call, no validation against project budget bounds, no separation from the original report. |
| FR-6.9 Security and prompt hygiene | PARTIAL | Server-only imports, env-only secrets, generic provider errors and sanitized error codes are present. Raw DB/error messages reach clients (`generator.ts:248-250`, `route.ts:72-75`); no prompt delimiter/sanitizer; `requestId` is not persisted; quota/circuit state is process-local; client can currently supply a run ID but not provider/owner. |

## Required implementation decisions

1. Keep the existing gateway and three adapters; add a validated server-side task-policy override rather than a competing router.
2. Require model identifiers from environment/configuration and skip unconfigured providers safely.
3. Preserve 20 s per-attempt timeout, add race-based timeout enforcement, accurate `timeout` logging, parent-abort handling, and graceful fallback on quota exhaustion.
4. Add shared Supabase RPC-backed quota and circuit state; retain a documented process-local fallback only for non-persistent/test contexts.
5. Use one trusted facts object for two separate language requests (`en`, `ur_roman`) and cache each separately.
6. Add a deterministic risk engine with explicit unknown handling. The low-budget numeric threshold remains unresolved because no approved value exists.
7. Add stable action IDs, priority/impact/effort, and an RLS-safe completion update path.
8. Add a stored-data-only budget simulation using existing pure feature/scoring logic; never write to the original report.
9. Add a dedicated Module 6 test suite with mocked providers and mocked Supabase; no live paid calls.

> **Post-implementation note:** this was the pre-implementation decision record. The delivered code kept cache, quota and circuit state process-local and documented that serverless-wide guarantees require a shared store in `docs/module-6-ai-advisory.md`; it did not add the shared Supabase RPC described in decision 4.

## Thresholds intentionally not invented

- **Low budget ratio:** SRS FR-6.6 names the condition but gives no numeric cutoff. No approved value exists in `config/module4-scoring.json`, `config/module5-visualization.json`, the MCDA config, or migrations. The rule will be reported as `unknown` with `threshold: null`; it will never be treated as safe or triggered.
- **Provisional MCDA:** remains a provisional index. It is not a calibrated supervised model while OI-6 is open.
