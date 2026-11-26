import json
import os
from pathlib import Path
from typing import Any, Dict
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent

# Load environment configuration from repo root or local directory if present
load_dotenv(REPO_ROOT / ".env.local")
load_dotenv(REPO_ROOT / ".env")
load_dotenv(BASE_DIR / ".env")

DATASETS_DIR = BASE_DIR / "data" / "datasets"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
CACHE_DIR = BASE_DIR / "data" / "cache"
SCORING_CONFIG_PATH = REPO_ROOT / "config" / "module4-scoring.json"
LABEL_POLICY_PATH = BASE_DIR / "config" / "label_approval.json"

# FR-4 schema/version contract. These are incremented only when the feature,
# artifact or synthetic-dataset contract changes incompatibly.
FEATURE_SCHEMA_VERSION = "v2.0-fr4"
ARTIFACT_SCHEMA_VERSION = "v2.0-fr4"
DATASET_SCHEMA_VERSION = "v2.0-fr4-synthetic"
SYNTHETIC_DATA_SOURCE = "synthetic"
TRAINING_RANDOM_SEED = 42

with open(SCORING_CONFIG_PATH, "r", encoding="utf-8") as _scoring_file:
    SCORING_CONFIG = json.load(_scoring_file)


def validate_risk_thresholds(payload: Any) -> Dict[str, Any]:
    """Validate an admin-supplied FR-4.4 threshold contract; fail closed."""
    if not isinstance(payload, dict):
        raise ValueError("Risk thresholds must be a JSON object.")
    version = payload.get("version")
    if not isinstance(version, str) or not version.strip():
        raise ValueError("Risk thresholds require a non-empty version.")
    boundaries: Dict[str, float] = {}
    for key in ("low_risk_min", "moderate_risk_min", "high_risk_min"):
        value = payload.get(key)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{key} must be a number in [0, 1].")
        value = float(value)
        if not 0 <= value <= 1:
            raise ValueError(f"{key} must be in [0, 1].")
        boundaries[key] = value
    if not (
        boundaries["low_risk_min"]
        > boundaries["moderate_risk_min"]
        > boundaries["high_risk_min"]
        > 0
    ):
        raise ValueError(
            "Risk thresholds must be strictly ordered: "
            "low_risk_min > moderate_risk_min > high_risk_min > 0."
        )
    return {"version": version.strip(), **boundaries}

DATASETS_DIR.mkdir(parents=True, exist_ok=True)
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Security and networking configuration
ML_SERVICE_PORT = int(os.environ.get("ML_SERVICE_PORT", "8000"))
ML_SERVICE_HOST = os.environ.get("ML_SERVICE_HOST", "127.0.0.1")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").strip().lower()

DISALLOWED_DEFAULT_SECRETS = {
    "internal-dev-ml-secret-key-2026",
    "change-me",
    "secret",
    "placeholder",
    "your-ml-api-key-here",
    "your-secure-ml-service-api-key-here",
    "123456",
}

raw_key = os.environ.get("ML_SERVICE_API_KEY", "").strip()

if not raw_key:
    raise RuntimeError(
        "FAIL-CLOSED SECURITY ERROR: ML_SERVICE_API_KEY environment variable is missing. "
        "The ML microservice requires a configured secret to authenticate requests."
    )

if raw_key.lower() in DISALLOWED_DEFAULT_SECRETS:
    raise RuntimeError(
        "FAIL-CLOSED SECURITY ERROR: ML_SERVICE_API_KEY uses a known default/placeholder value. "
        "Never echo configured secrets; provide a secure, unique secret in your environment configuration."
    )

if ENVIRONMENT == "production" and len(raw_key) < 32:
    raise RuntimeError(
        "FAIL-CLOSED SECURITY ERROR: Production ML Service requires an ML_SERVICE_API_KEY with at least 32 characters."
    )

ML_SERVICE_API_KEY = raw_key

# Restricted CORS Origins
raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [orig.strip() for orig in raw_origins.split(",") if orig.strip()]

# Maximum upload file size (50MB)
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
