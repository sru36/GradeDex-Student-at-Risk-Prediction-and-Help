"""
model.py — 8-class training, adaptive SMOTE, confusion matrix, and prediction.

Class imbalance strategy (8-grade multi-class):
  Step 1 — RandomOverSampler : brings any class with < 6 samples up to 6,
            so SMOTE k_neighbors=5 won't crash.
  Step 2 — SMOTE              : oversamples every minority class to at least
            `target_count` synthetic samples (applied to training set ONLY).

XGBoost:
  objective  = "multi:softprob"
  num_class  = 8
  Tuned via GridSearchCV (5-fold, f1_weighted scoring).

Outputs:
  - Predicted grade label  (e.g. "B+")
  - Per-class probabilities (dict, %)
  - Confusion matrix        (stored as list-of-lists in model_info)
  - Classification report   (stored as dict + string in model_info)
"""

from collections import Counter

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import (
    train_test_split, cross_val_score, GridSearchCV, StratifiedKFold
)
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    classification_report, confusion_matrix,
)
from xgboost import XGBClassifier
from imblearn.over_sampling import SMOTE, RandomOverSampler

from .pipeline import build_preprocessor, prepare_data, apply_grade_label
from .utils import (
    NUMERIC_FEATURES, CATEGORICAL_FEATURES, ALL_FEATURES,
    GRADE_LABELS, NUM_CLASSES, LABEL_MAP, LABEL_REVERSE,
)

# ── Helper: compute metrics dict ─────────────────────────────────────────────
def _calc_metrics(y_true, y_pred) -> dict:
    return {
        "accuracy":  round(float(accuracy_score(y_true, y_pred)) * 100, 2),
        "precision": round(float(precision_score(
            y_true, y_pred, average="weighted", zero_division=0)) * 100, 2),
        "recall":    round(float(recall_score(
            y_true, y_pred, average="weighted", zero_division=0)) * 100, 2),
        "f1_score":  round(float(f1_score(
            y_true, y_pred, average="weighted", zero_division=0)) * 100, 2),
    }


