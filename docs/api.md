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

---

## 5. Storefront Configurator & Compiler API (`/api/storefront` & `/api/projects/[id]/storefront-wizard`)

### `GET /api/storefront/variants`
Fetches the sanitized component variant catalog registry.

- **Authentication**: Required (User or Admin)
- **Query Parameters**:
  - `type` (optional): Filter by component type (e.g., `header`, `hero`, `product_card`)
  - `category` (optional): Filter variants compatible with a specific industry category
- **Response `200 OK`**:
  ```json
  {
    "data": [
      {
        "id": "hero-v1-fullbleed-image",
        "name": "Full-Bleed Image Hero",
        "componentType": "hero",
        "description": "High-impact editorial image banner with heading and primary CTA",
        "availability": "core",
        "supportedCategories": [],
        "pageSlots": ["home_hero"],
        "requiredProps": ["title", "cta_text"],
        "optionalProps": ["subtitle", "image_url"],
        "responsiveBehavior": "Image scales responsively; text centers on mobile",
        "accessibilityNotes": "Contrast ratio compliant; aria labels on CTA",
        "themeTokens": ["--primary", "--surface"],
        "requiresData": ["hero_image"],
        "fallbackBehavior": "Gradient background placeholder"
      }
    ],
    "count": 12
  }
  ```

---

### `GET /api/projects/[id]/storefront-wizard`
Retrieves the most recent active or saved MCQ wizard session for the project.

- **Authentication**: Required (Project Owner or Admin)
- **Response `200 OK`**:
  ```json
  {
    "data": {
      "id": "f29b46e8-...",
      "owner_id": "u1092-...",
      "project_id": "c1f7a0e2-...",
      "answers": {
        "style_preference": "modern",
        "audience": "general",
        "product_presentation": "balanced",
        "optional_features": ["faq", "announcement_bar"],
        "schema_version": "v1.0"
      },
      "current_step": 4,
      "recommended_template": "modern-urban",
      "recommended_variants": {
        "header": "header-v2-left-logo-full-nav",
        "hero": "hero-v1-fullbleed-image",
        "product_card": "product-card-v1-standard",
        "footer": "footer-v1-standard-columns"
      },
      "status": "in_progress"
    }
  }
  ```

---

### `POST /api/projects/[id]/storefront-wizard`
Saves MCQ wizard step answers, updates recommendations, and compiles immutable draft store manifests.

- **Authentication**: Required (Project Owner only)
- **Request Body**:
  ```json
  {
    "answers": {
      "style_preference": "modern",
      "audience": "general",
      "product_presentation": "balanced",
      "optional_features": ["faq"]
    },
    "current_step": 4,
    "custom_variants": {
      "hero": "hero-v2-split-text-image"
    },
    "action": "compile"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "session": { ... },
    "compiled": true,
    "manifest": {
      "manifest_version": "v1.0",
      "template_id": "modern-urban",
      "variants": { ... },
      "theme_tokens": { ... },
      "missing_requirements": [],
      "compatibility_violations": []
    },
    "store_id": "s823a-...",
    "draft_version_id": "d918c-...",
    "approval_gate": {
      "status": "draft_compiled",
      "note": "Store is in draft status. Full publication requires project approval gate."
    }
  }
  ```

---

## 8. Store Management API (`/api/stores`)

All store management endpoints require authentication and verify store ownership (`owner_id = auth.uid()`). Returns `403 Forbidden` for unauthorized access.

### `GET /api/projects/[id]/store`
Resolve a project to its associated store. Provisions a draft store if none exists.

- **Authentication**: Required (Owner)
- **Response `200 OK`**:
  ```json
  {
    "store": {
      "id": "s823a-...",
      "project_id": "c1f7a0e2-...",
      "owner_id": "u5e2f-...",
      "name": "Hunza Wild Honey Store",
      "status": "draft",
      "created_at": "2026-10-06T12:00:00Z"
    }
  }
  ```

---

### `GET /api/stores/[id]/overview`
Store dashboard KPIs.

