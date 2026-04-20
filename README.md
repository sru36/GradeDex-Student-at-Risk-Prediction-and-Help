# GradeDex - Student at Risk Prediction & Help

An end-to-end ML web application for student risk prediction, grade forecasting,
and intervention support using an ordinal threshold ensemble with robust
missing-value handling.

---

## Quick Start

### Step 1 — Install Python dependencies

```powershell
cd s:\UNI\macro\StudentPerfomancePrediction\backend
pip install -r requirements.txt
```

### Step 2 — Train the model

```powershell
# From the backend/ directory:
python train.py
```

Training can take **several minutes** (GridSearchCV with SMOTE-aware 5-fold CV).
The trained model is saved to `backend/models/xgboost_model.pkl`.

### Step 3 — Start the backend server

```powershell
# From the backend/ directory:
uvicorn app:app --reload --port 8000
```

### Step 4 — Open the app

Navigate to **http://localhost:8000** in your browser.

---

## Project Structure

```
StudentPerformanceFactors.csv        ← raw dataset (6,608 rows)
backend/
├── app.py                           ← FastAPI server (API + static frontend)
├── train.py                         ← standalone training script
├── requirements.txt
├── models/
│   └── xgboost_model.pkl            ← saved model (created after training)
└── ml/
    ├── utils.py                     ← feature lists, label maps
    ├── pipeline.py                  ← preprocessing (imputation + encoding)
    └── model.py                     ← training, SMOTE, prediction
frontend/
├── index.html                       ← single-page app
├── css/style.css
└── js/
    ├── app.js                       ← main orchestration
    ├── api.js                       ← API call wrappers
    ├── charts.js                    ← Chart.js wrappers
    └── ui.js                        ← DOM helpers, table, toast
```

---

## ML Pipeline

### Missing Value Handling

| Feature | Strategy |
|---|---|
| `Hours_Studied`, `Attendance`, `Previous_Scores`, `Sleep_Hours`, `Tutoring_Sessions`, `Physical_Activity` | **Median imputation** |
| `Teacher_Quality` *(confirmed missing)* | **Mode imputation** |
| `Distance_from_Home` *(confirmed missing)* | **Mode imputation** |
| `Parental_Education_Level` *(confirmed missing)* | **Mode imputation** |
| `Family_Income` *(confirmed missing)* | **Mode imputation** |
| All other categorical features | **Mode imputation** |

Imputation is part of the sklearn `Pipeline` — it's applied automatically
during training and prediction, preventing data leakage.

### Class Imbalance — SMOTE

Target grades bucketed from `Exam_Score`:
- **F**:   score < 60
- **D**:   60 ≤ score < 65
- **C**:   65 ≤ score < 70
- **B**:   70 ≤ score < 75
- **B+**:  75 ≤ score < 80
- **A**:   80 ≤ score < 85
- **AA**:  85 ≤ score < 90
- **AAA**: score ≥ 90

The upper-grade classes are rare. **SMOTE** (Synthetic Minority Oversampling Technique)
generates synthetic samples *only on the training set* after preprocessing,
so the test set evaluation remains unbiased.

### Models Compared

| Model | Notes |
|---|---|
| Logistic Regression | baseline linear |
| Random Forest | n=150 trees |
| SVM (RBF kernel) | with probability |
| Gradient Boosting | n=150 estimators |
| **XGBoost (Tuned)** ⭐ | GridSearchCV, 16 combos, 5-fold CV |

### XGBoost GridSearchCV Grid

```python
{
  "max_depth":        [3, 5, 7],
  "n_estimators":     [100, 200],
  "learning_rate":    [0.05, 0.1, 0.2],
  "subsample":        [0.8, 1.0],
  "colsample_bytree": [0.8, 1.0],
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server + model status |
| GET | `/api/model/info` | Accuracy, SMOTE details, best params |
| POST | `/api/train` | Trigger full re-training |
| POST | `/api/predict/single` | Predict one student (JSON) |
| POST | `/api/predict/batch` | Upload CSV → download CSV with predictions |
| GET | `/api/model/feature-importance` | XGBoost feature importance |
| GET | `/api/model/metrics` | All model metrics |

---

## Features

- ✅ 5 ML models compared with 5-fold CV
- ✅ XGBoost tuned with GridSearchCV (16 hyperparameter combinations)
- ✅ Median imputation for numeric missing values
- ✅ Mode imputation for categorical missing values (robust to 4 confirmed missing columns)
- ✅ SMOTE applied only on training set (no data leakage)
- ✅ Stratified 80/20 split
- ✅ Manual prediction form (missing fields auto-imputed)
- ✅ Bulk CSV upload → downloadable predictions CSV
- ✅ Feature importance chart (XGBoost)
- ✅ Model comparison charts
- ✅ Dark glass-morphism UI with animations
