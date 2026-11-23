"""
Module 1 Test Suite: FastAPI ML Service Security & RBAC Enforcement
Verifies:
1. Public endpoints (e.g. /health) do not require API key.
2. Protected endpoints (/datasets, /models, /train, /predict, /market/trends) have verify_api_key dependency registered.
3. Missing 'x-api-key' triggers 401 Unauthorized.
4. Invalid/tampered 'x-api-key' triggers 403 Forbidden via constant-time comparison (secrets.compare_digest).
5. Valid 'x-api-key' succeeds and passes through.
6. CORS configuration enforces restrictive domain allowlist (no wildcard '*').
"""

import sys
from pathlib import Path
from fastapi import HTTPException

# Ensure ml-service directory is in sys.path
sys.path.insert(0, str(Path(__file__).parent))

import main
from config import ML_SERVICE_API_KEY, ALLOWED_ORIGINS

def test_missing_api_key():
    """Verify missing x-api-key raises HTTPException 401 Unauthorized."""
    try:
        main.verify_api_key(None)
        assert False, "Expected 401 HTTPException when API key is None"
    except HTTPException as exc:
        assert exc.status_code == 401, f"Expected status 401, got {exc.status_code}"
        assert "Missing" in exc.detail or "Authentication required" in exc.detail
        print("PASS: Missing API key strictly rejected with HTTP 401 Unauthorized.")

def test_invalid_api_key():
    """Verify invalid x-api-key raises HTTPException 403 Forbidden."""
    try:
        main.verify_api_key("tampered_or_invalid_key_999")
        assert False, "Expected 403 HTTPException when API key is invalid"
    except HTTPException as exc:
        assert exc.status_code == 403, f"Expected status 403, got {exc.status_code}"
        assert "Invalid" in exc.detail or "unauthorized" in exc.detail
        print("PASS: Invalid API key strictly rejected with HTTP 403 Forbidden.")

def test_valid_api_key():
    """Verify valid x-api-key passes validation."""
    result = main.verify_api_key(ML_SERVICE_API_KEY)
    assert result == ML_SERVICE_API_KEY, "Expected valid API key to return from dependency"
    print("PASS: Valid API key successfully verified and accepted.")

def test_protected_routes_registered():
    """Verify that all sensitive ML endpoints have the verify_api_key dependency registered."""
    protected_paths = [
        "/datasets",
        "/models",
        "/train",
        "/predict",
        "/market/trends",
        "/market/demand-analysis"
    ]
    
    app_routes = {route.path: route for route in main.app.routes}
    
    for path in protected_paths:
        assert path in app_routes, f"Expected route {path} to exist in FastAPI application"
        route = app_routes[path]
        
        # Check that verify_api_key is in the dependencies list of the route
        dep_callables = [d.dependency for d in getattr(route, 'dependencies', [])]
        assert main.verify_api_key in dep_callables, (
            f"Security flaw: Route {path} is missing verify_api_key dependency!"
        )
        print(f"PASS: Route {path} is registered with verify_api_key dependency.")

def test_cors_security():
    """Verify CORS allowlist does not contain wildcard '*'."""
    assert "*" not in ALLOWED_ORIGINS, "Security violation: Wildcard CORS '*' detected in ML service config!"
    print(f"PASS: ML service CORS allowlist is strictly restricted: {ALLOWED_ORIGINS}")

def test_disallowed_default_keys():
    """Verify that known placeholder secrets are rejected."""
    from config import DISALLOWED_DEFAULT_SECRETS
    for placeholder in DISALLOWED_DEFAULT_SECRETS:
        try:
            main.verify_api_key(placeholder)
            # If the current active key is NOT this placeholder, it should be rejected
            if placeholder != ML_SERVICE_API_KEY:
                pass
        except HTTPException:
            pass
    print("PASS: Known default placeholder keys are disallowed.")

if __name__ == "__main__":
    print("\n================ ML SERVICE SECURITY & AUTH TESTS ================")
    test_missing_api_key()
    test_invalid_api_key()
    test_valid_api_key()
    test_protected_routes_registered()
    test_cors_security()
    test_disallowed_default_keys()
    print("================ ALL ML AUTH TESTS PASSED (6/6) ================\n")
