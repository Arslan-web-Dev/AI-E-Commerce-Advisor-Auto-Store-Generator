# Deferred Supervised Training Contract

**Status:** `BLOCKED_OI6_PIPELINE_READY`

## Overview

The system currently uses an explicitly labelled **Provisional MCDA index** (`provisional_mcda:v1.0-mcda`) for project feasibility reports. Task 5 delivered the FR-4 feature/training/versioning infrastructure, but supervised feasibility training and serving are still blocked.

Two separate gates apply:

1. **OI-6 decision gate:** there is no recorded supervisor approval for the rule-generated label formula, weights, or legacy class boundaries. The formula is preserved verbatim in `docs/module-4-label-approval-proposal.md`; `ml-service/config/label_approval.json` remains `BLOCKED`.
2. **Evidence gate:** even if OI-6 approved the rule labels, a model trained on them would learn the rule formula, not observed commercial outcomes. Any such artifact would be sandbox-only unless an outcome-labelled dataset and calibration evidence are also supplied.

## What exists now

- `ml-service/models/trainer.py` supports classification/regression candidate comparison, deterministic holdout splits and cross-validation with preprocessing fitted inside each fold. Per-fold and aggregate CV metrics plus held-out metrics are persisted on versioned artifacts.
- `ml-service/models/label_policy.py` fails closed for `feasibility_class` and `feasibility_score` while OI-6 is blocked. Generic sandbox targets are allowed to validate the pipeline, but their artifacts are not production feasibility models.
- `artifact_ready_for_serving()` re-reads the live policy and rejects unversioned artifacts, artifacts without CV metrics, artifacts with target-leak features, feasibility-label artifacts without approval, and any rule-label bundle derived from the synthetic sandbox. Training no longer auto-promotes a candidate.
- `src/app/api/ml/predict` is an admin sandbox only and does not write project reports. It rejects non-serving-ready artifacts even with an explicit `model_id` and applies the live admin threshold contract. Customer reports continue to be written by `/api/projects/[id]/feasibility`.
- FR-4.4 risk bands are shared by TypeScript, Python and both UIs; local explanations are documented rule context, not SHAP.

## Prerequisites for production supervised inference

1. **OI-6 decision:** an explicit approval, rejection or amendment of the rule-generated label formula and weights, with approver, timestamp and evidence reference recorded in `ml-service/config/label_approval.json`.
2. **Suitable dataset:** real, documented, lawful records with outcome labels (for example, survival beyond 12 months or verified ROI). Synthetic curve-generated labels are not ground truth.
3. **Schema mapping:** feature columns must map explicitly to `project_features` and its `engineered_vector`. Target-derived companions must be excluded precisely, not by broad name matching.
4. **Evaluation:** time-aware or otherwise leakage-safe CV plus held-out metrics; probability calibration (for example Brier score/calibration curve) before any output is described as a probability of success.
5. **Serving readiness:** a versioned artifact with fingerprint, provenance, metrics, no leaky features and an explicit approval state; activation must be a separate audited admin action.
6. **Runtime evidence:** live Supabase/RLS, migration-from-empty and deployment checks must be executed. Mocked/static tests are not runtime proof.

## Model lifecycle and rollback

1. Train and compare candidates only after the applicable gate allows it.
2. Register the artifact via the admin model API with `scoring_mode: "supervised_model"`, `artifact_version`, `artifact_sha256`, `dataset_fingerprint`, `label_approval_status`, CV metrics and held-out metrics.
3. Activate explicitly only when `artifact_ready_for_serving` passes. No candidate is auto-promoted.
4. Keep `provisional_mcda` as the current report mode for valid inputs; write an explicit `unavailable` report (null score and full provenance) when essential budget or in-scope demand drivers are absent. Do not fall back to a supervised artifact that is absent, unapproved, out of distribution or unhealthy.

No placeholder model, fabricated metric, SHAP claim or calibrated probability has been created. See `docs/module-4-ml-pipeline.md` for implementation and verification details.
