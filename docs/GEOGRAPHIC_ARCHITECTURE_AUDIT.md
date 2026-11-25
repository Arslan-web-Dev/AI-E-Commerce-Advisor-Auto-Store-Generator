# Geographic Architecture Correction — Audit

**Status:** Audit complete — **awaiting approval before any implementation.**
**Scope:** A national Pakistan application with Punjab as the initial data-supported region.
**Constraint honoured in this document:** no code was changed. This is analysis only.

---

## 0. Executive summary

The application is designed for Pakistan but its **geographic identity layer** (wizard form, validation, several server defaults) is currently hard-wired to Punjab. The data layer is already partly national (`public.regional_market_statistics` stores `province`, and `PbsRegionalStatsProvider` already contains Karachi, Islamabad, Peshawar and Quetta). The problem is therefore not the data model — it is a set of **application-level restrictions and silent Punjab fallbacks** that both (a) reject valid non-Punjab Pakistani locations and (b) substitute Punjab observations for non-Punjab regions.

Two categories must be separated:
1. **Geographic identity** — which country/province/district/city a project targets. Must be national.
2. **Geographic data coverage** — whether verified feasibility data exists for that region. Initially Punjab only.

The current code conflates the two: it *rejects* valid locations because coverage is absent, and it *silently borrows* Punjab numbers when coverage is absent.

---

## 1. Every Punjab-only restriction found in the repository

Legend for column **Class**: `LEGIT` = legitimate dataset limitation (keep) · `CONSTRAINT` = incorrectly constrains the national application (must change) · `LABEL` = cosmetic wording only.

