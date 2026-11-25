"""
Task 5 / Module 4 — Feature Engineering & ML Pipeline regression suite.

Run with: python ml-service/test_pipeline.py

Behavioural checks exercise the real trainer, label gate, explainability and
prediction response contract with small deterministic fixtures. No live Google
Trends, Supabase or network calls are made.
"""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import pandas as pd
import joblib
from fastapi import HTTPException

import main
import models.trainer as trainer
from config import SCORING_CONFIG
from datasets.sample_dataset_generator import (
    CATEGORIES,
    generate_punjab_feasibility_dataset,
)
from models.explainability import compute_local_prediction_factors
from models.label_policy import (
    APPROVED_MODULE4_CATEGORIES,
    LabelApprovalBlocked,
    artifact_ready_for_serving,
    assert_training_allowed,
    load_label_policy,
    target_derived_columns,
)


def check(label, condition, detail=""):
    assert condition, f"FAIL: {label}{(' — ' + detail) if detail else ''}"
    print(f"PASS: {label}")


def test_oi6_label_gate_blocks_feasibility_targets():
    policy = load_label_policy()
    check("OI-6 label policy is BLOCKED by default", policy["status"] == "BLOCKED")
    for target in ("feasibility_class", "feasibility_score"):
        try:
            assert_training_allowed(target)
            raise AssertionError(f"FAIL: {target} training was not blocked")
        except LabelApprovalBlocked as exc:
            check(f"{target} training fails closed", exc.policy["status"] == "BLOCKED")
    decision = assert_training_allowed("generic_sandbox_target")
    check("generic sandbox target is allowed", decision["status"] == "ALLOWED_GENERIC_SANDBOX")


def test_approved_categories_and_risk_bands():
    check(
        "five approved categories are authoritative",
        len(APPROVED_MODULE4_CATEGORIES) == 5,
        ", ".join(APPROVED_MODULE4_CATEGORIES),
    )
    for legacy in ("Fashion & Apparel", "Electronics & Mobile", "Grocery & Gourmet", "Home & Living"):
        check(f"legacy category '{legacy}' removed from generator", legacy not in CATEGORIES)
    check(
        "SRS FR-4.4 risk boundaries are exact",
        SCORING_CONFIG["low_risk_min"] == 0.75
        and SCORING_CONFIG["moderate_risk_min"] == 0.55
        and SCORING_CONFIG["high_risk_min"] == 0.35,
    )
    check(
        "exact limited-data disclaimer is configured",
        SCORING_CONFIG["limited_data_disclaimer"] == "Estimate based on a model trained on limited data",
    )
    policy_row = main.get_training_policy()
    check(
        "training-policy endpoint exposes approved taxonomy and gate",
        policy_row["label_policy"]["status"] == "BLOCKED"
        and policy_row["approved_categories"] == list(APPROVED_MODULE4_CATEGORIES),
    )


def test_sample_dataset_uses_approved_categories_and_preserves_formula():
    df = generate_punjab_feasibility_dataset(num_samples=60, random_seed=7)
    check(
        "sample dataset uses only approved categories",
        set(df["business_category"].unique()).issubset(set(APPROVED_MODULE4_CATEGORIES)),
    )
    check(
        "sample dataset keeps the unapproved rule-label targets",
        {"feasibility_class", "feasibility_score"}.issubset(set(df.columns)),
    )
    # The historical boundaries are preserved, not silently replaced by SRS bands.
    legacy_labels = set(df["feasibility_class"].unique())
    check(
        "legacy class vocabulary is preserved",
        legacy_labels.issubset({"High Feasibility", "Medium Feasibility", "Low Feasibility", "Not Feasible"}),
    )


def test_target_companion_columns_are_precise():
    columns = ["feature_a", "feasibility_score", "logistics_accessibility_score", "budget_score_index"]
    check(
        "only feasibility_score is removed for feasibility_class",
        target_derived_columns("feasibility_class", columns) == ["feasibility_score"],
    )
    check(
        "unrelated score-named features are retained",
        "logistics_accessibility_score" not in target_derived_columns("feasibility_class", columns),
    )


