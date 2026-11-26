# Task 5 / Module 4 — Feature Engineering and ML Model Pipeline

**Authority:** `docs/FINAL_DELIVERY_BASELINE.md` and the user-supplied October 2026 SRS/SDD v1.0. Older repository documents that place scoring in “Module 5” use a legacy numbering alias; in the source SRS, feature engineering and the feasibility model are FR-4.1–FR-4.8.

**Important status:** the FR-4 infrastructure is implemented and tested. Experimental sandbox training on the unapproved rule labels is permitted, but **production activation and supervised feasibility serving remain BLOCKED by OI-6.** No production feasibility model has been activated or reported as calibrated. Customer/project scoring still uses the explicitly labelled provisional MCDA index.

## 1. FR coverage

| FR | Implementation | Evidence / limitation |
| --- | --- | --- |
| FR-4.1 | Eight explicit unit-bearing features persisted on `project_features`, plus the stable bounded `engineered_vector`. Stale/cross-region demand vectors stay `null`. | `src/lib/data-processing/feature-engineer.ts`, `src/lib/data-processing/trend-validity.ts`, `src/types/feature-processing.ts`, migration `20261125130000_module4_model_pipeline_hardening.sql`, `tests/module4-feature-engineering.test.mjs`. |
| FR-4.2 | Deduplication, domain quality scoring and provenance breakdown retained; unavailable sources stay `N/A`/`null` and are named in `domain_completeness.missing_fields`. No synthetic benchmark is used as a local observation. | `src/lib/data-processing/cleaner.ts`, `deduplicator.ts`, existing quality tests. The legacy `imputations_count` field now counts unavailable components for compatibility, not fabricated replacements. |
| FR-4.3 | Exactly 8 classifiers and 8 regressors (including XGBoost) are registered, attempted in a single comparison run, and reported with stratified/K-fold CV, fold-local preprocessing, per-fold and aggregate CV metrics, held-out metrics, library versions and artifact fingerprints. Deliberately excluded candidates carry auditable reasons. | `ml-service/models/candidate_models.py`, `ml-service/models/trainer.py`. Rule-generated feasibility targets may be trained only as `experimental_sandbox`; production activation remains blocked by OI-6. `xgboost 3.4.1` is installed and declared as `xgboost>=2.1.0` in `requirements.txt`. |
| FR-4.4 | Exact SRS bands `>=0.75`, `>=0.55`, `>=0.35`, `<0.35`, shared by TypeScript, Python and both UIs. Admin-changed versions are forwarded to the Python scorer per request. | `config/module4-scoring.json`, `src/lib/ml/scoring-contract.ts`, `ml-service/config.py`, `src/app/api/ml/predict/route.ts`; `risk_level` and feasibility vocabulary are both returned explicitly. |
| FR-4.5 | Versioned artifacts; each report persists `model_version`, `threshold_version`, `risk_level`, evaluation status, disclaimer and provenance, including explicitly unavailable reports. | `src/lib/scoring/mcda.ts`, `src/app/api/projects/[id]/feasibility/route.ts`, migration above. Report versions are `provisional_mcda:v1.0-mcda` while OI-6 is blocked. |
| FR-4.6 | Model-derived **global** importances where an artifact provides them; documented rule-based **local context factors**. No SHAP claim. | `ml-service/models/explainability.py`, `src/app/admin/ml/page.tsx`. Missing inputs are reported as unavailable, not silently replaced. |
| FR-4.7 | Rule-label formula and legacy boundaries preserved verbatim in the OI-6 proposal; exact disclaimer `Estimate based on a model trained on limited data` shown in customer and admin UI. | `docs/module-4-label-approval-proposal.md`, `ml-service/config/label_approval.json`, `src/lib/ml/scoring-contract.ts`. No calibrated probability, revenue prediction or commercial-success claim. |
| FR-4.8 | Admin-only GET/POST threshold API with strict validation, ordered numeric bounds, non-empty version, duplicate rejection, immutable version table, DB CHECK and live config update. | `src/app/api/admin/scoring-thresholds/route.ts`, `public.ml_scoring_config_versions`, `public.is_admin()` RLS policy. |