| # | Location | What it does | Class |
|---|---|---|---|
| 1 | `src/lib/validation/project.ts:19` | `ALLOWED_DISTRICT_NAMES = PUNJAB_DISTRICTS.map(...)` — district allow-list is 7 Punjab districts only | CONSTRAINT |
| 2 | `src/lib/validation/project.ts:55-57` | Rejects any `region !== 'Punjab'` ("Only Punjab province is supported") | CONSTRAINT |
| 3 | `src/lib/validation/project.ts:79-81` | Rejects any district outside the Punjab list | CONSTRAINT |
| 4 | `src/lib/validation/project.ts:82-84` | Rejects any city outside the Punjab list | CONSTRAINT |
| 5 | `src/lib/validation/project.ts:85-90` | District↔city membership checked only against Punjab data | CONSTRAINT |
| 6 | `src/lib/validation/project.ts:186-193` | Step messages hard-coded "in Punjab" | LABEL |
| 7 | `src/types/project.ts:132` | `PUNJAB_PROVINCE = 'Punjab'` — single-province constant; no province list exists | CONSTRAINT |
| 8 | `src/types/project.ts:134-137` | `PunjabDistrict` interface (Punjab-named model) | CONSTRAINT |
| 9 | `src/types/project.ts:143-151` | `PUNJAB_DISTRICTS` — 7 districts, 1 city each | CONSTRAINT |
| 10 | `src/types/project.ts:153` | `PUNJAB_CITIES` derived list | CONSTRAINT |
| 11 | `src/types/project.ts:164-179` | `COMMERCIAL_HUB_PRESETS` — Punjab hubs only, no `province` field | CONSTRAINT |
| 12 | `src/app/api/projects/route.ts:116` | `region: body.region \|\| 'Punjab'` — **silent Punjab default** on insert | CONSTRAINT |
| 13 | `src/app/api/market/demand-analysis/route.ts:17-19` | Unmatched district **silently falls back to `PUNJAB_DISTRICT_BENCHMARKS[0]` (Lahore)** | CONSTRAINT |
| 14 | `src/lib/data-collection/orchestrator.ts:112-113,128-129` | `Number(project.lat \|\| 31.5204)` / `(project.lng \|\| 74.3587)` — **silent Lahore coordinates** | CONSTRAINT |
| 15 | `src/lib/data-collection/orchestrator.ts:115,131,147,179` | `city: project.city \|\| 'Lahore'` — **silent Lahore city** | CONSTRAINT |
| 16 | `src/lib/providers/trends/google-trends.ts:50,68` | Hard-coded Google-Trends geo `'PK-PB'` (Punjab) | CONSTRAINT |
| 17 | `src/lib/providers/trends/google-trends.ts:81` | Synthetic fallback is Punjab seasonal curves, applied to **every** region without a coverage flag | CONSTRAINT |
| 18 | `src/app/market-intelligence/page.tsx:176,224,272-273,474` | Title/tab/labels "Punjab"; geo selector only `PK` and `PK-PB (Punjab Province)` | CONSTRAINT |
| 19 | `src/app/projects/[id]/feasibility/page.tsx:205,221,228` | Fallback `'Lahore, Punjab'`; hard-coded "Geography: Punjab, Pakistan"; Punjab-only disclaimer | CONSTRAINT |
| 19b | `src/app/projects/[id]/feasibility/page.tsx:125-126` | Map center `Number(project?.lat) \|\| 31.5204` / `Number(project?.lng) \|\| 74.3587` — **silent Lahore map centering** | CONSTRAINT |
| 19c | `src/app/projects/[id]/feasibility/page.tsx:75-77` | Demo competitor fixtures carry Lahore coordinates and are rendered when no live data exists, without a coverage label | LABEL |
| 20 | `src/app/projects/[id]/feasibility/page.tsx:77` | Demo competitor named "Punjab Mart" | LABEL |
| 21 | `src/app/api/market/regional/route.ts:26-32` | Fallback returns only `PUNJAB_DISTRICT_BENCHMARKS` | CONSTRAINT (fallback only; DB read is already national) |
| 22 | `src/app/api/cron/rent-cache/route.ts:10-23` | Rent seed rows are Punjab districts; record does not set `province` explicitly | LEGIT (dataset) |
| 23 | `src/lib/constants/punjab-benchmarks.ts` (whole file) | Punjab district benchmarks (10 districts incl. Sargodha, Sahiwal, Sheikhupura) | LEGIT (dataset) |
| 24 | `src/lib/providers/trends/…` / `pbs.ts:37` | PBS citation strings mention Punjab | LABEL |
| 25 | `src/lib/currency/exchange-rate.ts:15` | Comment "Punjab commercial feasibility planning" (rate is national) | LABEL |
| 26 | `ml-service/main.py:33,35,126` | Service title/description "Punjab …" | LABEL |
| 27 | `ml-service/datasets/sample_dataset_generator.py:1-34` | `DISTRICT_DATA` = 10 Punjab districts; `CATEGORIES` = separate 6-category taxonomy | LEGIT (dataset) |
| 28 | `src/app/admin/ml/page.tsx:118-119,351,446,458,482,944,951` | Punjab district presets, "Punjab ML Engine/Sample/District" labels | LABEL |
| 29 | `src/components/wizard/BusinessIdeaWizard.tsx:10-12,48,331-336,448,634,803,813,839-840,878,1408` | Province read-only = `PUNJAB_PROVINCE`; district/city/hub driven by Punjab lists; copy says "Punjab" | CONSTRAINT |
| 30 | `src/app/[slug]/about/page.tsx:60` (and other `[slug]` storefront pages) | Generated store template copy "Punjab Delivery … all districts of Punjab" | LABEL (store template, not advisor geography) |

---

## 2. Restrictions that are legitimate dataset limitations (keep)

These reflect **coverage**, not application scope, and should remain — they must simply be *labelled as coverage* rather than enforced as identity restrictions:

