# Module 7 implementation gap report

**Baseline:** `e73f2c59a24a6641d5a1c65255a32a7fbc48b5a9` (`main`, local and remote matched)
**Authority:** `docs/SRS.md:267-276` (FR-7.1–FR-7.6). Document labels were not treated as evidence.
**Method:** read-only code, migration, API, UI, test and documentation audit before edits. No live Groq, Supabase, browser or deployed-runtime verification was performed.
**Working tree at start:** clean regarding tracked Module 7 source, but contained unrelated untracked evidence assets/scripts and two modified tracked Python bytecode files. These are pre-existing user work and will not be touched or staged.

## Current implementation summary

- `src/app/projects/[id]/storefront-wizard/page.tsx` contains a four-step MCQ UI with 4/4/3/5 options, stepper, local state restore, loading/error states and `aria-pressed` option buttons.
- `src/app/api/projects/[id]/storefront-wizard/route.ts` uses the server-side AI gateway (`task: 'theme'`) and writes a compiled manifest to `stores.theme_config` and `store_draft_versions`.
- `src/lib/ai/gateway/router.ts` already defines a Groq-only `theme` policy with `maxAttemptsPerProvider: 2` and a 20 s timeout. `GROQ_API_KEY` and `GROQ_MODEL` are both required; there is no client provider override.
- `src/lib/storefront/compiler.ts` and `src/lib/storefront/variant-catalog.ts` deterministically compile a manifest from allowlisted variant IDs.
- `supabase/migrations/20261006050000_module7_storefront_configurator_schema.sql` creates `store_wizard_sessions` and `store_draft_versions` with RLS enabled and forced.
- `supabase/migrations/20261004000000_module1_auth_rbac_schema.sql:118-131` already defines `public.stores.theme_config jsonb not null default '{}'::jsonb`.

## Requirement-by-requirement gap

| FR | Audit status | Code-level evidence and gap |
| --- | --- | --- |
| **FR-7.1** Four-step code-free wizard | **PARTIAL** | Four steps and 3–5 choices exist (`storefront-wizard/page.tsx:6,45-74,296-329`), but the topics are Style/Audience/Products/Features, not the required Colour Palette/Navbar Style/Hero Section/Product Grid Layout (`docs/SRS.md:271`). Options are text/icon cards, not palette/navbar/hero/grid previews. The wireframe preview at `page.tsx:558-772` is driven by catalog tile clicks, not by the four answers. Previous navigation only calls `setStep()` without persisting (`page.tsx:415,463,541`). Error banner lacks `aria-live`. |
| **FR-7.2** Groq JSON-schema generation | **PARTIAL** | Server-side Groq call exists via `executeAIGateway` (`storefront-wizard/route.ts:58-86`), but the schema only requires two 7-character strings (`route.ts:65-73`); hex format is checked out-of-band at `:90-94`. Layout/navbar/hero/grid values are server presets, not model output validated against enums (`compiler.ts:63-73`; `variant-catalog.ts:4770-4865`). Store name is never sent; the prompt contains only category and three old answers (`route.ts:78`). No full structured theme configuration is requested. |
| **FR-7.3** One retry then deterministic fallback | **MOSTLY IMPLEMENTED, NEEDS THEME-LEVEL EVIDENCE** | Gateway policy retries twice (`router.ts:25-29`) and invalid output is retryable (`gateway/validate.ts:18-25`). Deterministic fallback exists (`execute.ts:110-134,229-233`), but the route fallback only returns the base two colours (`route.ts:84,88-101`). No dedicated test covers theme retry/fallback, and no deterministic preset is derived from the four SRS MCQ answers because those answers do not yet exist. |
| **FR-7.4** Persist to `stores.theme_config` | **PARTIAL** | The column exists (`20261004000000_module1_auth_rbac_schema.sql:126`) and the route writes a nested manifest (`storefront-wizard/route.ts:294,311`). Server ownership is checked for POST (`:143-154`), but GET relies only on an `owner_id` filter (`:115-122`). Store lookup is by owner only (`:272-279`), so multiple projects can reuse/overwrite one store. There is no JSONB shape constraint and no dedicated theme-config schema validation before persistence. The public renderer reads flat colour keys (`src/app/[slug]/layout.tsx:6-20,90-110`) while Module 7 writes nested `theme_tokens`, so the stored result is not consumed as designed. `public.stores.project_id` is used by application code but absent from every checked-in migration. |
| **FR-7.5** WCAG AA contrast | **PARTIAL** | Real relative-luminance/contrast math exists (`storefront-wizard/route.ts:48-56`), but it is applied only to AI accents against `base.surface` at a 3:1 threshold (`:90-94`). Failing colours are rejected in favour of the original preset, not auto-adjusted. Base palette and text/on-colour pairs are never checked. No normal-text 4.5:1 check exists. No unit tests exist. |
| **FR-7.6** Re-run with history | **PARTIAL** | A draft row is inserted on compile (`storefront-wizard/route.ts:319-334`), but there is no history read API or UI anywhere in the repository. `store_draft_versions` is owner-scoped through `stores.owner_id` with RLS forced (`20261006050000_module7_storefront_configurator_schema.sql:70-74,84-100`), but the `for all` policy permits owner UPDATE/DELETE; there is no DB-level immutability. `version_label` is a timestamp string, and no stable sequential version counter exists. |

