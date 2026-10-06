# Deferred Supervised Training Contract

**Status:** `deferred_waiting_for_dataset_and_compute`

## Overview
As evaluated in Module 5's model readiness assessment (`docs/module-5-model-readiness.md`), supervised ML training has been explicitly deferred. The system currently uses a Provisional MCDA index.

This document serves as the handoff contract for future implementation of supervised machine learning inference when conditions are met.

## Prerequisites for Supervised Training

1. **Suitable Dataset:**
   - Must contain real business records, not synthetic dummy records or demo data.
   - Must contain verified ground-truth labels for outcomes (e.g., store stayed open for > 12 months, achieved positive ROI, etc.). The target definition must be approved by the project supervisor.
   - Must have documented provenance, consent, and licensing ensuring data privacy compliance.
   - Must map 1:1 with the existing Module 4 `project_features.engineered_vector` schema (`competitors_count`, `category_saturation`, `budget_ratio`, `avg_demand_index`, `trend_slope_score`).

2. **Evaluation & Metric Standards:**
   - Must handle data splits safely to prevent temporal target leakage (e.g., using time-aware cross-validation).
   - Must evaluate probability calibration (e.g., Brier score, calibration curve) before labeling outputs as "probability of success." Accuracy alone is insufficient.

3. **Compute and Infrastructure:**
   - A compute environment suitable for the selected model (e.g., standard VM for XGBoost/Random Forest, or GPU instances for Neural Networks) must be provisioned.
   - We must not block current system operations waiting for this infrastructure.

## Model Lifecycle and Registry
Once the model is trained offline:
1. **Registration:** Admin will register the model via `POST /api/admin/models` passing `"scoring_mode": "supervised_model"` and a reference to the `training_dataset_ref`.
2. **Inference Activation:** The inference pipeline in `src/lib/scoring/mcda.ts` should be updated to consume the active model via an API call or localized inference endpoint rather than the heuristic calculation.
3. **Rollback:** The system will retain the capability to fallback to `provisional_mcda` if the supervised model begins producing out-of-distribution errors or fails health checks.

No placeholder models or fabricated metrics have been created. This ensures the integrity of the application remains untouched until genuine machine learning can be achieved.