- `src/lib/constants/punjab-benchmarks.ts` — verified Punjab district benchmarks (rent, PPI, demographics). This is the Punjab coverage dataset.
- `public.regional_market_statistics` seeded rows (all `province='Punjab'`).
- `ml-service/datasets/sample_dataset_generator.py` — Punjab training data and its 6-category taxonomy (already documented as a limitation).
- Punjab seasonal trend fallback curves in `google-trends.ts` (legitimately Punjab-derived; must be labelled, not silently applied).
- Website cron rent estimates for Punjab districts.
- Storefront template copy that ships to Punjab-based merchants.

Already national (no change needed, keep as-is):
- Pakistan coordinate bounding box `lat 23.5–37.2 / lng 60.8–77.9` (`validation/project.ts:98`).
- Country fixed to `Pakistan` (`validation/project.ts:58-64`) — this is the stated national requirement.
- `region: 'PK'` national geo default for demand trends (`orchestrator.ts:164`; `ml-client.ts:279`).
- `PbsRegionalStatsProvider` — already covers Karachi, Islamabad, Peshawar, Quetta (+ national fallback).
- `public.projects.region` is plain `text` with **no** Punjab `CHECK` constraint at the database level.
- Overpass competitor tag map is keyed by category, not by province — already national-capable.

---

## 3. Restrictions that incorrectly constrain the national application (must change)

Grouped by the principle they violate:

**A. Recognition is coupled to coverage (items 1–13, 29).** A valid Pakistani province/district/city is rejected because it is not in the Punjab list. Per the requirement, a recognised region must be identifiable and selectable even when its dataset is not yet available.

**B. Silent Punjab substitution (items 12–17, 19, 21).** Missing or unmatched geography silently becomes Punjab (region default `'Punjab'`, Lahore coordinates/city, `PUNJAB_DISTRICT_BENCHMARKS[0]`, `'PK-PB'` trends geo, `'Lahore, Punjab'` label). This violates "never substitute Punjab observations as local market evidence" and "never generate fabricated local market statistics."

**C. UI presents Punjab as the only region (items 16, 18, 19, 21, 29).** No province selector; province is a read-only fixed value; geo dropdowns list only Punjab.

---

## 4. Existing geographic database schema

There is **no canonical geographic reference table** (no `provinces`/`districts`/`cities` lookups). Geography is stored as free text plus one Punjab-seeded statistics table:

| Object | Location | Geography fields |
|---|---|---|
| `public.projects` | `supabase/combined_schema.sql:340-357`; `supabase/migrations/20261006000000_module2_projects_wizard_schema.sql` | `city text`, `district text` (added by `20261124020000_module2_wizard_district.sql`), `region text`, `country text default 'Pakistan'`, `postal_code text`, `lat double precision`, `lng double precision`, `radius_km numeric(4,1)`. No FK, no `CHECK` on `region`. |
| `public.regional_market_statistics` | `supabase/migrations/20261123000000_ml_pipeline_and_market_intelligence.sql:92-113` | `province text not null default 'Punjab'`, `district text not null`, `tehsil text not null default 'All'`, `division text not null`, plus demographic/commercial metrics. **This is already a province → district → tehsil hierarchy.** |
| `public.project_market_observations` | `combined_schema.sql` | `geography text not null` (free text) |
| `public.demand_trend_records` (trend table) | `combined_schema.sql` | `region text not null default 'PK'` |

**Conclusion:** the existing structure to *extend* is `regional_market_statistics` (it already models province/district/tehsil). What is missing is (a) a national province/region identity list and (b) a coverage/availability flag decoupled from identity.

---

## 5. Proposed minimum changes

Practical, on the existing stack; no new abstraction frameworks.

1. **One configurable national geography dataset** (new module, e.g. `src/lib/geo/pakistan-geography.ts`):
   - `PAKISTAN_COUNTRY = 'Pakistan'`.
   - `PAKISTAN_REGIONS`: Punjab (`PK-PB`), Sindh (`PK-SD`), Khyber Pakhtunkhwa (`PK-KP`), Balochistan (`PK-BA`), Islamabad Capital Territory (`PK-IS`), Azad Jammu & Kashmir (`PK-AK`), Gilgit-Baltistan (`PK-GB`) — each with `{ name, code, districts: [{ name, cities }] }` where intermediate levels (division/tehsil) are **optional** so differently-structured regions are supported.
   - A separate **coverage** concern per region: `coverage: 'verified' | 'limited' | 'none'`, `analysis_enabled: boolean`, `supported_categories: string[]`, `source_note`.
   - Keep `COMMERCIAL_HUB_PRESETS` but add a `province` field.
