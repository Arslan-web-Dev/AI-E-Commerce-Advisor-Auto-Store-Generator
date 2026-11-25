import os
import uuid
import json
import secrets
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
import pandas as pd
import joblib

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, BackgroundTasks, Security, Depends, status
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import (
    DATASETS_DIR,
    ARTIFACTS_DIR,
    CACHE_DIR,
    ML_SERVICE_PORT,
    ML_SERVICE_HOST,
    ML_SERVICE_API_KEY,
    ALLOWED_ORIGINS,
    MAX_FILE_SIZE_BYTES,
    SCORING_CONFIG,
    validate_risk_thresholds,
)
from datasets.manager import inspect_dataset
from datasets.sample_dataset_generator import save_sample_dataset
from models.trainer import train_and_compare_models
from models.explainability import compute_local_prediction_factors
from models.label_policy import (
    APPROVED_MODULE4_CATEGORIES,
    LabelApprovalBlocked,
    assert_training_allowed,
    artifact_ready_for_serving,
    load_label_policy,
)
from trends.google_trends import fetch_google_trends
from trends.market_analytics import compute_market_demand_analysis

app = FastAPI(
    title="Punjab E-Commerce ML & Market Intelligence API",
    version="1.0.0",
    description="Multi-model ML training, cross-validation, prediction, and Punjab market analytics service."
)

# Hardened CORS: allow only explicit application and development origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "x-api-key", "Authorization"],
)

# API Key Authentication Dependency
api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)

def verify_api_key(api_key: Optional[str] = Security(api_key_header)):
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing x-api-key header."
        )
    if not secrets.compare_digest(api_key, ML_SERVICE_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or unauthorized API key."
        )
    return api_key

# In-memory jobs store
TRAINING_JOBS: Dict[str, Dict[str, Any]] = {}
DATASETS_STORE: Dict[str, Dict[str, Any]] = {}
ACTIVE_MODEL_ID: Optional[str] = None

def _fingerprint_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


# Pre-load existing datasets and artifacts on startup
def _init_storage():
    global ACTIVE_MODEL_ID
    sample_file = DATASETS_DIR / "punjab_retail_feasibility_v1.csv"
    if not sample_file.exists():
        save_sample_dataset(sample_file)

    for f in DATASETS_DIR.glob("*.*"):
        if f.suffix.lower() in [".csv", ".xlsx", ".xls"]:
            ds_id = f.stem
            report = inspect_dataset(f)
            DATASETS_STORE[ds_id] = {
                "id": ds_id,
                "name": f.name.replace("_", " ").title(),
                "file_name": f.name,
                "file_path": str(f),
                "file_size_bytes": f.stat().st_size,
                "is_sample": ("sample" in f.name or "punjab_retail" in f.name),
                **report
            }

    # Legacy/unversioned artifacts are not serving-ready. In particular the
    # committed gradient-boosting bundle leaked feasibility_score and must never
    # become the active production model after a restart.
    for f in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(f)
            if not ACTIVE_MODEL_ID and artifact_ready_for_serving(bundle):
                ACTIVE_MODEL_ID = bundle.get("model_id")
        except Exception:
            pass

_init_storage()

# Models for request validation
class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    problem_type: str  # 'classification' or 'regression'
    candidate_algorithms: Optional[List[str]] = None
    validation_strategy: Optional[str] = "stratified_kfold"
    cv_folds: Optional[int] = 5
    test_size: Optional[float] = 0.2

class PredictRequest(BaseModel):
    model_id: Optional[str] = None
    input_features: Dict[str, Any]
    risk_thresholds: Optional[Dict[str, Any]] = None

class MarketDemandRequest(BaseModel):
    primary_keyword: str
    district: str
    comparison_keywords: Optional[List[str]] = None
    geo: Optional[str] = "PK"
    district_data: Optional[Dict[str, Any]] = None

