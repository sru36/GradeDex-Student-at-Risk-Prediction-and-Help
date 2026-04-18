"""
model_v3.py - fixed 8-grade XGBoost training with a routed high-grade expert.

Architecture:
  1. Global model: 8-class XGBoost (`multi:softprob`) over F..AAA.
  2. High-grade specialist: 4-class XGBoost over B+, A, AA, AAA.
  3. Routing: if the global model assigns enough probability mass to the
     upper-grade block, the specialist may override the prediction to
     A / AA / AAA.
"""

from collections import Counter
import os

import numpy as np
import pandas as pd
from imblearn.over_sampling import RandomOverSampler
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
from xgboost import XGBClassifier

from .pipeline import build_preprocessor, prepare_data
from .utils import (
    ALL_FEATURES,
    CATEGORICAL_FEATURES,
    GRADE_LABELS,
    LABEL_MAP,
    LABEL_REVERSE,
    NUMERIC_FEATURES,
    NUM_CLASSES,
)

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

HIGH_GRADE_START = 4
SPECIALIST_LABELS = ["B+", "A", "AA", "AAA"]
ROUTE_THRESHOLD_CANDIDATES = [0.05, 0.08, 0.10, 0.12]

GLOBAL_XGB_PARAMS = {
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

SPECIALIST_XGB_PARAMS = {
    "objective": "multi:softprob",
    "num_class": 4,
    "eval_metric": "mlogloss",
    "random_state": 42,
    "verbosity": 0,
    "n_estimators": 300,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.9,
    "colsample_bytree": 1.0,
    "min_child_weight": 1,
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


def _build_global_model() -> XGBClassifier:
    return XGBClassifier(**GLOBAL_XGB_PARAMS)


def _build_high_grade_model() -> XGBClassifier:
    return XGBClassifier(**SPECIALIST_XGB_PARAMS)


def _aggregate_feature_importance(preprocessor, importances) -> dict:
    transformed_names = preprocessor.get_feature_names_out()
    grouped = {feature: 0.0 for feature in ALL_FEATURES}

    for transformed_name, importance in zip(transformed_names, importances):
        raw_name = transformed_name.split("__", 1)[1]
        source_feature = next(
            (
                feature
                for feature in ALL_FEATURES
                if raw_name == feature or raw_name.startswith(f"{feature}_")
            ),
            raw_name,
        )
        grouped[source_feature] = grouped.get(source_feature, 0.0) + float(importance)

    return dict(sorted(grouped.items(), key=lambda item: item[1], reverse=True))


def _fit_high_grade_specialist(X_train: pd.DataFrame, y_train: pd.Series):
    mask = y_train >= HIGH_GRADE_START
    specialist_preprocessor = build_preprocessor()
    X_high = specialist_preprocessor.fit_transform(X_train.loc[mask])
    y_high = y_train.loc[mask].astype(int) - HIGH_GRADE_START

    original_counts = Counter(y_high.tolist())
    sampling_strategy = {
        label: 60
        for label in [1, 2, 3]
        if original_counts.get(label, 0) < 60
    }
    if sampling_strategy:
        ros = RandomOverSampler(random_state=42, sampling_strategy=sampling_strategy)
        X_high, y_high = ros.fit_resample(X_high, y_high)

    after_counts = Counter(y_high.tolist())
    specialist = _build_high_grade_model()
    specialist.fit(X_high, y_high)

    imbalance_details = {
        "original": {SPECIALIST_LABELS[idx]: int(original_counts.get(idx, 0)) for idx in range(4)},
        "after_resample": {SPECIALIST_LABELS[idx]: int(after_counts.get(idx, 0)) for idx in range(4)},
    }
    return specialist_preprocessor, specialist, imbalance_details


def _predict_with_routing(
    global_preprocessor,
    global_model,
    specialist_preprocessor,
    specialist_model,
    X: pd.DataFrame,
    route_threshold: float,
):
    X_global = global_preprocessor.transform(X)
    global_probs = global_model.predict_proba(X_global)
    global_pred = global_probs.argmax(axis=1)

    X_specialist = specialist_preprocessor.transform(X)
    specialist_probs = specialist_model.predict_proba(X_specialist)
    specialist_pred = specialist_probs.argmax(axis=1) + HIGH_GRADE_START

    high_block_mass = global_probs[:, HIGH_GRADE_START:].sum(axis=1)
    override_mask = (high_block_mass >= route_threshold) & (specialist_pred >= 5)

    final_pred = global_pred.copy()
    final_pred[override_mask] = specialist_pred[override_mask]

    final_probs = global_probs.copy()
    if np.any(override_mask):
        final_probs[override_mask, :HIGH_GRADE_START] = 0.0
        final_probs[override_mask, HIGH_GRADE_START:] = specialist_probs[override_mask]

    return final_pred, final_probs, override_mask


def _select_route_threshold(X_train: pd.DataFrame, y_train: pd.Series):
    X_inner_train, X_val, y_inner_train, y_val = train_test_split(
        X_train, y_train, test_size=0.2, random_state=42, stratify=y_train
    )

    global_preprocessor = build_preprocessor()
    X_inner_pp = global_preprocessor.fit_transform(X_inner_train)
    global_model = _build_global_model()
    global_model.fit(X_inner_pp, y_inner_train)

    specialist_preprocessor, specialist_model, _ = _fit_high_grade_specialist(
        X_inner_train, y_inner_train
    )

    best_choice = None
    for threshold in ROUTE_THRESHOLD_CANDIDATES:
        y_pred, _, _ = _predict_with_routing(
            global_preprocessor,
            global_model,
            specialist_preprocessor,
            specialist_model,
            X_val,
            threshold,
        )
        metrics = _calc_metrics(y_val.values, y_pred)
        pred_counts = Counter(y_pred.tolist())
        has_all_top_grades = all(pred_counts.get(label, 0) > 0 for label in [5, 6, 7])
        choice = {
            "threshold": threshold,
            "metrics": metrics,
            "predicted_top_counts": {
                LABEL_REVERSE[label]: int(pred_counts.get(label, 0))
                for label in [5, 6, 7]
            },
            "has_all_top_grades": has_all_top_grades,
        }

        if best_choice is None:
            best_choice = choice
            continue

        if choice["has_all_top_grades"] and not best_choice["has_all_top_grades"]:
            best_choice = choice
        elif choice["has_all_top_grades"] == best_choice["has_all_top_grades"]:
            if choice["metrics"]["f1_score"] > best_choice["metrics"]["f1_score"]:
                best_choice = choice

    return best_choice


def train_all_models(df: pd.DataFrame) -> dict:
    X, y_str = prepare_data(df)
    y = y_str.map(LABEL_MAP).astype(int)

    print("\n" + "=" * 62)
    print("8-CLASS GRADE DISTRIBUTION (fixed thresholds)")
    for grade in GRADE_LABELS:
        count = int((y_str == grade).sum())
        pct = count / len(y_str) * 100
        print(f"  {grade:4s}: {count:5d} ({pct:.2f}%)")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"\nSplit -> train: {len(X_train)}, test: {len(X_test)}")

    route_selection = _select_route_threshold(X_train, y_train)
    route_threshold = route_selection["threshold"]
    print(
        "\nSelected high-grade route threshold:",
        route_threshold,
        route_selection["predicted_top_counts"],
    )

    global_preprocessor = build_preprocessor()
    X_train_global = global_preprocessor.fit_transform(X_train)
    global_model = _build_global_model()
    global_model.fit(X_train_global, y_train)

    specialist_preprocessor, specialist_model, imbalance_details = _fit_high_grade_specialist(
        X_train, y_train
    )

    X_test_global = global_preprocessor.transform(X_test)
    global_pred = global_model.predict(X_test_global)
    global_metrics = _calc_metrics(y_test.values, global_pred)

    routed_pred, routed_probs, override_mask = _predict_with_routing(
        global_preprocessor,
        global_model,
        specialist_preprocessor,
        specialist_model,
        X_test,
        route_threshold,
    )
    routed_metrics = _calc_metrics(y_test.values, routed_pred)

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    global_pipeline = Pipeline(
        steps=[
            ("preprocessor", build_preprocessor()),
            ("model", _build_global_model()),
        ]
    )
    cv_scores = cross_val_score(
        global_pipeline,
        X_train,
        y_train,
        cv=cv,
        scoring="f1_weighted",
        n_jobs=1,
    )
    global_metrics["cv_f1_mean"] = round(float(cv_scores.mean()) * 100, 2)
    global_metrics["cv_f1_std"] = round(float(cv_scores.std()) * 100, 2)

    routed_metrics["cv_f1_mean"] = route_selection["metrics"]["f1_score"]
    routed_metrics["cv_f1_std"] = 0.0

    print("\n" + "=" * 62)
    print("MODEL RESULTS")
    print(
        f"  XGBoost (global): Acc={global_metrics['accuracy']}%  F1={global_metrics['f1_score']}%"
    )
    print(
        f"  XGBoost (routed): Acc={routed_metrics['accuracy']}%  F1={routed_metrics['f1_score']}%"
    )
    print(f"  Routed overrides on test set: {int(override_mask.sum())}")

    cm = confusion_matrix(y_test.values, routed_pred, labels=list(range(NUM_CLASSES)))
    report_str = classification_report(
        y_test.values,
        routed_pred,
        labels=list(range(NUM_CLASSES)),
        target_names=GRADE_LABELS,
        zero_division=0,
    )
    report_dict = classification_report(
        y_test.values,
        routed_pred,
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

    feature_importance = _aggregate_feature_importance(
        global_preprocessor, global_model.feature_importances_.tolist()
    )
    class_distribution = Counter(y.tolist())

    all_metrics = {
        "XGBoost (global)": global_metrics,
        "XGBoost (Routed)": routed_metrics,
    }

    best_params = {
        **{
            key: value
            for key, value in GLOBAL_XGB_PARAMS.items()
            if key in {"n_estimators", "max_depth", "learning_rate", "subsample", "colsample_bytree", "min_child_weight"}
        },
        "high_grade_route_threshold": route_threshold,
    }

    return {
        "preprocessor": global_preprocessor,
        "best_xgb": global_model,
        "high_grade_preprocessor": specialist_preprocessor,
        "high_grade_xgb": specialist_model,
        "high_grade_route_threshold": route_threshold,
        "best_params": best_params,
        "label_map": LABEL_MAP,
        "label_reverse": LABEL_REVERSE,
        "grade_labels": GRADE_LABELS,
        "num_classes": NUM_CLASSES,
        "all_metrics": all_metrics,
        "feature_importance": feature_importance,
        "test_accuracy": routed_metrics["accuracy"],
        "test_f1": routed_metrics["f1_score"],
        "test_macro_f1": routed_metrics["macro_f1"],
        "confusion_matrix": cm.tolist(),
        "classification_report": report_dict,
        "classification_report_str": report_str,
        "total_samples": len(X),
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "smote_applied": False,
        "smote_details": None,
        "imbalance_details": imbalance_details,
        "class_distribution": {
            LABEL_REVERSE[idx]: int(class_distribution.get(idx, 0))
            for idx in range(NUM_CLASSES)
        },
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


def predict_single(model_info: dict, input_df: pd.DataFrame) -> dict:
    y_pred, y_probs, _ = _predict_with_routing(
        model_info["preprocessor"],
        model_info["best_xgb"],
        model_info["high_grade_preprocessor"],
        model_info["high_grade_xgb"],
        input_df,
        model_info["high_grade_route_threshold"],
    )

    cls = int(y_pred[0])
    probs = y_probs[0].tolist()
    return {
        "predicted_grade": model_info["label_reverse"][cls],
        "confidence": round(probs[cls] * 100, 2),
        "probabilities": {
            model_info["grade_labels"][i]: round(p * 100, 2)
            for i, p in enumerate(probs)
        },
    }


def predict_batch(model_info: dict, df: pd.DataFrame) -> pd.DataFrame:
    X = df.copy()
    for col in NUMERIC_FEATURES:
        X[col] = pd.to_numeric(X.get(col, np.nan), errors="coerce") if col in X.columns else np.nan
    for col in CATEGORICAL_FEATURES:
        if col not in X.columns:
            X[col] = np.nan

    y_pred, y_probs, _ = _predict_with_routing(
        model_info["preprocessor"],
        model_info["best_xgb"],
        model_info["high_grade_preprocessor"],
        model_info["high_grade_xgb"],
        X[ALL_FEATURES],
        model_info["high_grade_route_threshold"],
    )

    out = df.copy()
    out["Predicted_Grade"] = [model_info["label_reverse"][int(pred)] for pred in y_pred]
    out["Confidence_%"] = [
        round(float(y_probs[row_index][int(pred)]) * 100, 2)
        for row_index, pred in enumerate(y_pred)
    ]
    return out
