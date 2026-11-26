"""Punjab E-Commerce ML & Market Intelligence API (Task 5 / Module 4).

Training jobs, dataset entries and the active model id are held in process
memory only. This is intentional for the sandbox: they are NOT durable, are
lost on restart, and are not shared across multiple uvicorn workers. Production
deployment requires a durable job/registry store and a supervised OI-6 decision.
"""

import hashlib
import json
import re
import secrets
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd
from fastapi import (
    BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query,
    Security, UploadFile, status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

from config import (
    ALLOWED_ORIGINS,
    ARTIFACTS_DIR,
    CACHE_DIR,
    DATASETS_DIR,
    FEATURE_SCHEMA_VERSION,
    MAX_FILE_SIZE_BYTES,
    ML_SERVICE_API_KEY,
    ML_SERVICE_HOST,
    ML_SERVICE_PORT,
    SCORING_CONFIG,
    TRAINING_RANDOM_SEED,
    validate_risk_thresholds,
)
from datasets.manager import inspect_dataset
from datasets.sample_dataset_generator import save_sample_dataset
from models.candidate_models import (
    INELIGIBLE_CANDIDATES,
    XGBOOST_AVAILABLE,
    XGBOOST_VERSION,
    candidate_catalog,
)
from models.explainability import compute_local_prediction_factors
from models.label_policy import (
    APPROVED_MODULE4_CATEGORIES,
    assert_production_approval,
    assert_training_allowed,
    artifact_ready_for_serving,
    load_label_policy,
)
from models.preprocessor import validate_input_schema
from models.trainer import train_and_compare_models
from trends.google_trends import fetch_google_trends
from trends.market_analytics import compute_market_demand_analysis

app = FastAPI(
    title="Punjab E-Commerce ML & Market Intelligence API",
    version="2.0.0-fr4",
    description=(
        "Synthetic-sandbox multi-model training with OI-6 production gating. "
        "No synthetic record, metric or prediction is presented as real market evidence."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "x-api-key", "Authorization"],
)

api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)


def verify_api_key(api_key: Optional[str] = Security(api_key_header)):
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing x-api-key header.",
        )
    if not secrets.compare_digest(api_key, ML_SERVICE_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or unauthorized API key.",
        )
    return api_key


# In-memory sandbox stores. Protected by a lock because FastAPI runs background
# tasks in a worker thread while request handlers may read the same objects.
_JOBS_LOCK = threading.Lock()
TRAINING_JOBS: Dict[str, Dict[str, Any]] = {}
DATASETS_STORE: Dict[str, Dict[str, Any]] = {}
ACTIVE_MODEL_ID: Optional[str] = None

_ACTIVE_JOB_STATES = frozenset({"queued", "running"})
_JOB_STORAGE_NOTE = "In-memory only: jobs are lost on restart and are not shared across workers."


def _fingerprint_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_error_text(exc: Exception) -> str:
    """Return a bounded, non-sensitive summary for failed jobs."""
    text = re.sub(r"(?:[A-Za-z]:)?[\\/][^\s\"']+", "<path>", str(exc))
    text = text.split("\n")[0][:300]
    return f"{type(exc).__name__}: {text}" if text else type(exc).__name__


def _update_job(job_id: str, **changes: Any) -> None:
    with _JOBS_LOCK:
        if job_id in TRAINING_JOBS:
            TRAINING_JOBS[job_id].update(changes)


def _init_storage():
    global ACTIVE_MODEL_ID
    sample_file = DATASETS_DIR / "punjab_retail_feasibility_v1.csv"
    if not sample_file.exists():
        save_sample_dataset(sample_file)

    for file_path in DATASETS_DIR.glob("*.*"):
        if file_path.suffix.lower() not in {".csv", ".xlsx", ".xls"}:
            continue
        report = inspect_dataset(file_path)
        dataset_id = file_path.stem
        DATASETS_STORE[dataset_id] = {
            "id": dataset_id,
            "name": file_path.name.replace("_", " ").title(),
            "file_name": file_path.name,
            "file_path": str(file_path),
            "file_size_bytes": file_path.stat().st_size,
            "is_sample": (
                "sample" in file_path.name
                or "punjab_retail" in file_path.name
                or report.get("data_source") == "synthetic"
            ),
            **report,
        }

    # Legacy/unversioned artifacts are not serving-ready. In particular the
    # committed gradient-boosting bundle leaked feasibility_score and must never
    # become the active production model after a restart.
    for file_path in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(file_path)
            if not ACTIVE_MODEL_ID and artifact_ready_for_serving(bundle):
                ACTIVE_MODEL_ID = bundle.get("model_id")
        except Exception:
            pass


