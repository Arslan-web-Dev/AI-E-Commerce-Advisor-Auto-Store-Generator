import datetime
import platform
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional, Sequence
import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.model_selection import train_test_split, KFold, StratifiedKFold
from sklearn.pipeline import Pipeline

from config import ARTIFACTS_DIR, SCORING_CONFIG
from models.candidate_models import get_candidate_models
from models.preprocessor import build_preprocessor, get_transformed_feature_names
from models.evaluator import evaluate_classification, evaluate_regression
from models.explainability import compute_global_feature_importances
from models.label_policy import (
    assert_training_allowed,
    is_rule_generated_target,
    target_derived_columns,
)


def _aggregate_fold_metrics(metric_rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate every numeric metric, not only the primary rank metric."""
    if not metric_rows:
        return {}
    aggregated: Dict[str, Any] = {}
    keys = metric_rows[0].keys()
    for key in keys:
        values = [row.get(key) for row in metric_rows]
        numeric = [float(value) for value in values if isinstance(value, (int, float)) and not isinstance(value, bool)]
        if numeric:
            aggregated[key] = {
                "mean": round(float(np.mean(numeric)), 4),
                "std": round(float(np.std(numeric)), 4),
            }
    return aggregated


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
    """Train candidates with fold-local preprocessing and persist a versioned artifact.

    Cross-validation fits imputation/scaling/encoding inside each training fold.
    The holdout set is never used for fitting. The holdout is used for candidate
    ranking and explanations, so reported test metrics are selection metrics and
    must not be presented as a calibrated production estimate.
    """
    if problem_type not in {"classification", "regression"}:
        raise ValueError("problem_type must be 'classification' or 'regression'.")
    if not 0 < test_size < 1:
        raise ValueError("test_size must be between 0 and 1.")
    if cv_folds < 2:
        raise ValueError("cv_folds must be at least 2.")

    policy_decision = assert_training_allowed(target_col, dataset_info)
    # Approval state is derived from the gate, never trusted from a caller.
    effective_label_approval_status = (
        policy_decision["status"] if is_rule_generated_target(target_col) else "BLOCKED"
    )
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in dataset.")

    clean_df = df.dropna(subset=[target_col]).copy()
    if clean_df.empty:
        raise ValueError("No labelled rows remain after dropping missing targets.")

    # Remove only known target companions. Unrelated features such as
    # logistics_accessibility_score must remain available to the model.
    cols_to_drop = [target_col] + target_derived_columns(target_col, clean_df.columns)
    X = clean_df.drop(columns=cols_to_drop, errors="ignore")
    y = clean_df[target_col]

    unique_classes = None
    if problem_type == "classification":
        unique_classes = sorted([str(value) for value in y.unique()])
        if len(unique_classes) < 2:
            raise ValueError("Classification requires at least two target classes.")
        min_class_count = int(y.value_counts().min())
        stratify = y if min_class_count >= 2 else None
    else:
        stratify = None

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify
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
        cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
    else:
        cv = KFold(n_splits=cv_folds, shuffle=True, random_state=42)

    candidates = get_candidate_models(problem_type, candidate_algorithms)
    if not candidates:
        raise ValueError(f"No valid candidate algorithms selected for problem type '{problem_type}'.")

    leaderboard = []
    trained_candidates: Dict[str, Dict[str, Any]] = {}
    total_candidates = len(candidates)

    for idx, (alg_key, candidate_info) in enumerate(candidates.items()):
        if progress_callback:
            progress = round(((idx + 0.1) / total_candidates) * 100, 1)
            progress_callback(progress, f"Training candidate: {candidate_info['name']}")

        fold_metric_rows: List[Dict[str, Any]] = []
        for train_idx, val_idx in cv.split(X_train, y_train):
            X_cv_train = X_train.iloc[train_idx]
            X_cv_val = X_train.iloc[val_idx]
            y_cv_train = y_train.iloc[train_idx]
            y_cv_val = y_train.iloc[val_idx]

            # Preprocessor is constructed and fitted per fold: no validation-fold
            # median, scale or one-hot vocabulary leaks into training.
            fold_preprocessor, _, _ = build_preprocessor(X_cv_train, target_col="")
            X_cv_train_trans = fold_preprocessor.fit_transform(X_cv_train)
            X_cv_val_trans = fold_preprocessor.transform(X_cv_val)

            fold_model = candidate_info["factory"]()
            fold_model.fit(X_cv_train_trans, y_cv_train)
            val_preds = fold_model.predict(X_cv_val_trans)

            if problem_type == "classification":
                fold_metrics = evaluate_classification(
                    y_cv_val, val_preds, labels=unique_classes
                )
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

        model = candidate_info["factory"]()
        model.fit(X_train_trans, y_train)
        test_preds = model.predict(X_test_trans)
        test_probs = model.predict_proba(X_test_trans) if hasattr(model, "predict_proba") else None

        if problem_type == "classification":
            test_metrics = evaluate_classification(
                y_test, test_preds, test_probs, labels=unique_classes
            )
            rank_score = test_metrics["f1"]
        else:
            test_metrics = evaluate_regression(y_test, test_preds)
            rank_score = test_metrics["r2"]

        importances = compute_global_feature_importances(
            model, feature_names, X_test_trans, y_test
        )
        full_pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)])

        trained_candidates[alg_key] = {
            "pipeline": full_pipeline,
            "model": model,
            "info": candidate_info,
            "metrics": test_metrics,
            "cv_metrics": {
                "strategy": actual_validation_strategy,
                "cv_folds": cv_folds,
                "primary_metric": primary,
                "mean_cv_score": round(cv_mean, 4),
                "std_cv_score": round(cv_std, 4),
                "fold_metrics": fold_metric_rows,
                "aggregated_metrics": aggregated,
            },
            "importances": importances,
            "rank_score": rank_score,
        }

        leaderboard.append({
            "algorithm_key": alg_key,
            "name": candidate_info["name"],
            "description": candidate_info["description"],
            "rank_score": round(rank_score, 4),
            "cv_score": round(cv_mean, 4),
            "test_metrics": test_metrics,
            "hyperparameters": candidate_info["params"],
        })

    leaderboard.sort(key=lambda item: item["rank_score"], reverse=True)
    best_key = leaderboard[0]["algorithm_key"]
    best_candidate = trained_candidates[best_key]

    model_id = str(uuid.uuid4())
    created_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    artifact_version = f"{best_key}-v1.0-{created_at.replace(':', '').replace('-', '')}-{model_id[:8]}"
    output_dir = Path(artifacts_dir) if artifacts_dir is not None else ARTIFACTS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_filename = f"model_{best_key}_{model_id[:8]}.joblib"
    artifact_path = output_dir / artifact_filename

    artifact_bundle = {
        "artifact_version": artifact_version,
        "created_at": created_at,
        "model_id": model_id,
        "algorithm_key": best_key,
        "name": best_candidate["info"]["name"],
        "problem_type": problem_type,
        "target_col": target_col,
        "feature_names": best_candidate.get("feature_names", []),
        "raw_numeric_cols": num_cols,
        "raw_categorical_cols": cat_cols,
        "pipeline": best_candidate["pipeline"],
        "global_importances": best_candidate["importances"],
        "metrics": best_candidate["metrics"],
        "cv_metrics": best_candidate["cv_metrics"],
        "class_labels": unique_classes,
        "dataset_fingerprint": dataset_fingerprint,
        "dataset_ref": dataset_ref,
        "label_approval_status": effective_label_approval_status,
        "training_provenance": training_provenance or policy_decision,
        "risk_threshold_version": SCORING_CONFIG["version"],
        "risk_thresholds": dict(SCORING_CONFIG),
        "disclaimer": SCORING_CONFIG["limited_data_disclaimer"],
        "library_versions": {
            "python": platform.python_version(),
            "scikit_learn": sklearn.__version__,
            "pandas": pd.__version__,
            "numpy": np.__version__,
        },
    }
    # The transform names belong to the best candidate's fitted preprocessor.
    artifact_bundle["feature_names"] = get_transformed_feature_names(
        best_candidate["pipeline"].named_steps["preprocessor"], num_cols, cat_cols
    )
    joblib.dump(artifact_bundle, artifact_path)

    if progress_callback:
        progress_callback(100.0, f"Completed. Best model: {best_candidate['info']['name']}")

    return {
        "best_model_id": model_id,
        "artifact_version": artifact_version,
        "best_algorithm": best_key,
        "best_model_name": best_candidate["info"]["name"],
        "artifact_path": str(artifact_path),
        "feature_names": artifact_bundle["feature_names"],
        "global_importances": best_candidate["importances"],
        "test_metrics": best_candidate["metrics"],
        "cv_metrics": best_candidate["cv_metrics"],
        "leaderboard": leaderboard,
        "dataset_fingerprint": dataset_fingerprint,
        "label_approval_status": effective_label_approval_status,
        "sample_split": {
            "train_size": len(X_train),
            "test_size": len(X_test),
            "total_records": len(clean_df),
        },
    }