- **Authentication**: Required (Owner)
- **Response `200 OK`**:
  ```json
  {
    "kpis": {
      "total_revenue_pkr": 458000,
      "total_orders": 23,
      "unfulfilled_orders": 5,
      "total_products": 18,
      "active_products": 15,
      "total_customers": 12,
      "low_stock_count": 3
    },
    "low_stock_products": [...],
    "recent_orders": [...]
  }
  ```

---

### `GET /api/stores/[id]/products`
List all products for this store.

- **Authentication**: Required (Owner)
- **Query Parameters**: `?status=active|archived` (optional filter)
- **Response `200 OK`**:
  ```json
  {
    "products": [
      {
        "id": "p1234-...",
        "store_id": "s823a-...",
        "name": "Organic Wild Honey 500g",
        "slug": "organic-wild-honey-500g",
        "price_pkr": 4500,
        "compare_at_price_pkr": 5200,
        "stock": 48,
        "description": "Pure Hunza mountain honey",
        "status": "active",
        "created_at": "2026-10-06T12:10:00Z"
      }
    ]
  }
  ```

---

### `POST /api/stores/[id]/products`
Create a new product.

- **Authentication**: Required (Owner)
- **Request Body**:
  ```json
  {
    "name": "Mountain Bee Pollen 250g",
    "price_pkr": 3200,
    "compare_at_price_pkr": 3800,
    "stock": 100,
    "description": "Raw, unprocessed bee pollen"
  }
  ```
- **Validation**: `price_pkr >= 0`, `stock >= 0`, `compare_at_price_pkr >= price_pkr`, unique slug per store
- **Response `201 Created`**: `{ "product": { ... } }`

---

### `PUT /api/stores/[id]/products/[productId]`
Update an existing product.

- **Authentication**: Required (Owner)
- **Request Body**: Partial product fields to update
- **Response `200 OK`**: `{ "product": { ... } }`

---

### `DELETE /api/stores/[id]/products/[productId]`
Soft-archive a product (sets `status = 'archived'`).

- **Authentication**: Required (Owner)
- **Response `200 OK`**: `{ "product": { ..., "status": "archived" } }`

---

### `GET /api/stores/[id]/inventory`
Stock monitor with optional low-stock filter.

- **Authentication**: Required (Owner)
- **Query Parameters**: `?low_stock=true` (filter to only low-stock items)
- **Response `200 OK`**:
  ```json
  {
    "inventory": [
      {
        "product_id": "p1234-...",
        "name": "Organic Wild Honey 500g",
        "stock": 3,
        "low_stock_threshold": 10,
        "is_low_stock": true
      }
    ]
  }
  ```

---

### `POST /api/stores/[id]/inventory`
Atomic stock adjustment with audit log entry.

- **Authentication**: Required (Owner)
- **Request Body**:
  ```json
  {
    "product_id": "p1234-...",
    "delta": -5,
    "reason": "Damaged stock write-off"
  }
  ```
- **Validation**: Resulting stock must remain >= 0
- **Response `200 OK`**: `{ "product": { ..., "stock": 43 }, "log": { ... } }`

---

### `GET /api/stores/[id]/orders`
List orders with optional status filter.

- **Authentication**: Required (Owner)
- **Query Parameters**: `?status=pending|confirmed|shipped` (optional)
- **Response `200 OK`**:
  ```json
  {
    "orders": [
      {
        "id": "o5678-...",
        "order_number": "ORD-00023",
        "status": "confirmed",
        "total_pkr": 13500,
        "customer_name": "Ahmad Khan",
        "items_count": 3,
        "created_at": "2026-10-06T14:00:00Z"
      }
    ]
  }
  ```

---

### `POST /api/stores/[id]/orders`
Create a new order.

- **Authentication**: Required (Owner)
- **Request Body**:
  ```json
  {
    "customer_name": "Ahmad Khan",
    "customer_phone": "+923001234567",
    "customer_address": "123 Gulberg III, Lahore",
    "items": [
      { "product_id": "p1234-...", "quantity": 2 },
      { "product_id": "p5678-...", "quantity": 1 }
    ]
  }
  ```
- **Validation**: All products must exist and have sufficient stock
- **Response `201 Created`**: `{ "order": { ... } }`

