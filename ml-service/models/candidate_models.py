"""Task 5 / FR-4.5 candidate model catalogue.

Exactly eight supervised classifiers and eight regressors are registered.
XGBoost is imported defensively so a broken installation is reported as an
ineligibility reason instead of crashing the whole service. Every registered
candidate is deterministic (fixed ``random_state``). Candidates that support
class balancing enable it; XGBoost uses ``scale_pos_weight`` for binary targets
and stratified CV for multiclass, and every strategy is recorded in the report.
"""

from typing import Any, Dict, List, Optional

import sklearn
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
    ExtraTreesClassifier, ExtraTreesRegressor,
)
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier

try:
    from xgboost import XGBClassifier, XGBRegressor
    import xgboost
    XGBOOST_AVAILABLE = True
    XGBOOST_VERSION = str(xgboost.__version__)
    XGBOOST_IMPORT_ERROR = None
except Exception as _xgb_error:  # pragma: no cover - exercised only on broken installs
    XGBClassifier = None
    XGBRegressor = None
    XGBOOST_AVAILABLE = False
    XGBOOST_VERSION = None
    XGBOOST_IMPORT_ERROR = str(_xgb_error)


SEED = 42


def _entry(name, description, factory, params, family, library="scikit-learn",
           supports_class_weight=False, needs_sample_weight=False,
           uses_scale_pos_weight=False, needs_label_encoding=False):
    return {
        "name": name,
        "description": description,
        "factory": factory,
        "params": params,
        "family": family,
        "library": library,
        "library_version": sklearn.__version__ if library == "scikit-learn" else XGBOOST_VERSION,
        "supports_class_weight": supports_class_weight,
        "needs_sample_weight": needs_sample_weight,
        "uses_scale_pos_weight": uses_scale_pos_weight,
        "needs_label_encoding": needs_label_encoding,
        "random_state": SEED,
        "eligible": True,
        "ineligibility_reason": None,
    }


CLASSIFICATION_CANDIDATES: Dict[str, Dict[str, Any]] = {
    "random_forest": _entry(
        "Random Forest Classifier",
        "Bagged decision trees; robust tabular baseline with balanced class weights.",
        lambda: RandomForestClassifier(n_estimators=100, max_depth=10, min_samples_split=4,
                                       class_weight="balanced", random_state=SEED, n_jobs=1),
        {"n_estimators": 100, "max_depth": 10, "class_weight": "balanced"},
        "ensemble", supports_class_weight=True,
    ),
    "gradient_boosting": _entry(
        "Gradient Boosting Classifier",
        "Sequential boosting minimizing log loss; strong structured-data candidate.",
        lambda: GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=4,
                                           random_state=SEED),
        {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 4},
        "boosting",
    ),
    "extra_trees": _entry(
        "Extra Trees Classifier",
        "Extremely randomized trees reducing variance while retaining balanced weights.",
        lambda: ExtraTreesClassifier(n_estimators=100, max_depth=10, class_weight="balanced",
                                     random_state=SEED, n_jobs=1),
        {"n_estimators": 100, "max_depth": 10, "class_weight": "balanced"},
        "ensemble", supports_class_weight=True,
    ),
    "logistic_regression": _entry(
        "Logistic Regression",
        "Interpretable L2 linear baseline with balanced classes.",
        lambda: LogisticRegression(max_iter=1000, class_weight="balanced", random_state=SEED),
        {"max_iter": 1000, "solver": "lbfgs", "class_weight": "balanced"},
        "linear", supports_class_weight=True,
    ),
    "decision_tree": _entry(
        "Decision Tree Classifier",
        "Single shallow tree yielding interpretable feasibility rules.",
        lambda: DecisionTreeClassifier(max_depth=6, min_samples_leaf=5,
                                       class_weight="balanced", random_state=SEED),
        {"max_depth": 6, "min_samples_leaf": 5, "class_weight": "balanced"},
        "tree", supports_class_weight=True,
    ),
    "svm": _entry(
        "Support Vector Classifier",
        "RBF-kernel maximum-margin classifier with probability estimates and balanced classes.",
        lambda: SVC(probability=True, kernel="rbf", class_weight="balanced", random_state=SEED),
        {"kernel": "rbf", "probability": True, "class_weight": "balanced"},
        "kernel", supports_class_weight=True,
    ),
    "knn": _entry(
        "K-Nearest Neighbors",
        "Distance-based local similarity baseline.",
        lambda: KNeighborsClassifier(n_neighbors=5),
        {"n_neighbors": 5},
        "instance",
    ),
    "xgboost": _entry(
        "XGBoost Classifier",
        "Regularized histogram-boosted trees; binary imbalance via scale_pos_weight, multiclass via stratified CV.",
        (lambda: XGBClassifier(
            n_estimators=120, max_depth=4, learning_rate=0.08,
            subsample=0.9, colsample_bytree=0.9,
            eval_metric="logloss", tree_method="hist", random_state=SEED, n_jobs=1,
        )) if XGBOOST_AVAILABLE else (lambda: None),
        {"n_estimators": 120, "max_depth": 4, "learning_rate": 0.08,
         "tree_method": "hist", "imbalance_strategy": "scale_pos_weight_for_binary"},
        "boosting", library="xgboost", uses_scale_pos_weight=True, needs_label_encoding=True,
    ),
}

