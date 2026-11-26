"""
Task 5 / Module 4 — Feature Engineering & ML Pipeline regression suite.

Run with: python ml-service/test_pipeline.py

Covers FR-4.1..FR-4.8 with deterministic fixtures: synthetic dataset contract,
fold-local preprocessing, 8x8 candidate registry (including XGBoost), OI-6
approval semantics, genuine background training jobs, activation/prediction
gates and security boundaries. No live Google Trends, Supabase or network calls.
"""

import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))

import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException
from fastapi.testclient import TestClient

import main
import models.trainer as trainer
from config import (
    ARTIFACT_SCHEMA_VERSION,
    DATASET_SCHEMA_VERSION,
    FEATURE_SCHEMA_VERSION,
    SCORING_CONFIG,
)
from datasets.sample_dataset_generator import (
    CATEGORIES,
    assert_synthetic_only,
    dataset_schema,
    generate_punjab_feasibility_dataset,
    load_dataset_metadata,
    save_sample_dataset,
    validate_dataset,
)
from models.candidate_models import (
    CLASSIFICATION_CANDIDATES,
    INELIGIBLE_CANDIDATES,
    REGRESSION_CANDIDATES,
    XGBOOST_AVAILABLE,
    candidate_catalog,
    get_candidate_models,
)
from models.explainability import compute_local_prediction_factors
from models.label_policy import (
    APPROVED_MODULE4_CATEGORIES,
    LabelApprovalBlocked,
    artifact_ready_for_serving,
    assert_production_approval,
    assert_training_allowed,
    evaluate_label_policy,
    load_label_policy,
    target_derived_columns,
)
from models.preprocessor import build_preprocessor, validate_input_schema


def check(label, condition, detail=""):
    assert condition, f"FAIL: {label}{(' — ' + detail) if detail else ''}"
    print(f"PASS: {label}")


def test_synthetic_dataset_contract():
    policy = load_label_policy()
    check("OI-6 label policy is BLOCKED by default", policy["status"] == "BLOCKED")
    check(
        "OI-6 records exactly which fields are missing",
        set(policy["oi6_validation"]["reasons"]) == {
            "status must be exactly APPROVED",
            "approved_by must name a real approver",
            "approved_at must be a real timestamp",
            "evidence_reference must point to a genuine approval record",
        },
    )

    df = generate_punjab_feasibility_dataset(num_samples=80, random_seed=7, missing_rate=0.02)
    check("dataset generator is configurable", len(df) == 80)
    replay = generate_punjab_feasibility_dataset(num_samples=80, random_seed=7, missing_rate=0.02)
    check("generator is reproducible for a fixed seed", df.equals(replay))
    check("every row is explicitly synthetic", set(df["data_source"]) == {"synthetic"})
    check("dataset schema version is stamped", set(df["schema_version"]) == {DATASET_SCHEMA_VERSION})
    check(
        "sample uses only the five approved categories",
        set(df["business_category"]).issubset(set(CATEGORIES))
        and len(CATEGORIES) == 5
        and tuple(CATEGORIES) == APPROVED_MODULE4_CATEGORIES,
    )
    check(
        "legacy class vocabulary is preserved",
        set(df["feasibility_class"]).issubset(
            {"High Feasibility", "Medium Feasibility", "Low Feasibility", "Not Feasible"}
        ),
    )
    check("generated sandbox passes its own schema contract", validate_dataset(df)["valid"] is True)
    schema = dataset_schema()
    check(
        "machine-readable schema declares provenance and synthetic-only status",
        schema["data_source"] == "synthetic"
        and schema["no_verified_records"] is True
        and schema["target_approval"] == "BLOCKED_OI6"
        and "provenance_columns" in schema,
    )
    documented_columns = {
        column
        for group in schema["groups"].values()
        for column in group
    } | set(schema["target_columns"])
    check(
        "machine-readable schema covers every generated column exactly",
        documented_columns == set(df.columns)
        and len(df.columns) == 41,
        f"documented={len(documented_columns)}, generated={len(df.columns)}",
    )

    bad_source = df.copy()
    bad_source.loc[0, "data_source"] = "verified_market"
    check("mixed source rows fail validation", validate_dataset(bad_source)["valid"] is False)
    try:
        assert_synthetic_only(bad_source)
        raise AssertionError("FAIL: mixed-source dataset was accepted")
    except ValueError:
        check("mixed synthetic/real data is rejected", True)

    bad_category = df.copy()
    bad_category.loc[0, "business_category"] = "Fashion & Apparel"
    check("unapproved category fails validation", validate_dataset(bad_category)["valid"] is False)

    duplicated = pd.concat([df, df.iloc[[0]]], ignore_index=True)
    check("duplicate rows are detected", validate_dataset(duplicated)["duplicate_rows"] == 1)

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "synthetic.csv"
        save_sample_dataset(path, num_samples=25, random_seed=3)
        metadata = load_dataset_metadata(path)
        check("dataset sidecar records source, schema and fingerprint", metadata["data_source"] == "synthetic" and bool(metadata["dataset_fingerprint"]) and metadata["schema_version"] == DATASET_SCHEMA_VERSION)
        check("sidecar explicitly denies approval", metadata["dataset_provenance"]["approved_for_production"] is False)
        report = main.inspect_dataset(path)
        check("inspection endpoint surfaces provenance", report["data_source"] == "synthetic" and report["data_quality_report"]["schema_validation"]["valid"] is True)