def test_cv_is_fold_local_and_metrics_are_persisted():
    rng = np.random.default_rng(11)
    n = 120
    frame = pd.DataFrame(
        {
            "feature_a": rng.normal(size=n),
            "feature_b": rng.normal(size=n),
            "logistics_accessibility_score": rng.normal(size=n),
            "generic_target": np.where(rng.normal(size=n) > 0, "yes", "no"),
        }
    )

    original_build = trainer.build_preprocessor
    seen_lengths = []

    def tracking_build(df, target_col):
        seen_lengths.append(len(df))
        return original_build(df, target_col)

    trainer.build_preprocessor = tracking_build
    try:
        with tempfile.TemporaryDirectory() as tmp:
            results = trainer.train_and_compare_models(
                df=frame,
                target_col="generic_target",
                problem_type="classification",
                candidate_algorithms=["logistic_regression"],
                cv_folds=3,
                test_size=0.2,
                artifacts_dir=tmp,
                dataset_fingerprint="fixture-sha256",
                dataset_ref="fixture",
            )
    finally:
        trainer.build_preprocessor = original_build

    cv = results["cv_metrics"]
    check("cross-validation fold metrics are persisted", len(cv["fold_metrics"]) == 3)
    check("executed CV strategy is persisted honestly", cv["strategy"] == "stratified_kfold")
    check("CV primary metric is aggregated with spread", "mean" in cv["aggregated_metrics"]["f1"] and "std" in cv["aggregated_metrics"]["f1"])
    check(
        "preprocessing is fitted inside each fold",
        min(seen_lengths) < max(seen_lengths),
        f"observed training sizes: {sorted(set(seen_lengths))}",
    )
    check(
        "unrelated score-named feature is available to the model",
        "logistics_accessibility_score" in results["feature_names"],
    )
    metrics = results["test_metrics"]
    check(
        "classification metrics cover accuracy, F1, precision and recall",
        all(key in metrics for key in ("accuracy", "f1", "precision", "recall")),
    )
    check("holdout split sizes are reported", results["sample_split"]["train_size"] + results["sample_split"]["test_size"] == n)
    check("dataset fingerprint is carried into results", results["dataset_fingerprint"] == "fixture-sha256")
    check("artifact version is generated", bool(results["artifact_version"]))
    print(
        "  fixture classification holdout: "
        f"accuracy={metrics['accuracy']}, f1={metrics['f1']}, "
        f"precision={metrics['precision']}, recall={metrics['recall']}, "
        f"roc_auc={metrics['roc_auc']}, split={results['sample_split']['train_size']}/{results['sample_split']['test_size']}"
    )
    print(
        "  fixture classification CV f1: "
        f"mean={cv['aggregated_metrics']['f1']['mean']:.4f}, "
        f"std={cv['aggregated_metrics']['f1']['std']:.4f}, folds={len(cv['fold_metrics'])}"
    )

    with tempfile.TemporaryDirectory() as tmp:
        reg = trainer.train_and_compare_models(
            df=pd.DataFrame({"x": rng.normal(size=80), "generic_score": rng.normal(size=80)}),
            target_col="generic_score",
            problem_type="regression",
            candidate_algorithms=["linear_regression"],
            cv_folds=3,
            artifacts_dir=tmp,
        )
    check(
        "regression comparison reports R2 and RMSE",
        "r2" in reg["test_metrics"] and "rmse" in reg["test_metrics"],
    )
    print(
        "  fixture regression holdout: "
        f"r2={reg['test_metrics']['r2']}, mae={reg['test_metrics']['mae']}, "
        f"rmse={reg['test_metrics']['rmse']}, mse={reg['test_metrics']['mse']}"
    )


