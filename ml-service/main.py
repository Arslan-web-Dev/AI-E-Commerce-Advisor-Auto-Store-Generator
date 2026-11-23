import os
import uuid
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
import pandas as pd
import joblib

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import DATASETS_DIR, ARTIFACTS_DIR, CACHE_DIR, ML_SERVICE_PORT, ML_SERVICE_HOST
from datasets.manager import inspect_dataset
from datasets.sample_dataset_generator import save_sample_dataset
from models.trainer import train_and_compare_models
from models.explainability import compute_local_prediction_factors
from trends.google_trends import fetch_google_trends
from trends.market_analytics import compute_market_demand_analysis

app = FastAPI(
    title="Punjab E-Commerce ML & Market Intelligence API",
    version="1.0.0",
    description="Multi-model ML training, cross-validation, prediction, and Punjab market analytics service."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory jobs store
TRAINING_JOBS: Dict[str, Dict[str, Any]] = {}
DATASETS_STORE: Dict[str, Dict[str, Any]] = {}
ACTIVE_MODEL_ID: Optional[str] = None

# Pre-load existing datasets and artifacts on startup
def _init_storage():
    global ACTIVE_MODEL_ID
    # Ensure sample dataset exists
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

    # Find any existing active model
    for f in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(f)
            if not ACTIVE_MODEL_ID:
                ACTIVE_MODEL_ID = bundle.get("model_id")
        except Exception:
            pass

_init_storage()

# Models for request validation
class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    problem_type: str # 'classification' or 'regression'
    candidate_algorithms: Optional[List[str]] = None
    validation_strategy: Optional[str] = "stratified_kfold"
    cv_folds: Optional[int] = 5
    test_size: Optional[float] = 0.2

class PredictRequest(BaseModel):
    model_id: Optional[str] = None
    input_features: Dict[str, Any]

class MarketDemandRequest(BaseModel):
    primary_keyword: str
    district: str
    comparison_keywords: Optional[List[str]] = None
    geo: Optional[str] = "PK"
    district_data: Optional[Dict[str, Any]] = None

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "service": "Punjab E-Commerce ML & Market Intelligence Engine",
        "active_model_id": ACTIVE_MODEL_ID,
        "datasets_count": len(DATASETS_STORE),
        "artifacts_count": len(list(ARTIFACTS_DIR.glob("*.joblib")))
    }

# ----------------- DATASET ENDPOINTS -----------------

@app.get("/datasets")
def list_datasets():
    return list(DATASETS_STORE.values())

@app.post("/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    target_column: Optional[str] = Form(None)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(status_code=400, detail="Only CSV and Excel (.xlsx, .xls) files are supported.")

    ds_id = str(uuid.uuid4())[:8]
    saved_filename = f"{ds_id}_{file.filename}"
    saved_path = DATASETS_DIR / saved_filename

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

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

@app.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    if dataset_id not in DATASETS_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return DATASETS_STORE[dataset_id]

@app.post("/datasets/generate-sample")
def generate_sample_punjab_dataset():
    sample_file = DATASETS_DIR / "punjab_retail_feasibility_v1.csv"
    save_sample_dataset(sample_file)
    ds_id = "punjab_retail_feasibility_v1"
    report = inspect_dataset(sample_file, target_col="feasibility_class")
    entry = {
        "id": ds_id,
        "name": "Punjab Retail Feasibility Baseline (Sample)",
        "file_name": sample_file.name,
        "file_path": str(sample_file),
        "file_size_bytes": sample_file.stat().st_size,
        "is_sample": True,
        **report
    }
    DATASETS_STORE[ds_id] = entry
    return entry

# ----------------- TRAINING & MODEL PIPELINE -----------------

def _run_training_job_task(job_id: str, req: TrainRequest):
    global ACTIVE_MODEL_ID
    try:
        ds_info = DATASETS_STORE.get(req.dataset_id)
        if not ds_info:
            raise ValueError(f"Dataset '{req.dataset_id}' not found.")

        TRAINING_JOBS[job_id]["status"] = "running"
        TRAINING_JOBS[job_id]["current_step"] = "Loading dataset and cleaning split"

        file_path = Path(ds_info["file_path"])
        ext = file_path.suffix.lower()
        df = pd.read_excel(file_path) if ext in [".xlsx", ".xls"] else pd.read_csv(file_path)

        def progress_cb(pct: float, step: str):
            TRAINING_JOBS[job_id]["progress_pct"] = pct
            TRAINING_JOBS[job_id]["current_step"] = step

        results = train_and_compare_models(
            df=df,
            target_col=req.target_column,
            problem_type=req.problem_type,
            candidate_algorithms=req.candidate_algorithms,
            validation_strategy=req.validation_strategy,
            cv_folds=req.cv_folds,
            test_size=req.test_size,
            progress_callback=progress_cb
        )

        TRAINING_JOBS[job_id]["status"] = "completed"
        TRAINING_JOBS[job_id]["progress_pct"] = 100.0
        TRAINING_JOBS[job_id]["current_step"] = "Completed successfully"
        TRAINING_JOBS[job_id]["results"] = results
        TRAINING_JOBS[job_id]["best_model_id"] = results["best_model_id"]
        
        # Auto-activate best model
        ACTIVE_MODEL_ID = results["best_model_id"]

    except Exception as e:
        TRAINING_JOBS[job_id]["status"] = "failed"
        TRAINING_JOBS[job_id]["error_message"] = str(e)
        TRAINING_JOBS[job_id]["current_step"] = f"Failed: {str(e)}"

@app.post("/train")
def start_training(req: TrainRequest, background_tasks: BackgroundTasks):
    if req.dataset_id not in DATASETS_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")

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

    # Execute training synchronously if small, or in background
    # Given requirements, running synchronously for immediate response if requested
    _run_training_job_task(job_id, req)
    return TRAINING_JOBS[job_id]

@app.get("/train/{job_id}")
def get_training_job(job_id: str):
    if job_id not in TRAINING_JOBS:
        raise HTTPException(status_code=404, detail="Training job not found.")
    return TRAINING_JOBS[job_id]

@app.get("/models")
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
                "metrics": bundle["metrics"],
                "is_active": (bundle["model_id"] == ACTIVE_MODEL_ID),
                "file_size_bytes": f.stat().st_size,
                "file_name": f.name
            })
        except Exception:
            pass
    return models