2. **Province-aware validation** (`validation/project.ts`): replace `PUNJAB_*` allow-lists with the region dataset. Validate district/city against the **selected province**, keep district↔city membership. Accept any recognised region regardless of coverage. Keep the Pakistan bounding box and country rule.
3. **No silent defaults** (`api/projects/route.ts`): stop defaulting `region` to `'Punjab'`; derive the province from the selected district when possible, otherwise require it, and reject only *unrecognised* regions.
4. **Coverage-aware orchestrator** (`orchestrator.ts`): remove Lahore coordinate/city defaults; if coordinates are missing **or** region coverage is `none`, mark providers `skipped_no_coverage`/`unavailable` and **do not** insert Punjab data as local evidence.
5. **Trends provider** (`google-trends.ts`): pass the project's ISO-3166-2 province code instead of `'PK-PB'`; label the Punjab fallback as coverage-limited; return coverage-unavailable for uncovered regions.
6. **Demand-analysis route** (`api/market/demand-analysis/route.ts`): replace the silent Lahore fallback with an explicit `coverage unavailable` response.
7. **Wizard** (`BusinessIdeaWizard.tsx`): dynamic **province → district → city** cascade from the dataset, with a coverage badge and honest "dataset not yet available for this region" message. Country stays fixed to Pakistan; Punjab stays the fully-supported default selection.
8. **UI honesty**: `market-intelligence` and `feasibility` pages list all regions dynamically; remove hard-coded "Punjab" geography labels; show coverage status.
9. **Data layer**: generalise `PUNJAB_DISTRICT_BENCHMARKS` naming to a province-aware corpus (keep the Punjab rows; add new provinces only with authoritative data). Keep `regional_market_statistics` as the numeric store.

**Not changed:** five approved categories, PKR canonical currency, budget bounds (Rs. 10,000–50,000,000), three-step wizard, draft persistence/resume, Supabase auth + RLS, the secure submission RPC, and project ownership rules.

---

## 6. Migration requirements

All **additive, nullable, forward-only**; no RLS changes, no drops.

| Change | Purpose | Risk |
|---|---|---|
| `public.projects` + `province_code text` (ISO 3166-2), nullable | Reliable geo joins while keeping `region text` for backward compatibility | Low — nullable, existing rows unaffected |
| `public.projects` + `coverage_status text` (or store in existing `metadata jsonb`) | Record whether analysis data existed at submission time | Low — avoid a new column if `metadata` is acceptable |
| New reference table `public.geo_coverage` (country, region_code, region_name, district, coverage_status, analysis_enabled, supported_categories, source_note, updated_at) | National identity + coverage, decoupled | Low — new table, read-only to authenticated users |
| Optional: seed authoritative province/district rows with `coverage_status='none'` (no metrics) | Allow selection of recognised-but-uncovered regions | Low — no fabricated metrics |
| `public.regional_market_statistics` | Accept rows for new provinces when verified data arrives; set `province` explicitly | Low — `province` already exists with a default |

No migration is strictly required to *unblock* the wizard if the geography dataset is versioned in code; migrations are required to persist `province_code`/coverage and to store non-Punjab statistics later. **Decision requested** (see §9).

---

## 7. Backward-compatibility risks

