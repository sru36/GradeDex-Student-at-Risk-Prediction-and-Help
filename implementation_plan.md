# GradeDex - Student at Risk Prediction & Help

## Overview

**GradeDex** is an end-to-end ML web application for student risk prediction, grade forecasting, and intervention support using structured input data. Inspired by the research paper *"Predicting Student Performance Using Deep Learning and Machine Learning Techniques"*, but limited strictly to **Machine Learning** (no deep learning).

The app has a Python (FastAPI) backend with a trained ML pipeline and a rich, modern HTML/CSS/JS frontend.

---

## Dataset Analysis

The `StudentPerformanceFactors.csv` has **6,608 student records** with **19 features + 1 target**:

| Feature | Type | Notes |
|---|---|---|
| `Hours_Studied` | Numeric | 1–43 |
| `Attendance` | Numeric | 60–100 |
| `Parental_Involvement` | Categorical | Low / Medium / High |
| `Access_to_Resources` | Categorical | Low / Medium / High |
| `Extracurricular_Activities` | Categorical | Yes / No |
| `Sleep_Hours` | Numeric | 4–10 |
| `Previous_Scores` | Numeric | 50–100 |
| `Motivation_Level` | Categorical | Low / Medium / High |
| `Internet_Access` | Categorical | Yes / No |
| `Tutoring_Sessions` | Numeric | 0–6 |
| `Family_Income` | Categorical | Low / Medium / High |
| `Teacher_Quality` | Categorical | Low / Medium / High |
| `School_Type` | Categorical | Public / Private |
| `Peer_Influence` | Categorical | Negative / Neutral / Positive |
| `Physical_Activity` | Numeric | 0–6 |
| `Learning_Disabilities` | Categorical | Yes / No |
| `Parental_Education_Level` | Categorical | High School / College / Postgraduate |
| `Distance_from_Home` | Categorical | Near / Moderate / Far |
| `Gender` | Categorical | Male / Female |
| **`Exam_Score`** | **Target** | Numeric, 55–101 |

**Target engineering**: `Exam_Score` will be bucketed into 3 classes:
- **Low**: Exam_Score < 65
- **Medium**: Exam_Score 65–79
- **High**: Exam_Score ≥ 80

Some rows have a few outlier scores (e.g., 89, 97, 100, 101) — we'll keep them and let the model handle via robust cross-validation.

Missing values are present in some categorical columns (`Teacher_Quality`, `Distance_from_Home`, `Parental_Education_Level`) — will be imputed.

---

## Architecture

```
s:\UNI\macro\StudentPerfomancePrediction\
├── StudentPerformanceFactors.csv      # Source dataset
├── backend/
│   ├── app.py                         # FastAPI entry point
│   ├── ml/
│   │   ├── pipeline.py                # Preprocessing & training pipeline
│   │   ├── model.py                   # XGBoost + other model definitions
│   │   └── utils.py                   # Feature helpers, class mapping
│   ├── models/                        # Saved .pkl model files
│   │   └── xgboost_model.pkl
│   ├── requirements.txt
│   └── train.py                       # Standalone training script
└── frontend/
    ├── index.html                     # Main single-page app
    ├── css/
    │   └── style.css                  # Full design system
    └── js/
        ├── app.js                     # Main JS orchestration
        ├── api.js                     # API call wrappers
        ├── charts.js                  # Chart.js visualizations
        └── ui.js                      # DOM update helpers
```

---

## Proposed Changes

### Backend

#### [NEW] `backend/requirements.txt`
Python dependencies: `fastapi`, `uvicorn`, `scikit-learn`, `xgboost`, `pandas`, `numpy`, `imbalanced-learn`, `joblib`, `python-multipart`.

#### [NEW] `backend/ml/utils.py`
- Feature column lists (numeric / categorical)
- Grade label mapping (Low / Medium / High and thresholds)
- Missing value fill strategies per column

#### [NEW] `backend/ml/pipeline.py`
- `build_preprocessor()` — `ColumnTransformer` with:
  - `SimpleImputer` (median) + `StandardScaler` for numeric
  - `SimpleImputer` (most_frequent) + `OrdinalEncoder` for categoricals
- `build_pipeline(model)` — wraps preprocessor + classifier in sklearn `Pipeline`
- Returns fitted pipeline + label encoder

#### [NEW] `backend/ml/model.py`
Defines all 5 models to train & compare:
1. `XGBoostClassifier` (primary, with `GridSearchCV`)
2. `RandomForestClassifier`
3. `LogisticRegression`
4. `SVC`
5. `GradientBoostingClassifier`

Returns best XGBoost pipeline + comparison metrics for all models.