## Architecture and security findings

1. **Do not add a competing provider abstraction.** The existing gateway is the correct integration point; its `theme` policy is Groq-only and server-only. Reuse `executeAIGateway` with a task-specific strict schema and semantic validator.
2. **Model configuration is already correct.** A provider is eligible only with both key and model (`src/lib/ai/gateway/router.ts:56-60`, `src/lib/ai/providers/groq.ts:34-44`). No new provider/model env variables are required. Do not accept provider or model from request bodies.
3. **Server-side ownership must be explicit.** GET must verify the authenticated owner against the project, not merely filter rows. Store selection should be resolved per owner and verified project, not by an unscoped `.limit(1)`.
4. **`stores.theme_config` needs a validated shape.** Unvalidated JSONB can reach dangerously-set CSS in the legacy storefront renderer. The new module must allowlist every colour, enum and string before persistence.
5. **A small additive migration is justified.** A nullable `stores.project_id` fixes an existing schema/code mismatch and supports per-project configuration. `store_draft_versions` needs read-onlyimmutability protection, a stable version number and a project index for FR-7.6. No Module 1–6 table or policy will be removed or weakened.
6. **Out of scope.** Do not implement store creation/publishing, slug rules, custom domains, SEO, tenant routing, payments, or Module 8/4/6 changes. The legacy variant catalog and publish APIs may remain untouched but must not be presented as new Module 7 evidence.

## Test and documentation findings

- No `tests/module7-*.test.mjs` exists. `scripts/verify-module7.mjs` and `scripts/verify-catalog-20plus.mjs` are source-string checks and are not wired into CI.
- `tests/module6-ai-advisory.test.mjs` covers the gateway only for the advisory task; it contains no theme coverage.
- `docs/requirements-traceability.md:19` incorrectly says Module 7 is Complete; `docs/FINAL_DELIVERY_BASELINE.md:57` correctly says Partial foundation.
- `docs/module-7-storefront-compiler.md:8` and `docs/FINAL_DELIVERY_BASELINE.md:124` describe the wrong four questions and claim full Groq theme compilation.
- `docs/api.md:720-830` documents wizard contracts that do not match the implementation and omits a theme/history API.
- `docs/data-and-integrations.md` documents advisory providers but not the `theme` task or its key-and-model requirement.

## Required implementation decisions

1. Build an SRS-aligned four-step MCQ wizard with 3–5 visual options per step, live preview tied to current answers, retained state, validation, review, responsive layout and accessible controls.
2. Introduce reusable Module 7 libraries for option catalogs, strict theme schema validation, deterministic fallback presets, WCAG contrast calculation/adjustment, and theme compilation. Keep presentation separate from business logic.
3. Use `executeAIGateway({ task: 'theme' })` with a strict JSON schema, semantic validation, two attempts and a deterministic fallback that passes the same validator. Send store name and category plus the four MCQ answers. Never accept provider/model overrides from clients.
4. Add a small, authenticated API surface to load current configuration/history and to generate, validate, adjust, persist and save the next configuration. Resolve owner identity and project authorization on the server.
5. Add one additive migration for nullable per-project store linkage, stable history versioning, immutability and owner-scoped indexes; include rollback guidance. Do not claim it has been executed in Supabase.
6. Create `tests/module7-theme-configurator.test.mjs` with mocked Groq fetch and mocked Supabase query chains covering all six FRs, including security and contrast edge cases. No paid/live calls.
7. Create `docs/module-7-theme-configurator.md` and reconcile traceability, API, data/integrations and final baseline docs. Report runtime limitations explicitly.

## Deliberately not resolved by invention

- No live Groq, Supabase/RLS, browser or deployed-runtime verification is claimed.
- No fabricated store, product, colour, market or AI performance data is introduced.
- OI-6, Module 4 scoring, Module 6 risk thresholds and Module 8 deployment remain unchanged.
- Model IDs remain operator configuration; no in-code model fallback is added.