_init_storage()


class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    problem_type: str
    candidate_algorithms: Optional[List[str]] = None
    validation_strategy: Optional[str] = None
    cv_folds: Optional[int] = 5
    test_size: Optional[float] = 0.2


class PredictRequest(BaseModel):
    model_id: Optional[str] = None
    input_features: Dict[str, Any]
    risk_thresholds: Optional[Dict[str, Any]] = None
    feature_schema_version: Optional[str] = None


class MarketDemandRequest(BaseModel):
    primary_keyword: str
    district: str
    comparison_keywords: Optional[List[str]] = None
    geo: Optional[str] = "PK"
    district_data: Optional[Dict[str, Any]] = None


@app.get("/")
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Punjab E-Commerce ML & Market Intelligence Engine",
        "version": app.version,
        "active_model_id": ACTIVE_MODEL_ID,
        "datasets_count": len(DATASETS_STORE),
        "artifact_count": len(list(ARTIFACTS_DIR.glob("*.joblib"))),
        "label_approval_status": load_label_policy()["status"],
    }


@app.get("/training-policy", dependencies=[Depends(verify_api_key)])
def get_training_policy():
    """Server-side OI-6 gate state, catalogue and approved taxonomy."""
    return {
        "label_policy": load_label_policy(),
        "approved_categories": list(APPROVED_MODULE4_CATEGORIES),
        "candidates": {
            "classification": candidate_catalog("classification"),
            "regression": candidate_catalog("regression"),
        },
        "ineligible_candidates": INELIGIBLE_CANDIDATES,
        "xgboost": {
            "available": XGBOOST_AVAILABLE,
            "version": XGBOOST_VERSION,
            "required_by": "FR-4.5 (8 classification + 8 regression)",
        },
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "random_seed": TRAINING_RANDOM_SEED,
        "risk_thresholds": {
            "version": SCORING_CONFIG["version"],
            "low_risk_min": SCORING_CONFIG["low_risk_min"],
            "moderate_risk_min": SCORING_CONFIG["moderate_risk_min"],
            "high_risk_min": SCORING_CONFIG["high_risk_min"],
        },
        "limited_data_disclaimer": SCORING_CONFIG["limited_data_disclaimer"],
        "job_storage": _JOB_STORAGE_NOTE,
    }


@app.get("/jobs", dependencies=[Depends(verify_api_key)])
def list_training_jobs():
    with _JOBS_LOCK:
        return {
            "jobs": list(TRAINING_JOBS.values()),
            "storage_note": _JOB_STORAGE_NOTE,
        }


# ----------------- DATASET ENDPOINTS -----------------

@app.get("/datasets", dependencies=[Depends(verify_api_key)])
def list_datasets():
    return list(DATASETS_STORE.values())


@app.post("/datasets/upload", dependencies=[Depends(verify_api_key)])
async def upload_dataset(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    target_column: Optional[str] = Form(None),
):
    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".csv", ".xlsx", ".xls"}:
        raise HTTPException(status_code=400, detail="Only CSV and Excel (.csv, .xlsx, .xls) files are supported.")
    if file.size is not None and file.size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Dataset exceeds the 50 MB upload limit.")

    dataset_id = str(uuid.uuid4())[:8]
    saved_path = DATASETS_DIR / f"{dataset_id}_{Path(file.filename).name}"

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
    entry = {
        "id": dataset_id,
        "name": name or Path(file.filename).stem.replace("_", " ").title(),
        "file_name": saved_path.name,
        "file_path": str(saved_path),
        "file_size_bytes": saved_path.stat().st_size,
        "is_sample": False,
        **report,
    }
    DATASETS_STORE[dataset_id] = entry
    return entry


@app.get("/datasets/{dataset_id}", dependencies=[Depends(verify_api_key)])
def get_dataset(dataset_id: str):
    if dataset_id not in DATASETS_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return DATASETS_STORE[dataset_id]


