from typing import Dict, Any
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
    ExtraTreesClassifier, ExtraTreesRegressor
)
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier

CLASSIFICATION_CANDIDATES = {
    "random_forest": {
        "name": "Random Forest Classifier",
        "description": "Ensemble of decision trees with bagging. High accuracy and resilient to overfitting.",
        "factory": lambda: RandomForestClassifier(n_estimators=100, max_depth=10, min_samples_split=4, random_state=42),
        "params": {"n_estimators": 100, "max_depth": 10}
    },
    "gradient_boosting": {
        "name": "Gradient Boosting Classifier",
        "description": "Sequential boosting minimizing loss gradient. High performance on tabular retail data.",
        "factory": lambda: GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42),
        "params": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 4}
    },
    "extra_trees": {
        "name": "Extra Trees Classifier",
        "description": "Extremely randomized trees with lower variance and high generalization.",
        "factory": lambda: ExtraTreesClassifier(n_estimators=100, max_depth=10, random_state=42),
        "params": {"n_estimators": 100, "max_depth": 10}
    },
    "logistic_regression": {
        "name": "Logistic Regression",
        "description": "Linear classifier with L2 regularization. Fast baseline with direct interpretability.",
        "factory": lambda: LogisticRegression(max_iter=1000, random_state=42),
        "params": {"max_iter": 1000, "solver": "lbfgs"}
    },
    "decision_tree": {
        "name": "Decision Tree Classifier",
        "description": "Single tree partitioned by information gain. Highly interpretable rules.",
        "factory": lambda: DecisionTreeClassifier(max_depth=6, min_samples_leaf=5, random_state=42),
        "params": {"max_depth": 6, "min_samples_leaf": 5}
    },
    "svm": {
        "name": "Support Vector Classifier",
        "description": "Radial basis kernel separating complex margin boundaries.",
        "factory": lambda: SVC(probability=True, kernel="rbf", random_state=42),
        "params": {"kernel": "rbf", "probability": True}
    },
    "knn": {
        "name": "K-Nearest Neighbors",
        "description": "Instance-based learning matching similar historical business setups.",
        "factory": lambda: KNeighborsClassifier(n_neighbors=5),
        "params": {"n_neighbors": 5}
    }
}

REGRESSION_CANDIDATES = {
    "random_forest_regressor": {
        "name": "Random Forest Regressor",
        "description": "Ensemble of regression trees predicting continuous feasibility scores.",
        "factory": lambda: RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42),
        "params": {"n_estimators": 100, "max_depth": 10}
    },
    "gradient_boosting_regressor": {
        "name": "Gradient Boosting Regressor",
        "description": "Sequential boosting model optimizing continuous residual loss.",
        "factory": lambda: GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42),
        "params": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 4}
    },
    "extra_trees_regressor": {
        "name": "Extra Trees Regressor",
        "description": "Randomized tree regressor yielding smooth variance-reduced predictions.",
        "factory": lambda: ExtraTreesRegressor(n_estimators=100, max_depth=10, random_state=42),
        "params": {"n_estimators": 100, "max_depth": 10}
    },
    "ridge": {
        "name": "Ridge Regression",
        "description": "L2 regularized linear model preventing collinear feature inflation.",
        "factory": lambda: Ridge(alpha=1.0, random_state=42),
        "params": {"alpha": 1.0}
    },
    "lasso": {
        "name": "Lasso Regression",
        "description": "L1 regularized linear model performing automatic feature selection.",
        "factory": lambda: Lasso(alpha=0.01, random_state=42),
        "params": {"alpha": 0.01}
    },
    "linear_regression": {
        "name": "Linear Regression",
        "description": "Ordinary least squares continuous feasibility predictor.",
        "factory": lambda: LinearRegression(),
        "params": {}
    }
}

def get_candidate_models(problem_type: str, selected_keys: list = None) -> Dict[str, Any]:
    candidates = CLASSIFICATION_CANDIDATES if problem_type == "classification" else REGRESSION_CANDIDATES
    if not selected_keys:
        return candidates
    return {k: v for k, v in candidates.items() if k in selected_keys}