---

### `PATCH /api/stores/[id]/orders/[orderId]`
Transition order status through the fulfillment state machine.

- **Authentication**: Required (Owner)
- **Request Body**:
  ```json
  {
    "status": "confirmed"
  }
  ```
- **Allowed transitions**:
  - `pending` → `confirmed`, `cancelled`
  - `confirmed` → `packed`, `cancelled`
  - `packed` → `shipped`, `cancelled`
  - `shipped` → `delivered`, `returned`
  - `delivered` → `returned`
  - `cancelled`, `returned` → *(terminal)*
- **Side effects**: Stock decrements on `confirmed`, stock restores on `cancelled`/`returned`
- **Response `200 OK`**: `{ "order": { ..., "status": "confirmed" } }`
- **Error `422`**: Invalid transition

---

### `GET /api/stores/[id]/orders/[orderId]/invoice`
Generate a printable invoice.

- **Authentication**: Required (Owner)
- **Query Parameters**: `?format=html|json` (default: `html`)
- **Response `200 OK`** (`format=html`): HTML document with print button
- **Response `200 OK`** (`format=json`): Invoice data as JSON

---

### `GET /api/stores/[id]/customers`
Customer directory with aggregated metrics.

- **Authentication**: Required (Owner)
- **Response `200 OK`**:
  ```json
  {
    "customers": [
      {
        "id": "c9012-...",
        "name": "Ahmad Khan",
        "phone": "+923001234567",
        "total_orders": 5,
        "lifetime_spend_pkr": 67500,
        "last_order_at": "2026-10-06T14:00:00Z"
      }
    ]
  }
  ```

---

### `GET /api/stores/[id]/payments`
List payment providers and their status.

- **Authentication**: Required (Owner)
- **Response `200 OK`**:
  ```json
  {
    "providers": [
      { "id": "cod", "name": "Cash on Delivery", "status": "active", "is_default": true, "is_enabled": true },
      { "id": "stripe", "name": "Stripe", "status": "not_configured", "is_enabled": false },
      { "id": "paypal", "name": "PayPal", "status": "unsupported", "is_enabled": false },
      { "id": "jazzcash", "name": "JazzCash / EasyPaisa", "status": "planned", "is_enabled": false }
    ]
  }
  ```

---

### `POST /api/stores/[id]/payments`
Toggle a payment provider on or off.

- **Authentication**: Required (Owner)
- **Request Body**:
  ```json
  {
    "provider_id": "stripe",
    "is_enabled": true
  }
  ```
- **Validation**: Cannot enable unsupported/planned providers
- **Response `200 OK`**: `{ "provider": { ..., "is_enabled": true } }`

---

## 9. Store Analytics API (`/api/stores/[id]/analytics`)

All analytics endpoints require authentication and verify store ownership (`owner_id = auth.uid()`), returning `403 Forbidden` on cross-tenant requests.

### `GET /api/stores/[id]/analytics/overview`
Aggregated sales KPIs, order counts, average order value, visitors, and period-over-period percentage deltas.

- **Authentication**: Required (Owner)
- **Query Parameters**: `?range=7d|30d|90d|all` (default: `7d`)
- **Response `200 OK`**:
  ```json
  {
    "storeId": "s823a-...",
    "storeName": "Organic Wild Honey Store",
    "currency": "PKR",
    "dateRange": { "preset": "7d", "startDate": "...", "endDate": "..." },
    "kpis": {
      "grossSalesPkr": 145000,
      "netRevenuePkr": 132000,
      "totalOrders": 18,
      "averageOrderValuePkr": 8250,
      "visitorsCount": 420,
      "pageViewsCount": 1850,
      "conversionRatePercent": 3.8,
      "cartAbandonmentRatePercent": 62.5,
      "cancelledOrdersCount": 2,
      "cancelledOrdersAmountPkr": 8000,
      "returnedOrdersCount": 1,
      "returnedOrdersAmountPkr": 5000,
      "delta": {
        "grossSalesDeltaPercent": 14.2,
        "netRevenueDeltaPercent": 11.5,
        "ordersDeltaPercent": 5.8,
        "aovDeltaPercent": 4.1
      }
    }
  }
  ```

