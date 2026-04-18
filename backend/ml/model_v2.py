"""
model_v2.py - production-grade hybrid ordinal trainer for GradeDex.

The deployed model uses two stages:
  1. A 7-threshold logistic ensemble for the ordered grade boundaries.
  2. Tail score regressors that only uplift strong upper-grade candidates.

The ordinal base keeps the strong overall calibration, while the tail uplift
restores the rare A / AA / AAA grades that the pure threshold model can
otherwise collapse into B+ on this imbalanced dataset.
"""

from collections import Counter
import os

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBClassifier, XGBRegressor

from .pipeline import build_preprocessor
from .utils import (
    ALL_FEATURES,
    CATEGORICAL_FEATURES,
    GRADE_LABELS,
    LABEL_MAP,
    LABEL_REVERSE,
    NUMERIC_FEATURES,
    NUM_CLASSES,
    score_to_grade,
)

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

PRODUCTION_MODEL_NAME = "Ordinal Hybrid"
BASE_MODEL_NAME = "Ordinal Logistic"
THRESHOLD_SCORES = [60, 65, 70, 75, 80, 85, 90]
TAIL_ROUTE_MIN_SCORE = 75.0
TAIL_ROUTE_MIN_BASE_GRADE = LABEL_MAP["B"]
TAIL_XGB_EXTREME_CUTOFF = 90.0
TAIL_SCORE_CENTERS = np.array([57.0, 62.0, 67.0, 72.0, 77.0, 82.0, 87.0, 92.5], dtype=float)
TAIL_SCORE_SIGMA = 2.0
DYNAMIC_GRADE_PERCENTILES = np.array([30, 40, 50, 60, 70, 80, 90], dtype=float)
DYNAMIC_GRADE_CENTER_PERCENTILES = np.array([15, 35, 45, 55, 65, 75, 85, 95], dtype=float)

LOGISTIC_CONFIG = {
    "C": 2.0,
    "solver": "lbfgs",
    "max_iter": 2000,
    "random_state": 42,
}

XGB_BASELINE_PARAMS = {
    "objective": "multi:softprob",
    "num_class": NUM_CLASSES,
    "eval_metric": "mlogloss",
    "random_state": 42,
    "verbosity": 0,
    "n_estimators": 200,
    "max_depth": 5,
    "learning_rate": 0.1,
    "subsample": 0.9,
    "colsample_bytree": 0.9,
    "min_child_weight": 2,
    "n_jobs": 1,
}

TAIL_XGB_PARAMS = {
    "objective": "reg:squarederror",
    "eval_metric": "rmse",
    "random_state": 42,
    "verbosity": 0,
    "n_estimators": 280,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.9,
    "colsample_bytree": 0.9,
    "min_child_weight": 2,
    "n_jobs": 1,
}

TAIL_RF_PARAMS = {
    "n_estimators": 320,
    "max_depth": 14,
    "min_samples_leaf": 2,
    "random_state": 42,
    "n_jobs": 1,
}


def _calc_metrics(y_true, y_pred) -> dict:
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)) * 100, 2),
        "precision": round(
            float(precision_score(y_true, y_pred, average="weighted", zero_division=0)) * 100, 2
        ),
        "recall": round(
            float(recall_score(y_true, y_pred, average="weighted", zero_division=0)) * 100, 2
        ),
        "f1_score": round(
            float(f1_score(y_true, y_pred, average="weighted", zero_division=0)) * 100, 2
        ),
        "macro_f1": round(
            float(f1_score(y_true, y_pred, average="macro", zero_division=0)) * 100, 2
        ),
    }


def _clean_training_frame(df: pd.DataFrame) -> pd.DataFrame:
    cleaned = df.copy()
    cleaned["Exam_Score"] = pd.to_numeric(cleaned["Exam_Score"], errors="coerce")
    cleaned = cleaned.dropna(subset=["Exam_Score"])

    for col in NUMERIC_FEATURES:
        cleaned[col] = pd.to_numeric(cleaned[col], errors="coerce")

    cleaned["Grade"] = cleaned["Exam_Score"].apply(score_to_grade)
    return cleaned


def _build_ordinal_model() -> LogisticRegression:
    return LogisticRegression(**LOGISTIC_CONFIG)