def test_oi6_approval_and_training_semantics():
    complete = {
        "status": "APPROVED",
        "approved_by": "Named Supervisor",
        "approved_at": "2026-11-01T09:30:00Z",
        "evidence_reference": "signed-approval-oi6-001",
        "target_scope": ["feasibility_class", "feasibility_score"],
    }
    check("a complete genuine approval validates", evaluate_label_policy(complete, "feasibility_class")["approved"] is True)
    for field in ("status", "approved_by", "approved_at", "evidence_reference"):
        incomplete = dict(complete)
        incomplete[field] = None if field != "status" else "PENDING"
        check(f"approval fails closed without {field}", evaluate_label_policy(incomplete, "feasibility_class")["approved"] is False)
    placeholder = dict(complete, approved_by="TBD", evidence_reference="n/a")
    check("placeholder approval values are rejected", evaluate_label_policy(placeholder, "feasibility_class")["approved"] is False)
    malformed_date = dict(complete, approved_at="not-a-date")
    check("malformed approval timestamp is rejected", evaluate_label_policy(malformed_date, "feasibility_class")["approved"] is False)

    for target in ("feasibility_class", "feasibility_score"):
        decision = assert_training_allowed(target, {"is_sample": True})
        check(f"{target} experimental training is allowed", decision["status"] == "ALLOWED_EXPERIMENTAL_SANDBOX" and decision["approved_for_production"] is False)
        try:
            assert_production_approval(target)
            raise AssertionError(f"FAIL: {target} production activation was allowed")
        except LabelApprovalBlocked:
            check(f"{target} production activation is blocked", True)

    generic = assert_training_allowed("generic_sandbox_target")
    check("generic sandbox target remains experimental", generic["status"] == "ALLOWED_EXPERIMENTAL_SANDBOX" and generic["approved_for_production"] is False)


def test_feature_engineering_contract():
    rng = np.random.default_rng(11)
    frame = pd.DataFrame(
        {
            "feature_a": rng.normal(size=120),
            "feature_b": rng.normal(size=120),
            "logistics_accessibility_score": rng.normal(size=120),
            "generic_target": np.where(rng.normal(size=120) > 0, "yes", "no"),
        }
    )
    frame.loc[0:5, "feature_a"] = np.nan
    preprocessor, numeric, categorical = build_preprocessor(frame, "generic_target")
    transformed_names = preprocessor.fit_transform(frame.drop(columns=["generic_target"]))
    check("missing indicators are explicit in the contract", any("missingindicator" in name for name in preprocessor.get_feature_names_out()))
    check("numeric and categorical features are partitioned", "feature_a" in numeric and "generic_target" not in numeric)

    try:
        validate_input_schema(pd.DataFrame([{"feature_a": 1, "unexpected": 2}]), ["feature_a"], FEATURE_SCHEMA_VERSION, FEATURE_SCHEMA_VERSION)
        raise AssertionError("FAIL: extra prediction feature was accepted")
    except ValueError:
        check("unknown prediction columns are rejected", True)
    try:
        validate_input_schema(pd.DataFrame([{"feature_a": 1}]), ["feature_a"], FEATURE_SCHEMA_VERSION, "old-schema")
        raise AssertionError("FAIL: mismatched schema version was accepted")
    except ValueError:
        check("stale feature schema version is rejected", True)
    check("valid prediction schema passes", validate_input_schema(pd.DataFrame([{"feature_a": 1}]), ["feature_a"], FEATURE_SCHEMA_VERSION, FEATURE_SCHEMA_VERSION)["column_count"] == 1)


