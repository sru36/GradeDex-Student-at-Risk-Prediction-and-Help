"""
app.py — FastAPI backend for GradeDex.
Serves both the REST API (/api/...) and the static frontend (/).

Run from the backend/ directory:
    uvicorn app:app --reload --port 8000

Then open http://localhost:8000 in your browser.
"""

import io
import os
import sys
from contextlib import asynccontextmanager
from typing import Optional

# Fix Windows console UTF-8 encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Path setup (works whether run from backend/ or project root) ───────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

from ml.model_v2 import train_all_models, predict_single, predict_batch, ensure_dynamic_grade_calibration
from ml.pipeline import prepare_single_input
from ml.utils import ALL_FEATURES, NUMERIC_FEATURES, CATEGORICAL_FEATURES

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR   = os.path.join(BASE_DIR, "models")
MODEL_PATH  = os.path.join(MODEL_DIR, "xgboost_model.pkl")
CSV_PATH    = os.path.join(BASE_DIR, "..", "StudentPerformanceFactors.csv")
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

# ── Global state ──────────────────────────────────────────────────────────────
model_info: Optional[dict] = None
is_training: bool = False


def load_model_from_disk():
    global model_info
    if os.path.exists(MODEL_PATH):
        model_info = joblib.load(MODEL_PATH)
        if os.path.exists(CSV_PATH):
            reference_df = pd.read_csv(CSV_PATH)
            model_info = ensure_dynamic_grade_calibration(model_info, reference_df)
        print(f"[OK] Model loaded from {MODEL_PATH}")
    else:
        print("[WARN] No saved model found. POST /api/train to train first.")


# ── Lifespan (replaces deprecated @app.on_event) ──────────────────────────────
@asynccontextmanager
async def lifespan(application: "FastAPI"):
    load_model_from_disk()
    yield   # server runs here
    # (shutdown logic could go here if needed)


# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="GradeDex API",
    description="ML-based Student at Risk Prediction & Help — ordinal threshold ensemble",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic schema ───────────────────────────────────────────────────────────
class StudentInput(BaseModel):
    Hours_Studied:             Optional[float] = None
    Attendance:                Optional[float] = None
    Parental_Involvement:      Optional[str]   = None
    Access_to_Resources:       Optional[str]   = None
    Extracurricular_Activities:Optional[str]   = None
    Sleep_Hours:               Optional[float] = None
    Previous_Scores:           Optional[float] = None
    Motivation_Level:          Optional[str]   = None
    Internet_Access:           Optional[str]   = None
    Tutoring_Sessions:         Optional[float] = None
    Family_Income:             Optional[str]   = None
    Teacher_Quality:           Optional[str]   = None
    School_Type:               Optional[str]   = None
    Peer_Influence:            Optional[str]   = None
    Physical_Activity:         Optional[float] = None
    Learning_Disabilities:     Optional[str]   = None
    Parental_Education_Level:  Optional[str]   = None
    Distance_from_Home:        Optional[str]   = None
    Gender:                    Optional[str]   = None


# ═══════════════════════════════════════════════════════════════════════════════
#  API ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model_info is not None,
        "is_training": is_training,
    }


@app.get("/api/model/info")
def get_model_info():
    if model_info is None:
        raise HTTPException(status_code=404, detail="Model not trained yet. POST /api/train first.")
    return {
        "best_model":         model_info.get("best_model", "Ordinal Logistic"),
        "model_type":         model_info.get("model_type", "ordinal_threshold_logistic"),
        "accuracy":           model_info["test_accuracy"],
        "f1_score":           model_info["test_f1"],
        "total_samples":      model_info["total_samples"],
        "train_samples":      model_info["train_samples"],
        "test_samples":       model_info["test_samples"],
        "class_distribution": model_info.get("dynamic_class_distribution", model_info["class_distribution"]),
        "smote_applied":      model_info["smote_applied"],
        "smote_details":      model_info["smote_details"],
        "best_params":        model_info["best_params"],
        "grade_labels":       model_info.get("grade_labels", []),
        "num_classes":        model_info.get("num_classes", 8),
        "features":           ALL_FEATURES,
        "model_ready":        True,
    }


@app.post("/api/train")
async def train_model():
    global model_info, is_training
    if is_training:
        raise HTTPException(status_code=409, detail="Training already in progress. Please wait.")
    if not os.path.exists(CSV_PATH):
        raise HTTPException(status_code=404, detail=f"Dataset not found: {CSV_PATH}")
    is_training = True
    try:
        df = pd.read_csv(CSV_PATH)
        model_info = train_all_models(df)
        os.makedirs(MODEL_DIR, exist_ok=True)
        joblib.dump(model_info, MODEL_PATH)
        return {
            "best_model":         model_info.get("best_model", "Ordinal Logistic"),
            "status":            "success",
            "accuracy":          model_info["test_accuracy"],
            "f1_score":          model_info["test_f1"],
            "best_params":       model_info["best_params"],
            "class_distribution":model_info["class_distribution"],
            "smote_details":     model_info["smote_details"],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        is_training = False


@app.post("/api/predict/single")
def predict_single_student(student: StudentInput):
    if model_info is None:
        raise HTTPException(status_code=404, detail="Model not trained yet.")
    input_df = prepare_single_input(student.model_dump())
    return predict_single(model_info, input_df)


@app.post("/api/predict/batch")
async def predict_batch_students(file: UploadFile = File(...)):
    if model_info is None:
        raise HTTPException(status_code=404, detail="Model not trained yet.")
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded CSV is empty.")

    # Fill missing columns with NaN — pipeline imputer handles them
    for col in NUMERIC_FEATURES:
        if col not in df.columns:
            df[col] = np.nan
    for col in CATEGORICAL_FEATURES:
        if col not in df.columns:
            df[col] = np.nan

    result_df = predict_batch(model_info, df)

    output = io.StringIO()
    result_df.to_csv(output, index=False)
    output.seek(0)

    output_filename = f"gradedex_predictions_{file.filename}"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{output_filename}"'},
    )


@app.get("/api/model/feature-importance")
def get_feature_importance():
    if model_info is None:
        raise HTTPException(status_code=404, detail="Model not trained yet.")
    fi = model_info["feature_importance"]
    return {
        "feature_importance": fi,
        "top_features": list(fi.keys())[:10],
        "top_values":   list(fi.values())[:10],
    }


@app.get("/api/model/metrics")
def get_metrics():
    if model_info is None:
        raise HTTPException(status_code=404, detail="Model not trained yet.")
    return {
        "all_metrics":  model_info["all_metrics"],
        "best_model":   model_info.get("best_model", "Ordinal Logistic"),
        "best_accuracy":model_info["test_accuracy"],
        "best_f1":      model_info["test_f1"],
    }


@app.get("/api/model/confusion-matrix")
def get_confusion_matrix():
    if model_info is None:
        raise HTTPException(status_code=404, detail="Model not trained yet.")
    return {
        "matrix":                model_info.get("confusion_matrix", []),
        "labels":                model_info.get("grade_labels", []),
        "classification_report": model_info.get("classification_report", {}),
    }


# ═══════════════════════════════════════════════════════════════════════════════
#  Serve Frontend (must be LAST — acts as catch-all fallback)
# ═══════════════════════════════════════════════════════════════════════════════
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