---

### `GET /api/stores/[id]/analytics/trends`
Daily time-series metrics for gross sales, net revenue, orders count, visitors, and page views.

- **Authentication**: Required (Owner)
- **Query Parameters**: `?range=7d|30d|90d` (default: `7d`)
- **Response `200 OK`**:
  ```json
  {
    "storeId": "s823a-...",
    "daysCount": 7,
    "trends": [
      {
        "date": "2026-10-06",
        "label": "Oct 6",
        "grossSalesPkr": 24000,
        "netRevenuePkr": 21000,
        "orders": 3,
        "visitors": 64,
        "pageViews": 280
      }
    ]
  }
  ```

---

### `GET /api/stores/[id]/analytics/products`
Product catalog performance breakdown sorted by revenue.

- **Authentication**: Required (Owner)
- **Query Parameters**: `?range=7d|30d|90d` (default: `7d`)
- **Response `200 OK`**:
  ```json
  {
    "storeId": "s823a-...",
    "totalProducts": 12,
    "products": [
      {
        "productId": "p123-...",
        "productName": "Wild Mountain Honey 500g",
        "views": 340,
        "unitsSold": 24,
        "revenuePkr": 72000,
        "conversionRatePercent": 7.1
      }
    ]
  }
  ```

---

### `GET /api/stores/[id]/analytics/behavior`
Customer conversion funnel, cart abandonment rate analysis, and traffic sources breakdown.

- **Authentication**: Required (Owner)
- **Query Parameters**: `?range=7d|30d|90d` (default: `7d`)
- **Response `200 OK`**:
  ```json
  {
    "storeId": "s823a-...",
    "funnel": [
      { "stage": "Visitors", "key": "visitors", "count": 420, "conversionFromFirstPercent": 100, "dropoffPercent": 0 },
      { "stage": "Product Views", "key": "product_view", "count": 310, "conversionFromFirstPercent": 73.8, "dropoffPercent": 26.2 },
      { "stage": "Added to Cart", "key": "add_to_cart", "count": 84, "conversionFromFirstPercent": 20.0, "dropoffPercent": 72.9 },
      { "stage": "Checkout Started", "key": "begin_checkout", "count": 28, "conversionFromFirstPercent": 6.7, "dropoffPercent": 66.7 },
      { "stage": "Purchased", "key": "purchase", "count": 16, "conversionFromFirstPercent": 3.8, "dropoffPercent": 42.9 }
    ],
    "cartAbandonment": {
      "cartsStarted": 84,
      "cartsPurchased": 28,
      "cartsAbandoned": 56,
      "abandonmentRatePercent": 66.7,
      "isAvailable": true,
      "notes": "Derived from 84 cart sessions within the reporting window."
    },
    "trafficSources": [
      { "source": "Direct / Internal", "count": 240, "percentage": 57.1 },
      { "source": "Social Media (Instagram/TikTok)", "count": 110, "percentage": 26.2 },
      { "source": "Google Search", "count": 70, "percentage": 16.7 }
    ]
  }
  ```

---

### `POST /api/stores/[id]/analytics/events`
First-party telemetry event ingestion. Publicly callable for valid, unbanned stores.

- **Authentication**: Public (Visitors)
- **Request Body**:
  ```json
  {
    "event_type": "page_view",
    "session_id": "anon_session_hash_9a8f2",
    "product_id": "p123-...",
    "referrer": "https://instagram.com/shop",
    "utm_source": "instagram"
  }
  ```
- **Validation**: Strict allowlist for `event_type`, payload string length bounds.
- **Response `201 Created`**: `{ "success": true, "recorded": true }`

---

### `GET /api/stores/[id]/analytics/reports`
Executive analytics summary report for store owners.

- **Authentication**: Required (Owner)
- **Query Parameters**: `?range=30d&format=html|json` (default: `html`)
- **Response `200 OK` (`format=html`)**: Print-ready HTML document with `@media print` layout and print trigger.
- **Response `200 OK` (`format=json`)**: Full JSON executive analytics report object.