@app.get("/")
@app.get("/health")
def health_check():
    """Public health / liveness check."""
    return {
        "status": "healthy",
        "service": "Punjab E-Commerce ML & Market Intelligence Engine",
        "active_model_id": ACTIVE_MODEL_ID,
        "datasets_count": len(DATASETS_STORE),
        "artifact_count": len(list(ARTIFACTS_DIR.glob("*.joblib"))),
        "label_approval_status": load_label_policy()["status"],
    }


@app.get("/training-policy", dependencies=[Depends(verify_api_key)])
def get_training_policy():
    """Server-side OI-6 gate state and the approved product taxonomy."""
    return {
        "label_policy": load_label_policy(),
        "approved_categories": list(APPROVED_MODULE4_CATEGORIES),
        "risk_thresholds": {
            "version": SCORING_CONFIG["version"],
            "low_risk_min": SCORING_CONFIG["low_risk_min"],
            "moderate_risk_min": SCORING_CONFIG["moderate_risk_min"],
            "high_risk_min": SCORING_CONFIG["high_risk_min"],
        },
        "limited_data_disclaimer": SCORING_CONFIG["limited_data_disclaimer"],
    }

# ----------------- DATASET ENDPOINTS -----------------

@app.get("/datasets", dependencies=[Depends(verify_api_key)])
def list_datasets():
    return list(DATASETS_STORE.values())

@app.post("/datasets/upload", dependencies=[Depends(verify_api_key)])
async def upload_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    target_column: Optional[str] = Form(None)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(status_code=400, detail="Only CSV and Excel (.xlsx, .xls) files are supported.")
    if file.size is not None and file.size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Dataset exceeds the 50 MB upload limit.")

    ds_id = str(uuid.uuid4())[:8]
    saved_filename = f"{ds_id}_{file.filename}"
    saved_path = DATASETS_DIR / saved_filename

    # Enforce the cap while streaming; `file.size` may be absent on chunked
    # requests and must not be trusted as the only boundary.
    written = 0
    with open(saved_path, "wb") as buffer:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_FILE_SIZE_BYTES:
                buffer.close()
                saved_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Dataset exceeds the 50 MB upload limit.")
            buffer.write(chunk)

    report = inspect_dataset(saved_path, target_col=target_column)
    display_name = name or file.filename.rsplit(".", 1)[0].replace("_", " ").title()

    entry = {
        "id": ds_id,
        "name": display_name,
        "file_name": saved_filename,
        "file_path": str(saved_path),
        "file_size_bytes": saved_path.stat().st_size,
        "is_sample": False,
        **report
    }
    DATASETS_STORE[ds_id] = entry
    return entry

@app.get("/datasets/{dataset_id}", dependencies=[Depends(verify_api_key)])
def get_dataset(dataset_id: str):
    if dataset_id not in DATASETS_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return DATASETS_STORE[dataset_id]

@app.post("/datasets/generate-sample", dependencies=[Depends(verify_api_key)])
def generate_sample_dataset():
    sample_file = DATASETS_DIR / f"punjab_retail_feasibility_{str(uuid.uuid4())[:6]}.csv"
    save_sample_dataset(sample_file, num_samples=150000)
    ds_id = sample_file.stem
    report = inspect_dataset(sample_file)
    entry = {
        "id": ds_id,
        "name": "Unapproved synthetic feasibility sandbox (150,000 samples)",
        "file_name": sample_file.name,
        "file_path": str(sample_file),
        "file_size_bytes": sample_file.stat().st_size,
        "is_sample": True,
        **report
    }
    DATASETS_STORE[ds_id] = entry
    return entry

# ----------------- TRAINING & MODEL EVALUATION -----------------