## 2. Feature formulas and units

All source values are canonical PKR unless a project explicitly declares USD; the documented conversion rate is `278 PKR/USD`, applied to both cost midpoints and the parsed PKR rent rate so one feature record never mixes currencies. A zero or missing denominator produces `null` (`N/A` in UI), never `0`, `Infinity`, or a borrowed Lahore/Punjab value.

| Feature | Formula | Unit / range |
| --- | --- | --- |
| `competitors_count` | Count of deduplicated competitors with valid coordinates and name | count |
| `competitor_density_per_km2` | `competitors_count / (π × radius_km²)` | POIs per km², six decimals; `null` when radius is absent/invalid |
| `avg_competitor_rating` | Arithmetic mean of available ratings in `[0,5]` | rating 0–5, two decimals; `null` when no ratings |
| `rent_per_sqft` | Sourced PKR rate from a labelled rent record, parsed from cost assumptions then converted if the project is USD | PKR/sq.ft or USD/sq.ft per `currency`; `null` when no sourced record |
| `estimated_monthly_rent` | Sourced monthly rent midpoint when freshness is not `unavailable` and amount is positive | PKR/month; `null` on a coverage gap |
| `rent_to_budget_ratio` | `estimated_monthly_rent / (user_budget / 12)` | dimensionless, four decimals; `null` on zero/missing denominator |
| `budget_to_setup_cost_ratio` | `user_budget / total_estimated_setup_cost` | dimensionless, four decimals; `null` on zero/missing/negative input |
| `demand_score` | 0–100 trend index from a fresh, in-scope record | index 0–100, two decimals; `null` when trend is unavailable, stale or cross-region |
| `category_saturation` | `competitors_count / population` | ratio, eight decimals; `null` when population is absent/non-positive |
| `saturation_index` | `category_saturation × 100,000` | competitors per 100,000 residents; `null` on the same conditions |

`trend_slope` remains `growing` / `stable` / `declining`; `trend_slope_score` is `+1 / 0 / −1` only for a fresh, in-scope trend and is `null` otherwise. Missing bounded vector values (`norm_avg_demand`, `trend_slope_score`, `norm_internet_penetration`, `norm_ecommerce_growth`, `norm_category_saturation`, `norm_budget_ratio`) are excluded from the provisional index rather than replaced by neutral numbers. The bounded vector order (`norm_competitors_density`, `norm_category_saturation`, `norm_budget_ratio`, `norm_avg_demand`, `trend_slope_score`, `norm_internet_penetration`, `norm_ecommerce_growth`, `footprint_scale`, `channel_type`) is stable and covered by a deterministic test. `feature_version` is `v1.1-fr4`.

## 3. Dataset and label provenance

- Project inputs come from Task 3 collection rows: Overpass competitors, market observations, demand trend records and cost estimates. Rent is read from labelled cache/benchmark records; analysis never substitutes a live scrape or a different district’s value.
- The Python sample generator creates **synthetic sandbox rows only** for five approved categories: Grocery / General Stores, Clothing / Footwear, Mobile Phones / Accessories, Restaurants / Cafes, Pharmacies / Medical Stores. Legacy six-category labels were removed. The generator default is 1,500 rows (the Task 5 comparison smoke run used 5,000); every frame has 41 documented columns. `num_samples`, `random_seed` and `missing_rate` are configurable and a fixed seed replays an identical frame.
- Every generated row carries `data_source = synthetic`, `dataset_version = synthetic-fr4-v2` and `schema_version = v2.0-fr4-synthetic`. A `.meta.json` sidecar records a SHA-256 fingerprint, the full column dictionary, explicit `approved_for_production: false`, and the OI-6 status. `validate_dataset()` checks missing required columns, numeric ranges, unapproved categories, duplicate rows, null targets and source mixing; `assert_synthetic_only()` rejects any mixed-source frame.
- The pre-existing rule-label formula and its `0.35 / 0.25 / 0.25 / 0.15` weights, Gaussian noise and legacy class boundaries are preserved verbatim in `docs/module-4-label-approval-proposal.md`. Task 5 did not change them.
- OI-6 is open. `ml-service/config/label_approval.json` is `BLOCKED`, with `approved_by`, `approved_at` and `evidence_reference` set to `null`. An approval is accepted only if `status` is exactly `APPROVED` and all three fields contain genuine, non-placeholder values with a parseable ISO-8601 timestamp. `assert_training_allowed()` permits rule-label runs as experimental sandbox only; `assert_production_approval()` and `artifact_ready_for_serving()` keep activation and inference blocked.

