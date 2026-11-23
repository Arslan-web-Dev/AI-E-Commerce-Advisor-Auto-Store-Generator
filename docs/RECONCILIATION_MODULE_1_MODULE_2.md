# Requirement Reconciliation Record: Module 1 & Module 2

**Authority:** user-supplied *FYP SRS & SDD Combined*, v1.0, October 2026; Revised SRS; `docs/FINAL_DELIVERY_BASELINE.md`; and existing repository audit.

---

## 1. Reconciliation Matrix

| # | Topic | Original Advanced SRS | Revised SRS / Baseline | Existing Implementation | Conflict or Ambiguity | Recommended Interpretation | Final Implementation Decision |
|---|---|---|---|---|---|---|---|
| **1** | **Wizard Steps & Organization** | 5 Steps: Category & Vision, Location & Catchment, Budget & Capital, Target Audience & Scale, Review & Submit. | 3 Steps: (1) Idea & Category, (2) Location & Market, (3) Budget, Options, Attachments & Review. | 5-step wizard component in `BusinessIdeaWizard.tsx`. | Step count differs (5 vs 3), but both require identical data fields (Title, Category, Vision, Scale, Model, Location, Budget, Radius, Audience, Catalog upload). | Group into a 3-step unified workflow matching the Revised SRS while preserving every single advanced field from the Original SRS. | **Adopt 3-Step Unified Wizard:**<br>• **Step 1: Business Idea Information** (Title, Predefined Category + Custom Category, Vision Description, Business Model, Business Scale, Product Types).<br>• **Step 2: Investment Budget & Target Market** (Budget amount, PKR/USD toggle with transparent rate, Target Audience demographics, Target Location in Pakistan, City, Coordinates, Radius).<br>• **Step 3: Additional Details, Attachments & Review** (Product catalog/spec upload, Supporting documents, Optional notes, Full review summary, Autosave status, Idempotent submission). |
| **2** | **Investment Budget Limits** | Rs. 50,000 to Rs. 50,000,000 (and up to Rs. 500M in some mockups). | Rs. 10,000 to Rs. 50,000,000 (PKR). | Validated between Rs. 10,000 and Rs. 50,000,000; some legacy comments said 500k. | Inconsistency in minimum (Rs. 10,000 vs 50,000) and maximum (50M vs 500M). | Rs. 10,000 reflects micro-retail / cottage ecommerce in Punjab, while Rs. 50,000,000 captures large retail setups. | **Enforce PKR 10,000 to PKR 50,000,000:** Canonical storage in database as integer `bigint` PKR (`budget_pkr`). Reject values outside this range with informative validation errors. |
| **3** | **USD / PKR Currency Handling** | Dual currency toggle with fixed $1 = Rs. 278 conversion. | Canonical currency PKR; USD allowed with disclosed conversion rate or labeled demo rate. | Fixed constant `EXCHANGE_RATE_USD_TO_PKR = 278` in `types/project.ts`. | Hardcoded constant was treated as live data without provenance or timestamp. | Disclose exchange rate explicitly; record exchange rate, timestamp, and benchmark type in metadata; store canonical `budget_pkr`. | **Implement Transparent FX Service:** Store `budget_amount`, `budget_currency`, `budget_pkr`, `exchange_rate_used`, and `exchange_rate_timestamp`. Display clear label: "Benchmark Exchange Rate (Rs. 278 / USD - Updated November 2026)". |
| **4** | **Spatial Catchment & Search Radius** | 5 to 25 km slider in initial draft; 10 to 15 km in body. | Default 10 km, maximum 15 km (FR-2.7). | Clamped to `[10, 15]` km with default 10 km in wizard state. | Initial prototypes allowed up to 25 km, violating Overpass density limits. | 10 km represents realistic commercial reach in dense Punjab cities (Lahore, Faisalabad, Rawalpindi); 15 km is upper bound. | **Enforce Default 10 km, Max 15 km:** Range `[5.0, 15.0]` km with default `10.0` km. Validate server-side in API routes. |
| **5** | **Location & Default Coordinates** | Initial draft pre-filled Gulberg III / Lahore (31.5204, 74.3587). | Pakistan-restricted autocomplete / commercial hub picker. No silent default to Lahore. | Hard-coded Lahore coordinates were pre-filled in default state. | Pre-populating Lahore caused non-Lahore entrepreneurs to inadvertently submit Lahore coordinates. | Require explicit location input or commercial hub selection. Coordinates must be within Pakistan bounding box (Lat 23.5–37.2, Lng 60.8–77.9). | **Zero Silent Defaults:** Default form starts with unselected location. Entrepreneur must select a verified Punjab hub (Lahore, Faisalabad, Rawalpindi, Multan, Gujranwala, Sialkot, etc.) or type manual locality with coordinates. Server validates Pakistan geographic bounds. |
| **6** | **Storage Security for Attachments** | Public bucket in initial migration. | Strictly private bucket with authenticated owner access and signed URLs. | Bucket was registered with `public = true` and `storage.objects` select policy open to public. | Severe security vulnerability: anyone could view private catalog documents and business plans. | Convert `project-attachments` to private bucket. Enforce folder path `{user_id}/{project_id}/{unique_filename}`. Use short-lived signed URLs. | **Private Bucket & Signed URLs:**<br>1. Migration to set bucket `public = false`.<br>2. Delete public select policy.<br>3. Storage policy: only authenticated user matching `{user_id}` folder can upload, select, update, delete.<br>4. Backend returns signed URLs (1 hour expiry) verifying project ownership. |
| **7** | **ML Service Authentication & CORS** | Next.js sends `x-api-key`; FastAPI service had wildcard CORS and no enforced key dependency. | Authenticated ML service with constant-time API key check and restricted origin allowlist. | `allow_origins=["*"]` in `ml-service/main.py`; key check not universally enforced. | Unauthenticated third parties could invoke compute-heavy model training and predictions. | FastAPI dependency validating `x-api-key` header using `secrets.compare_digest(key, ML_SERVICE_API_KEY)`. Restrict CORS to authorized origins. | **Enforce Constant-Time API Key & CORS Allowlist:** Require `x-api-key` on all sensitive endpoints (`/predict`, `/train`, `/models`, `/datasets`). Configure explicit CORS origins (`http://localhost:3000`, `http://127.0.0.1:3000`, `APP_URL`). |
| **8** | **ML Administration Route Protection** | Next.js ML routes `/api/ml/models`, `/api/ml/train`, `/api/ml/datasets` had missing GET authentication. | Administrative operations must require authenticated session with `role = 'admin'`. | GET `/api/ml/models` and GET `/api/ml/train` had no auth checks. | Unauthenticated visitors could query training job statuses and model registries. | Require `supabase.auth.getUser()` and check `profiles.role === 'admin'` on all ML admin routes (GET and POST). | **Secure All ML Admin Routes:** Return 401 if unauthenticated, 403 if role is not `'admin'`. |
| **9** | **Roles & Self-Promotion Prevention** | Roles: `owner`, `admin`. Trigger auto-assigns `owner`. | Same. Prevent any role self-escalation in profile updates. | Trigger `handle_new_user` assigns `'owner'`. RLS `profiles_update_own` restricts columns. | Need verification that PATCH/PUT `/api/account` or direct Supabase updates cannot change `role`. | Profile RLS prevents `role` updates. Seed admin uses server-side service-role script only. | **Hardened Server RBAC:** Server-side validation on every sensitive API. Profile updates reject `role` and `must_change_password` modifications. |