def test_candidate_catalog_and_all_models_train():
    check("eight classifiers are registered", len(CLASSIFICATION_CANDIDATES) == 8)
    check("eight regressors are registered", len(REGRESSION_CANDIDATES) == 8)
    check("XGBoost is installed and registered", XGBOOST_AVAILABLE and all(key in CLASSIFICATION_CANDIDATES for key in ("xgboost",)) and "xgboost_regressor" in REGRESSION_CANDIDATES)
    check("catalog metadata is serialisable", all("factory" not in spec for spec in candidate_catalog("classification").values()))
    check("ineligible candidates carry auditable reasons", all(spec.get("reason") for spec in INELIGIBLE_CANDIDATES.values()))
    for problem, catalog in (("classification", CLASSIFICATION_CANDIDATES), ("regression", REGRESSION_CANDIDATES)):
        models = get_candidate_models(problem)
        check(f"all {problem} factories instantiate", len(models) == 8 and all(model is not None for model in models.values()))
        check(f"{problem} candidates are deterministic", all(spec["random_state"] == 42 for spec in catalog.values()))

    rng = np.random.default_rng(23)
    n = 120
    frame = pd.DataFrame(
        {
            "feature_a": rng.normal(size=n),
            "feature_b": rng.normal(size=n),
            "logistics_accessibility_score": rng.normal(size=n),
            "generic_target": np.where(rng.normal(size=n) > 0, "yes", "no"),
            "generic_score": rng.normal(size=n),
        }
    )
    frame.loc[0:5, "feature_a"] = np.nan

    original_build = trainer.build_preprocessor
    seen_lengths = []

    def tracking_build(df, target_col):
        seen_lengths.append(len(df))
        return original_build(df, target_col)

    trainer.build_preprocessor = tracking_build
    comparison_tmp = tempfile.TemporaryDirectory()
    try:
        results = trainer.train_and_compare_models(
            df=frame,
            target_col="generic_target",
            problem_type="classification",
            cv_folds=2,
            test_size=0.2,
            artifacts_dir=comparison_tmp.name,
            dataset_fingerprint="fixture-sha256",
            dataset_ref="fixture",
            dataset_info={"is_sample": True, "data_source": "synthetic"},
        )
    finally:
        trainer.build_preprocessor = original_build

    check("all eight classifiers produced results", len(results["leaderboard"]) == 8)
    check("preprocessing is fitted inside each fold", min(seen_lengths) < max(seen_lengths))
    check("unrelated score-named feature is retained", any("logistics_accessibility_score" in name for name in results["feature_names"]))
    cv = results["cv_metrics"]
    check("CV fold metrics and spread are persisted", len(cv["fold_metrics"]) == 2 and "mean" in cv["aggregated_metrics"]["f1"] and "std" in cv["aggregated_metrics"]["f1"])
    check("classification metrics cover accuracy, F1, precision and recall", all(key in results["test_metrics"] for key in ("accuracy", "f1", "precision", "recall")))
    check("confusion matrix is persisted per fold", all("confusion_matrix" in row for row in cv["fold_metrics"]))
    check("experiment is stamped as sandbox", results["training_mode"] == "experimental_sandbox" and results["approved_for_production"] is False)
    check("artifact and feature schemas are stamped", results["feature_schema_version"] == FEATURE_SCHEMA_VERSION)
    check("comparison report is persisted", Path(results["comparison_report_path"]).exists())
    comparison = json.loads(Path(results["comparison_report_path"]).read_text(encoding="utf-8"))
    check("comparison report holds all candidates and ineligible reasons", comparison["candidate_count"] == 8 and bool(comparison["ineligible_candidates"]) and comparison["xgboost"]["available"] is True)
    check("artifact bundle is experimental and not servable", joblib.load(results["artifact_path"])["training_mode"] == "experimental_sandbox")
    check("experiment artifact fails serving gate", artifact_ready_for_serving(joblib.load(results["artifact_path"])) is False)
    comparison_tmp.cleanup()

    with tempfile.TemporaryDirectory() as tmp:
        regression = trainer.train_and_compare_models(
            df=frame,
            target_col="generic_score",
            problem_type="regression",
            cv_folds=2,
            test_size=0.2,
            artifacts_dir=tmp,
            dataset_info={"is_sample": True, "data_source": "synthetic"},
        )
    check("all eight regressors produced results", len(regression["leaderboard"]) == 8)
    check("regression reports R2 and RMSE", all(key in regression["test_metrics"] for key in ("r2", "rmse")))


