# Requirements Traceability Matrix

This matrix maps functional and non-functional requirements from the Software Requirements Specification (SRS v2.0) to their technical implementations in the codebase.

---

## Module 1: User Authentication, RBAC & Landing Page

| SRS ID | Requirement Title | Technical Implementation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-1.1** | Email/Password Registration & Login | `src/app/login/page.tsx`, Supabase Auth integration | Automated Auth Flow + Build verification | ✅ Verified |
| **FR-1.2** | Google OAuth & Account Linking | `src/app/auth/callback/route.ts` with code exchange | Route handler & verified email linking | ✅ Verified |
| **FR-1.3** | Roles: Owner & Admin | `profiles.role` enum, server-side trigger `handle_new_user()` | RLS Policy + Trigger enforcement | ✅ Verified |
| **FR-1.4** | Route Guards in Middleware | `src/middleware.ts`, `src/lib/supabase/middleware.ts` | SSR route guard tests | ✅ Verified |
| **FR-1.5** | Seed Admin Bootstrap | `scripts/seed-admin.mjs` with env secrets | Script execution check | ✅ Verified |
| **FR-1.6** | System GitHub REST Sync | `src/app/api/admin/sync/route.ts`, `src/app/admin/page.tsx` | Admin API check & audit log | ✅ Verified |
| **FR-1.7** | Password Reset & Session Revocation | `src/app/reset-password`, `src/app/update-password`, `/api/auth/signout` | Route tests | ✅ Verified |
| **FR-1.8** | User Account Deletion & Cascades | `/api/auth/delete-account`, PostgreSQL foreign-key cascades | Cascading delete tests | ✅ Verified |

---

## Module 2: Business Idea Input and Project Creation

| SRS ID | Requirement Title | Technical Implementation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-2.1** | Store Requirement Input (Category, Location, Budget) | `src/components/wizard/BusinessIdeaWizard.tsx` (Steps 1–3) | Input validation + Schema tests | ✅ Verified |
| **FR-2.2** | Advanced Input Options (Audience, Scale, Products) | `src/components/wizard/BusinessIdeaWizard.tsx` (Step 4), file upload | Schema verification + Type checks | ✅ Verified |
| **FR-2.3** | Commercial Hub Picker & Location | `COMMERCIAL_HUB_PRESETS`, worldwide location text | Coordinate & preset validation | ✅ Verified |
| **FR-2.4** | Budget Range Validation & Currency | USD ($100–$10M) / PKR (Rs. 10k–500M) dual-currency slider | Range validator tests | ✅ Verified |
| **FR-2.5** | Optional Inputs (Channel, Footprint) | D2C vs Hybrid, Kiosk/Boutique/Outlet/Flagship footprint | Form & DB persistence checks | ✅ Verified |
| **FR-2.6** | Submission Lifecycle & Report Linkage | `POST /api/projects/[id]/submit` links `feasibility_reports` | Status transition tests | ✅ Verified |
| **FR-2.7** | Search Radius Selection | 5–25 km dynamic slider with 10–15 km standard default | Slider state & reach calculations | ✅ Verified |

---

## Module 3: Data Collection and Provider Integration

| SRS ID | Requirement Title | Technical Implementation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-3.1** | Competitor Data Collection | `OverpassCompetitorProvider` & `DemoCompetitorProvider` | Overpass API QL + Synthetic Fallback | ✅ Verified |
| **FR-3.2** | Market & Demographics Data | `PbsRegionalStatsProvider` (PBS 2023 Census & PTA) | Metric observations persistence | ✅ Verified |
| **FR-3.2** | Category Demand & Search Trends | `GoogleTrendsProvider` (12-month relative interest) | Trend point array & slope calculation | ✅ Verified |
| **FR-3.3** | Cost Data Collection (Setup, Rent, Logistics) | `BenchmarkCostEstimateProvider` + `rent_cache` | Currency conversion & range checks | ✅ Verified |
| **Orchestration** | Independent Concurrent Provider Execution | `runDataCollection()` via `Promise.allSettled` | Concurrency & partial failure tests | ✅ Verified |
| **Persistence** | Normalized Source Records & Provenance | `project_collection_runs`, `project_competitors`, etc. | PostgreSQL RLS + Provenance tags | ✅ Verified |
| **Transparency** | UI Status, Provenance Badges & Fallback Actions | `MarketDataPanel.tsx` in `/projects/[id]` | UI component render & toggle checks | ✅ Verified |

---

## Module 4: Data Processing and Feature Engineering

| SRS ID | Requirement Title | Technical Implementation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-4.1** | Competitor Deduplication & Count | `deduplicateCompetitors()` spatial Haversine (<50m) & brand match | Deduplication unit tests | ✅ Verified |
| **FR-4.1** | Category Saturation Feature | `category_saturation = competitors_count / population` | Mathematical formula & edge case null test | ✅ Verified |
| **FR-4.1** | Budget Ratio Feature | `budget_ratio = user_budget / total_estimated_cost` | Currency normalization & coverage math test | ✅ Verified |
| **FR-4.1** | ML Feature Vector | Bounded $[0, 1]$ `engineered_vector` JSON schema | Vector structure & range tests | ✅ Verified |
| **FR-4.2** | Missing Value Imputation | `cleanAndValidateData()` with national benchmarks & audit tags | Imputation counter & integrity check | ✅ Verified |
| **FR-4.2** | Data Completeness & Quality Scoring | 4-domain scoring (0–100%) & status (`complete`, `partial`, `unavailable`) | Scoring threshold verification | ✅ Verified |
| **Persistence** | Auditable Run & Features Persistence | `project_processing_runs` & `project_features` with RLS | Migration & policy verification | ✅ Verified |
| **API Endpoints** | Feature Processing & Retrieval APIs | `POST /api/projects/[id]/process`, `GET .../features`, `GET .../processing-runs` | API route integration tests | ✅ Verified |
| **UI Integration**| Feature Quality & Completeness Panel | `FeatureQualityPanel.tsx` on `/projects/[id]` | Component render & interaction check | ✅ Verified |