- **Existing data**: rows already store `region='Punjab'` and valid Punjab districts — remain valid; adding nullable columns does not touch them.
- **Removing the `|| 'Punjab'` default**: new drafts may store `region = null`; validation must therefore allow a null region on partial drafts (as it already does for other fields). Existing rows unaffected.
- **Removing Lahore fallbacks in the orchestrator**: changes behaviour for projects that previously lacked coordinates (they used to receive Lahore competitors). This is a correctness fix, not a data migration; existing stored observations are untouched.
- **Test drift**: `tests/task3-wizard-feasibility.test.mjs` currently asserts `PUNJAB_PROVINCE`/`PUNJAB_DISTRICTS`/`PUNJAB_CITIES` and the string "Only Punjab province is supported". These assertions must be updated **together with** the implementation, or they will fail. `tests/module2-wizard-project.test.mjs` references `COMMERCIAL_HUB_PRESETS` and Pakistan bounds (safe).
- **Naming**: if `PUNJAB_*` exports are renamed, keep temporary re-exports only if something external depends on them; otherwise migrate all references (repo-internal only).
- **Cosmetic labels** in ML service and storefront templates are safe to leave or restyle independently.

---

## 8. Future province-expansion procedure

Adding a province must require **no rewrite** of the wizard, auth, projects DB, or RPC:

1. Add authoritative administrative records to the geography dataset (province → districts → cities/tehsils where they exist).
2. Add verified benchmark rows to `regional_market_statistics` (province, district, tehsil, rent, PPI, demographics) and the district benchmark corpus.
3. Configure coverage: `coverage_status='verified'`, `analysis_enabled=true`, and list `supported_categories`.
4. Add/verify commercial hub presets (`province, district, city, lat, lng`).
5. Enable provider coverage (OSM/Overpass is already national; trends uses the province geo code; regional stats extended).
6. Run regional data-quality validation (per-province ML sample dataset, encoder `handle_unknown='ignore'` already tolerates new categories; run the benchmark suites).

---

## 9. Open decisions for approval

1. **Geography home**: versioned code dataset only, or a `public.geo_coverage` reference table (or both)? The instruction warns against unnecessary duplicate tables; `regional_market_statistics` already covers province/district/tehsil, so a *single* new coverage table is the recommendation.
2. **Persisting coverage**: add `projects.province_code` + `coverage_status` columns, or store both inside the existing `projects.metadata jsonb`?
3. **Scope of this correction**: apply to the wizard + validation + API + provider defaults (core), and treat the market-intelligence/admin/storefront label changes as a follow-up, or include them now?
4. **Task 3 status**: the committed Task 3 work (SHA `5800568`) is ~80% reusable; this correction revises its Punjab-only validation, wizard cascade, and silent defaults rather than replacing the wizard, drafts, or submission flow.

---

## 10. Acceptance-criterion mapping

| Acceptance requirement | Current state | After approved changes |
|---|---|---|
| Pakistan-wide application (identity) | ❌ rejects non-Punjab | ✅ recognised nationally |
| Punjab as initial data-supported region | ✅ present | ✅ preserved |
| Recognised region not rejected for missing dataset | ❌ | ✅ coverage shown, not rejection |
| No Punjab substitution as local evidence | ❌ (Lahore fallbacks) | ✅ coverage-unavailable instead |
| Adding a province needs no core rewrite | ⚠️ partial | ✅ data + coverage only |
| Five categories / PKR / budget bounds / 3 steps / drafts / RLS / RPC | ✅ | ✅ unchanged |

**This criterion is NOT claimed as satisfied until the implementation and tests demonstrate it.** No implementation has been performed in this audit.

---

## 11. Implementation status (delivered)

The corrected architecture was implemented and verified. Nationwide **identity** is
demonstrated by automated tests; verified **coverage** remains Punjab-first.

**Decisions applied**

