import numpy as np
from typing import Dict, Any, List
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix,
    mean_absolute_error, mean_squared_error, r2_score, explained_variance_score
)

def evaluate_classification(y_true, y_pred, y_prob=None, labels: List[str] = None) -> Dict[str, Any]:
    acc = float(accuracy_score(y_true, y_pred))
    p_weighted = float(precision_score(y_true, y_pred, average='weighted', zero_division=0))
    r_weighted = float(recall_score(y_true, y_pred, average='weighted', zero_division=0))
    f1_weighted = float(f1_score(y_true, y_pred, average='weighted', zero_division=0))
    f1_macro = float(f1_score(y_true, y_pred, average='macro', zero_division=0))

    cm = confusion_matrix(y_true, y_pred, labels=labels).tolist() if labels is not None else confusion_matrix(y_true, y_pred).tolist()

    roc_auc = None
    if y_prob is not None and len(np.unique(y_true)) > 1:
        try:
            if len(np.unique(y_true)) == 2 and y_prob.ndim == 2:
                roc_auc = float(roc_auc_score(y_true, y_prob[:, 1]))
            elif y_prob.ndim == 2 and y_prob.shape[1] == len(np.unique(y_true)):
                roc_auc = float(roc_auc_score(y_true, y_prob, multi_class='ovr', average='weighted'))
        except Exception:
            roc_auc = None

    return {
        "accuracy": round(acc, 4),
        "precision": round(p_weighted, 4),
        "recall": round(r_weighted, 4),
        "f1": round(f1_weighted, 4),
        "f1_macro": round(f1_macro, 4),
        "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
        "confusion_matrix": cm,
        "class_labels": [str(l) for l in labels] if labels is not None else [str(c) for c in np.unique(y_true)]
    }

def evaluate_regression(y_true, y_pred) -> Dict[str, Any]:
    mae = float(mean_absolute_error(y_true, y_pred))
    mse = float(mean_squared_error(y_true, y_pred))
    rmse = float(np.sqrt(mse))
    r2 = float(r2_score(y_true, y_pred))
    ev = float(explained_variance_score(y_true, y_pred))

    return {
        "mae": round(mae, 4),
        "mse": round(mse, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
        "explained_variance": round(ev, 4)
    }