def test_failed_training_paths():
    frame = pd.DataFrame({"x": [1, 2, 3, 4], "generic_target": ["a", "a", "a", "a"]})
    for description, kwargs in (
        ("single-class classification is rejected", {"target_col": "generic_target", "problem_type": "classification", "candidate_algorithms": ["logistic_regression"], "cv_folds": 2}),
        ("missing target column is rejected", {"target_col": "missing_target", "problem_type": "classification", "candidate_algorithms": ["logistic_regression"]}),
        ("unsupported validation strategy is rejected", {"target_col": "generic_target", "problem_type": "classification", "candidate_algorithms": ["logistic_regression"], "cv_folds": 2, "validation_strategy": "shuffle_split"}),
    ):
        try:
            trainer.train_and_compare_models(frame, **kwargs)
            raise AssertionError(f"FAIL: {description}")
        except ValueError:
            check(description, True)


def test_artifact_activation_gate():
    check("legacy bundle is not serving-ready", artifact_ready_for_serving({"model_id": "legacy", "target_col": "feasibility_class", "feature_names": ["feasibility_score"]}) is False)
    check(
        "unversioned approval bundle is not serving-ready",
        artifact_ready_for_serving({
            "artifact_version": "v1",
            "cv_metrics": {"mean_cv_score": 0.5},
            "target_col": "feasibility_class",
            "feature_names": ["feature_a"],
            "label_approval_status": "APPROVED",
        }) is False,
    )
    check(
        "leaky bundle is not serving-ready",
        artifact_ready_for_serving({
            "artifact_version": ARTIFACT_SCHEMA_VERSION,
            "cv_metrics": {"mean_cv_score": 0.5},
            "feature_columns": ["feature_a"],
            "target_col": "feasibility_class",
            "feature_names": ["feasibility_score"],
            "approved_for_production": True,
            "training_mode": "production",
            "label_approval_status": "APPROVED",
        }) is False,
    )
    check(
        "experimental mode is never serving-ready",
        artifact_ready_for_serving({
            "artifact_version": ARTIFACT_SCHEMA_VERSION,
            "cv_metrics": {"mean_cv_score": 0.5},
            "feature_columns": ["feature_a"],
            "target_col": "feasibility_class",
            "feature_names": ["feature_a"],
            "approved_for_production": False,
            "training_mode": "experimental_sandbox",
            "label_approval_status": "APPROVED",
        }) is False,
    )
    check(
        "synthetic provenance cannot be promoted",
        artifact_ready_for_serving({
            "artifact_version": ARTIFACT_SCHEMA_VERSION,
            "cv_metrics": {"mean_cv_score": 0.5},
            "feature_columns": ["feature_a"],
            "target_col": "feasibility_class",
            "feature_names": ["feature_a"],
            "approved_for_production": True,
            "training_mode": "production",
            "label_approval_status": "APPROVED",
            "training_provenance": {"data_source": "synthetic"},
        }) is False,
    )
    check(
        "target companion columns are precise",
        target_derived_columns("feasibility_class", ["feature", "feasibility_score", "logistics_accessibility_score"]) == ["feasibility_score"],
    )


def test_explanations_report_missing_values_honestly():
    factors = compute_local_prediction_factors({}, [], "unknown")
    text = " ".join(str(f["explanation"]) for f in factors)
    check("missing local inputs are reported as unavailable", "unavailable" in text.lower())
    check("no synthetic factor is asserted for missing rent", "no regional value was substituted" in text.lower())
    check("local factors disclose non-SHAP method", any(f.get("method") == "disclosure" and "not SHAP" in f["explanation"] for f in factors))


class _StubPipeline:
    def __init__(self, value):
        self.value = value
        self.classes_ = ["0.8"]
        self.named_steps = {"model": self}

    def predict(self, _df):
        return [self.value]

    def predict_proba(self, _df):
        return [[1.0]]


def _servable_bundle(**overrides):
    bundle = {
        "model_id": "contract-model",
        "artifact_version": ARTIFACT_SCHEMA_VERSION,
        "artifact_schema_version": ARTIFACT_SCHEMA_VERSION,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "name": "Contract fixture",
        "algorithm_key": "fixture",
        "problem_type": "regression",
        "target_col": "generic_score",
        "feature_columns": ["feature_a"],
        "feature_names": ["feature_a"],
        "pipeline": _StubPipeline(0.80),
        "global_importances": [],
        "metrics": {},
        "cv_metrics": {"strategy": "kfold", "fold_metrics": [{"r2": 0.5}]},
        "label_approval_status": "BLOCKED",
        "approved_for_production": True,
        "training_mode": "production",
        "training_provenance": {"data_source": "uploaded_unverified"},
        "risk_threshold_version": SCORING_CONFIG["version"],
    }
    bundle.update(overrides)
    return bundle


