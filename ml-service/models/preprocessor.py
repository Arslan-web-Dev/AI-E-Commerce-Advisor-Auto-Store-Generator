"""Task 5 / FR-4.2 fold-local preprocessing contract.

All imputation/indicator state is learned inside the fitted pipeline, so each
CV fold sees only its own training rows. Missingness is preserved as an explicit
binary indicator instead of being silently erased by median/mode imputation.
"""

from typing import Any, Dict, List, Tuple

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def build_preprocessor(df: pd.DataFrame, target_col: str) -> Tuple[ColumnTransformer, List[str], List[str]]:
    """Build a leakage-free preprocessing pipeline with missing indicators."""
    feature_df = df.drop(columns=[target_col], errors="ignore")

    numeric_features = [col for col in feature_df.columns
                        if pd.api.types.is_numeric_dtype(feature_df[col])]
    categorical_features = [col for col in feature_df.columns if col not in numeric_features]

    numeric_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
        ("scaler", StandardScaler()),
    ])
    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent", add_indicator=True)),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    transformers: List[Any] = []
    if numeric_features:
        transformers.append(("num", numeric_transformer, numeric_features))
    if categorical_features:
        transformers.append(("cat", categorical_transformer, categorical_features))

    preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")
    return preprocessor, numeric_features, categorical_features


def get_transformed_feature_names(
    preprocessor: ColumnTransformer,
    numeric_cols: List[str],
    cat_cols: List[str],
) -> List[str]:
    """Human-readable post-transform names, including missing indicators."""
    try:
        return [str(name) for name in preprocessor.get_feature_names_out()]
    except Exception:
        names = list(numeric_cols) + list(cat_cols)
        return names


def validate_input_schema(
    input_df: pd.DataFrame,
    expected_columns: List[str],
    schema_version: str,
    provided_schema_version: Any = None,
) -> Dict[str, Any]:
    """Fail closed when a prediction payload does not match the saved schema.

    Column *order* is part of the contract because the persisted pipeline was
    fitted in that order. Extra columns are rejected so silent feature drift
    cannot change a score.
    """
    expected = [str(column) for column in expected_columns]
    actual = [str(column) for column in input_df.columns]
    missing = [column for column in expected if column not in actual]
    unexpected = [column for column in actual if column not in expected]
    order_mismatch = [column for column in expected if column in actual and actual.index(column) != expected.index(column)]

    if provided_schema_version is not None and str(provided_schema_version) != str(schema_version):
        raise ValueError(
            f"Feature schema version mismatch: expected {schema_version}, got {provided_schema_version}."
        )
    if missing or unexpected or order_mismatch:
        raise ValueError(
            "Prediction payload does not match the saved feature schema "
            f"({schema_version}). missing={missing}; unexpected={unexpected}; "
            f"out_of_order={order_mismatch}."
        )
    return {
        "schema_version": str(schema_version),
        "columns": expected,
        "column_count": len(expected),
    }
