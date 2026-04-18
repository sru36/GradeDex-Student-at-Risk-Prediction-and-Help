"""
train.py — Standalone training script for GradeDex.
Run from the backend/ directory:
    python train.py

Trains the ordinal threshold ensemble, benchmarks it against multiclass XGBoost,
and saves the resulting model package to models/xgboost_model.pkl.
"""

import os
import sys

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Path setup ────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import joblib
import pandas as pd

from ml.model_v2 import train_all_models
from ml.utils import score_to_grade

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
CSV_PATH  = os.path.join(BASE_DIR, "..", "StudentPerformanceFactors.csv")
MODEL_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "xgboost_model.pkl")


def main():
    # ── Load ──────────────────────────────────────────────────────────────────
    print(f"Loading dataset: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    print(f"Rows: {df.shape[0]}  |  Columns: {df.shape[1]}")

    # ── Missing value report ──────────────────────────────────────────────────
    missing = df.isnull().sum()
    missing = missing[missing > 0]
    if not missing.empty:
        print("\nMissing values detected:")
        for col, cnt in missing.items():
            print(f"  {col:30s}: {cnt} missing ({cnt/len(df)*100:.2f}%)")
        print("  → All will be imputed by the preprocessing pipeline.\n")
    else:
        print("No missing values detected.\n")

    # ── Grade distribution ────────────────────────────────────────────────────
    df["Grade"] = df["Exam_Score"].apply(score_to_grade)
    print("Grade distribution (before SMOTE):")
    print(df["Grade"].value_counts().sort_index())

    # ── Train ─────────────────────────────────────────────────────────────────
    model_info = train_all_models(df)

    # ── Save ─────────────────────────────────────────────────────────────────
    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(model_info, MODEL_PATH)
    print(f"\n[SAVED] Model saved -> {MODEL_PATH}")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("FINAL RESULTS SUMMARY")
    print("="*60)
    print(f"Best Model            : {model_info.get('best_model', 'Ordinal Logistic')}")
    print(f"Best Accuracy         : {model_info['test_accuracy']}%")
    print(f"Best F1 Score         : {model_info['test_f1']}%")
    print(f"Model Configuration   : {model_info['best_params']}")
    print("\nAll Model Comparison:")
    print(f"{'Model':30s}{'Accuracy':>10}{'F1':>10}{'CV-F1':>12}")
    print("-"*62)
    for name, m in model_info["all_metrics"].items():
        cv = f"{m.get('cv_f1_mean', 0):.2f}%"
        print(f"{name:30s}{m['accuracy']:>9.2f}%{m['f1_score']:>9.2f}%{cv:>12}")


if __name__ == "__main__":
    main()