## 4. Validation and leakage strategy

1. A deterministic holdout is split before preprocessing.
2. Preprocessing (`SimpleImputer`, `StandardScaler`, `OneHotEncoder`) is fitted **inside each CV fold and on the final training split only**. Tests instrument `build_preprocessor` to confirm that fold training sizes differ, proving the pipeline is not pre-fitted on all rows.
3. Only the exact requested target column and its explicitly mapped companion target are removed. Unrelated columns whose names contain `score` are retained as ordinary features.
4. Every candidate reports held-out accuracy/F1/precision/recall/ROC-AUC and a confusion matrix (classification) or R²/MAE/RMSE/MSE (regression), plus per-fold and mean/std CV metrics. Holdout metrics rank candidates; metrics are sandbox/candidate-selection evidence, not calibrated production estimates.
5. Imbalance handling is recorded per run: balanced estimator weights, XGBoost `scale_pos_weight` for binary targets, and stratified split/CV for multiclass. No silent fallback model or fabricated metric is produced.
6. Post-split class counts are checked against `cv_folds`, and the executed splitter (`stratified_kfold` or `kfold`) is persisted instead of echoing an unsupported request string.
7. Serving is stricter than listing: `/predict` validates the frozen column list/order and schema version, then rejects any bundle lacking a version, CV metrics, leakage checks and a live-approved label policy, even when an explicit `model_id` is supplied. Activation additionally requires a versioned, production-mode Supabase registry row with complete OI-6 approval.

### Background execution (FR-4.7 operational contract)

`POST /train` registers a job and calls FastAPI `background_tasks.add_task(...)`; work runs after the queued response is returned. The API exposes `queued`, `running`, `completed` and `failed` states via `GET /train/{job_id}` and `GET /jobs`, rejects duplicate active jobs for the same dataset/target/problem with `409`, and stores only a bounded sanitized exception summary on failure. The Next.js admin UI polls the real job state and displays no simulated progress. Registry metadata is written by `/api/ml/train/sync` only after the service reports a completed job; the client cannot forge results or approval.

Jobs, dataset entries and the active model id live in process memory only. They are lost on restart, are not shared between uvicorn workers, and are not a durable job queue. A production deployment needs an auditable durable store.

## 5. Risk bands, explainability and disclaimers

The single validated contract version is `v1.0-srs-fr4.4`. Scores are clamped to `[0,1]` and rounded to two decimals before classification.

| Score | `risk_level` | Risk label | Feasibility vocabulary |
| --- | --- | --- | --- |
| 0.75–1.00 | `low` | Low risk | High Feasibility |
| 0.55–0.74 | `moderate` | Moderate | Medium Feasibility |
| 0.35–0.54 | `high` | High | Low Feasibility |
| 0.00–0.34 | `critical` | Critical | Not Feasible |

Explainability is deliberately limited: global importances come from an accepted artifact when available; local factors are documented rule context and show method `disclosure` / `not SHAP`. Rent, demand and rating gaps are named as unavailable. The provisional index averages only available drivers and records `missing_drivers`; when essential budget or in-scope demand inputs are absent it writes a `scoring_mode: unavailable` report with `score_value: null`, full provenance and the same disclaimers rather than a neutral score. Both customer and admin screens display `Estimate based on a model trained on limited data`; the customer report additionally states that the MCDA index is not a calibrated supervised probability.

## 6. Versioning, migration and rollback