#### [NEW] `backend/train.py`
- Loads CSV, engineers target label, calls `pipeline.py`
- Performs 80/20 stratified split
- Trains all models, prints metrics table
- Saves best model to `backend/models/xgboost_model.pkl`

#### [NEW] `backend/app.py`
FastAPI app with these endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/model/info` | Model metadata, accuracy, features |
| `POST` | `/api/train` | Re-train model from CSV |
| `POST` | `/api/predict/single` | Predict for one student (JSON body) |
| `POST` | `/api/predict/batch` | Upload CSV, returns CSV with `Predicted_Grade` + `Confidence` |
| `GET` | `/api/model/feature-importance` | Feature importance from XGBoost |
| `GET` | `/api/model/metrics` | Full metrics report (all models) |

CORS enabled for local dev (all origins allowed).

---

### Frontend

#### [NEW] `frontend/index.html`
Single-page, tab-based layout with 5 sections:
1. **Dashboard** — overview cards (model accuracy, total trained, class distribution donut chart)
2. **Model Info** — metrics table for all models, parameter controls (sliders for max_depth, n_estimators, learning_rate), feature importance bar chart
3. **Manual Predict** — full form with all 19 input fields, live prediction result card with animated confidence bars
4. **Bulk Upload** — drag-and-drop CSV upload, preview table, process button, results table with download button
5. **About** — project methodology, dataset info

#### [NEW] `frontend/css/style.css`
Premium dark-mode design:
- Color palette: indigo/violet primary (`#6366f1`), dark slate backgrounds (`#0f0f1a`, `#1a1a2e`)
- Glass-morphism cards (`backdrop-filter: blur`)
- CSS custom properties for all tokens
- Smooth tab transitions + micro-animations
- Animated gradient hero header
- Responsive grid layout

#### [NEW] `frontend/js/app.js`
- Tab navigation logic
- Train model button flow
- Page load initialization

#### [NEW] `frontend/js/api.js`
- `fetchModelInfo()`, `trainModel()`, `predictSingle()`, `predictBatch(file)` 
- All calls go to `http://localhost:8000/api/...`
- Handles loading states and error toasts

#### [NEW] `frontend/js/charts.js`
- `renderFeatureImportanceChart(data)` — horizontal bar chart (Chart.js)
- `renderClassDistributionChart(data)` — donut chart
- `renderModelComparisonChart(data)` — grouped bar chart (accuracy, F1, etc.)

#### [NEW] `frontend/js/ui.js`
- `showPredictionResult(data)` — animated result card
- `renderBulkResultsTable(data)` — paginated table
- `updateMetricsCards(data)` — update dashboard counters
- Toast notification system

---

## ML Pipeline Details

### Preprocessing
1. Drop rows where `Exam_Score` is null
2. Create `Grade` column: Low (< 65) / Medium (65–79) / High (≥ 80)
3. Numeric imputation → StandardScaler
4. Categorical imputation (mode) → OrdinalEncoder
5. Handle outlier exam scores by keeping them (they belong to `High` class)

### Class Imbalance
Check distribution after bucketing. If imbalanced, use **SMOTE** from `imbalanced-learn` on training set only.

### Model Selection
- GridSearchCV on XGBoost: `max_depth` ∈ {3,5,7}, `n_estimators` ∈ {100,200}, `learning_rate` ∈ {0.05, 0.1, 0.2}
- 5-fold CV, `f1_weighted` scoring

### Output
Each prediction returns:
- `predicted_grade`: Low / Medium / High
- `confidence`: probability of predicted class (%)
- `probabilities`: dict with all class probabilities

---

## Verification Plan

### Automated
1. Run `python backend/train.py` — should finish without errors, save model
2. Run `uvicorn backend.app:app --reload` — server starts on port 8000
3. Test endpoints via browser or curl:
   - `GET /api/model/info` → returns JSON with accuracy
   - `POST /api/predict/single` with sample JSON → returns grade
   - `POST /api/predict/batch` with CSV → returns downloadable CSV
4. Open `frontend/index.html` in browser — full UI loads, charts render

### Manual QA
- Verify dashboard loads with accurate metrics
- Submit manual form → result card appears with grade + confidence
- Upload the original CSV → verify `Predicted_Grade` column appears and file downloads

---

## Open Questions

> [!IMPORTANT]
> **Backend port**: The frontend will call `http://localhost:8000`. Are you okay running the FastAPI backend on port 8000?

> [!NOTE]
> **Target bucketing**: Scores < 65 = Low, 65–79 = Medium, ≥ 80 = High. The dataset has very few High scores (outliers like 86, 89, 94, 97, 100, 101 appear). This may create class imbalance — SMOTE will handle it.

> [!NOTE]
> **Run method**: The backend is a Python server. You'll need Python + pip installed. I'll provide a `requirements.txt` and clear run instructions.