---

## 2. Architectural Blueprint

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ENTREPRENEUR BROWSER                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS + Cookies / Session
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APP ROUTER                             │
│                                                                        │
│  [Middleware]: Session Refresh & Route Guards                          │
│  [/wizard]: 3-Step Guided Business Idea Wizard (Autosave + Validation) │
│  [/projects]: Project Portfolio & Draft Management                     │
│  [/admin]: Admin Command Center (Admin Role Only)                      │
│                                                                        │
│  [API Route Guards]: Server-side auth.getUser() + Profile Role Check   │
│   ├── /api/projects: Owner CRUD (RLS-enforced)                         │
│   ├── /api/projects/upload: Private Attachment Upload                  │
│   ├── /api/projects/[id]/attachments: Signed URL Generation            │
│   ├── /api/projects/[id]/submit: Idempotent Analysis Trigger           │
│   └── /api/ml/*: Admin Only (401/403 guards)                           │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    │ Signed x-api-key              │ Supabase Client /
                    │ (Internal Network)            │ Service-Role
                    ▼                               ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       FASTAPI ML MICROSERVICE        │  │     SUPABASE POSTGRESQL      │
│                                      │  │                              │
│  • Constant-time API Key Auth        │  │  • RLS Default Deny          │
│  • Restricted CORS Allowlist         │  │  • Private Storage Bucket    │
│  • Multi-Model Training & Prediction │  │  • Non-escalating Profiles   │
│  • Pytrends & Punjab Market Analytics│  │  • Cascading User Deletion   │
└──────────────────────────────────────┘  └──────────────────────────────┘
```