- `config/module4-scoring.json` is the shared cross-language scoring contract; TypeScript and Python copies are asserted equal by tests.
- `supabase/migrations/20261125130000_module4_model_pipeline_hardening.sql` and `supabase/migrations/20261126140000_task5_provenance_hardening.sql` are forward-only and additive. New columns are nullable or have non-destructive defaults; approval defaults to `BLOCKED`, training mode to `experimental_sandbox`. Existing rows and permissions are not widened.
- `public.ml_scoring_config_versions` has RLS enabled/forced: authenticated read, admin-only insert, immutable unique version and a CHECK that rejects missing, non-numeric or unordered boundaries even for direct SQL writes. Rollback SQL is in the migration header; it must only be run after application code is reverted.
- Model activation is explicit. Removing `ACTIVE_MODEL_ID` auto-promotion prevents a candidate from silently becoming the serving model.
- Each best-candidate bundle stores schema/artifact versions, UUID model id and timestamp, target and frozen feature columns, preprocessing pipeline, library versions, dataset fingerprint/reference, provenance, OI-6 snapshot, training mode, CV and holdout metrics, comparison report path and disclaimer. A separate JSON comparison report stores all candidates, CV folds, ineligible candidates, XGBoost status and the sandbox disclaimer.
- Legacy committed `.joblib` artifacts and the stale demo CSV were removed from source control and are now ignored. The Python service regenerates a synthetic sandbox CSV at runtime; no model artifact, comparison JSON or private dataset is committed.

## 7. Security and operational limits

- All ML routes require a verified session plus an admin profile check on the Next.js side; the FastAPI service requires a non-placeholder `x-api-key` and a strict origin allowlist. Both denylists include `123456`, errors never echo configured secrets, and caller headers cannot override `x-api-key`.
- `/api/ml/predict` is an admin sandbox and never writes a project feasibility report. It validates numeric bounds and approved categories on the server, forwards the live admin threshold contract, and returns explicit `sandbox_only`, `project_report_persisted` and applied/artifact threshold versions.
- `/api/admin/scoring-thresholds` validates on the server; client-side role checks are not authoritative. Duplicate versions return `409`, including a concurrent unique-violation race.
- Upload size is enforced while streaming, not only from the client-reported `file.size`.
- Feature ownership is checked before scoring: a processing run from another project returns `403`.
- Live Overpass/Pytrends calls, live Supabase/RLS runtime behaviour, deployment checks and migration-from-empty execution are **not** proven by static or mocked automated tests and are reported separately as NOT RUN.
- GitHub Actions is wired for lint, typecheck, Node suites, Python ML and security suites, XGBoost import and Next.js build; the final commit's workflow result is recorded in the Task 5 delivery report. Live deployment itself is not executed here.

## 8. Automation commands

```bash
node --test tests/module4-feature-engineering.test.mjs
python ml-service/test_pipeline.py
python ml-service/test_auth_security.py
node --test tests/*.mjs
node scripts/verify-module3.mjs
npx tsc --noEmit
npm run lint
npm run build
```

## 9. Exact fixture metrics (not production estimates)

The pipeline test uses deterministic synthetic **generic sandbox** fixtures (`numpy` seed `11`, `n=120`, three stratified folds, 96/24 holdout). These numbers prove candidate comparison, metric persistence and reproducibility only; they are not feasibility-label metrics and are not calibrated production evidence.

| Fixture | Metric | Exact value |
| --- | --- | --- |
| Classification holdout (`logistic_regression`) | Accuracy / weighted F1 / weighted precision / weighted recall | `0.5` / `0.4857` / `0.5` / `0.5` |
| Classification holdout | ROC AUC | `0.5972` |
| Classification CV (`3` folds) | F1 mean / standard deviation | `0.3869` / `0.0789` |
| Regression holdout (`linear_regression`) | R² / MAE / RMSE / MSE | `-0.0316` / `0.7365` / `0.9536` / `0.9093` |

The negative regression R² is reported as-is: the fixture is deliberately small and is not presented as evidence that a useful feasibility model exists. The automated suite uses generic sandbox targets. A separate manual smoke run exercised the rule-generated feasibility targets in `experimental_sandbox` mode; its metrics are recorded in `docs/task5-final-report.md` and are not production evidence. No XGBoost artifact was promoted or activated.

See the final Task 5 delivery report for the PASS/FAIL/NOT RUN result of each command in the delivered revision.