def test_prediction_contract_uses_srs_risk_bands():
    original_dir = main.ARTIFACTS_DIR
    original_active = main.ACTIVE_MODEL_ID
    try:
        with tempfile.TemporaryDirectory() as tmp:
            main.ARTIFACTS_DIR = Path(tmp)
            joblib.dump(_servable_bundle(), main.ARTIFACTS_DIR / "fixture.joblib")
            main.ACTIVE_MODEL_ID = "contract-model"

            result = main.predict_feasibility(main.PredictRequest(input_features={"feature_a": 1.0}, feature_schema_version=FEATURE_SCHEMA_VERSION))
            check("prediction score is rounded to two decimals", result["feasibility_score"] == 0.8)
            check("0.80 maps to Low risk", result["risk_level"] == "low")
            check("feature schema version is returned", result["feature_schema_version"] == FEATURE_SCHEMA_VERSION)
            check("risk bands and disclaimer are returned", result["threshold_version"] == SCORING_CONFIG["version"] and result["disclaimer"] == SCORING_CONFIG["limited_data_disclaimer"])
            check("sandbox-only contract is explicit", result["sandbox_only"] is True and result["project_report_persisted"] is False)

            custom = {"version": "v-test-thresholds", "low_risk_min": 0.9, "moderate_risk_min": 0.6, "high_risk_min": 0.3}
            custom_result = main.predict_feasibility(main.PredictRequest(input_features={"feature_a": 1.0}, risk_thresholds=custom))
            check("admin threshold version reaches the scorer", custom_result["threshold_version"] == "v-test-thresholds")
            check("custom bands are applied to the same score", custom_result["risk_level"] == "moderate")

            try:
                main.predict_feasibility(main.PredictRequest(input_features={"feature_a": 1.0}, risk_thresholds={"version": "bad", "low_risk_min": 0.5, "moderate_risk_min": 0.9, "high_risk_min": 0.3}))
                raise AssertionError("FAIL: unordered thresholds were accepted")
            except HTTPException as exc:
                check("unordered thresholds are rejected at inference", exc.status_code == 422)

            try:
                main.predict_feasibility(main.PredictRequest(input_features={"feature_a": 1.0, "unexpected": 2}))
                raise AssertionError("FAIL: schema drift was accepted")
            except HTTPException as exc:
                check("prediction schema drift is rejected", exc.status_code == 422)

            joblib.dump(_servable_bundle(model_id="legacy-class-model", target_col="feasibility_class", feature_names=["feasibility_score"], feature_columns=["feature_a"], label_approval_status="APPROVED"), main.ARTIFACTS_DIR / "legacy.joblib")
            try:
                main.predict_feasibility(main.PredictRequest(model_id="legacy-class-model", input_features={"feature_a": 1.0}))
                raise AssertionError("FAIL: explicit model_id bypassed the gate")
            except HTTPException as exc:
                check("explicit model_id cannot bypass the serving gate", exc.status_code == 422)

            try:
                main.predict_feasibility(main.PredictRequest(input_features={"feature_a": 1.0, "business_category": "Fashion & Apparel"}))
                raise AssertionError("FAIL: legacy category was accepted")
            except HTTPException as exc:
                check("legacy category is rejected at inference", exc.status_code == 422)
    finally:
        main.ARTIFACTS_DIR = original_dir
        main.ACTIVE_MODEL_ID = original_active


