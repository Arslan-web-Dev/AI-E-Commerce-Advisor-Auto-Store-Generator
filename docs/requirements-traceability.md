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

---

## Module 5: Feasibility Prediction and Score Classification

| SRS ID | Requirement Title | Technical Implementation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-5.1** | Feasibility Prediction & Outcome | Provisional MCDA scoring engine (`src/lib/scoring/mcda.ts`) | Algorithmic scoring audit | ✅ Verified (Provisional) |
| **FR-5.2** | Supervised Model Governance | Deferred training audit (`docs/deferred-supervised-training.md`), `model_registry` schema | Schema & readiness note audit | ✅ Verified |
| **FR-5.3** | Feasibility Classification | Categorization: High (>=75), Moderate (50-74), Low (<50) | MCDA score threshold tests | ✅ Verified |
| **FR-5.4** | Feasibility Results Presentation | Feasibility breakdown UI (`/projects/[id]/feasibility`) | UI render & transparency tests | ✅ Verified |

---

## Module 6: Strategic Advisory, Budget Allocation & Location Recommendations

| SRS ID | Requirement Title | Technical Implementation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-6.1** | Strategic Advisory Engine | Advisory generator consuming M4 features and M5 score | Rule engine evaluation tests | ✅ Verified |
| **FR-6.2** | Budget Allocation Breakdown | Setup, inventory, marketing, working capital splits | Currency & percentage math tests | ✅ Verified |
| **FR-6.3** | Evidence-Based Location Rankings | Regional foot-traffic & demographic ranking with provenance | Provenance and score audit | ✅ Verified |
| **FR-6.4** | Strategic Advisory UI | Strategic recommendations & budget allocation view | UI interactive testing | ✅ Verified |

---

## Module 7: Theme Configurator, 20+ Component Variant Library & Storefront Compiler

| SRS ID | Requirement Title | Technical Implementation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-7.1** | MCQ Theme Configurator Flow | 4-step interactive wizard (`/projects/[id]/storefront-wizard`) | Wizard step & option tests | ✅ Verified |
| **FR-7.2** | 20+ Component Variant Library | 240 distinct variants across 12 component families in `src/lib/storefront/variant-catalog.ts` | Programmatic 20+ integrity check (`verify-catalog-20plus.mjs`) | ✅ Verified |
| **FR-7.3** | Live Multi-Viewport Preview | Viewport-responsive schematic wireframes (`WireframePreview`) for all 12 component families | Viewport switching (Desktop/Tablet/Mobile) & render tests | ✅ Verified |
| **FR-7.4** | Template Presets & Auto-Recommendation | 4 presets (`modern-urban`, `boutique-elegant`, `high-density-catalog`, `emerald-brand`) | MCQ mapping & deterministic fallback tests | ✅ Verified |
| **FR-7.5** | Safe Storefront Compiler | Pure JSON manifest compiler (`compileManifest`), zero executable code stored | Invariant & injection tests | ✅ Verified |
| **FR-7.6** | Approval Gate & Versioned Drafts | `store_draft_versions` & `store_wizard_sessions` schema, status locked to `draft` | RLS & server draft compile API tests | ✅ Verified |

---

## Module 8: Post-Launch Store Management

| SRS ID | Requirement Title | Technical Implementation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-8.8** | Product CRUD & Price/Stock Management | Products API (`/api/stores/[id]/products`), slug validation, non-negative price/stock constraints, soft archiving | API CRUD tests, DB constraint verification | ✅ Verified |
| **FR-8.9** | Low-Stock Alerts | `filterLowStockProducts()`, Inventory API (`/api/stores/[id]/inventory`), KPI alert banner | Low-stock threshold & filter tests | ✅ Verified |
| **FR-8.10** | Order List/Details/Status/Invoices | Order API with `ALLOWED_STATUS_TRANSITIONS` state machine, stock sync on confirm/cancel, `generateInvoiceHtml()` | State machine transition tests, XSS safety audit | ✅ Verified |
| **FR-8.11** | Customer Profiles & Order History | Customers API (`/api/stores/[id]/customers`) with aggregated lifetime spend | Directory render & aggregation tests | ✅ Verified |
| **FR-8.12** | Payment Method Management | Payment settings API, truthful provider status registry (COD active, Stripe configurable) | Provider status audit, no-fake-charge check | ✅ Verified |
| **Security** | Tenant Isolation & RLS | `can_manage_store()` SQL helper, `owner_id = auth.uid()`, forced RLS on all 6 tables | RLS policy & 403 guard verification | ✅ Verified |
| **UI** | Merchant Control Panel | 6-tab interface at `/projects/[id]/store` with product modal, stock adjustment, order drawer, invoice viewer | Tab render, modal interaction, sandbox mode check | ✅ Verified |

---

## Module 9: Generated Store Analytics, Customer Behavior & Reports

| SRS ID | Requirement Title | Technical Implementation | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-9.1** | Gross Sales & Net Revenue Calculation | `calculateOrderMetrics()` in `src/lib/analytics/metrics.ts`, deducting returns/cancels | Fixed test fixture math tests | ✅ Verified |
| **FR-9.2** | Daily, Weekly & Monthly Sales Trends | `generateDailyTrends()` in `metrics.ts`, `/api/stores/[id]/analytics/trends` | Time series bucketing tests | ✅ Verified |
| **FR-9.3** | Top Performing Products & Conversion | `aggregateProductPerformance()`, `/api/stores/[id]/analytics/products` | Catalog performance aggregation tests | ✅ Verified |
| **FR-9.4** | Customer Conversion Funnel | `computeFunnel()`, 5-stage conversion & dropoff calculation in `/api/stores/[id]/analytics/behavior` | Funnel stage tests | ✅ Verified |
| **FR-9.5** | Cart Abandonment Tracking | `computeCartAbandonment()`, defensive availability flag for zero-events state | Cart session & abandonment tests | ✅ Verified |
| **FR-9.6** | Traffic Sources & Attribution | `computeTrafficSources()`, referrer & UTM classification | Traffic parsing tests | ✅ Verified |
| **FR-9.7** | Executive PDF / Print Reports | `generateAnalyticsReportHtml()`, `/api/stores/[id]/analytics/reports`, `@media print` CSS | XSS escaping & print format tests | ✅ Verified |
| **FR-9.8** | First-Party Telemetry & Privacy Pipeline | `store_analytics_events` schema, `validateEventPayload()`, pseudonymous session hashing | SQL migration, RLS, and sanitizer tests | ✅ Verified |
| **Security** | Multi-Tenant Authorization Guards | `can_manage_store()` RLS policy, `getUser()` & `store.owner_id === user.id` on all analytics routes | 403 Forbidden & RLS check | ✅ Verified |
| **UI** | Analytics & Reports Merchant Panel | `AnalyticsPanel.tsx` in `/projects/[id]/store` with date range selector, trend chart, funnel, report modal | Component render & interaction tests | ✅ Verified |