1. **Geography storage** — one centrally maintained, version-controlled national dataset in [`src/lib/geo/pakistan-geography.ts`](../src/lib/geo/pakistan-geography.ts) (country → province/administrative territory → district → city, with optional tehsil/locality). No records are fabricated: non-Punjab regions carry an explicitly partial, well-established district subset flagged `district_registry_complete: false`. The helpers (`getRegion`, `isRecognised*`, `buildCoverageSnapshot`, …) are the stable seam a future DB-backed registry can implement behind without rewriting the wizard, validation, APIs or providers.
2. **Coverage persistence** — no new columns or tables. Coverage snapshots are written to the existing `projects.metadata.geo` JSONB (`{ country, region, region_code, district, city, coverage, analysis_enabled, supported_categories, source_note, captured_at }`) on create and refreshed on geographic update. Identity and coverage stay separate concepts.
3. **Identity vs coverage** — every recognised region is selectable regardless of coverage. Punjab is `coverage: 'verified'` / `analysis_enabled: true`; Sindh, Khyber Pakhtunkhwa, Balochistan, Islamabad Capital Territory, Azad Jammu and Kashmir and Gilgit-Baltistan are recognised with `coverage: 'none'` and `supported_categories: []`.

**Files changed**

- New: `src/lib/geo/pakistan-geography.ts`; `tests/geography-pakistan.test.mjs`.
- Types/validation: `src/types/project.ts` (re-exports the national dataset; `PUNJAB_*` retired), `src/lib/validation/project.ts` (region-aware, `PAKISTAN_BOUNDS`, coordinates mandatory only where coverage exists).
- APIs: `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts` (canonicalise/infer region, never default to Punjab; persist coverage snapshot), `src/app/api/market/demand-analysis/route.ts` (no `PUNJAB_DISTRICT_BENCHMARKS[0]` fallback → `coverage.status: 'unavailable'`), `src/app/api/market/regional/route.ts` (coverage status on every response).
- Providers/orchestrator: `src/types/data-collection.ts` (`CoverageUnavailableError`), `src/lib/data-collection/orchestrator.ts` (no Lahore coordinate/city defaults; maps `CoverageUnavailableError` → provider status `'unavailable'`), `src/lib/providers/trends/google-trends.ts` (uses the region's ISO code; throws `CoverageUnavailableError` instead of applying Punjab seasonal curves elsewhere).
- UI: `src/components/wizard/BusinessIdeaWizard.tsx` (dynamic province → district → city cascade, coverage badge, optional coordinates for non-Punjab), `src/app/projects/[id]/feasibility/page.tsx` (map/gauge only when coverage + coordinates exist; honest notices, no demo Lahore fixtures), `src/app/projects/[id]/page.tsx` (no coordinate fallback), `src/app/market-intelligence/page.tsx` (all regions listed, coverage labelled).

**Migrations:** none required. Per decision 2 the geography is code-versioned and coverage uses the existing `metadata` JSONB; `regional_market_statistics` already models province/district/tehsil for future verified rows. No RLS change; Task 2 security and the one-argument submission RPC are unchanged.

**Verification:** `node tests/geography-pakistan.test.mjs` (7/7), `node tests/task3-wizard-feasibility.test.mjs` (8/8), `node tests/module2-wizard-project.test.mjs` (6/6), `node tests/module1-auth-rbac.test.mjs` (6/6), `node tests/task2-security-remediation.test.mjs` (6/6), `scripts/verify-module3.mjs` (53/53), `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run build` (success), `python ml-service/test_pipeline.py` (pass).

**Remaining limitations**

- Verified feasibility coverage is Punjab-only; other regions return clearly labelled `unavailable` coverage rather than substituted Punjab data.
- Non-Punjab regions carry a partial, non-authoritative district/city subset (`district_registry_complete: false`) and accept user-provided district/city text; a complete authoritative registry per region is future work (see §8).
- Commercial hub presets remain Punjab-only (no verified coordinates elsewhere); uncovered locations stay selectable without a preset.
- Cosmetic Punjab labels in the ML admin UI, ML service strings, storefront templates and the cron rent seed were intentionally left in place (labelled datasets/templates, outside the approved correction scope).
