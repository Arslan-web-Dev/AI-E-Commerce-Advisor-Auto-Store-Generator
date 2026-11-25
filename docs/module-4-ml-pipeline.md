# Task 5 / Module 4 — Feature Engineering and ML Model Pipeline

**Authority:** `docs/FINAL_DELIVERY_BASELINE.md` and the user-supplied October 2026 SRS/SDD v1.0. Older repository documents that place scoring in “Module 5” use a legacy numbering alias; in the source SRS, feature engineering and the feasibility model are FR-4.1–FR-4.8.

**Important status:** the FR-4 infrastructure is implemented and tested. **Supervised feasibility training and serving remain BLOCKED by OI-6.** No production feasibility model has been trained, activated, or reported as calibrated. Customer/project scoring still uses the explicitly labelled provisional MCDA index.

## 1. FR coverage

| FR | Implementation | Evidence / limitation |
| --- | --- | --- |
| FR-4.1 | Eight explicit unit-bearing features persisted on `project_features`, plus the stable bounded `engineered_vector`. Stale/cross-region demand vectors stay `null`. | `src/lib/data-processing/feature-engineer.ts`, `src/lib/data-processing/trend-validity.ts`, `src/types/feature-processing.ts`, migration `20261125130000_module4_model_pipeline_hardening.sql`, `tests/module4-feature-engineering.test.mjs`. |
| FR-4.2 | Deduplication, domain quality scoring and provenance breakdown retained; unavailable sources stay `N/A`/`null` and are named in `domain_completeness.missing_fields`. No synthetic benchmark is used as a local observation. | `src/lib/data-processing/cleaner.ts`, `deduplicator.ts`, existing quality tests. The legacy `imputations_count` field now counts unavailable components for compatibility, not fabricated replacements. |
| FR-4.3 | Classification and regression candidate comparison, stratified/K-fold CV, fold-local preprocessing, persisted per-fold and aggregate CV metrics, held-out metrics and artifact fingerprints. | `ml-service/models/trainer.py`. `feasibility_class` / `feasibility_score` targets fail closed until OI-6 approval; only generic sandbox targets may be trained. The installed service uses scikit-learn candidates; no XGBoost package or XGBoost artifact is claimed. |
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
- The Python sample generator creates **synthetic sandbox rows only** for five approved categories: Grocery / General Stores, Clothing / Footwear, Mobile Phones / Accessories, Restaurants / Cafes, Pharmacies / Medical Stores. Legacy six-category labels were removed.
- The pre-existing rule-label formula and its `0.35 / 0.25 / 0.25 / 0.15` weights, Gaussian noise and legacy class boundaries are preserved verbatim in `docs/module-4-label-approval-proposal.md`. Task 5 did not change them.
- OI-6 is open. `ml-service/config/label_approval.json` is `BLOCKED`; an incomplete approval (missing timestamp, approver or evidence) is treated as blocked. `assert_training_allowed()` rejects feasibility targets and `artifact_ready_for_serving()` rejects unversioned, leaky or unapproved feasibility bundles.

## 4. Validation and leakage strategy

1. A deterministic holdout is split before preprocessing.
2. Preprocessing (`SimpleImputer`, `StandardScaler`, `OneHotEncoder`) is fitted **inside each CV fold and on the final training split only**. Tests instrument `build_preprocessor` to confirm that fold training sizes differ, proving the pipeline is not pre-fitted on all rows.
3. Only the exact requested target column and its explicitly mapped companion target are removed. Unrelated columns whose names contain `score` are retained as ordinary features.
4. Every candidate reports held-out accuracy/F1/precision/recall (classification) or R²/MAE/RMSE (regression), plus per-fold and mean/std CV metrics. Metrics are sandbox/candidate-selection evidence, not calibrated production estimates.
5. Training and comparison failures return errors; no silent fallback model or fabricated metric is produced.
6. Post-split class counts are checked against `cv_folds`, and the executed splitter (`stratified_kfold` or `kfold`) is persisted instead of echoing an unsupported request string.
7. Serving is stricter than listing: `/predict` rejects any bundle lacking a version, CV metrics, leakage checks and a live-approved label policy, even when an explicit `model_id` is supplied. Activation additionally requires a versioned Supabase registry row with `label_approval_status = APPROVED`.

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
- `supabase/migrations/20261125130000_module4_model_pipeline_hardening.sql` is forward-only and additive. New columns are nullable except the registry approval state, which defaults to `BLOCKED`. Existing rows and permissions are not widened.
- `public.ml_scoring_config_versions` has RLS enabled/forced: authenticated read, admin-only insert, immutable unique version and a CHECK that rejects missing, non-numeric or unordered boundaries even for direct SQL writes. Rollback SQL is in the migration header; it must only be run after application code is reverted.
- Model activation is explicit. Removing `ACTIVE_MODEL_ID` auto-promotion prevents a candidate from silently becoming the serving model.
- Legacy committed `.joblib` artifacts and the stale demo CSV were removed from source control and are now ignored. The Python service regenerates a synthetic sandbox CSV at runtime; no model artifact or private dataset is committed.

## 7. Security and operational limits

- All ML routes require a verified session plus an admin profile check on the Next.js side; the FastAPI service requires a non-placeholder `x-api-key` and a strict origin allowlist. Both denylists include `123456`, errors never echo configured secrets, and caller headers cannot override `x-api-key`.
- `/api/ml/predict` is an admin sandbox and never writes a project feasibility report. It validates numeric bounds and approved categories on the server, forwards the live admin threshold contract, and returns explicit `sandbox_only`, `project_report_persisted` and applied/artifact threshold versions.
- `/api/admin/scoring-thresholds` validates on the server; client-side role checks are not authoritative. Duplicate versions return `409`, including a concurrent unique-violation race.
- Upload size is enforced while streaming, not only from the client-reported `file.size`.
- Feature ownership is checked before scoring: a processing run from another project returns `403`.
- Live Overpass/Pytrends calls, live Supabase/RLS runtime behaviour, deployment checks and migration-from-empty execution are **not** proven by static or mocked automated tests and are reported separately as NOT RUN.
- `gh` is unavailable in this environment, so GitHub Actions/deployment checks cannot be verified here.

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

The negative regression R² is reported as-is: the fixture is deliberately small and is not presented as evidence that a useful feasibility model exists. No feasibility target was trained, no XGBoost artifact was produced and no model was promoted.

See the final Task 5 delivery report for the PASS/FAIL/NOT RUN result of each command in the delivered revision.
