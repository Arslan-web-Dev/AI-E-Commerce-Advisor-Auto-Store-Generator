import io
import math
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

def inspect_dataset(file_path: Path, target_col: Optional[str] = None) -> Dict[str, Any]:
    """
    Reads a CSV or Excel dataset and performs a comprehensive quality inspection,
    schema inference, statistics summary, and target variable analysis.
    """
    ext = file_path.suffix.lower()
    if ext in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)

    row_count = len(df)
    column_count = len(df.columns)

    columns_metadata: List[Dict[str, Any]] = []
    warnings: List[str] = []

    # Infer potential target if not supplied
    inferred_target = target_col
    if not inferred_target:
        candidates = ["feasibility_class", "feasibility_score", "target", "label", "outcome", "status"]
        for cand in candidates:
            if cand in df.columns:
                inferred_target = cand
                break

    for col in df.columns:
        series = df[col]
        null_count = int(series.isna().sum())
        null_pct = round((null_count / row_count) * 100, 2) if row_count > 0 else 0
        unique_count = int(series.nunique(dropna=True))

        col_type = "numeric" if pd.api.types.is_numeric_dtype(series) else "categorical"
        if pd.api.types.is_datetime64_any_dtype(series):
            col_type = "datetime"

        meta: Dict[str, Any] = {
            "name": col,
            "type": col_type,
            "null_count": null_count,
            "null_pct": null_pct,
            "unique_count": unique_count,
            "is_target": (col == inferred_target)
        }

        # Quality checks per column
        if null_pct > 80:
            warnings.append(f"Column '{col}' has {null_pct}% missing values.")
        if unique_count == 1:
            warnings.append(f"Column '{col}' is constant (zero variance).")
        if unique_count == row_count and col_type == "categorical":
            warnings.append(f"Column '{col}' appears to be an identifier (high cardinality).")

        if col_type == "numeric":
            clean_s = series.dropna()
            if len(clean_s) > 0:
                meta["stats"] = {
                    "min": float(clean_s.min()),
                    "max": float(clean_s.max()),
                    "mean": float(clean_s.mean()),
                    "median": float(clean_s.median()),
                    "std": float(clean_s.std()) if len(clean_s) > 1 else 0.0
                }
        else:
            val_counts = series.value_counts(dropna=True).head(5).to_dict()
            meta["top_values"] = {str(k): int(v) for k, v in val_counts.items()}

        columns_metadata.append(meta)

    # Determine problem type if target is selected
    problem_type = None
    target_analysis = {}
    if inferred_target and inferred_target in df.columns:
        t_series = df[inferred_target].dropna()
        if pd.api.types.is_numeric_dtype(t_series) and t_series.nunique() > 10:
            problem_type = "regression"
            target_analysis = {
                "problem_type": "regression",
                "min": float(t_series.min()),
                "max": float(t_series.max()),
                "mean": float(t_series.mean()),
                "std": float(t_series.std()) if len(t_series) > 1 else 0.0
            }
        else:
            problem_type = "classification"
            class_counts = t_series.value_counts().to_dict()
            target_analysis = {
                "problem_type": "classification",
                "class_counts": {str(k): int(v) for k, v in class_counts.items()},
                "class_count": len(class_counts),
                "is_balanced": (max(class_counts.values()) / max(1, min(class_counts.values()))) < 3.0
            }

    # Duplicate rows check
    duplicates = int(df.duplicated().sum())
    if duplicates > 0:
        warnings.append(f"Dataset contains {duplicates} duplicate rows.")

    quality_report = {
        "missing_cells_total": int(df.isna().sum().sum()),
        "duplicate_rows": duplicates,
        "warnings": warnings,
        "health_score": max(20, 100 - (len(warnings) * 15)),
        "target_analysis": target_analysis
    }

    return {
        "row_count": row_count,
        "column_count": column_count,
        "target_column": inferred_target,
        "problem_type": problem_type,
        "columns_metadata": columns_metadata,
        "data_quality_report": quality_report
    }
