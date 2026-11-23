from typing import List, Tuple
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder

def build_preprocessor(df: pd.DataFrame, target_col: str) -> Tuple[ColumnTransformer, List[str], List[str]]:
    """
    Builds a leakage-free preprocessing pipeline.
    Numeric columns are imputed with median and scaled.
    Categorical columns are imputed with most frequent and one-hot encoded.
    """
    feature_df = df.drop(columns=[target_col], errors='ignore')
    
    numeric_features = []
    categorical_features = []

    for col in feature_df.columns:
        if pd.api.types.is_numeric_dtype(feature_df[col]):
            numeric_features.append(col)
        else:
            categorical_features.append(col)

    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='most_frequent')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])

    transformers = []
    if numeric_features:
        transformers.append(('num', numeric_transformer, numeric_features))
    if categorical_features:
        transformers.append(('cat', categorical_transformer, categorical_features))

    preprocessor = ColumnTransformer(transformers=transformers, remainder='drop')
    return preprocessor, numeric_features, categorical_features

def get_transformed_feature_names(preprocessor: ColumnTransformer, numeric_cols: List[str], cat_cols: List[str]) -> List[str]:
    """
    Extracts human-readable feature names after one-hot encoding for explainability.
    """
    feature_names = []
    if numeric_cols:
        feature_names.extend(numeric_cols)
    if cat_cols and hasattr(preprocessor, 'named_transformers_') and 'cat' in preprocessor.named_transformers_:
        cat_pipeline = preprocessor.named_transformers_['cat']
        if hasattr(cat_pipeline, 'named_steps') and 'onehot' in cat_pipeline.named_steps:
            encoder = cat_pipeline.named_steps['onehot']
            if hasattr(encoder, 'get_feature_names_out'):
                cat_names = encoder.get_feature_names_out(cat_cols)
                feature_names.extend(list(cat_names))
            else:
                feature_names.extend(cat_cols)
        else:
            feature_names.extend(cat_cols)
    return feature_names