def _run_training_job_task(job_id: str, req: TrainRequest):
    global ACTIVE_MODEL_ID
    ds_entry = DATASETS_STORE[req.dataset_id]
    file_path = ds_entry["file_path"]

    TRAINING_JOBS[job_id]["status"] = "training"
    TRAINING_JOBS[job_id]["progress_pct"] = 15.0
    TRAINING_JOBS[job_id]["current_step"] = "Loading and validating dataset"

    try:
        if file_path.endswith(".csv"):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)

        TRAINING_JOBS[job_id]["progress_pct"] = 35.0
        TRAINING_JOBS[job_id]["current_step"] = "Executing candidate algorithms and cross-validation"

        policy_decision = assert_training_allowed(req.target_column, ds_entry)
        results = train_and_compare_models(
            df=df,
            target_col=req.target_column,
            problem_type=req.problem_type,
            candidate_algorithms=req.candidate_algorithms,
            validation_strategy=req.validation_strategy,
            cv_folds=req.cv_folds or 5,
            test_size=req.test_size or 0.2,
            dataset_fingerprint=_fingerprint_file(file_path),
            dataset_ref=req.dataset_id,
            dataset_info=ds_entry,
            training_provenance=policy_decision,
        )

        TRAINING_JOBS[job_id]["status"] = "completed"
        TRAINING_JOBS[job_id]["progress_pct"] = 100.0
        TRAINING_JOBS[job_id]["current_step"] = "Completed successfully"
        TRAINING_JOBS[job_id]["results"] = results
        TRAINING_JOBS[job_id]["best_model_id"] = results["best_model_id"]
        # Never auto-promote. Activation is an explicit admin action enforced by
        # `artifact_ready_for_serving` (version, metrics, no target leakage,
        # OI-6 approval for rule-generated labels).

    except Exception as e:
        TRAINING_JOBS[job_id]["status"] = "failed"
        TRAINING_JOBS[job_id]["error_message"] = str(e)
        TRAINING_JOBS[job_id]["current_step"] = f"Failed: {str(e)}"

@app.post("/train", dependencies=[Depends(verify_api_key)])
def start_training(req: TrainRequest, background_tasks: BackgroundTasks):
    if req.dataset_id not in DATASETS_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    if req.problem_type not in {"classification", "regression"}:
        raise HTTPException(status_code=400, detail="problem_type must be 'classification' or 'regression'.")
    if req.cv_folds is not None and req.cv_folds < 2:
        raise HTTPException(status_code=422, detail="cv_folds must be at least 2.")
    if req.test_size is not None and not 0 < req.test_size < 1:
        raise HTTPException(status_code=422, detail="test_size must be between 0 and 1.")

    try:
        assert_training_allowed(req.target_column, DATASETS_STORE[req.dataset_id])
    except LabelApprovalBlocked as exc:
        raise HTTPException(status_code=422, detail={
            "error": str(exc),
            "policy": exc.policy,
            "target_column": exc.target_col,
        }) from exc

    job_id = str(uuid.uuid4())
    TRAINING_JOBS[job_id] = {
        "job_id": job_id,
        "dataset_id": req.dataset_id,
        "target_column": req.target_column,
        "problem_type": req.problem_type,
        "status": "pending",
        "progress_pct": 0.0,
        "current_step": "Job queued",
        "results": None,
        "best_model_id": None,
        "error_message": None
    }

    _run_training_job_task(job_id, req)
    return TRAINING_JOBS[job_id]

@app.get("/train/{job_id}", dependencies=[Depends(verify_api_key)])
def get_training_job(job_id: str):
    if job_id not in TRAINING_JOBS:
        raise HTTPException(status_code=404, detail="Training job not found.")
    return TRAINING_JOBS[job_id]

@app.get("/models", dependencies=[Depends(verify_api_key)])
def list_models():
    models = []
    for f in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(f)
            models.append({
                "model_id": bundle["model_id"],
                "name": bundle["name"],
                "algorithm_key": bundle["algorithm_key"],
                "problem_type": bundle["problem_type"],
                "target_col": bundle["target_col"],
                "artifact_version": bundle.get("artifact_version"),
                "cv_metrics": bundle.get("cv_metrics"),
                "label_approval_status": bundle.get("label_approval_status", "BLOCKED"),
                "metrics": bundle["metrics"],
                "serving_ready": artifact_ready_for_serving(bundle),
                "is_active": (bundle["model_id"] == ACTIVE_MODEL_ID),
                "file_size_bytes": f.stat().st_size,
                "file_name": f.name
            })
        except Exception:
            pass
    return models