@app.post("/datasets/generate-sample", dependencies=[Depends(verify_api_key)])
def generate_sample_dataset(
    num_samples: int = Form(5000),
    random_seed: int = Form(TRAINING_RANDOM_SEED),
    missing_rate: float = Form(0.01),
):
    """Generate a configurable, fully provenanced SYNTHETIC sandbox dataset."""
    if not 1 <= num_samples <= 200000:
        raise HTTPException(status_code=422, detail="num_samples must be between 1 and 200000.")
    if not 0 <= missing_rate < 0.2:
        raise HTTPException(status_code=422, detail="missing_rate must be in [0, 0.2).")

    sample_file = DATASETS_DIR / f"punjab_retail_feasibility_{uuid.uuid4().hex[:6]}.csv"
    try:
        save_sample_dataset(
            sample_file, num_samples=num_samples,
            random_seed=random_seed, missing_rate=missing_rate,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    report = inspect_dataset(sample_file)
    dataset_id = sample_file.stem
    entry = {
        "id": dataset_id,
        "name": f"Unapproved synthetic feasibility sandbox ({num_samples:,} samples)",
        "file_name": sample_file.name,
        "file_path": str(sample_file),
        "file_size_bytes": sample_file.stat().st_size,
        "is_sample": True,
        **report,
    }
    DATASETS_STORE[dataset_id] = entry
    return entry


# ----------------- TRAINING & MODEL EVALUATION -----------------

def _run_training_job_task(job_id: str, req: TrainRequest):
    """Executed by FastAPI BackgroundTasks after the POST response is sent."""
    with _JOBS_LOCK:
        dataset_entry = dict(DATASETS_STORE.get(req.dataset_id) or {})
    if not dataset_entry:
        _update_job(
            job_id, status="failed", progress_pct=0.0,
            current_step="Failed: dataset no longer available",
            error_message="ValueError: dataset no longer available",
        )
        return

    _update_job(job_id, status="running", progress_pct=10.0, current_step="Loading synthetic sandbox dataset")

    def progress_callback(pct: float, step: str) -> None:
        _update_job(
            job_id,
            progress_pct=round(10.0 + (float(pct) * 0.85), 1),
            current_step=step,
        )

    try:
        file_path = dataset_entry["file_path"]
        if str(file_path).lower().endswith(".csv"):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)

        # The gate is advisory for experimental training: it records the exact
        # approval state in the artifact and never promotes an unapproved model.
        policy_decision = assert_training_allowed(req.target_column, dataset_entry)
        _update_job(job_id, progress_pct=12.0, current_step=policy_decision["status"])

        results = train_and_compare_models(
            df=df,
            target_col=req.target_column,
            problem_type=req.problem_type,
            candidate_algorithms=req.candidate_algorithms,
            validation_strategy=req.validation_strategy,
            cv_folds=req.cv_folds or 5,
            test_size=req.test_size or 0.2,
            progress_callback=progress_callback,
            dataset_fingerprint=dataset_entry.get("dataset_fingerprint") or _fingerprint_file(file_path),
            dataset_ref=req.dataset_id,
            dataset_info=dataset_entry,
            training_provenance=policy_decision,
        )

        _update_job(
            job_id,
            status="completed",
            progress_pct=100.0,
            current_step="Completed; experimental artifact created (not auto-promoted)",
            results=results,
            best_model_id=results["best_model_id"],
            error_message=None,
        )
    except Exception as exc:
        # Never expose paths, stack traces or environment details to clients.
        _update_job(
            job_id,
            status="failed",
            progress_pct=100.0,
            current_step="Training failed",
            error_message=_safe_error_text(exc),
        )


