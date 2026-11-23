import time
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, KFold, StratifiedKFold
from sklearn.pipeline import Pipeline

from config import ARTIFACTS_DIR
from models.candidate_models import get_candidate_models
from models.preprocessor import build_preprocessor, get_transformed_feature_names
from models.evaluator import evaluate_classification, evaluate_regression
from models.explainability import compute_global_feature_importances

def train_and_compare_models(
    df: pd.DataFrame,
    target_col: str,
    problem_type: str,
    candidate_algorithms: Optional[List[str]] = None,
    validation_strategy: str = "stratified_kfold",
    cv_folds: int = 5,
    test_size: float = 0.2,
    progress_callback = None
) -> Dict[str, Any]:
    """
    Executes a multi-algorithm training loop with rigorous cross-validation,
    zero data leakage, automated metric ranking, and artifact serialization.
    """
    if target_col not in df.columns:
        raise ValueError(f"Target column '{target_col}' not found in dataset.")

    clean_df = df.dropna(subset=[target_col]).copy()
    
    # Drop target and any known collinear target duplicates (e.g. feasibility_score if predicting feasibility_class)
    cols_to_drop = [target_col]
    target_lower = target_col.lower()
    if "class" in target_lower:
        for c in clean_df.columns:
            if "score" in c.lower() and c != target_col:
                cols_to_drop.append(c)
    elif "score" in target_lower:
        for c in clean_df.columns:
            if "class" in c.lower() and c != target_col:
                cols_to_drop.append(c)

    X = clean_df.drop(columns=cols_to_drop, errors='ignore')
    y = clean_df[target_col]

    # Handle class labels for classification
    unique_classes = None
    if problem_type == "classification":
        unique_classes = sorted(list(y.unique()))
        stratify = y if y.value_counts().min() >= 2 else None
    else:
        stratify = None

    # Holdout Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify
    )

    # Build leakage-free preprocessor using only training split
    preprocessor, num_cols, cat_cols = build_preprocessor(X_train, target_col="")
    X_train_trans = preprocessor.fit_transform(X_train)
    X_test_trans = preprocessor.transform(X_test)

    feature_names = get_transformed_feature_names(preprocessor, num_cols, cat_cols)

    candidates = get_candidate_models(problem_type, candidate_algorithms)
    if not candidates:
        raise ValueError(f"No valid candidate algorithms selected for problem type '{problem_type}'.")

    # Setup Cross-Validation
    if problem_type == "classification":
        cv = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=42)
    else:
        cv = KFold(n_splits=cv_folds, shuffle=True, random_state=42)

    leaderboard = []
    trained_pipelines = {}
    total_candidates = len(candidates)

    for idx, (alg_key, candidate_info) in enumerate(candidates.items()):
        if progress_callback:
            progress = round(((idx + 0.1) / total_candidates) * 100, 1)
            progress_callback(progress, f"Training candidate: {candidate_info['name']}")

        # K-Fold Cross Validation
        fold_scores = []
        for train_idx, val_idx in cv.split(X_train_trans, y_train):
            X_cv_train, X_cv_val = X_train_trans[train_idx], X_train_trans[val_idx]
            y_cv_train, y_cv_val = y_train.iloc[train_idx], y_train.iloc[val_idx]

            fold_model = candidate_info["factory"]()
            fold_model.fit(X_cv_train, y_cv_train)
            val_preds = fold_model.predict(X_cv_val)

            if problem_type == "classification":
                score = evaluate_classification(y_cv_val, val_preds, labels=unique_classes)["f1"]
            else:
                score = evaluate_regression(y_cv_val, val_preds)["r2"]
            fold_scores.append(score)

        cv_mean = float(np.mean(fold_scores))
        cv_std = float(np.std(fold_scores))

        # Train full candidate on complete training set
        model = candidate_info["factory"]()
        model.fit(X_train_trans, y_train)

        # Test set evaluation
        test_preds = model.predict(X_test_trans)
        test_probs = model.predict_proba(X_test_trans) if hasattr(model, 'predict_proba') else None

        if problem_type == "classification":
            test_metrics = evaluate_classification(y_test, test_preds, test_probs, labels=unique_classes)
            rank_score = test_metrics["f1"]
        else:
            test_metrics = evaluate_regression(y_test, test_preds)
            rank_score = test_metrics["r2"]

        # Feature importances
        importances = compute_global_feature_importances(model, feature_names, X_test_trans, y_test)

        # Full deployable scikit-learn pipeline (Preprocessor + Model)
        full_pipeline = Pipeline([
            ('preprocessor', preprocessor),
            ('model', model)
        ])

        trained_pipelines[alg_key] = {
            "pipeline": full_pipeline,
            "model": model,
            "info": candidate_info,
            "metrics": test_metrics,
            "cv_metrics": {
                "cv_folds": cv_folds,
                "primary_metric": "f1" if problem_type == "classification" else "r2",
                "mean_cv_score": round(cv_mean, 4),
                "std_cv_score": round(cv_std, 4),
                "fold_scores": [round(s, 4) for s in fold_scores]
            },
            "importances": importances,
            "rank_score": rank_score
        }

        leaderboard.append({
            "algorithm_key": alg_key,
            "name": candidate_info["name"],
            "description": candidate_info["description"],
            "rank_score": round(rank_score, 4),
            "cv_score": round(cv_mean, 4),
            "test_metrics": test_metrics,
            "hyperparameters": candidate_info["params"]
        })

    # Sort leaderboard descending by primary metric
    leaderboard.sort(key=lambda x: x["rank_score"], reverse=True)
    best_key = leaderboard[0]["algorithm_key"]
    best_candidate = trained_pipelines[best_key]

    # Serialize best model artifact
    model_id = str(uuid.uuid4())
    artifact_filename = f"model_{best_key}_{model_id[:8]}.joblib"
    artifact_path = ARTIFACTS_DIR / artifact_filename
    
    artifact_bundle = {
        "model_id": model_id,
        "algorithm_key": best_key,
        "name": best_candidate["info"]["name"],
        "problem_type": problem_type,
        "target_col": target_col,
        "feature_names": feature_names,
        "raw_numeric_cols": num_cols,
        "raw_categorical_cols": cat_cols,
        "pipeline": best_candidate["pipeline"],
        "global_importances": best_candidate["importances"],
        "metrics": best_candidate["metrics"],
        "class_labels": unique_classes
    }
    joblib.dump(artifact_bundle, artifact_path)

    if progress_callback:
        progress_callback(100.0, f"Completed. Best model: {best_candidate['info']['name']}")

    return {
        "best_model_id": model_id,
        "best_algorithm": best_key,
        "best_model_name": best_candidate["info"]["name"],
        "artifact_path": str(artifact_path),
        "feature_names": feature_names,
        "global_importances": best_candidate["importances"],
        "test_metrics": best_candidate["metrics"],
        "cv_metrics": best_candidate["cv_metrics"],
        "leaderboard": leaderboard,
        "sample_split": {
            "train_size": len(X_train),
            "test_size": len(X_test),
            "total_records": len(clean_df)
        }
    }
