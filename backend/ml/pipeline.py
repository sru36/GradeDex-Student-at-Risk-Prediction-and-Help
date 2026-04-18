"""
pipeline.py — Preprocessing pipeline builder for GradeDex.

Missing value handling strategy:
  • Numeric features  → SimpleImputer(strategy='median')  then StandardScaler
  • Categorical feats → SimpleImputer(strategy='most_frequent') then OrdinalEncoder

This ensures that any NaN (including the known missing columns: Teacher_Quality,
Distance_from_Home, Parental_Education_Level, Family_Income) are filled before
encoding, preventing downstream errors.
"""

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer

from .utils import (
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
    CATEGORICAL_VALUES,
    ALL_FEATURES,
    score_to_grade,
)


def build_preprocessor() -> ColumnTransformer:
    """
    Build a ColumnTransformer that:
      1. Imputes numeric NaNs with the column median, then standardises.
      2. Imputes categorical NaNs with the column mode, then one-hot encodes.
    The transformer must be fitted on training data before use.
    """
    # ── Numeric branch ────────────────────────────────────────────────────────
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    # ── Categorical branch ────────────────────────────────────────────────────
    # Pre-define categories so the encoder is deterministic across train/predict.
    categories = [CATEGORICAL_VALUES[col] for col in CATEGORICAL_FEATURES]
    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "encoder",
                OneHotEncoder(
                    categories=categories,
                    handle_unknown="ignore",
                    sparse_output=False,
                ),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, NUMERIC_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES),
        ],
        remainder="drop",  # drop anything not in our feature lists
    )
    return preprocessor


def compute_grade_thresholds(exam_scores: pd.Series) -> list:
    """
    Compute 7 quantile boundaries that split exam_scores into 8 equal-sized bins.

    Returns a list of 7 floats [t1..t7] where:
      score < t1           → F
      t1 <= score < t2     → D
      ...                  → ...
      score >= t7          → AAA

    Using quantile-based (equal-frequency) bins ensures every class has roughly
    the same number of real samples, regardless of the dataset's score distribution.
    This prevents the model from ignoring rare grade classes.
    """
    qs = [i / 8.0 for i in range(1, 8)]   # 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875
    thresholds = exam_scores.quantile(qs).tolist()
    return thresholds


def apply_grade_label(score: float, thresholds: list) -> str:
    """Map a single exam score to one of 8 grade strings using stored thresholds."""
    t = thresholds
    if   score < t[0]: return "F"
    elif score < t[1]: return "D"
    elif score < t[2]: return "C"
    elif score < t[3]: return "B"
    elif score < t[4]: return "B+"
    elif score < t[5]: return "A"
    elif score < t[6]: return "AA"
    else:              return "AAA"


def prepare_data(df: pd.DataFrame):
    """
    Prepare raw DataFrame for training.

    Grade labels are assigned using the fixed thresholds required by the
    project brief:
      F   : score < 60
      D   : 60 <= score < 65
      C   : 65 <= score < 70
      B   : 70 <= score < 75
      B+  : 75 <= score < 80
      A   : 80 <= score < 85
      AA  : 85 <= score < 90
      AAA : score >= 90

    Returns:
        X          — feature DataFrame  (ALL_FEATURES columns)
        y          — Series of grade string labels
        thresholds — list of 7 float boundaries (persist in model_info)
    """
    df = df.copy()
    df["Exam_Score"] = pd.to_numeric(df["Exam_Score"], errors="coerce")
    df = df.dropna(subset=["Exam_Score"])

    for col in NUMERIC_FEATURES:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["Grade"] = df["Exam_Score"].apply(score_to_grade)

    X = df[ALL_FEATURES].copy()
    y = df["Grade"]
    return X, y


def prepare_single_input(data_dict: dict) -> pd.DataFrame:
    """
    Convert a prediction request dict into a DataFrame ready for transform().
    • Missing / None / empty string values → np.nan  (imputer fills them in)
    • Numeric columns are cast to float; bad values → np.nan
    """
    row = {}
    for col in NUMERIC_FEATURES:
        val = data_dict.get(col, None)
        if val is None or str(val).strip() in ("", "None", "null"):
            row[col] = np.nan
        else:
            try:
                row[col] = float(val)
            except (ValueError, TypeError):
                row[col] = np.nan

    for col in CATEGORICAL_FEATURES:
        val = data_dict.get(col, None)
        if val is None or str(val).strip() in ("", "None", "null"):
            row[col] = np.nan
        else:
            row[col] = str(val).strip()

    return pd.DataFrame([row])[ALL_FEATURES]