@app.post("/train", dependencies=[Depends(verify_api_key)])
def start_training(req: TrainRequest, background_tasks: BackgroundTasks):
    """Queue training and return immediately with a pollable job id."""
    if req.dataset_id not in DATASETS_STORE:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    if req.problem_type not in {"classification", "regression"}:
        raise HTTPException(status_code=400, detail="problem_type must be 'classification' or 'regression'.")
    if req.cv_folds is not None and req.cv_folds < 2:
        raise HTTPException(status_code=422, detail="cv_folds must be at least 2.")
    if req.test_size is not None and not 0 < req.test_size < 1:
        raise HTTPException(status_code=422, detail="test_size must be between 0 and 1.")

    dataset_entry = DATASETS_STORE[req.dataset_id]
    target_column = req.target_column
    if target_column not in _dataset_columns(dataset_entry):
        raise HTTPException(status_code=422, detail=f"Target column '{target_column}' not found in dataset.")

    with _JOBS_LOCK:
        for existing in TRAINING_JOBS.values():
            if (
                existing["status"] in _ACTIVE_JOB_STATES
                and existing["dataset_id"] == req.dataset_id
                and existing["target_column"] == target_column
                and existing["problem_type"] == req.problem_type
            ):
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "A training job for this dataset/target/problem is already active.",
                        "job_id": existing["job_id"],
                        "status": existing["status"],
                    },
                )

        job_id = str(uuid.uuid4())
        TRAINING_JOBS[job_id] = {
            "job_id": job_id,
            "dataset_id": req.dataset_id,
            "target_column": target_column,
            "problem_type": req.problem_type,
            "status": "queued",
            "progress_pct": 0.0,
            "current_step": "Job queued",
            "results": None,
            "best_model_id": None,
            "error_message": None,
            "storage_note": _JOB_STORAGE_NOTE,
        }

    background_tasks.add_task(_run_training_job_task, job_id, req)
    return TRAINING_JOBS[job_id]


def _dataset_columns(dataset_entry: Dict[str, Any]) -> List[str]:
    return [str(column.get("name")) for column in dataset_entry.get("columns_metadata", [])]


@app.get("/train/{job_id}", dependencies=[Depends(verify_api_key)])
def get_training_job(job_id: str):
    with _JOBS_LOCK:
        if job_id not in TRAINING_JOBS:
            raise HTTPException(status_code=404, detail="Training job not found.")
        return dict(TRAINING_JOBS[job_id])


@app.get("/models", dependencies=[Depends(verify_api_key)])
def list_models():
    models = []
    for file_path in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(file_path)
            models.append({
                "model_id": bundle["model_id"],
                "name": bundle["name"],
                "algorithm_key": bundle["algorithm_key"],
                "problem_type": bundle["problem_type"],
                "target_col": bundle["target_col"],
                "artifact_version": bundle.get("artifact_version"),
                "artifact_schema_version": bundle.get("artifact_schema_version"),
                "feature_schema_version": bundle.get("feature_schema_version"),
                "cv_metrics": bundle.get("cv_metrics"),
                "label_approval_status": bundle.get("label_approval_status", "BLOCKED"),
                "training_mode": bundle.get("training_mode", "experimental_sandbox"),
                "approved_for_production": bundle.get("approved_for_production", False),
                "dataset_fingerprint": bundle.get("dataset_fingerprint"),
                "dataset_ref": bundle.get("dataset_ref"),
                "comparison_report_path": bundle.get("comparison_report_path"),
                "metrics": bundle["metrics"],
                "serving_ready": artifact_ready_for_serving(bundle),
                "is_active": bundle["model_id"] == ACTIVE_MODEL_ID,
                "file_size_bytes": file_path.stat().st_size,
                "file_name": file_path.name,
            })
        except Exception:
            pass
    return models


@app.get("/models/{model_id}", dependencies=[Depends(verify_api_key)])
def get_model(model_id: str):
    for file_path in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(file_path)
        except Exception:
            continue
        if bundle.get("model_id") == model_id:
            clean_bundle = {key: value for key, value in bundle.items() if key != "pipeline"}
            clean_bundle["is_active"] = model_id == ACTIVE_MODEL_ID
            clean_bundle["serving_ready"] = artifact_ready_for_serving(bundle)
            return clean_bundle
    raise HTTPException(status_code=404, detail="Model artifact not found.")


@app.post("/models/{model_id}/activate", dependencies=[Depends(verify_api_key)])
def activate_model(model_id: str):
    global ACTIVE_MODEL_ID
    for file_path in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(file_path)
        except Exception:
            continue
        if bundle.get("model_id") != model_id:
            continue

        target_col = str(bundle.get("target_col", ""))
        try:
            assert_production_approval(target_col)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if not artifact_ready_for_serving(bundle):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Artifact is not serving-ready: version/schema/metrics missing, target "
                    "leakage detected, experimental training mode, or OI-6 approval incomplete."
                ),
            )
        ACTIVE_MODEL_ID = model_id
        return {
            "status": "success",
            "active_model_id": ACTIVE_MODEL_ID,
            "approved_for_production": True,
            "label_policy_status": load_label_policy()["status"],
        }
    raise HTTPException(status_code=404, detail="Model artifact not found.")


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
        if key not in features or features[key] is None:
            continue
        value = features[key]
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise HTTPException(status_code=422, detail=f"{key} must be a finite number.")
        if not lower <= float(value) <= upper:
            raise HTTPException(status_code=422, detail=f"{key} must be between {lower} and {upper}.")