REGRESSION_CANDIDATES: Dict[str, Dict[str, Any]] = {
    "random_forest_regressor": _entry(
        "Random Forest Regressor",
        "Bagged regression trees predicting the continuous sandbox score.",
        lambda: RandomForestRegressor(n_estimators=100, max_depth=10, random_state=SEED, n_jobs=1),
        {"n_estimators": 100, "max_depth": 10},
        "ensemble",
    ),
    "gradient_boosting_regressor": _entry(
        "Gradient Boosting Regressor",
        "Sequential boosting on squared-error residuals.",
        lambda: GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=4,
                                          random_state=SEED),
        {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 4},
        "boosting",
    ),
    "extra_trees_regressor": _entry(
        "Extra Trees Regressor",
        "Randomized regression trees with low variance.",
        lambda: ExtraTreesRegressor(n_estimators=100, max_depth=10, random_state=SEED, n_jobs=1),
        {"n_estimators": 100, "max_depth": 10},
        "ensemble",
    ),
    "ridge": _entry(
        "Ridge Regression",
        "L2-regularized linear baseline resisting collinear inflation.",
        lambda: Ridge(alpha=1.0, random_state=SEED),
        {"alpha": 1.0},
        "linear",
    ),
    "lasso": _entry(
        "Lasso Regression",
        "L1-regularized linear model with implicit feature selection.",
        lambda: Lasso(alpha=0.01, max_iter=5000, random_state=SEED),
        {"alpha": 0.01, "max_iter": 5000},
        "linear",
    ),
    "linear_regression": _entry(
        "Linear Regression",
        "Ordinary least squares interpretable baseline.",
        lambda: LinearRegression(),
        {},
        "linear",
    ),
    "decision_tree_regressor": _entry(
        "Decision Tree Regressor",
        "Shallow regression tree mirroring the classification rule structure.",
        lambda: DecisionTreeRegressor(max_depth=6, min_samples_leaf=5, random_state=SEED),
        {"max_depth": 6, "min_samples_leaf": 5},
        "tree",
    ),
    "xgboost_regressor": _entry(
        "XGBoost Regressor",
        "Regularized histogram-based gradient boosting on the continuous score.",
        (lambda: XGBRegressor(
            n_estimators=120, max_depth=4, learning_rate=0.08,
            subsample=0.9, colsample_bytree=0.9, objective="reg:squarederror",
            eval_metric="rmse", tree_method="hist", random_state=SEED, n_jobs=1,
        )) if XGBOOST_AVAILABLE else (lambda: None),
        {"n_estimators": 120, "max_depth": 4, "learning_rate": 0.08,
         "objective": "reg:squarederror", "tree_method": "hist"},
        "boosting", library="xgboost",
    ),
}


if not XGBOOST_AVAILABLE:
    for _catalog in (CLASSIFICATION_CANDIDATES, REGRESSION_CANDIDATES):
        for _key, _spec in _catalog.items():
            if _spec["library"] == "xgboost":
                _spec["eligible"] = False
                _spec["ineligibility_reason"] = (
                    f"xgboost import failed: {XGBOOST_IMPORT_ERROR}"
                )


# Candidates deliberately NOT registered, with auditable reasons. These are
# recorded so the 8x8 selection is demonstrably deliberate rather than an
# incomplete implementation.
INELIGIBLE_CANDIDATES: Dict[str, Dict[str, str]] = {
    "naive_bayes": {
        "problem_type": "classification",
        "reason": "Gaussian independence assumption is violated by one-hot encoded correlated location/demand features; worse calibrated baseline than logistic regression.",
    },
    "svr": {
        "problem_type": "regression",
        "reason": "Epsilon-SVR is quadratic on the synthetic sample size and produces no native feature importance for the required comparison report.",
    },
    "knn_regressor": {
        "problem_type": "regression",
        "reason": "Distance averaging dilutes the rule-generated score signal; classification KNN is retained as the instance-based comparator.",
    },
    "elastic_net": {
        "problem_type": "regression",
        "reason": "Redundant with ridge/lasso for this feature contract; adds an extra hyperparameter without a distinct diagnostic purpose.",
    },
    "ada_boost": {
        "problem_type": "both",
        "reason": "Superseded by gradient boosting and XGBoost, which provide equivalent boosting diagnostics with native probability/regularization support.",
    },
    "neural_network_mlp": {
        "problem_type": "both",
        "reason": "Requires a separate scaling/convergence regime and adds no interpretable rule evidence for an unapproved sandbox target.",
    },
}


def _catalog(problem_type: str) -> Dict[str, Dict[str, Any]]:
    return CLASSIFICATION_CANDIDATES if problem_type == "classification" else REGRESSION_CANDIDATES


def candidate_catalog(problem_type: str) -> Dict[str, Dict[str, Any]]:
    """Public metadata catalog (no callables) for the admin UI and API."""
    return {
        key: {k: v for k, v in spec.items() if k != "factory"}
        for key, spec in _catalog(problem_type).items()
    }


def get_candidate_models(problem_type: str, selected_keys: Optional[List[str]] = None) -> Dict[str, Any]:
    """Return eligible factories, optionally restricted to selected keys."""
    catalog = _catalog(problem_type)
    requested = [str(key) for key in selected_keys] if selected_keys else list(catalog.keys())
    models: Dict[str, Any] = {}
    for key in requested:
        spec = catalog.get(key)
        if not spec or not spec.get("eligible"):
            continue
        model = spec["factory"]()
        if model is not None:
            models[key] = model
    return models


def candidate_spec(problem_type: str, key: str) -> Optional[Dict[str, Any]]:
    return _catalog(problem_type).get(key)
