"""
utils.py — Feature definitions, 8-class grade label mappings, and missing-value strategies.

Grade buckets (Exam_Score → Grade):
  AAA : score ≥ 90      (Exceptional)
  AA  : 85 ≤ score < 90 (Excellent)
  A   : 80 ≤ score < 85 (Very Good)
  B+  : 75 ≤ score < 80 (Good)
  B   : 70 ≤ score < 75 (Above Average)
  C   : 65 ≤ score < 70 (Average)
  D   : 60 ≤ score < 65 (Below Average)
  F   : score < 60      (Fail)

Encoding (ordered lowest→highest):
  F=0, D=1, C=2, B=3, B+=4, A=5, AA=6, AAA=7
"""

# ── Feature column groups ─────────────────────────────────────────────────────
NUMERIC_FEATURES = [
    "Hours_Studied",
    "Attendance",
    "Sleep_Hours",
    "Previous_Scores",
    "Tutoring_Sessions",
    "Physical_Activity",
]

CATEGORICAL_FEATURES = [
    "Parental_Involvement",
    "Access_to_Resources",
    "Extracurricular_Activities",
    "Motivation_Level",
    "Internet_Access",
    "Family_Income",           # ← confirmed missing values
    "Teacher_Quality",         # ← confirmed missing values
    "School_Type",
    "Peer_Influence",
    "Learning_Disabilities",
    "Parental_Education_Level",  # ← confirmed missing values
    "Distance_from_Home",        # ← confirmed missing values
    "Gender",
]

ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

# ── Known categories per categorical column ───────────────────────────────────
CATEGORICAL_VALUES = {
    "Parental_Involvement":       ["Low", "Medium", "High"],
    "Access_to_Resources":        ["Low", "Medium", "High"],
    "Extracurricular_Activities": ["No", "Yes"],
    "Motivation_Level":           ["Low", "Medium", "High"],
    "Internet_Access":            ["No", "Yes"],
    "Family_Income":              ["Low", "Medium", "High"],
    "Teacher_Quality":            ["Low", "Medium", "High"],
    "School_Type":                ["Public", "Private"],
    "Peer_Influence":             ["Negative", "Neutral", "Positive"],
    "Learning_Disabilities":      ["No", "Yes"],
    "Parental_Education_Level":   ["High School", "College", "Postgraduate"],
    "Distance_from_Home":         ["Near", "Moderate", "Far"],
    "Gender":                     ["Male", "Female"],
}

# ── 8-Class Grade System (ordered F → AAA) ────────────────────────────────────
GRADE_LABELS = ["F", "D", "C", "B", "B+", "A", "AA", "AAA"]
NUM_CLASSES = 8

LABEL_MAP = {"F": 0, "D": 1, "C": 2, "B": 3, "B+": 4, "A": 5, "AA": 6, "AAA": 7}
LABEL_REVERSE = {0: "F", 1: "D", 2: "C", 3: "B", 4: "B+", 5: "A", 6: "AA", 7: "AAA"}

# Grade → hex colour for UI display
GRADE_COLORS = {
    "F": "#ef4444",
    "D": "#f97316",
    "C": "#f59e0b",
    "B": "#eab308",
    "B+": "#84cc16",
    "A": "#22c55e",
    "AA": "#10b981",
    "AAA": "#14b8a6",
}

# Grade → human-readable description
GRADE_DESC = {
    "F": "Fail",
    "D": "Below Average",
    "C": "Average",
    "B": "Above Average",
    "B+": "Good",
    "A": "Very Good",
    "AA": "Excellent",
    "AAA": "Exceptional",
}


def score_to_grade(score: float) -> str:
    """Convert a numeric exam score to the fixed 8-grade label set."""
    if score >= 90:
        return "AAA"
    if score >= 85:
        return "AA"
    if score >= 80:
        return "A"
    if score >= 75:
        return "B+"
    if score >= 70:
        return "B"
    if score >= 65:
        return "C"
    if score >= 60:
        return "D"
    return "F"


# ── Missing-value handling documentation ──────────────────────────────────────
MISSING_VALUE_STRATEGIES = {
    # Numeric → median
    "Hours_Studied":    "median",
    "Attendance":       "median",
    "Sleep_Hours":      "median",
    "Previous_Scores":  "median",
    "Tutoring_Sessions":"median",
    "Physical_Activity":"median",
    # Categorical → mode (most-frequent)
    "Parental_Involvement":       "most_frequent",
    "Access_to_Resources":        "most_frequent",
    "Extracurricular_Activities": "most_frequent",
    "Motivation_Level":           "most_frequent",
    "Internet_Access":            "most_frequent",
    "Family_Income":              "most_frequent",    # confirmed missing
    "Teacher_Quality":            "most_frequent",    # confirmed missing
    "School_Type":                "most_frequent",
    "Peer_Influence":             "most_frequent",
    "Learning_Disabilities":      "most_frequent",
    "Parental_Education_Level":   "most_frequent",    # confirmed missing
    "Distance_from_Home":         "most_frequent",    # confirmed missing
    "Gender":                     "most_frequent",
}