def test_background_job_api_security_and_states():
    client = TestClient(main.app)
    with tempfile.TemporaryDirectory() as tmp:
        csv_path = Path(tmp) / "fixture.csv"
        generate_punjab_feasibility_dataset(num_samples=90, random_seed=5).to_csv(csv_path, index=False)
        dataset_entry = {
            "id": "fixture-ds",
            "file_path": str(csv_path),
            "dataset_fingerprint": "fixture-sha256",
            "columns_metadata": [{"name": "feasibility_score", "type": "float64"}],
            "is_sample": True,
            "data_source": "synthetic",
        }
        original_store = dict(main.DATASETS_STORE)
        original_jobs = dict(main.TRAINING_JOBS)
        try:
            main.DATASETS_STORE.clear()
            main.DATASETS_STORE["fixture-ds"] = dataset_entry
            main.TRAINING_JOBS.clear()

            headers = {"x-api-key": main.ML_SERVICE_API_KEY}
            check("health endpoint is public", client.get("/health").status_code == 200)
            check("missing API key is rejected", client.get("/datasets").status_code == 401)
            check("invalid API key is rejected", client.get("/datasets", headers={"x-api-key": "wrong"}).status_code == 403)

            called = []
            original_task = main._run_training_job_task

            def recording_task(job_id, req):
                called.append((job_id, req))

            main._run_training_job_task = recording_task
            try:
                response = client.post("/train", headers=headers, json={
                    "dataset_id": "fixture-ds",
                    "target_column": "feasibility_score",
                    "problem_type": "regression",
                    "cv_folds": 2,
                })
                check("/train returns a job immediately", response.status_code == 200 and response.json()["status"] == "queued" and bool(response.json()["job_id"]))
                check("training was registered as a background task", len(called) == 1 and called[0][0] == response.json()["job_id"])
                job_id = response.json()["job_id"]
                check("job status is retrievable", client.get(f"/train/{job_id}", headers=headers).json()["status"] == "queued")
                duplicate = client.post("/train", headers=headers, json={"dataset_id": "fixture-ds", "target_column": "feasibility_score", "problem_type": "regression", "cv_folds": 2})
                check("duplicate active jobs are prevented", duplicate.status_code == 409)
                check("unknown job returns 404", client.get("/train/missing", headers=headers).status_code == 404)
                check("generate-sample allows configurable size", client.post("/datasets/generate-sample", headers=headers, data={"num_samples": "20"}).json()["row_count"] == 20)
                check("generate-sample validates size", client.post("/datasets/generate-sample", headers=headers, data={"num_samples": "0"}).status_code == 422)
            finally:
                main._run_training_job_task = original_task

            main.TRAINING_JOBS.clear()
            response = client.post("/train", headers=headers, json={
                "dataset_id": "fixture-ds",
                "target_column": "feasibility_score",
                "problem_type": "regression",
                "cv_folds": 2,
                "candidate_algorithms": ["ridge", "linear_regression"],
            })
            job_id = response.json()["job_id"]
            job = client.get(f"/train/{job_id}", headers=headers).json()
            check("real background job completes with results", job["status"] == "completed" and job["results"]["best_model_id"])
            check("completed job stays experimental", job["results"]["training_mode"] == "experimental_sandbox")
            check("no model is auto-promoted", main.ACTIVE_MODEL_ID is None or job["results"]["best_model_id"] != main.ACTIVE_MODEL_ID)

            policy = client.get("/training-policy", headers=headers).json()
            check("policy endpoint exposes 8x8 catalog and XGBoost", len(policy["candidates"]["classification"]) == 8 and len(policy["candidates"]["regression"]) == 8 and policy["xgboost"]["available"] is True)
            check("job storage limits are disclosed", "In-memory" in policy["job_storage"])

            broken = dict(dataset_entry, file_path=str(Path(tmp) / "missing.csv"))
            main.DATASETS_STORE["fixture-ds"] = broken
            main.TRAINING_JOBS.clear()
            response = client.post("/train", headers=headers, json={"dataset_id": "fixture-ds", "target_column": "feasibility_score", "problem_type": "regression", "cv_folds": 2})
            job_id = response.json()["job_id"]
            job = client.get(f"/train/{job_id}", headers=headers).json()
            check("failed job records a sanitized error", job["status"] == "failed" and "<path>" in (job["error_message"] or ""))
        finally:
            main.DATASETS_STORE.clear()
            main.DATASETS_STORE.update(original_store)
            main.TRAINING_JOBS.clear()
            main.TRAINING_JOBS.update(original_jobs)


def run_test():
    print("\n================ TASK 5 MODULE 4 ML PIPELINE TESTS ================")
    test_synthetic_dataset_contract()
    test_oi6_approval_and_training_semantics()
    test_feature_engineering_contract()
    test_candidate_catalog_and_all_models_train()
    test_failed_training_paths()
    test_artifact_activation_gate()
    test_explanations_report_missing_values_honestly()
    test_prediction_contract_uses_srs_risk_bands()
    test_background_job_api_security_and_states()
    print("================ ALL MODULE 4 ML PIPELINE TESTS PASSED ================\n")


if __name__ == "__main__":
    run_test()