@app.post("/predict", dependencies=[Depends(verify_api_key)])
def predict_feasibility(req: PredictRequest):
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
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    target_model_id = req.model_id or ACTIVE_MODEL_ID
    if not target_model_id:
        raise HTTPException(
            status_code=400,
            detail="No active model found. Experimental artifacts cannot score customer requests.",
        )

    target_bundle = None
    for file_path in ARTIFACTS_DIR.glob("*.joblib"):
        try:
            bundle = joblib.load(file_path)
        except Exception:
            continue
        if bundle.get("model_id") == target_model_id:
            target_bundle = bundle
            break

    if not target_bundle:
        raise HTTPException(status_code=404, detail="Model artifact could not be loaded.")

    # A stale, unversioned or OI-6-unapproved bundle must not serve predictions
    # even when an explicit model_id is supplied to the sandbox endpoint.
    if not artifact_ready_for_serving(target_bundle):
        raise HTTPException(
            status_code=422,
            detail=(
                "Model artifact is not serving-ready (schema/version/CV metrics, no leakage "
                "and a complete genuine OI-6 approval are required)."
            ),
        )

    input_df = pd.DataFrame([req.input_features])
    try:
        validate_input_schema(
            input_df,
            target_bundle.get("feature_columns") or target_bundle.get("raw_feature_columns") or [],
            target_bundle.get("feature_schema_version") or FEATURE_SCHEMA_VERSION,
            req.feature_schema_version,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    pipeline = target_bundle["pipeline"]
    try:
        raw_pred = pipeline.predict(input_df)[0]
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Inference error: {_safe_error_text(exc)}") from exc

    prob_map: Dict[str, float] = {}
    confidence = None
    try:
        estimator = pipeline.named_steps.get("model", pipeline)
        if hasattr(estimator, "predict_proba"):
            probabilities = estimator.predict_proba(input_df)[0]
            classes = [str(value) for value in getattr(estimator, "classes_", [f"class_{i}" for i in range(len(probabilities))])]
            prob_map = {classes[i]: float(probabilities[i]) for i in range(len(probabilities))}
            confidence = float(max(prob_map.values())) if prob_map else None
    except Exception:
        pass

    local_factors = compute_local_prediction_factors(
        input_dict=req.input_features,
        global_importances=target_bundle.get("global_importances", []),
        prediction_result=raw_pred,
        confidence_score=confidence,
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
        "feature_schema_version": target_bundle.get("feature_schema_version") or FEATURE_SCHEMA_VERSION,
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
        "artifact_threshold_version": target_bundle.get("risk_threshold_version", SCORING_CONFIG["version"]),
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
    timeframe: str = Query("today 12-m", description="Google Trends timeframe"),
):
    keyword_list = [keyword.strip() for keyword in keywords.split(",") if keyword.strip()]
    if not keyword_list:
        raise HTTPException(status_code=400, detail="At least one keyword is required.")
    return fetch_google_trends(keywords=keyword_list, geo=geo, timeframe=timeframe)


@app.post("/market/demand-analysis", dependencies=[Depends(verify_api_key)])
def get_market_demand_analysis(req: MarketDemandRequest, api_key: str = Depends(verify_api_key)):
    district_data = req.district_data or {
        "district": req.district,
        "purchasing_power_index": 78.0,
        "urbanization_rate": 65.0,
        "commercial_rent_sqft_avg": 180.0,
        "retail_density_score": 75.0,
    }
    return compute_market_demand_analysis(
        primary_keyword=req.primary_keyword,
        district_data=district_data,
        comparison_keywords=req.comparison_keywords,
        geo=req.geo or "PK",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=ML_SERVICE_HOST, port=ML_SERVICE_PORT, reload=False)
