import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATASETS_DIR = BASE_DIR / "data" / "datasets"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
CACHE_DIR = BASE_DIR / "data" / "cache"

DATASETS_DIR.mkdir(parents=True, exist_ok=True)
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Security and networking
ML_SERVICE_PORT = int(os.environ.get("ML_SERVICE_PORT", "8000"))
ML_SERVICE_HOST = os.environ.get("ML_SERVICE_HOST", "127.0.0.1")
ML_SERVICE_API_KEY = os.environ.get("ML_SERVICE_API_KEY", "internal-dev-ml-secret-key-2026")
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")

if ENVIRONMENT == "production" and (not ML_SERVICE_API_KEY or ML_SERVICE_API_KEY == "internal-dev-ml-secret-key-2026"):
    raise ValueError("Production ML Service must be configured with a non-default ML_SERVICE_API_KEY")

# Restricted CORS Origins
raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [orig.strip() for orig in raw_origins.split(",") if orig.strip()]

# Maximum upload file size (50MB)
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