def test_failed_training_paths():
    frame = pd.DataFrame({"x": [1, 2, 3, 4], "generic_target": ["a", "a", "a", "a"]})
    try:
        trainer.train_and_compare_models(frame, "generic_target", "classification", ["logistic_regression"], cv_folds=2)
        raise AssertionError("FAIL: single-class classification was accepted")
    except ValueError:
        check("single-class classification is rejected", True)

    try:
        trainer.train_and_compare_models(frame, "missing_target", "classification", ["logistic_regression"])
        raise AssertionError("FAIL: missing target was accepted")
    except ValueError:
        check("missing target column is rejected", True)

    try:
        trainer.train_and_compare_models(
            frame,
            "generic_target",
            "classification",
            ["logistic_regression"],
            cv_folds=2,
            validation_strategy="shuffle_split",
        )
        raise AssertionError("FAIL: unsupported validation strategy was accepted")
    except ValueError:
        check("unsupported validation strategy is rejected", True)


def test_artifact_activation_gate():
    check("legacy unversioned bundle is not serving-ready", artifact_ready_for_serving({"model_id": "legacy", "target_col": "feasibility_class", "feature_names": ["feasibility_score"]}) is False)
    check(
        "unapproved feasibility-label bundle is not serving-ready",
        artifact_ready_for_serving({
            "artifact_version": "v1",
            "cv_metrics": {"mean_cv_score": 0.5},
            "target_col": "feasibility_class",
            "feature_names": ["feature_a"],
            "label_approval_status": "BLOCKED",
        }) is False,
    )
    check(
        "leaky feasibility bundle is not serving-ready",
        artifact_ready_for_serving({
            "artifact_version": "v1",
            "cv_metrics": {"mean_cv_score": 0.5},
            "target_col": "feasibility_class",
            "feature_names": ["feasibility_score"],
            "label_approval_status": "APPROVED",
        }) is False,
    )
    check(
        "stale APPROVED stamp fails closed when live OI-6 is BLOCKED",
        artifact_ready_for_serving({
            "artifact_version": "v1",
            "cv_metrics": {"mean_cv_score": 0.5},
            "target_col": "feasibility_class",
            "feature_names": ["feature_a"],
            "label_approval_status": "APPROVED",
        }) is False,
    )
    check(
        "versioned generic bundle is serving-ready",
        artifact_ready_for_serving({
            "artifact_version": "v1",
            "cv_metrics": {"mean_cv_score": 0.5},
            "target_col": "generic_target",
            "feature_names": ["feature_a"],
        }) is True,
    )


def test_explanations_report_missing_values_honestly():
    factors = compute_local_prediction_factors({}, [], "unknown")
    text = " ".join(str(f["explanation"]) for f in factors)
    check("missing local inputs are reported as unavailable", "unavailable" in text.lower())
    check("no synthetic factor is asserted for missing rent", "no regional value was substituted" in text.lower())
    check(
        "local factors disclose non-SHAP method",
        any(f.get("method") == "disclosure" and "not SHAP" in f["explanation"] for f in factors),
    )
    populated = compute_local_prediction_factors(
        {"runway_months": 18, "commercial_rent_sqft_pkr": 300, "online_search_interest": 90},
        [],
        "unknown",
    )
    check(
        "known inputs still produce directional context",
        any(f["impact"] == "positive" for f in populated)
        and any(f["impact"] == "negative" for f in populated),
    )


class _StubPipeline:
    def __init__(self, value):
        self.value = value
        self.classes_ = ["a", "b"]

    def predict(self, _df):
        return [self.value]

    def predict_proba(self, _df):
        return [[0.9, 0.1]]