@app.get("/models/{model_id}", dependencies=[Depends(verify_api_key)])
def get_model(model_id: str):
    target = None
    for f in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(f)
            if bundle.get("model_id") == model_id:
                target = bundle
                break
        except Exception:
            pass

    if not target:
        raise HTTPException(status_code=404, detail="Model artifact not found.")

    clean_bundle = {k: v for k, v in target.items() if k != "pipeline"}
    clean_bundle["is_active"] = (model_id == ACTIVE_MODEL_ID)
    return clean_bundle

@app.post("/models/{model_id}/activate", dependencies=[Depends(verify_api_key)])
def activate_model(model_id: str):
    global ACTIVE_MODEL_ID
    target = None
    for f in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(f)
            if bundle.get("model_id") == model_id:
                target = bundle
                break
        except Exception:
            pass

    if not target:
        raise HTTPException(status_code=404, detail="Model artifact not found.")
    if not artifact_ready_for_serving(target):
        raise HTTPException(
            status_code=422,
            detail="Artifact is not serving-ready: missing version/metrics, target leakage, or unapproved labels.",
        )

    ACTIVE_MODEL_ID = model_id
    return {"status": "success", "active_model_id": ACTIVE_MODEL_ID}

# ----------------- PREDICTION & INFERENCE -----------------

PREDICTION_NUMERIC_LIMITS = {
    "initial_capital_pkr": (1.0, 1e12),
    "monthly_burn_budget_pkr": (1.0, 1e12),
    "commercial_rent_sqft_pkr": (0.0, 1e7),
    "competitor_density_1km": (0.0, 100000.0),
    "online_search_interest": (0.0, 100.0),
    "urbanization_rate": (0.0, 100.0),
    "purchasing_power_index": (0.0, 100.0),
    "logistics_accessibility_score": (0.0, 10.0),
    "digital_payment_adoption_pct": (0.0, 100.0),
    "runway_months": (0.0, 1200.0),
}


def validate_prediction_features(features: Dict[str, Any]) -> None:
    """Mirror the Next.js sandbox validation at the service boundary."""
    for key, (lower, upper) in PREDICTION_NUMERIC_LIMITS.items():
        if key not in features:
            continue
        value = features[key]
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise HTTPException(status_code=422, detail=f"{key} must be a finite number.")
        if not lower <= float(value) <= upper:
            raise HTTPException(
                status_code=422,
                detail=f"{key} must be between {lower} and {upper}.",
            )