def _fit_threshold_models(X_train_pp: np.ndarray, y_train_scores: pd.Series) -> list[LogisticRegression]:
    threshold_models: list[LogisticRegression] = []
    for threshold in THRESHOLD_SCORES:
        y_binary = (y_train_scores >= threshold).astype(int)
        model = _build_ordinal_model()
        model.fit(X_train_pp, y_binary)
        threshold_models.append(model)
    return threshold_models


def _predict_threshold_probs(
    threshold_models: list[LogisticRegression], X_pp: np.ndarray
) -> np.ndarray:
    probs = np.column_stack([model.predict_proba(X_pp)[:, 1] for model in threshold_models])
    return np.minimum.accumulate(probs, axis=1)


def _threshold_probs_to_grade_probs(threshold_probs: np.ndarray) -> np.ndarray:
    grade_probs = np.column_stack(
        [
            1.0 - threshold_probs[:, 0],
            threshold_probs[:, 0] - threshold_probs[:, 1],
            threshold_probs[:, 1] - threshold_probs[:, 2],
            threshold_probs[:, 2] - threshold_probs[:, 3],
            threshold_probs[:, 3] - threshold_probs[:, 4],
            threshold_probs[:, 4] - threshold_probs[:, 5],
            threshold_probs[:, 5] - threshold_probs[:, 6],
            threshold_probs[:, 6],
        ]
    )
    grade_probs = np.clip(grade_probs, 0.0, None)
    row_sums = grade_probs.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0.0] = 1.0
    return grade_probs / row_sums


def _predict_with_ordinal_model(
    preprocessor, threshold_models: list[LogisticRegression], X: pd.DataFrame
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    X_pp = preprocessor.transform(X)
    threshold_probs = _predict_threshold_probs(threshold_models, X_pp)
    grade_probs = _threshold_probs_to_grade_probs(threshold_probs)
    grade_pred = grade_probs.argmax(axis=1).astype(int)
    return grade_pred, grade_probs, threshold_probs


def _aggregate_feature_importance(preprocessor, threshold_models: list[LogisticRegression]) -> dict:
    transformed_names = preprocessor.get_feature_names_out()
    abs_coefficients = np.vstack([np.abs(model.coef_.ravel()) for model in threshold_models])
    mean_abs_coefficients = abs_coefficients.mean(axis=0)
    grouped = {feature: 0.0 for feature in ALL_FEATURES}

    for transformed_name, weight in zip(transformed_names, mean_abs_coefficients):
        raw_name = transformed_name.split("__", 1)[1]
        source_feature = next(
            (
                feature
                for feature in ALL_FEATURES
                if raw_name == feature or raw_name.startswith(f"{feature}_")
            ),
            raw_name,
        )
        grouped[source_feature] = grouped.get(source_feature, 0.0) + float(weight)

    total_weight = sum(grouped.values()) or 1.0
    normalized = {feature: value / total_weight for feature, value in grouped.items()}
    return dict(sorted(normalized.items(), key=lambda item: item[1], reverse=True))


def _cross_validate_ordinal_model(
    X_train: pd.DataFrame, y_train_scores: pd.Series, y_train_grades: pd.Series, cv
) -> tuple[float, float]:
    cv_scores: list[float] = []

    for fold_train_idx, fold_val_idx in cv.split(X_train, y_train_grades):
        X_fold_train = X_train.iloc[fold_train_idx]
        X_fold_val = X_train.iloc[fold_val_idx]
        y_fold_scores = y_train_scores.iloc[fold_train_idx]
        y_fold_grades = y_train_grades.iloc[fold_val_idx]

        preprocessor = build_preprocessor()
        X_fold_train_pp = preprocessor.fit_transform(X_fold_train)
        threshold_models = _fit_threshold_models(X_fold_train_pp, y_fold_scores)
        y_pred_fold, _, _ = _predict_with_ordinal_model(preprocessor, threshold_models, X_fold_val)
        y_pred_fold_labels = pd.Series(y_pred_fold).map(LABEL_REVERSE)

        score = f1_score(y_fold_grades, y_pred_fold_labels, average="weighted", zero_division=0)
        cv_scores.append(float(score) * 100)

    return round(float(np.mean(cv_scores)), 2), round(float(np.std(cv_scores)), 2)


def _build_xgb_baseline_pipeline() -> Pipeline:
    return Pipeline(
        steps=[
            ("preprocessor", build_preprocessor()),
            ("model", XGBClassifier(**XGB_BASELINE_PARAMS)),
        ]
    )


def _build_tail_xgb_regressor() -> XGBRegressor:
    return XGBRegressor(**TAIL_XGB_PARAMS)


def _build_tail_rf_regressor() -> RandomForestRegressor:
    return RandomForestRegressor(**TAIL_RF_PARAMS)


def _blend_tail_scores(xgb_scores: np.ndarray, rf_scores: np.ndarray) -> np.ndarray:
    return np.where(xgb_scores >= TAIL_XGB_EXTREME_CUTOFF, xgb_scores, rf_scores)


def _estimate_scores_from_grade_probs(grade_probs: np.ndarray) -> np.ndarray:
    return np.asarray(grade_probs, dtype=float) @ TAIL_SCORE_CENTERS


def _predict_numeric_scores(
    preprocessor,
    threshold_models: list[LogisticRegression],
    X: pd.DataFrame,
    tail_xgb_regressor: XGBRegressor | None = None,
    tail_rf_regressor: RandomForestRegressor | None = None,
) -> np.ndarray:
    X_pp = preprocessor.transform(X)
    if tail_xgb_regressor is not None and tail_rf_regressor is not None:
        xgb_scores = tail_xgb_regressor.predict(X_pp)
        rf_scores = tail_rf_regressor.predict(X_pp)
        return _blend_tail_scores(xgb_scores, rf_scores)

    threshold_probs = _predict_threshold_probs(threshold_models, X_pp)
    grade_probs = _threshold_probs_to_grade_probs(threshold_probs)
    return _estimate_scores_from_grade_probs(grade_probs)


def _score_to_probability_vectors(scores: np.ndarray) -> np.ndarray:
    score_arr = np.asarray(scores, dtype=float).reshape(-1, 1)
    distances = (score_arr - TAIL_SCORE_CENTERS.reshape(1, -1)) / TAIL_SCORE_SIGMA
    weights = np.exp(-0.5 * np.square(distances))
    row_sums = weights.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0.0] = 1.0
    return weights / row_sums


