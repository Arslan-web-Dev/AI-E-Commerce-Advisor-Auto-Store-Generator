import os
from pathlib import Path
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
        f"FAIL-CLOSED SECURITY ERROR: ML_SERVICE_API_KEY cannot use known default/placeholder value '{raw_key}'. "
        "Please provide a secure, unique secret in your environment configuration."
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