@app.post("/predict", dependencies=[Depends(verify_api_key)])
def predict_feasibility(req: PredictRequest):
    global ACTIVE_MODEL_ID
    category = req.input_features.get("business_category")
    if category is not None and category not in APPROVED_MODULE4_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"Unapproved business_category '{category}'. Use one of the five approved categories.",
        )
    validate_prediction_features(req.input_features)

    try:
        applied_thresholds = (
            validate_risk_thresholds(req.risk_thresholds)
            if req.risk_thresholds is not None
            else SCORING_CONFIG
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    target_model_id = req.model_id or ACTIVE_MODEL_ID
    if not target_model_id:
        raise HTTPException(
            status_code=400,
            detail="No active model found. Please train or activate a model first."
        )

    target_bundle = None
    for f in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(f)
            if bundle.get("model_id") == target_model_id:
                target_bundle = bundle
                break
        except Exception:
            pass

    if not target_bundle:
        raise HTTPException(status_code=404, detail="Model artifact could not be loaded.")

    # A stale, unversioned or OI-6-unapproved bundle must not serve predictions
    # even when an explicit model_id is supplied to the sandbox endpoint.
    if not artifact_ready_for_serving(target_bundle):
        raise HTTPException(
            status_code=422,
            detail="Model artifact is not serving-ready (version, CV metrics, leakage and OI-6 gate are required).",
        )

    pipeline = target_bundle["pipeline"]
    input_df = pd.DataFrame([req.input_features])

    try:
        raw_pred = pipeline.predict(input_df)[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Inference error: {str(e)}")

    prob_map = {}
    confidence = None
    if hasattr(pipeline, "predict_proba"):
        try:
            probs = pipeline.predict_proba(input_df)[0]
            classes = [str(c) for c in getattr(pipeline, "classes_", [f"class_{i}" for i in range(len(probs))])]
            prob_map = {classes[i]: float(probs[i]) for i in range(len(probs))}
            confidence = float(max(prob_map.values())) if prob_map else None
        except Exception:
            pass

    local_factors = compute_local_prediction_factors(
        input_dict=req.input_features,
        global_importances=target_bundle.get("global_importances", []),
        prediction_result=raw_pred,
        confidence_score=confidence
    )

    numeric_score = None
    if isinstance(raw_pred, (int, float)) and not isinstance(raw_pred, bool) and 0 <= float(raw_pred) <= 1:
        numeric_score = round(float(raw_pred), 2)

    risk_level = None
    if numeric_score is not None:
        if numeric_score >= applied_thresholds["low_risk_min"]:
            risk_level = "low"
        elif numeric_score >= applied_thresholds["moderate_risk_min"]:
            risk_level = "moderate"
        elif numeric_score >= applied_thresholds["high_risk_min"]:
            risk_level = "high"
        else:
            risk_level = "critical"

    return {
        "model_id": target_model_id,
        "artifact_version": target_bundle.get("artifact_version"),
        "model_name": target_bundle["name"],
        "algorithm": target_bundle["algorithm_key"],
        "problem_type": target_bundle["problem_type"],
        "prediction": raw_pred if isinstance(raw_pred, (str, int, float)) else str(raw_pred),
        "feasibility_score": numeric_score,
        "risk_level": risk_level,
        "confidence_score": confidence,
        "class_probabilities": prob_map,
        "local_explanation_factors": local_factors,
        "top_global_drivers": target_bundle.get("global_importances", [])[:5],
        "threshold_version": applied_thresholds["version"],
        "artifact_threshold_version": target_bundle.get(
            "risk_threshold_version", SCORING_CONFIG["version"]
        ),
        "label_approval_status": target_bundle.get("label_approval_status", "BLOCKED"),
        "serving_ready": True,
        "sandbox_only": True,
        "project_report_persisted": False,
        "disclaimer": SCORING_CONFIG["limited_data_disclaimer"],
    }

# ----------------- MARKET INTELLIGENCE & GOOGLE TRENDS -----------------

@app.get("/market/trends", dependencies=[Depends(verify_api_key)])
def get_trends(
    keywords: str = Query(..., description="Comma-separated keywords"),
    geo: str = Query("PK", description="Geo code: 'PK' or 'PK-PB'"),
    timeframe: str = Query("today 12-m", description="Google Trends timeframe")
):
    kw_list = [k.strip() for k in keywords.split(",") if k.strip()]
    if not kw_list:
        raise HTTPException(status_code=400, detail="At least one keyword is required.")
    return fetch_google_trends(keywords=kw_list, geo=geo, timeframe=timeframe)

@app.post("/market/demand-analysis", dependencies=[Depends(verify_api_key)])
def get_market_demand_analysis(req: MarketDemandRequest, api_key: str = Depends(verify_api_key)):
    district_data = req.district_data or {
        "district": req.district,
        "purchasing_power_index": 78.0,
        "urbanization_rate": 65.0,
        "commercial_rent_sqft_avg": 180.0,
        "retail_density_score": 75.0
    }
    return compute_market_demand_analysis(
        primary_keyword=req.primary_keyword,
        district_data=district_data,
        comparison_keywords=req.comparison_keywords,
        geo=req.geo or "PK"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=ML_SERVICE_HOST, port=ML_SERVICE_PORT, reload=False)
