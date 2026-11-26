"""Task 5 / FR-4.3–FR-4.7 training and comparison engine.

Cross-validation fits imputation/scaling/encoding inside each training fold.
The holdout set is never used for fitting. The holdout is used for candidate
ranking and explanations, so reported test metrics are selection metrics and
must not be presented as a calibrated production estimate.
"""

import datetime
import json
import platform
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.model_selection import KFold, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline

from config import (
    ARTIFACTS_DIR,
    ARTIFACT_SCHEMA_VERSION,
    FEATURE_SCHEMA_VERSION,
    SCORING_CONFIG,
    TRAINING_RANDOM_SEED,
)
from models.candidate_models import (
    INELIGIBLE_CANDIDATES,
    XGBOOST_AVAILABLE,
    XGBOOST_VERSION,
    candidate_catalog,
    candidate_spec,
    get_candidate_models,
)
from models.evaluator import evaluate_classification, evaluate_regression
from models.explainability import compute_global_feature_importances
from models.label_policy import (
    is_rule_generated_target,
    load_label_policy,
    target_derived_columns,
)
from models.preprocessor import build_preprocessor, get_transformed_feature_names


def _aggregate_fold_metrics(metric_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate every numeric metric, not only the primary rank metric."""
    if not metric_rows:
        return {}
    aggregated: Dict[str, Any] = {}
    for key in metric_rows[0].keys():
        values = [row.get(key) for row in metric_rows]
        numeric = [
            float(value) for value in values
            if isinstance(value, (int, float)) and not isinstance(value, bool)
        ]
        if numeric:
            aggregated[key] = {
                "mean": round(float(np.mean(numeric)), 4),
                "std": round(float(np.std(numeric)), 4),
            }
    return aggregated


class _DecodedClassifier:
    """Maps XGBoost's integer classes back to the original label vocabulary."""

    def __init__(self, estimator: Any, classes: List[str]):
        self.estimator = estimator
        self.classes_ = np.asarray(classes, dtype=object)

    def predict(self, X: Any) -> np.ndarray:
        encoded = np.asarray(self.estimator.predict(X)).astype(int)
        return np.asarray([self.classes_[index] for index in encoded], dtype=object)

    def predict_proba(self, X: Any) -> np.ndarray:
        return self.estimator.predict_proba(X)

    def __getattr__(self, name: str) -> Any:
        if name.startswith("__"):
            raise AttributeError(name)
        return getattr(self.estimator, name)


def _fit_model(
    model: Any,
    X: Any,
    y: pd.Series,
    spec: Optional[Dict[str, Any]] = None,
    classes: Optional[List[str]] = None,
) -> None:
    """Fit with the imbalance strategy declared by the candidate contract.

    Tree/linear classifiers use balanced class weights inside their estimator.
    XGBoost requires integer labels; its classes are encoded in sorted order and
    decoded before metrics/explanations. ``scale_pos_weight`` handles binary
    imbalance, while stratified split/CV handles multiclass balance.
    """
    if spec and spec.get("needs_label_encoding") and classes:
        label_map = {label: index for index, label in enumerate(classes)}
        encoded = y.map(label_map).astype(int)
        if spec.get("uses_scale_pos_weight") and len(classes) == 2:
            counts = encoded.value_counts().sort_index()
            negative, positive = float(counts.get(0, 0)), float(counts.get(1, 0))
            if positive > 0:
                model.set_params(scale_pos_weight=round(negative / positive, 6))
        model.fit(X, encoded)
    else:
        model.fit(X, y)


def train_and_compare_models(
    df: pd.DataFrame,
    target_col: str,
    problem_type: str,
    candidate_algorithms: Optional[List[str]] = None,
    validation_strategy: Optional[str] = None,
    cv_folds: int = 5,
    test_size: float = 0.2,
    progress_callback=None,
    artifacts_dir: Optional[Any] = None,
    dataset_fingerprint: Optional[str] = None,
    dataset_ref: Optional[str] = None,
    dataset_info: Optional[Dict[str, Any]] = None,
    training_provenance: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Train eight candidates and persist a versioned, auditable artifact."""
    if problem_type not in {"classification", "regression"}:
        raise ValueError("problem_type must be 'classification' or 'regression'.")
    if not 0 < test_size < 1:
        raise ValueError("test_size must be between 0 and 1.")
    if cv_folds < 2:
        raise ValueError("cv_folds must be at least 2.")
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in dataset.")

    policy_decision = load_label_policy()
    oi6 = policy_decision["oi6_validation"]
    dataset_info = dict(dataset_info or {})
    label_approval_status = "APPROVED" if oi6["approved"] else "BLOCKED"
    synthetic_training = (
        dataset_info.get("is_sample") is True
        or str(dataset_info.get("data_source") or "").lower() == "synthetic"
    )
    approved_for_production = (
        bool(oi6["approved"])
        and not synthetic_training
        and is_rule_generated_target(target_col)
    )
    training_mode = "production" if approved_for_production else "experimental_sandbox"

    clean_df = df.dropna(subset=[target_col]).copy()
    if clean_df.empty:
        raise ValueError("No labelled rows remain after dropping missing targets.")

    # Remove only known target companions. Unrelated features such as
    # logistics_accessibility_score must remain available to the model.
    cols_to_drop = [target_col] + target_derived_columns(target_col, clean_df.columns)
    X = clean_df.drop(columns=cols_to_drop, errors="ignore")
    y = clean_df[target_col]

    unique_classes: Optional[List[str]] = None
    if problem_type == "classification":
        unique_classes = sorted([str(value) for value in y.unique()])
        if len(unique_classes) < 2:
            raise ValueError("Classification requires at least two target classes.")
        min_class_count = int(y.value_counts().min())
        stratify = y if min_class_count >= 2 else None
        imbalance = {
            "handled": True,
            "strategy": "stratified_split_and_stratified_cv_plus_balanced_class_weights_or_xgboost_scale_pos_weight",
            "class_counts": {str(key): int(value) for key, value in y.value_counts().items()},
        }
    else:
        stratify = None
        imbalance = {"handled": False, "strategy": "not_applicable_to_regression", "class_counts": {}}

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=TRAINING_RANDOM_SEED, stratify=stratify
    )

    # The executed splitter is derived from the problem type. An arbitrary
    # request string must never be persisted as if that strategy had run.
    actual_validation_strategy = "stratified_kfold" if problem_type == "classification" else "kfold"
    if validation_strategy is not None and validation_strategy != actual_validation_strategy:
        raise ValueError(
            f"validation_strategy '{validation_strategy}' is not supported for {problem_type}; "
            f"expected '{actual_validation_strategy}'."
        )

    if problem_type == "classification":
        train_min_class_count = int(y_train.value_counts().min())
        if cv_folds > train_min_class_count:
            raise ValueError(
                f"cv_folds ({cv_folds}) cannot exceed the smallest post-split training class count "
                f"({train_min_class_count})."
            )
        cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=TRAINING_RANDOM_SEED)
    else:
        cv = KFold(n_splits=cv_folds, shuffle=True, random_state=TRAINING_RANDOM_SEED)

    candidates = get_candidate_models(problem_type, candidate_algorithms)
    if not candidates:
        raise ValueError(f"No valid candidate algorithms selected for problem type '{problem_type}'.")

    leaderboard: List[Dict[str, Any]] = []
    comparison_rows: List[Dict[str, Any]] = []
    trained_candidates: Dict[str, Dict[str, Any]] = {}
    total_candidates = len(candidates)

    for idx, alg_key in enumerate(candidates):
        spec = candidate_spec(problem_type, alg_key) or {}
        model_factory = spec["factory"]
        if progress_callback:
            progress = round(((idx + 0.1) / total_candidates) * 100, 1)
            progress_callback(progress, f"Training candidate {idx + 1}/{total_candidates}: {spec.get('name', alg_key)}")

        fold_metric_rows: List[Dict[str, Any]] = []
        for train_idx, val_idx in cv.split(X_train, y_train):
            X_cv_train = X_train.iloc[train_idx]
            X_cv_val = X_train.iloc[val_idx]
            y_cv_train = y_train.iloc[train_idx]
            y_cv_val = y_train.iloc[val_idx]

            # Preprocessor is constructed and fitted per fold: no validation-fold
            # median, scale, one-hot vocabulary or missing indicator leaks.
            fold_preprocessor, _, _ = build_preprocessor(X_cv_train, target_col="")
            X_cv_train_trans = fold_preprocessor.fit_transform(X_cv_train)
            X_cv_val_trans = fold_preprocessor.transform(X_cv_val)

            fold_model = model_factory()
            _fit_model(fold_model, X_cv_train_trans, y_cv_train, spec, unique_classes)
            val_preds = fold_model.predict(X_cv_val_trans)
            if spec.get("needs_label_encoding") and unique_classes:
                val_preds = np.asarray(
                    [unique_classes[int(value)] for value in np.asarray(val_preds).astype(int)],
                    dtype=object,
                )
            val_probs = (
                fold_model.predict_proba(X_cv_val_trans)
                if problem_type == "classification" and hasattr(fold_model, "predict_proba")
                else None
            )

            if problem_type == "classification":
                fold_metrics = evaluate_classification(y_cv_val, val_preds, val_probs, labels=unique_classes)
                primary = "f1"
            else:
                fold_metrics = evaluate_regression(y_cv_val, val_preds)
                primary = "r2"
            fold_metric_rows.append(fold_metrics)

        aggregated = _aggregate_fold_metrics(fold_metric_rows)
        cv_mean = float(aggregated[primary]["mean"])
        cv_std = float(aggregated[primary]["std"])

        # Full preprocessor is fitted only on X_train; X_test is never read here.
        preprocessor, num_cols, cat_cols = build_preprocessor(X_train, target_col="")
        X_train_trans = preprocessor.fit_transform(X_train)
        X_test_trans = preprocessor.transform(X_test)
        feature_names = get_transformed_feature_names(preprocessor, num_cols, cat_cols)

        model = model_factory()
        _fit_model(model, X_train_trans, y_train, spec, unique_classes)
        test_preds = model.predict(X_test_trans)
        if spec.get("needs_label_encoding") and unique_classes:
            test_preds = np.asarray(
                [unique_classes[int(value)] for value in np.asarray(test_preds).astype(int)],
                dtype=object,
            )
        test_probs = model.predict_proba(X_test_trans) if hasattr(model, "predict_proba") else None

        if problem_type == "classification":
            test_metrics = evaluate_classification(y_test, test_preds, test_probs, labels=unique_classes)
            rank_score = test_metrics["f1"]
        else:
            test_metrics = evaluate_regression(y_test, test_preds)
            rank_score = test_metrics["r2"]

        importances = compute_global_feature_importances(model, feature_names, X_test_trans, y_test)
        serving_model = (
            _DecodedClassifier(model, unique_classes)
            if spec.get("needs_label_encoding") and unique_classes
            else model
        )
        full_pipeline = Pipeline([("preprocessor", preprocessor), ("model", serving_model)])

        cv_payload = {
            "strategy": actual_validation_strategy,
            "cv_folds": cv_folds,
            "primary_metric": primary,
            "mean_cv_score": round(cv_mean, 4),
            "std_cv_score": round(cv_std, 4),
            "fold_metrics": fold_metric_rows,
            "aggregated_metrics": aggregated,
            "shuffle_seed": TRAINING_RANDOM_SEED,
        }
        trained_candidates[alg_key] = {
            "pipeline": full_pipeline,
            "model": model,
            "spec": spec,
            "metrics": test_metrics,
            "cv_metrics": cv_payload,
            "importances": importances,
            "rank_score": rank_score,
            "feature_names": feature_names,
        }

        leaderboard.append({
            "algorithm_key": alg_key,
            "name": spec.get("name", alg_key),
            "description": spec.get("description", ""),
            "rank_score": round(float(rank_score), 4),
            "cv_score": round(cv_mean, 4),
            "cv_std": round(cv_std, 4),
            "primary_metric": primary,
            "test_metrics": test_metrics,
            "cv_metrics": cv_payload,
            "hyperparameters": spec.get("params", {}),
            "library": spec.get("library", "scikit-learn"),
            "library_version": spec.get("library_version"),
            "global_importances": importances[:15],
            "training_mode": training_mode,
        })
        comparison_rows.append(leaderboard[-1])

    leaderboard.sort(key=lambda item: item["rank_score"], reverse=True)
    best_key = leaderboard[0]["algorithm_key"]
    best_candidate = trained_candidates[best_key]

    model_id = str(uuid.uuid4())
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    artifact_version = (
        f"{best_key}-v2.0-{created_at.replace(':', '').replace('-', '')}-{model_id[:8]}"
    )
    output_dir = Path(artifacts_dir) if artifacts_dir is not None else ARTIFACTS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = output_dir / f"model_{best_key}_{model_id[:8]}.joblib"
    comparison_path = output_dir / f"comparison_{model_id[:8]}.json"

    feature_columns = [str(column) for column in X_train.columns]
    provenance = dict(training_provenance or {})
    provenance.update({
        "data_source": dataset_info.get("data_source", provenance.get("data_source", "uploaded_unverified")),
        "dataset_is_sample": bool(dataset_info.get("is_sample", False)),
        "dataset_fingerprint": dataset_fingerprint,
        "dataset_ref": dataset_ref,
        "problem_type": problem_type,
        "target_col": target_col,
        "random_seed": TRAINING_RANDOM_SEED,
    })

    comparison_report = {
        "report_version": "v2.0-fr4",
        "generated_at": created_at,
        "training_job_model_id": model_id,
        "problem_type": problem_type,
        "target_col": target_col,
        "dataset_fingerprint": dataset_fingerprint,
        "dataset_ref": dataset_ref,
        "dataset_info": dataset_info,
        "training_provenance": provenance,
        "candidate_count": len(leaderboard),
        "expected_candidate_count": 8,
        "completed_candidates": [row["algorithm_key"] for row in comparison_rows],
        "candidate_catalog": candidate_catalog(problem_type),
        "ineligible_candidates": {
            key: spec for key, spec in INELIGIBLE_CANDIDATES.items()
            if spec["problem_type"] in {problem_type, "both"}
        },
        "xgboost": {
            "available": XGBOOST_AVAILABLE,
            "version": XGBOOST_VERSION,
            "classification_key": "xgboost",
            "regression_key": "xgboost_regressor",
        },
        "validation": {
            "strategy": actual_validation_strategy,
            "cv_folds": cv_folds,
            "holdout_test_size": test_size,
            "random_seed": TRAINING_RANDOM_SEED,
            "imbalance_handling": imbalance,
            "fold_local_preprocessing": True,
            "missing_indicators": True,
        },
        "sample_split": {
            "train_size": int(len(X_train)),
            "test_size": int(len(X_test)),
            "total_records": int(len(clean_df)),
        },
        "results": comparison_rows,
        "best_model": {
            "algorithm_key": best_key,
            "name": best_candidate["spec"].get("name", best_key),
            "selection_metric": "f1" if problem_type == "classification" else "r2",
            "selection_score": round(float(best_candidate["rank_score"]), 4),
            "selection_basis": "holdout selection metric; not an unbiased production performance estimate",
        },
        "label_approval": {
            "oi6_status": label_approval_status,
            "training_mode": training_mode,
            "approved_for_production": approved_for_production,
            "reasons": [] if oi6["approved"] else oi6["reasons"],
        },
        "disclaimer": SCORING_CONFIG["limited_data_disclaimer"],
    }
    comparison_path.write_text(json.dumps(comparison_report, indent=2), encoding="utf-8")

    artifact_bundle = {
        "artifact_version": artifact_version,
        "artifact_schema_version": ARTIFACT_SCHEMA_VERSION,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "created_at": created_at,
        "model_id": model_id,
        "algorithm_key": best_key,
        "name": best_candidate["spec"].get("name", best_key),
        "problem_type": problem_type,
        "target_col": target_col,
        "feature_columns": feature_columns,
        "feature_names": best_candidate["feature_names"],
        "raw_numeric_cols": num_cols,
        "raw_categorical_cols": cat_cols,
        "pipeline": best_candidate["pipeline"],
        "global_importances": best_candidate["importances"],
        "metrics": best_candidate["metrics"],
        "cv_metrics": best_candidate["cv_metrics"],
        "class_labels": unique_classes,
        "dataset_fingerprint": dataset_fingerprint,
        "dataset_ref": dataset_ref,
        "label_approval_status": label_approval_status,
        "label_approval_snapshot": policy_decision,
        "training_mode": training_mode,
        "approved_for_production": approved_for_production,
        "training_provenance": provenance,
        "comparison_report_path": str(comparison_path),
        "comparison_report": comparison_report,
        "risk_threshold_version": SCORING_CONFIG["version"],
        "risk_thresholds": dict(SCORING_CONFIG),
        "disclaimer": SCORING_CONFIG["limited_data_disclaimer"],
        "library_versions": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "xgboost": XGBOOST_VERSION,
            "pandas": pd.__version__,
            "numpy": np.__version__,
            "joblib": joblib.__version__,
        },
    }
    joblib.dump(artifact_bundle, artifact_path)

    if progress_callback:
        progress_callback(100.0, f"Completed. Best model: {best_candidate['spec'].get('name', best_key)}")

    return {
        "best_model_id": model_id,
        "artifact_version": artifact_version,
        "best_algorithm": best_key,
        "best_model_name": best_candidate["spec"].get("name", best_key),
        "artifact_path": str(artifact_path),
        "comparison_report_path": str(comparison_path),
        "feature_columns": feature_columns,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "feature_names": best_candidate["feature_names"],
        "global_importances": best_candidate["importances"],
        "test_metrics": best_candidate["metrics"],
        "cv_metrics": best_candidate["cv_metrics"],
        "leaderboard": leaderboard,
        "comparison_report": comparison_report,
        "dataset_fingerprint": dataset_fingerprint,
        "label_approval_status": label_approval_status,
        "training_mode": training_mode,
        "approved_for_production": approved_for_production,
        "sample_split": {
            "train_size": int(len(X_train)),
            "test_size": int(len(X_test)),
            "total_records": int(len(clean_df)),
        },
    }