def test_prediction_contract_uses_srs_risk_bands():
    original_dir = main.ARTIFACTS_DIR
    original_active = main.ACTIVE_MODEL_ID
    try:
        with tempfile.TemporaryDirectory() as tmp:
            main.ARTIFACTS_DIR = Path(tmp)
            bundle = {
                "model_id": "contract-model",
                "artifact_version": "contract-model-v1",
                "name": "Contract fixture",
                "algorithm_key": "fixture",
                "problem_type": "regression",
                "target_col": "generic_score",
                "feature_names": ["feature_a"],
                "pipeline": _StubPipeline(0.80),
                "global_importances": [],
                "metrics": {},
                "cv_metrics": {"strategy": "kfold", "fold_metrics": [{"r2": 0.5}]},
                "label_approval_status": "BLOCKED",
            }
            joblib.dump(bundle, main.ARTIFACTS_DIR / "fixture.joblib")
            main.ACTIVE_MODEL_ID = "contract-model"

            result = main.predict_feasibility(main.PredictRequest(input_features={"feature_a": 1.0}))
            check("prediction score is rounded to two decimals", result["feasibility_score"] == 0.8)
            check("0.80 maps to Low risk", result["risk_level"] == "low")
            check("artifact version is returned", result["artifact_version"] == "contract-model-v1")
            check("threshold version is returned", result["threshold_version"] == SCORING_CONFIG["version"])
            check("limited-data disclaimer is returned", result["disclaimer"] == "Estimate based on a model trained on limited data")
            check("sandbox-only contract is explicit", result["sandbox_only"] is True and result["project_report_persisted"] is False)

            custom = {
                "version": "v-test-thresholds",
                "low_risk_min": 0.9,
                "moderate_risk_min": 0.6,
                "high_risk_min": 0.3,
            }
            custom_result = main.predict_feasibility(
                main.PredictRequest(
                    input_features={"feature_a": 1.0},
                    risk_thresholds=custom,
                )
            )
            check("admin threshold version reaches the Python scorer", custom_result["threshold_version"] == "v-test-thresholds")
            check("custom bands are applied to the same score", custom_result["risk_level"] == "moderate")

            try:
                main.predict_feasibility(
                    main.PredictRequest(input_features={"feature_a": 1.0}, risk_thresholds={
                        "version": "bad", "low_risk_min": 0.5,
                        "moderate_risk_min": 0.9, "high_risk_min": 0.3,
                    })
                )
                raise AssertionError("FAIL: unordered thresholds were accepted")
            except HTTPException as exc:
                check("unordered thresholds are rejected at inference", exc.status_code == 422)

            legacy_bundle = dict(bundle)
            legacy_bundle.update({
                "model_id": "legacy-class-model",
                "target_col": "feasibility_class",
                "feature_names": ["feasibility_score"],
                "label_approval_status": "BLOCKED",
            })
            joblib.dump(legacy_bundle, main.ARTIFACTS_DIR / "legacy.joblib")
            try:
                main.predict_feasibility(
                    main.PredictRequest(
                        model_id="legacy-class-model",
                        input_features={"feature_a": 1.0},
                    )
                )
                raise AssertionError("FAIL: explicit model_id bypassed the serving gate")
            except HTTPException as exc:
                check("explicit model_id cannot bypass the serving gate", exc.status_code == 422)

            try:
                main.predict_feasibility(
                    main.PredictRequest(
                        input_features={"feature_a": 1.0, "business_category": "Fashion & Apparel"}
                    )
                )
                raise AssertionError("FAIL: legacy category was accepted at inference")
            except HTTPException as exc:
                check("legacy category is rejected at inference", exc.status_code == 422)

            check(
                "legacy artifact never auto-activates on restart",
                artifact_ready_for_serving({"model_id": "legacy"}) is False,
            )
    finally:
        main.ARTIFACTS_DIR = original_dir
        main.ACTIVE_MODEL_ID = original_active


def run_test():
    print("\n================ TASK 5 MODULE 4 ML PIPELINE TESTS ================")
    test_oi6_label_gate_blocks_feasibility_targets()
    test_approved_categories_and_risk_bands()
    test_sample_dataset_uses_approved_categories_and_preserves_formula()
    test_target_companion_columns_are_precise()
    test_cv_is_fold_local_and_metrics_are_persisted()
    test_failed_training_paths()
    test_artifact_activation_gate()
    test_explanations_report_missing_values_honestly()
    test_prediction_contract_uses_srs_risk_bands()
    print("================ ALL MODULE 4 ML PIPELINE TESTS PASSED ================\n")


if __name__ == "__main__":
    run_test()