def _apply_tail_uplift(
    base_pred: np.ndarray,
    base_probs: np.ndarray,
    xgb_scores: np.ndarray,
    rf_scores: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    final_pred = base_pred.copy()
    final_probs = base_probs.copy()

    tail_scores = _blend_tail_scores(xgb_scores, rf_scores)
    tail_pred = np.array([LABEL_MAP[score_to_grade(score)] for score in tail_scores], dtype=int)

    uplift_mask = (
        (base_pred >= TAIL_ROUTE_MIN_BASE_GRADE)
        & (tail_scores >= TAIL_ROUTE_MIN_SCORE)
        & (tail_pred >= LABEL_MAP["B+"])
    )

    if np.any(uplift_mask):
        final_pred[uplift_mask] = tail_pred[uplift_mask]
        final_probs[uplift_mask] = _score_to_probability_vectors(tail_scores[uplift_mask])

    return final_pred, final_probs, tail_scores, uplift_mask


def _predict_with_hybrid_model(
    preprocessor,
    threshold_models: list[LogisticRegression],
    tail_xgb_regressor: XGBRegressor,
    tail_rf_regressor: RandomForestRegressor,
    X: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    X_pp = preprocessor.transform(X)
    threshold_probs = _predict_threshold_probs(threshold_models, X_pp)
    base_probs = _threshold_probs_to_grade_probs(threshold_probs)
    base_pred = base_probs.argmax(axis=1).astype(int)

    xgb_scores = tail_xgb_regressor.predict(X_pp)
    rf_scores = tail_rf_regressor.predict(X_pp)
    final_pred, final_probs, tail_scores, uplift_mask = _apply_tail_uplift(
        base_pred,
        base_probs,
        xgb_scores,
        rf_scores,
    )
    return final_pred, final_probs, threshold_probs, tail_scores, uplift_mask


def _build_dynamic_grade_calibration(scores: np.ndarray) -> dict:
    score_arr = np.asarray(scores, dtype=float).reshape(-1)
    if score_arr.size == 0:
        raise ValueError("Dynamic calibration requires at least one predicted score.")

    thresholds = np.percentile(score_arr, DYNAMIC_GRADE_PERCENTILES)
    centers = np.percentile(score_arr, DYNAMIC_GRADE_CENTER_PERCENTILES)
    center_diffs = np.diff(centers)
    positive_diffs = center_diffs[center_diffs > 0]
    probability_sigma = float(np.median(positive_diffs) / 1.5) if positive_diffs.size else 1.0
    probability_sigma = max(probability_sigma, 1.0)

    grade_idx = np.searchsorted(thresholds, score_arr, side="right").astype(int)
    distribution = Counter(grade_idx.tolist())

    return {
        "thresholds": thresholds.tolist(),
        "centers": centers.tolist(),
        "probability_sigma": round(probability_sigma, 4),
        "percentiles": {
            f"p{int(percentile)}": round(float(value), 4)
            for percentile, value in zip(DYNAMIC_GRADE_PERCENTILES, thresholds)
        },
        "reference_distribution": {
            GRADE_LABELS[idx]: int(distribution.get(idx, 0)) for idx in range(NUM_CLASSES)
        },
    }


def _apply_dynamic_grade_calibration(
    scores: np.ndarray, calibration: dict
) -> tuple[np.ndarray, np.ndarray]:
    score_arr = np.asarray(scores, dtype=float).reshape(-1)
    thresholds = np.asarray(calibration["thresholds"], dtype=float)
    centers = np.asarray(calibration["centers"], dtype=float)
    probability_sigma = max(float(calibration.get("probability_sigma", 1.0)), 1.0)

    grade_idx = np.searchsorted(thresholds, score_arr, side="right").astype(int)
    distances = (score_arr.reshape(-1, 1) - centers.reshape(1, -1)) / probability_sigma
    grade_probs = np.exp(-0.5 * np.square(distances))

    for row_idx, cls_idx in enumerate(grade_idx):
        max_weight = float(np.max(grade_probs[row_idx]))
        if grade_probs[row_idx, cls_idx] <= max_weight:
            grade_probs[row_idx, cls_idx] = max_weight + 1e-6

    row_sums = grade_probs.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0.0] = 1.0
    return grade_idx, grade_probs / row_sums


def _predict_with_dynamic_calibration(
    model_info: dict, X: pd.DataFrame, calibration: dict | None
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    raw_scores = _predict_numeric_scores(
        model_info["preprocessor"],
        model_info["threshold_models"],
        X,
        model_info.get("tail_xgb_regressor"),
        model_info.get("tail_rf_regressor"),
    )

    if calibration:
        grade_pred, grade_probs = _apply_dynamic_grade_calibration(raw_scores, calibration)
        return grade_pred, grade_probs, raw_scores

    grade_pred, grade_probs = _predict_with_production_model(model_info, X)
    return grade_pred, grade_probs, raw_scores


def _cross_validate_hybrid_model(
    X_train: pd.DataFrame, y_train_scores: pd.Series, y_train_grades: pd.Series, cv
) -> tuple[float, float]:
    cv_scores: list[float] = []

    for fold_train_idx, fold_val_idx in cv.split(X_train, y_train_grades):
        X_fold_train = X_train.iloc[fold_train_idx]
        X_fold_val = X_train.iloc[fold_val_idx]
        y_fold_scores_train = y_train_scores.iloc[fold_train_idx]
        y_fold_grades_val = y_train_grades.iloc[fold_val_idx]

        preprocessor = build_preprocessor()
        X_fold_train_pp = preprocessor.fit_transform(X_fold_train)
        threshold_models = _fit_threshold_models(X_fold_train_pp, y_fold_scores_train)

        tail_xgb_regressor = _build_tail_xgb_regressor()
        tail_rf_regressor = _build_tail_rf_regressor()
        tail_xgb_regressor.fit(X_fold_train_pp, y_fold_scores_train)
        tail_rf_regressor.fit(X_fold_train_pp, y_fold_scores_train)

        y_pred_fold, _, _, _, _ = _predict_with_hybrid_model(
            preprocessor,
            threshold_models,
            tail_xgb_regressor,
            tail_rf_regressor,
            X_fold_val,
        )
        y_pred_fold_labels = pd.Series(y_pred_fold).map(LABEL_REVERSE)

        score = f1_score(y_fold_grades_val, y_pred_fold_labels, average="weighted", zero_division=0)
        cv_scores.append(float(score) * 100)

    return round(float(np.mean(cv_scores)), 2), round(float(np.std(cv_scores)), 2)


def train_all_models(df: pd.DataFrame) -> dict:
    training_df = _clean_training_frame(df)
    X = training_df[ALL_FEATURES].copy()
    y_grades = training_df["Grade"].copy()
    y_scores = training_df["Exam_Score"].astype(float).copy()
    y_labels = y_grades.map(LABEL_MAP).astype(int)

    print("\n" + "=" * 62)
    print("8-CLASS GRADE DISTRIBUTION (fixed thresholds)")
    for grade in GRADE_LABELS:
        count = int((y_grades == grade).sum())
        pct = count / len(y_grades) * 100
        print(f"  {grade:6s}: {count:5d} ({pct:.2f}%)")

    X_train, X_test, y_train_grades, y_test_grades, y_train_scores, _, y_train_labels, y_test_labels = train_test_split(
        X,
        y_grades,
        y_scores,
        y_labels,
        test_size=0.2,
        random_state=42,
        stratify=y_grades,
    )
    print(f"\nSplit -> train: {len(X_train)}, test: {len(X_test)}")

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    all_metrics: dict = {}

    print("\n" + "=" * 62)
    print("BASELINE COMPARISON")

    xgb_pipeline = _build_xgb_baseline_pipeline()
    xgb_pipeline.fit(X_train, y_train_labels)
    y_pred_xgb = xgb_pipeline.predict(X_test)
    xgb_cv_scores = cross_val_score(
        _build_xgb_baseline_pipeline(),
        X_train,
        y_train_labels,
        cv=cv,
        scoring="f1_weighted",
        n_jobs=1,
    )
    xgb_metrics = _calc_metrics(y_test_labels.values, y_pred_xgb)
    xgb_metrics["cv_f1_mean"] = round(float(xgb_cv_scores.mean()) * 100, 2)
    xgb_metrics["cv_f1_std"] = round(float(xgb_cv_scores.std()) * 100, 2)
    all_metrics["XGBoost (Multiclass)"] = xgb_metrics
    print(
        f"  XGBoost (Multiclass)      Acc={xgb_metrics['accuracy']}%  F1={xgb_metrics['f1_score']}%"
    )

    production_preprocessor = build_preprocessor()
    X_train_pp = production_preprocessor.fit_transform(X_train)
    threshold_models = _fit_threshold_models(X_train_pp, y_train_scores)

    y_pred_ordinal, _, _ = _predict_with_ordinal_model(
        production_preprocessor, threshold_models, X_test
    )
    ordinal_metrics = _calc_metrics(y_test_labels.values, y_pred_ordinal)
    ordinal_cv_mean, ordinal_cv_std = _cross_validate_ordinal_model(
        X_train, y_train_scores, y_train_grades, cv
    )
    ordinal_metrics["cv_f1_mean"] = ordinal_cv_mean
    ordinal_metrics["cv_f1_std"] = ordinal_cv_std
    all_metrics[BASE_MODEL_NAME] = ordinal_metrics
    print(
        f"  {BASE_MODEL_NAME:26s} Acc={ordinal_metrics['accuracy']}%  F1={ordinal_metrics['f1_score']}%"
    )

    tail_xgb_regressor = _build_tail_xgb_regressor()
    tail_rf_regressor = _build_tail_rf_regressor()
    tail_xgb_regressor.fit(X_train_pp, y_train_scores)
    tail_rf_regressor.fit(X_train_pp, y_train_scores)

    y_pred_best, y_proba_best, _, hybrid_scores, uplift_mask = _predict_with_hybrid_model(
        production_preprocessor,
        threshold_models,
        tail_xgb_regressor,
        tail_rf_regressor,
        X_test,
    )
    hybrid_metrics = _calc_metrics(y_test_labels.values, y_pred_best)
    hybrid_cv_mean, hybrid_cv_std = _cross_validate_hybrid_model(
        X_train, y_train_scores, y_train_grades, cv
    )
    hybrid_metrics["cv_f1_mean"] = hybrid_cv_mean
    hybrid_metrics["cv_f1_std"] = hybrid_cv_std
    all_metrics[PRODUCTION_MODEL_NAME] = hybrid_metrics
    print(
        f"  {PRODUCTION_MODEL_NAME:26s} Acc={hybrid_metrics['accuracy']}%  F1={hybrid_metrics['f1_score']}%"
    )
    print(
        f"    Tail uplift applied to {int(uplift_mask.sum())} / {len(uplift_mask)} holdout predictions"
    )

    best_params = {
        "model_type": "ordinal_hybrid_tail_uplift",
        "base_model": "ordinal_threshold_logistic",
        "tail_regressors": "XGBRegressor + RandomForestRegressor",
        "logistic_C": LOGISTIC_CONFIG["C"],
        "solver": LOGISTIC_CONFIG["solver"],
        "max_iter": LOGISTIC_CONFIG["max_iter"],
        "threshold_models": len(THRESHOLD_SCORES),
        "score_thresholds": THRESHOLD_SCORES,
        "tail_min_base_grade": "B",
        "tail_min_score": TAIL_ROUTE_MIN_SCORE,
        "tail_xgb_extreme_cutoff": TAIL_XGB_EXTREME_CUTOFF,
        "tail_xgb_estimators": TAIL_XGB_PARAMS["n_estimators"],
        "tail_rf_estimators": TAIL_RF_PARAMS["n_estimators"],
    }

    cm = confusion_matrix(y_test_labels.values, y_pred_best, labels=list(range(NUM_CLASSES)))
    report_str = classification_report(
        y_test_labels.values,
        y_pred_best,
        labels=list(range(NUM_CLASSES)),
        target_names=GRADE_LABELS,
        zero_division=0,
    )
    report_dict = classification_report(
        y_test_labels.values,
        y_pred_best,
        labels=list(range(NUM_CLASSES)),
        target_names=GRADE_LABELS,
        output_dict=True,
        zero_division=0,
    )
    for key, value in report_dict.items():
        if isinstance(value, dict):
            for metric_name, metric_value in value.items():
                if isinstance(metric_value, float):
                    value[metric_name] = round(metric_value, 4)

    print(f"\n{report_str}")

    feature_importance = _aggregate_feature_importance(production_preprocessor, threshold_models)
    full_distribution = Counter(y_labels.tolist())
    reference_scores = _predict_numeric_scores(
        production_preprocessor,
        threshold_models,
        X,
        tail_xgb_regressor,
        tail_rf_regressor,
    )
    dynamic_grade_calibration = _build_dynamic_grade_calibration(reference_scores)

    return {
        "best_model": PRODUCTION_MODEL_NAME,
        "model_type": "ordinal_hybrid_tail_uplift",
        "preprocessor": production_preprocessor,
        "threshold_models": threshold_models,
        "tail_xgb_regressor": tail_xgb_regressor,
        "tail_rf_regressor": tail_rf_regressor,
        "best_params": best_params,
        "label_map": LABEL_MAP,
        "label_reverse": LABEL_REVERSE,
        "grade_labels": GRADE_LABELS,
        "num_classes": NUM_CLASSES,
        "dynamic_grade_calibration": dynamic_grade_calibration,
        "all_metrics": all_metrics,
        "feature_importance": feature_importance,
        "test_accuracy": hybrid_metrics["accuracy"],
        "test_f1": hybrid_metrics["f1_score"],
        "test_macro_f1": hybrid_metrics["macro_f1"],
        "confusion_matrix": cm.tolist(),
        "classification_report": report_dict,
        "classification_report_str": report_str,
        "total_samples": len(X),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "smote_applied": False,
        "smote_details": None,
        "tail_uplift_count": int(uplift_mask.sum()),
        "tail_uplift_rate": round(float(uplift_mask.mean()) * 100, 2),
        "tail_score_summary": {
            "min": round(float(np.min(hybrid_scores)), 2),
            "mean": round(float(np.mean(hybrid_scores)), 2),
            "max": round(float(np.max(hybrid_scores)), 2),
        },
        "class_distribution": {
            LABEL_REVERSE[idx]: int(full_distribution.get(idx, 0)) for idx in range(NUM_CLASSES)
        },
        "dynamic_class_distribution": dynamic_grade_calibration["reference_distribution"],
        "grade_thresholds": {
            "F": "<60",
            "D": "60-64",
            "C": "65-69",
            "B": "70-74",
            "B+": "75-79",
            "A": "80-84",
            "AA": "85-89",
            "AAA": ">=90",
        },
}


def ensure_dynamic_grade_calibration(model_info: dict, reference_df: pd.DataFrame | None) -> dict:
    if model_info.get("dynamic_grade_calibration") or reference_df is None or reference_df.empty:
        return model_info

    reference_features = reference_df.copy()
    for col in NUMERIC_FEATURES:
        reference_features[col] = (
            pd.to_numeric(reference_features.get(col, np.nan), errors="coerce")
            if col in reference_features.columns
            else np.nan
        )
    for col in CATEGORICAL_FEATURES:
        if col not in reference_features.columns:
            reference_features[col] = np.nan

    raw_scores = _predict_numeric_scores(
        model_info["preprocessor"],
        model_info["threshold_models"],
        reference_features[ALL_FEATURES],
        model_info.get("tail_xgb_regressor"),
        model_info.get("tail_rf_regressor"),
    )
    dynamic_grade_calibration = _build_dynamic_grade_calibration(raw_scores)
    model_info["dynamic_grade_calibration"] = dynamic_grade_calibration
    model_info["dynamic_class_distribution"] = dynamic_grade_calibration["reference_distribution"]
    return model_info


def _predict_with_production_model(
    model_info: dict, X: pd.DataFrame
) -> tuple[np.ndarray, np.ndarray]:
    has_tail_models = "tail_xgb_regressor" in model_info and "tail_rf_regressor" in model_info
    if has_tail_models:
        grade_pred, grade_probs, _, _, _ = _predict_with_hybrid_model(
            model_info["preprocessor"],
            model_info["threshold_models"],
            model_info["tail_xgb_regressor"],
            model_info["tail_rf_regressor"],
            X,
        )
        return grade_pred, grade_probs

    grade_pred, grade_probs, _ = _predict_with_ordinal_model(
        model_info["preprocessor"], model_info["threshold_models"], X
    )
    return grade_pred, grade_probs


def predict_single(model_info: dict, input_df: pd.DataFrame) -> dict:
    calibration = model_info.get("dynamic_grade_calibration")
    grade_pred, grade_probs, raw_scores = _predict_with_dynamic_calibration(
        model_info, input_df, calibration
    )

    cls = int(grade_pred[0])
    probs = grade_probs[0].tolist()
    return {
        "predicted_grade": model_info["label_reverse"][cls],
        "predicted_score": round(float(raw_scores[0]), 2),
        "confidence": round(probs[cls] * 100, 2),
        "probabilities": {
            model_info["grade_labels"][i]: round(p * 100, 2) for i, p in enumerate(probs)
        },
    }


def predict_batch(model_info: dict, df: pd.DataFrame) -> pd.DataFrame:
    X = df.copy()
    for col in NUMERIC_FEATURES:
        X[col] = pd.to_numeric(X.get(col, np.nan), errors="coerce") if col in X.columns else np.nan
    for col in CATEGORICAL_FEATURES:
        if col not in X.columns:
            X[col] = np.nan

    raw_scores = _predict_numeric_scores(
        model_info["preprocessor"],
        model_info["threshold_models"],
        X[ALL_FEATURES],
        model_info.get("tail_xgb_regressor"),
        model_info.get("tail_rf_regressor"),
    )
    batch_calibration = _build_dynamic_grade_calibration(raw_scores)
    grade_pred, grade_probs = _apply_dynamic_grade_calibration(raw_scores, batch_calibration)

    out = df.copy()
    out["Predicted_Score"] = [round(float(score), 2) for score in raw_scores]
    out["Predicted_Grade"] = [model_info["label_reverse"][int(pred)] for pred in grade_pred]
    out["Confidence_%"] = [
        round(float(grade_probs[row_index][int(pred)]) * 100, 2)
        for row_index, pred in enumerate(grade_pred)
    ]
    return out