@app.get("/models/{model_id}")
def get_model_details(model_id: str):
    for f in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(f)
            if bundle["model_id"] == model_id:
                return {
                    "model_id": bundle["model_id"],
                    "name": bundle["name"],
                    "algorithm_key": bundle["algorithm_key"],
                    "problem_type": bundle["problem_type"],
                    "target_col": bundle["target_col"],
                    "feature_names": bundle["feature_names"],
                    "global_importances": bundle["global_importances"],
                    "metrics": bundle["metrics"],
                    "class_labels": bundle.get("class_labels"),
                    "is_active": (bundle["model_id"] == ACTIVE_MODEL_ID)
                }
        except Exception:
            pass
    raise HTTPException(status_code=404, detail="Model artifact not found.")

@app.post("/models/{model_id}/activate")
def activate_model(model_id: str):
    global ACTIVE_MODEL_ID
    for f in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(f)
            if bundle["model_id"] == model_id:
                ACTIVE_MODEL_ID = model_id
                return {"status": "success", "active_model_id": ACTIVE_MODEL_ID, "model_name": bundle["name"]}
        except Exception:
            pass
    raise HTTPException(status_code=404, detail="Model artifact not found.")

# ----------------- PREDICTION & INFERENCE -----------------

@app.post("/predict")
def predict_feasibility(req: PredictRequest):
    target_model_id = req.model_id or ACTIVE_MODEL_ID
    if not target_model_id:
        raise HTTPException(status_code=400, detail="No active model found. Train and activate a model first.")

    target_bundle = None
    for f in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            b = joblib.load(f)
            if b["model_id"] == target_model_id:
                target_bundle = b
                break
        except Exception:
            pass

    if not target_bundle:
        raise HTTPException(status_code=404, detail=f"Model artifact '{target_model_id}' not found.")

    pipeline = target_bundle["pipeline"]
    raw_num = target_bundle.get("raw_numeric_cols", [])
    raw_cat = target_bundle.get("raw_categorical_cols", [])
    expected_cols = list(raw_num) + list(raw_cat)

    # Ensure all expected columns exist in input_df, filling missing ones with None / NaN
    row_data = {}
    for col in expected_cols:
        row_data[col] = req.input_features.get(col, None)
    
    # Also include any remaining keys from input_features
    for k, v in req.input_features.items():
        if k not in row_data:
            row_data[k] = v

    input_df = pd.DataFrame([row_data])

    try:
        raw_pred = pipeline.predict(input_df)[0]
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Inference input transformation error: {str(e)}")

    prob_map = {}
    confidence = None
    if hasattr(pipeline, "predict_proba"):
        try:
            probs = pipeline.predict_proba(input_df)[0]
            classes = target_bundle.get("class_labels", getattr(pipeline, "classes_", []))
            prob_map = {str(classes[i]): round(float(probs[i]), 4) for i in range(len(classes))}
            if prob_map:
                confidence = round(float(max(prob_map.values())), 4)
        except Exception:
            pass

    # Explainability factors
    local_factors = compute_local_prediction_factors(
        input_dict=req.input_features,
        global_importances=target_bundle.get("global_importances", []),
        prediction_result=raw_pred,
        confidence_score=confidence
    )

    return {
        "model_id": target_model_id,
        "model_name": target_bundle["name"],
        "algorithm": target_bundle["algorithm_key"],
        "problem_type": target_bundle["problem_type"],
        "prediction": raw_pred if isinstance(raw_pred, (str, int, float)) else str(raw_pred),
        "confidence_score": confidence,
        "class_probabilities": prob_map,
        "local_explanation_factors": local_factors,
        "top_global_drivers": target_bundle.get("global_importances", [])[:5]
    }

# ----------------- MARKET INTELLIGENCE & GOOGLE TRENDS -----------------

@app.get("/market/trends")
def get_trends(
    keywords: str = Query(..., description="Comma-separated keywords"),
    geo: str = Query("PK", description="Geo code: 'PK' or 'PK-PB'"),
    timeframe: str = Query("today 12-m", description="Google Trends timeframe")
):
    kw_list = [k.strip() for k in keywords.split(",") if k.strip()]
    if not kw_list:
        raise HTTPException(status_code=400, detail="At least one keyword is required.")
    return fetch_google_trends(keywords=kw_list, geo=geo, timeframe=timeframe)

@app.post("/market/demand-analysis")
def get_market_demand_analysis(req: MarketDemandRequest):
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
