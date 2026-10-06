# REST API Documentation — AI E-Commerce Advisor

## Base URL
`/api`

All endpoints require an authenticated user session cookie (or Bearer token) unless explicitly marked as public.

---

## 1. Projects API (`/api/projects`)

### `GET /api/projects`
List all projects owned by the currently authenticated user.

- **Authentication**: Required (Session / User token)
- **Response `200 OK`**:
  ```json
  {
    "projects": [
      {
        "id": "c1f7a0e2-...",
        "title": "Hunza Wild Honey",
        "category": "Grocery & Gourmet Food",
        "custom_category": null,
        "target_location": "Gulberg III, Lahore, Pakistan",
        "city": "Lahore",
        "budget_amount": 15000,
        "budget_currency": "USD",
        "business_scale": "small",
        "status": "submitted",
        "current_step": 5,
        "created_at": "2026-10-06T10:00:00Z",
        "updated_at": "2026-10-06T10:05:00Z",
        "submitted_at": "2026-10-06T10:05:00Z"
      }
    ]
  }
  ```

---

### `POST /api/projects`
Initialize a new project draft.

- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "title": "Organic Skincare Line",
    "category": "Cosmetics & Skincare",
    "custom_category": null,
    "target_location": "DHA Phase 5, Lahore, Pakistan",
    "city": "Lahore",
    "budget_amount": 12000,
    "budget_currency": "USD",
    "current_step": 1,
    "target_audience": {
      "age_group": "Young Professionals (25-34)",
      "gender": "Female-skewed",
      "income_level": "Affluent / Premium"
    },
    "business_scale": "small",
    "business_model": "hybrid",
    "storefront_footprint": "boutique",
    "product_description": "Clean, chemical-free cold-pressed botanical oils."
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "project": { ... }
  }
  ```

---

### `GET /api/projects/[id]`
Retrieve full details of a specific project. Ownership is strictly verified on the server.

- **Authentication**: Required
- **Response `200 OK`**: Project object
- **Response `403 Forbidden`**: If project belongs to another user
- **Response `404 Not Found`**: If project does not exist

---

### `PATCH /api/projects/[id]`
Update a draft project. Note: Edits to submitted projects are rejected with `400 Bad Request`.

- **Authentication**: Required
- **Request Body**: Partial project fields to update.
- **Response `200 OK`**:
  ```json
  {
    "project": { ... }
  }
  ```

---

### `POST /api/projects/[id]/submit`
Submit an existing draft project for feasibility analysis.
Validates all required fields (category, location, budget). Transitions status from `draft` to `submitted`, creates a linked `feasibility_reports` row with status `pending`, and timestamps `submitted_at`.

- **Authentication**: Required
- **Response `200 OK`**:
  ```json
  {
    "message": "Project submitted successfully for feasibility analysis",
    "project": { ... },
    "report_id": "a93e...uuid"
  }
  ```

---

### `POST /api/projects/upload`
Upload an optional product specification document (PDF, CSV, JSON, PNG, JPG; max 5MB).

- **Authentication**: Required
- **Request**: `multipart/form-data` with `file` and `project_id`.
- **Response `200 OK`**:
  ```json
  {
    "file_url": "project-attachments/user-id/file-name.pdf",
    "file_name": "catalog.pdf",
    "file_size": 204850
  }
  ```

---

## 2. Market Data Collection API (`/api/projects/[id]/...`)

### `POST /api/projects/[id]/collect`
Initiate or retry external and benchmark data collection across competitors, demographics, trends, and cost models.

- **Authentication**: Required (Project owner or system admin)
- **Request Body (Optional)**:
  ```json
  {
    "force_demo": false
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "Data collection completed successfully across all providers",
    "success": true,
    "run_id": "93f8e02d-...",
    "status": "completed",
    "providers_status": {
      "competitors": {
        "status": "completed",
        "provider": "overpass_osm",
        "provenance": "external_api",
        "item_count": 14,
        "latency_ms": 1280
      },
      "regional_stats": {
        "status": "completed",
        "provider": "pbs_census_open_data",
        "provenance": "licensed_dataset",
        "item_count": 3
      },
      "trends": {
        "status": "completed",
        "provider": "google_trends_pytrends",
        "provenance": "external_api",
        "item_count": 12
      },
      "costs": {
        "status": "completed",
        "provider": "sme_cost_benchmark_model",
        "provenance": "manual_estimate",
        "item_count": 4
      }
    },
    "summary": {
      "competitor_count": 14,
      "market_metric_count": 3,
      "has_trend_data": true,
      "cost_estimate_count": 4
    }
  }
  ```

---

### `GET /api/projects/[id]/collection`
Retrieve current collection run status, latest run timestamp, and summary metrics.

- **Authentication**: Required (Owner or Admin)
- **Response `200 OK`**:
  ```json
  {
    "latest_run": { ... },
    "has_data": true,
    "summary": {
      "competitor_count": 14,
      "market_metric_count": 3,
      "has_trend_data": true,
      "cost_estimate_count": 4
    }
  }
  ```

---

### `GET /api/projects/[id]/competitors`
Retrieve paginated competitor POIs discovered for the project.

- **Authentication**: Required (Owner or Admin)
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20, max: 50)
- **Response `200 OK`**:
  ```json
  {
    "competitors": [
      {
        "id": "...",
        "name": "Al-Fatah Gourmet Mart",
        "category": "supermarket",
        "provider": "overpass_osm",
        "provenance": "external_api",
        "lat": 31.5204,
        "lng": 74.3587,
        "distance_km": 0.42,
        "rating": 4.5,
        "price_level": "Moderate",
        "address": "Gulberg III, Lahore",
        "retrieved_at": "2026-10-06T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 14,
      "total_pages": 1
    }
  }
  ```

---

### `GET /api/projects/[id]/market-data`
Retrieve regional census demographics and 12-month demand trend observations.

- **Authentication**: Required (Owner or Admin)
- **Response `200 OK`**:
  ```json
  {
    "observations": [
      {
        "metric_name": "population",
        "metric_value": 13004135,
        "unit": "count",
        "geography": "Lahore, Pakistan",
        "period_year": 2023,
        "provenance": "licensed_dataset"
      }
    ],
    "demand_trend": {
      "category": "Grocery & Gourmet Food",
      "region": "PK",
      "trend_series": [{ "month": "2025-10", "index": 78 }],
      "avg_interest": 74.2,
      "trend_slope": "stable",
      "provenance": "external_api"
    }
  }
  ```

---

### `GET /api/projects/[id]/costs`
Retrieve category-specific commercial setup, monthly rent, marketing, and logistics cost estimates.

- **Authentication**: Required (Owner or Admin)
- **Response `200 OK`**:
  ```json
  {
    "costs": [
      {
        "cost_type": "rent_monthly",
        "amount_min": 180000,
        "amount_max": 240000,
        "currency": "PKR",
        "period_or_unit": "per_month",
        "assumptions": "Commercial rent benchmarked at Rs. 220/sq.ft for 250 sq.ft footprint.",
        "provenance": "manual_estimate"
      }
    ]
  }
  ```

---

## 4. Feature Processing & Engineering API (`/api/projects/[id]`)

### `POST /api/projects/[id]/process`
Triggers deterministic feature engineering, deduplication, imputation, and quality scoring on collected project records.

- **Authentication**: Required (Owner or Admin)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "run": {
      "id": "e4f81c9a-...",
      "project_id": "c1f7a0e2-...",
      "status": "completed",
      "quality_score": 92.00,
      "data_completeness": "complete",
      "imputations_count": 0,
      "deduplication_stats": {
        "raw_count": 14,
        "unique_count": 13,
        "duplicates_removed": 1
      },
      "started_at": "2026-10-06T10:15:00Z",
      "completed_at": "2026-10-06T10:15:02Z"
    },
    "features": {
      "id": "b1a7d83f-...",
      "competitors_count": 13,
      "category_saturation": 0.00000100,
      "budget_ratio": 1.4200,
      "avg_demand_index": 74.20,
      "trend_slope": "stable",
      "trend_slope_score": 0.0,
      "population": 13004135,
      "total_estimated_annual_cost": 2940000,
      "user_budget": 4170000,
      "currency": "PKR",
      "engineered_vector": {
        "norm_competitors_density": 0.4333,
        "norm_category_saturation": 0.1000,
        "norm_budget_ratio": 0.7100,
        "norm_avg_demand": 0.7420,
        "trend_slope_score": 0.0,
        "norm_internet_penetration": 0.5430,
        "norm_ecommerce_growth": 0.4625,
        "footprint_scale": 2,
        "channel_type": 1
      },
      "feature_version": "v1.0"
    }
  }
  ```

---

### `GET /api/projects/[id]/features`
Retrieves the most recent engineered feature record and processing run metadata.

- **Authentication**: Required (Owner or Admin)
- **Response `200 OK`**:
  ```json
  {
    "features": {
      "id": "b1a7d83f-...",
      "competitors_count": 13,
      "category_saturation": 0.00000100,
      "budget_ratio": 1.4200,
      "avg_demand_index": 74.20,
      "trend_slope": "stable",
      "engineered_vector": { ... },
      "feature_version": "v1.0"
    },
    "latest_run": {
      "id": "e4f81c9a-...",
      "status": "completed",
      "quality_score": 92.00,
      "data_completeness": "complete"
    },
    "has_features": true
  }
  ```

---

### `GET /api/projects/[id]/processing-runs`
Retrieves the execution history of all feature engineering runs for auditability.

- **Authentication**: Required (Owner or Admin)
- **Response `200 OK`**:
  ```json
  {
    "runs": [
      {
        "id": "e4f81c9a-...",
        "status": "completed",
        "quality_score": 92.00,
        "data_completeness": "complete",
        "deduplication_stats": { "duplicates_removed": 1 },
        "created_at": "2026-10-06T10:15:00Z"
      }
    ],
    "total": 1
  }
  ```


