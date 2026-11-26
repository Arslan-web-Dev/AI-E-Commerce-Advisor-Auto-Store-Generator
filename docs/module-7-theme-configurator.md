# Module 7: Interactive MCQ Component / Theme Configurator

**Scope:** SRS FR-7.1–FR-7.6 only.
**Authority:** `docs/SRS.md:267-276`.
**Baseline:** `e73f2c59a24a6641d5a1c65255a32a7fbc48b5a9` (`main`, local and remote matched before this work).
**Pre-implementation audit:** [module-7-implementation-gap-report.md](module-7-implementation-gap-report.md).
**Verification suite:** `tests/module7-theme-configurator.test.mjs` (mocked Groq responses and mocked Supabase query chains; no paid or live calls).

This document records repository implementation and local test evidence. It does **not** claim live Groq, populated Supabase/RLS, browser, or deployed-runtime verification unless a named check below was actually run.

## 1. Requirement status

| FR | Status | Implementation and evidence |
| --- | --- | --- |
| **FR-7.1** Four-step code-free wizard | **COMPLETE (local evidence)** | `src/components/theme-configurator/ThemeConfigurator.tsx` renders exactly four steps: colour palette, navbar style, hero section and product grid layout. `src/lib/theme/options.ts` supplies four approved visual options per step (within the required 3–5 range), each with a label, description and a schematic visual in `OptionVisual`. Selections update `LivePreview` immediately; desktop/tablet/mobile toggles change the preview viewport. Partial answers persist through `save_draft`, a final review stage precedes generation, and a stepper uses `aria-current="step"`. Loading, empty-history, busy, error and status states are explicit. |
| **FR-7.2** Groq compilation and strict schema | **COMPLETE (mocked evidence)** | `src/lib/theme/generator.ts` calls the shared server-only gateway with `task: 'theme'`. `src/lib/ai/gateway/router.ts` fixes that policy to Groq only; there is no provider or model override from the request body and no in-code model fallback. Store name/category are sanitized, length-bounded and delimited as untrusted data. `THEME_OUTPUT_SCHEMA` requires exactly seven keys with additional properties rejected, enum-validated IDs and six-digit hex colour patterns; `assertValidThemeOutput` repeats the checks in TypeScript and requires the model to return the user's approved selections unchanged. Labels, metadata and configuration objects are validated again before persistence. |
| **FR-7.3** One retry, then deterministic fallback | **COMPLETE (mocked evidence)** | The theme task policy uses `providers: ['groq']` and `maxAttemptsPerProvider: 2` with a 20 s timeout. Invalid JSON/schema, changed answers, HTTP failures and unavailability fail over through `executeAIGateway`; the required fallback is built from the selected palette in `buildFallbackModelOutput` using only approved IDs. The resulting configuration is still validated and passes through the same WCAG evaluation. Metadata discloses `provider: 'rule_fallback'`, `fallback: true`, `model: 'deterministic'` and the provider attempt count; unconfigured Groq yields zero provider calls and zero attempts. No unbounded retry loop exists. |
| **FR-7.4** Persist to `stores.theme_config` | **COMPLETE (mocked evidence)** | `src/lib/theme/persistence.ts` verifies the authenticated owner's project, validates the submitted configuration and its answers, and writes only to an owner-scoped store row (`theme_config`, `theme_config_version`, `theme_updated_at`). A missing draft store is created with a bounded slug and `status: 'draft'`. Errors are mapped to meaningful validation/forbidden/not-found/conflict/database responses by `src/app/api/projects/[id]/theme-configurator/route.ts`; database error text is sanitized before display. |
| **FR-7.5** WCAG AA contrast check/adjustment | **COMPLETE (unit-tested)** | `src/lib/theme/contrast.ts` implements sRGB linearisation, WCAG relative luminance and the contrast-ratio formula. Accent colours are checked against surfaces at **3:1** (large text/UI); text colours are checked at **4.5:1** (normal text). `evaluatePaletteContrast` deterministically moves failing colours toward black or white, then records final ratios, original colours and every adjusted token in generation metadata. The result UI displays each ratio against its threshold and lists adjusted colours. Tests verify 21:1 black/white, 1:1 identical colours and a failing palette being adjusted. |
| **FR-7.6** Re-run with preserved history | **COMPLETE (mocked evidence)** | The result stage exposes **Run again** and **Edit answers** while preserving answers. On load, the UI restores the saved draft/current configuration and lists owner-scoped history. Before replacing a draft configuration, `saveThemeConfiguration` inserts the previous valid object into `store_draft_versions` with a stable `version_number`, `version_label` and the same project/store links. Published stores are rejected with `409` rather than silently replaced. The additive migration makes history snapshots append-only for non-service roles. |

## 2. Runtime flow