# ── Adaptive SMOTE (handles tiny minority classes safely) ─────────────────────
def _adaptive_smote(X_pp, y_arr, seed: int = 42):
    """
    Two-step resampling:
      1. RandomOverSampler → guarantees every class has ≥ k_neighbors+1 samples
      2. SMOTE              → generates synthetic samples up to `target_count`
    Applied ONLY to training data.
    """
    K_NEIGHBORS   = 5
    MIN_FOR_SMOTE = K_NEIGHBORS + 1               # 6 samples minimum per class

    counts = Counter(y_arr.tolist())
    print(f"\n  Class distribution before resampling:")
    for idx in sorted(counts):
        print(f"    {LABEL_REVERSE[idx]:4s} [{idx}]: {counts[idx]:5d}")

    # ── Step 1: RandomOverSampler for tiny classes ────────────────────────────
    ros_strategy = {k: MIN_FOR_SMOTE for k, v in counts.items()
                    if v < MIN_FOR_SMOTE}
    if ros_strategy:
        ros = RandomOverSampler(sampling_strategy=ros_strategy, random_state=seed)
        X_ros, y_ros = ros.fit_resample(X_pp, y_arr)
        print(f"  RandomOverSampler applied to {len(ros_strategy)} tiny class(es).")
    else:
        X_ros, y_ros = X_pp, y_arr

    # ── Step 2: SMOTE to oversample all below target count ───────────────────
    counts2     = Counter(y_ros.tolist())
    majority    = max(counts2.values())
    target_cnt  = max(500, majority // 2)          # at least 500, or half-majority

    smote_strategy = {k: target_cnt for k, v in counts2.items()
                      if v < target_cnt}
    if smote_strategy:
        smote = SMOTE(random_state=seed, k_neighbors=K_NEIGHBORS,
                      sampling_strategy=smote_strategy)
        X_bal, y_bal = smote.fit_resample(X_ros, y_ros)
    else:
        X_bal, y_bal = X_ros, y_ros

    counts3 = Counter(y_bal.tolist())
    print(f"\n  Class distribution after SMOTE:")
    for idx in sorted(counts3):
        print(f"    {LABEL_REVERSE[idx]:4s} [{idx}]: {counts3[idx]:5d}")

    smote_details = {
        "original":    {LABEL_REVERSE[k]: v for k, v in counts.items()},
        "after_smote": {LABEL_REVERSE[k]: v for k, v in counts3.items()},
    }
    return X_bal, y_bal, smote_details


# ── Main training function ────────────────────────────────────────────────────
def train_all_models(df: pd.DataFrame) -> dict:
    """
    Full 8-class ML pipeline:
      1. Parse & grade-label data
      2. Stratified 80/20 split (falls back if any class < 2 samples)
      3. Preprocessor fit on train, transform train + test
      4. Adaptive SMOTE on training set only
      5. Baseline comparison of 5 models (5-fold stratified CV)
      6. GridSearchCV hyperparameter tuning for XGBoost
      7. Compute confusion matrix + classification report
    """
    X, y_str, thresholds = prepare_data(df)
    y = y_str.map(LABEL_MAP).astype(int)

    print("\n" + "="*62)
    print("8-CLASS GRADE DISTRIBUTION  (quantile-based thresholds)")
    t = thresholds
    boundaries = [
        ("F",   f"< {t[0]:.1f}"),
        ("D",   f"{t[0]:.1f} – {t[1]:.1f}"),
        ("C",   f"{t[1]:.1f} – {t[2]:.1f}"),
        ("B",   f"{t[2]:.1f} – {t[3]:.1f}"),
        ("B+",  f"{t[3]:.1f} – {t[4]:.1f}"),
        ("A",   f"{t[4]:.1f} – {t[5]:.1f}"),
        ("AA",  f"{t[5]:.1f} – {t[6]:.1f}"),
        ("AAA", f">= {t[6]:.1f}"),
    ]
    for grade in GRADE_LABELS:
        cnt = (y_str == grade).sum()
        pct = cnt / len(y_str) * 100
        rng = next(r for g, r in boundaries if g == grade)
        print(f"  {grade:4s} (score {rng:16s}): {cnt:5d}  ({pct:.1f}%)")

    # ── Stratified split (safe fallback) ──────────────────────────────────────
    class_min = int(y.value_counts().min())
    strat = y if class_min >= 2 else None
    if strat is None:
        print("[WARN] Some classes have <2 samples — skipping stratification.")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=strat
    )
    print(f"\nSplit -> train: {len(X_train)}, test: {len(X_test)}")

    # ── Preprocessing ─────────────────────────────────────────────────────────
    preprocessor = build_preprocessor()
    X_train_pp = preprocessor.fit_transform(X_train)
    X_test_pp  = preprocessor.transform(X_test)
    print(f"Preprocessing done. NaNs remaining: {np.isnan(X_train_pp).sum()}")

    # ── Adaptive SMOTE (training only) ────────────────────────────────────────
    print("\nAPPLYING ADAPTIVE SMOTE (training set only)...")
    X_train_bal, y_train_bal, smote_details = _adaptive_smote(
        X_train_pp, y_train.values.astype(int)
    )

    # ── Baseline model comparison ─────────────────────────────────────────────
    baseline_models = {
        "Logistic Regression": LogisticRegression(
            max_iter=1000, random_state=42, solver="lbfgs"),
        "Random Forest":       RandomForestClassifier(
            n_estimators=150, random_state=42, n_jobs=-1),
        "SVM":                 SVC(
            probability=True, random_state=42, kernel="rbf"),
        "Gradient Boosting":   GradientBoostingClassifier(
            n_estimators=100, random_state=42),
        "XGBoost (default)":   XGBClassifier(
            objective="multi:softprob", num_class=NUM_CLASSES,
            eval_metric="mlogloss", random_state=42, verbosity=0),
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    all_metrics: dict = {}

    print("\n" + "="*62)
    print("TRAINING BASELINE MODELS")
    for name, mdl in baseline_models.items():
        print(f"  [{name}] ...", end=" ", flush=True)
        mdl.fit(X_train_bal, y_train_bal)
        y_pred = mdl.predict(X_test_pp)
        cv_sc  = cross_val_score(mdl, X_train_bal, y_train_bal,
                                 cv=cv, scoring="f1_weighted", n_jobs=-1)
        m = _calc_metrics(y_test.values, y_pred)
        m["cv_f1_mean"] = round(float(cv_sc.mean()) * 100, 2)
        m["cv_f1_std"]  = round(float(cv_sc.std())  * 100, 2)
        all_metrics[name] = m
        print(f"Acc={m['accuracy']}%  F1={m['f1_score']}%")

    # ── XGBoost GridSearchCV ───────────────────────────────────────────────────
    print("\n" + "="*62)
    print("HYPERPARAMETER TUNING — XGBoost (GridSearchCV, 5-fold)")
    param_grid = {
        "max_depth":        [3, 5, 7],
        "n_estimators":     [100, 200],
        "learning_rate":    [0.05, 0.1, 0.2],
        "subsample":        [0.8, 1.0],
        "colsample_bytree": [0.8, 1.0],
    }
    xgb_base = XGBClassifier(
        objective="multi:softprob", num_class=NUM_CLASSES,
        eval_metric="mlogloss", random_state=42, verbosity=0,
    )
    grid_search = GridSearchCV(
        xgb_base, param_grid,
        cv=5, scoring="f1_weighted",
        n_jobs=-1, verbose=1, refit=True,
    )
    grid_search.fit(X_train_bal, y_train_bal)
    best_xgb    = grid_search.best_estimator_
    best_params = grid_search.best_params_

    y_pred_best  = best_xgb.predict(X_test_pp)
    y_proba_best = best_xgb.predict_proba(X_test_pp)

    print(f"\nBest params: {best_params}")

    # ── Confusion matrix ──────────────────────────────────────────────────────
    cm = confusion_matrix(y_test.values, y_pred_best, labels=list(range(NUM_CLASSES)))
    cm_list = cm.tolist()

    # ── Classification report ─────────────────────────────────────────────────
    report_str  = classification_report(
        y_test.values, y_pred_best,
        target_names=GRADE_LABELS, zero_division=0,
    )
    report_dict = classification_report(
        y_test.values, y_pred_best,
        target_names=GRADE_LABELS, output_dict=True, zero_division=0,
    )
    # Round all floats in report_dict
    for key in report_dict:
        if isinstance(report_dict[key], dict):
            for k2 in report_dict[key]:
                v = report_dict[key][k2]
                if isinstance(v, float):
                    report_dict[key][k2] = round(v, 4)
    print(f"\n{report_str}")

    # ── Tuned XGBoost metrics ─────────────────────────────────────────────────
    m_tuned = _calc_metrics(y_test.values, y_pred_best)
    m_tuned["cv_f1_mean"]  = round(float(grid_search.best_score_) * 100, 2)
    m_tuned["cv_f1_std"]   = 0.0
    m_tuned["best_params"] = best_params
    all_metrics["XGBoost (Tuned)"] = m_tuned

    # ── Feature importance ────────────────────────────────────────────────────
    feature_names = NUMERIC_FEATURES + CATEGORICAL_FEATURES
    fi_raw   = best_xgb.feature_importances_.tolist()
    fi_dict  = dict(zip(feature_names, fi_raw))
    fi_sorted = dict(sorted(fi_dict.items(), key=lambda x: x[1], reverse=True))

    model_info = {
        # Prediction assets
        "preprocessor":            preprocessor,
        "best_xgb":                best_xgb,
        "best_params":             best_params,
        "label_map":               LABEL_MAP,
        "label_reverse":           LABEL_REVERSE,
        "grade_labels":            GRADE_LABELS,
        "num_classes":             NUM_CLASSES,
        # Metrics
        "all_metrics":             all_metrics,
        "feature_importance":      fi_sorted,
        "test_accuracy":           m_tuned["accuracy"],
        "test_f1":                 m_tuned["f1_score"],
        # Confusion matrix & report
        "confusion_matrix":        cm_list,
        "classification_report":   report_dict,
        "classification_report_str": report_str,
        # Data info
        "total_samples":           len(df),
        "train_samples":           len(X_train),
        "test_samples":            len(X_test),
        "smote_applied":           True,
        "smote_details":           smote_details,
        "class_distribution":      smote_details["after_smote"],
        "grade_thresholds":        thresholds,   # [t1..t7] quantile boundaries
    }
    return model_info


# ── Single-student prediction ─────────────────────────────────────────────────
def predict_single(model_info: dict, input_df: pd.DataFrame) -> dict:
    preprocessor   = model_info["preprocessor"]
    best_xgb       = model_info["best_xgb"]
    label_reverse  = model_info["label_reverse"]
    grade_labels   = model_info["grade_labels"]

    X_pp    = preprocessor.transform(input_df)
    y_pred  = best_xgb.predict(X_pp)
    y_proba = best_xgb.predict_proba(X_pp)

    cls     = int(y_pred[0])
    probs   = y_proba[0].tolist()

    return {
        "predicted_grade": label_reverse[cls],
        "confidence":      round(probs[cls] * 100, 2),
        "probabilities":   {
            grade_labels[i]: round(p * 100, 2)
            for i, p in enumerate(probs)
        },
    }


# ── Batch prediction ──────────────────────────────────────────────────────────
def predict_batch(model_info: dict, df: pd.DataFrame) -> pd.DataFrame:
    preprocessor   = model_info["preprocessor"]
    best_xgb       = model_info["best_xgb"]
    label_reverse  = model_info["label_reverse"]

    X = df.copy()
    for col in NUMERIC_FEATURES:
        X[col] = pd.to_numeric(X.get(col, np.nan), errors="coerce") \
                 if col in X.columns else np.nan
    for col in CATEGORICAL_FEATURES:
        if col not in X.columns:
            X[col] = np.nan

    X_pp    = preprocessor.transform(X[ALL_FEATURES])
    y_pred  = best_xgb.predict(X_pp)
    y_proba = best_xgb.predict_proba(X_pp)

    out = df.copy()
    out["Predicted_Grade"] = [label_reverse[int(p)] for p in y_pred]
    out["Confidence_%"]    = [
        round(float(y_proba[i][int(p)]) * 100, 2) for i, p in enumerate(y_pred)
    ]
    return out