1. The authenticated owner opens `/projects/[id]/storefront-wizard`; the server page renders `ThemeConfigurator` with the project ID.
2. `GET /api/projects/[id]/theme-configurator` verifies the session and project ownership, then returns the current draft, current validated configuration, store version and up to 20 history entries.
3. Each step's selection is saved with `POST` action `save_draft`; the server allowlists keys, validates enum IDs and writes `store_wizard_sessions` with `answers_version: 'theme.v1'`.
4. The review stage submits action `generate`. All four answers are required; generation is server-side and the client sends no provider, model, credentials, CSS, HTML or executable content.
5. The gateway tries Groq at most twice. A valid response, or an identified deterministic fallback, is converted into a validated configuration with WCAG AA metadata.
6. Action `save` revalidates the configuration and answers, preserves the previous configuration as history, then updates `stores.theme_config`.
7. **Run again** returns to review with answers preserved; saving again creates the next version instead of silently replacing the current one.

## 3. API additions

See [api.md](api.md), section 5B:

- `GET /api/projects/[id]/theme-configurator`
- `POST /api/projects/[id]/theme-configurator` with actions `save_draft`, `generate` and `save`

The older `/api/projects/[id]/storefront-wizard` compiler route is intentionally retained for the existing storefront-compiler assets and Module 8 dependencies. The SRS-aligned UI uses the new theme-configurator route.

## 4. Data additions

One additive migration was introduced:

- `supabase/migrations/20261126160000_module7_theme_configurator.sql`
- Adds nullable `public.stores.project_id`, `theme_config_version` and `theme_updated_at`.
- Adds `public.store_draft_versions.version_number`, an owner/project history index, a partial unique `(store_id, version_number)` index, an ownership-consistency trigger and an append-only trigger for history snapshots.
- Adds no destructive changes and does not rewrite existing rows.

Manual rollback, only after application code is reverted:

```sql
drop trigger if exists trg_store_draft_versions_immutable on public.store_draft_versions;
drop trigger if exists trg_stores_project_owner on public.stores;
drop function if exists public.prevent_store_draft_version_mutation();
drop function if exists public.enforce_store_project_owner();
drop index if exists public.uq_store_draft_versions_store_version;
drop index if exists public.idx_store_draft_versions_project;
drop index if exists public.idx_stores_project_theme;
alter table public.store_draft_versions drop column if exists version_number;
alter table public.stores drop column if exists theme_updated_at;
alter table public.stores drop column if exists theme_config_version;
alter table public.stores drop column if exists project_id;
```

This file is checked in; its statements have **not** been executed in Supabase as part of this task. RLS authority and trigger behavior in a live database remain unverified.

## 5. Environment configuration

```bash
# Server-only; never prefix with NEXT_PUBLIC_
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
```

Both values are required for Groq to be eligible. If either is absent, the configurator deliberately uses the deterministic preset and discloses it. `AI_ADVISORY_PROVIDERS` does not affect the theme task. Sample model IDs are operator configuration, not hard-coded runtime fallbacks.

## 6. Acceptance evidence

Local checks executed for this work (all exited `0`):

- `node --test tests/module7-theme-configurator.test.mjs` — 12/12 tests pass; mocked provider HTTP, mocked Supabase chains and source contracts.
- `node scripts/verify-module7.mjs` — updated file/wiring checks.
- `npx tsc --noEmit` and `npm run lint` — zero errors; lint reports only pre-existing warnings.
- `node --test tests/module4-feature-engineering.test.mjs`, `node --test tests/*.mjs`, `node scripts/verify-module3.mjs` — unchanged-module regressions.
- `npm run build` — production build succeeded.
- `python ml-service/test_pipeline.py` and `python ml-service/test_auth_security.py` — unchanged ML-service regressions.
- `git diff --check` — no whitespace errors.

The dedicated suite stubs global `fetch`; it makes no Groq request and does not require a database. No live provider, browser or deployed runtime claim is made.

## 7. Known limitations

- Live Groq responses, Supabase migrations/RLS/triggers, browser keyboard/visual review and deployed behavior are `NOT RUN`. The migration is checked in only.
- The shared gateway's response cache, quota and circuit state remain process-local from Module 6; cross-instance guarantees are not claimed.
- The deterministic fallback uses the selected approved palette; it does not attempt to imitate a language model.
- Contrast adjustment is deterministic and rule-based. It proves the four recorded ratios, not a full perceptual or color-blindness audit.
- History display is capped at the latest 20 entries. Older snapshots remain in the table but are not listed.
- A published store is protected from silent replacement and must go through an explicit publish/unpublish flow outside Module 7.
- The legacy variant-catalog compiler route remains present; this pass did not remove or rewrite Module 8 dependencies.
