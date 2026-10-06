# Module 2: Business Idea Input and Project Creation — Milestone Handoff

## 1. Executive Summary & Deliverables

Module 2 of the **AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator** has been implemented following the software requirements specification (SRS v2.0, IEEE 830 / ISO/IEC/IEEE 29148) and the supplied Stitch UI design reference (`onboarding_wizard_feasibility_advisor`).

### Delivered Components:

1. **Guided Multi-Step Wizard (`src/components/wizard/BusinessIdeaWizard.tsx` & `/wizard`):**
   - **Step 1: Category & Commercial Vertical**: Predefined commercial vertical cards (Apparel & Fashion, Consumer Electronics, Cosmetics & Skincare, Grocery & Gourmet Food, Home Decor & Living, Other Niche Venture), custom category specifier, vision description input with character limit and prompt optimizer indicator, and keyword pills.
   - **Step 2: Location & Spatial Catchment**: Target operating hub and city input, fast-select commercial hub chips (Gulberg III, DHA Phase 5/6, Blue Area, F-7/F-10 Markaz, Clifton, Saddar, Anarkali), radar spatial catchment simulation with SVG radar grid, central store node, competitor beacons, and dynamic buffer radius slider (5–25 km).
   - **Step 3: Budget & Operational Capital Runway**: Capital runway input with live USD/PKR currency toggle, range validation, algorithmic 4-part capital allocation visual (Inventory 45%, Rent & Setup 25%, Marketing 18%, Buffer 12%), operating model selector (D2C Cloud Store vs Hybrid), and storefront footprint picker (Kiosk, Boutique, Commercial Outlet, Flagship).
   - **Step 4: Target Audience, Scale & Product Scope (SRS FR-2.2)**: Planned business scale (Small, Medium, Large), demographic selectors (age group, gender focus, household income bracket), product type tags, and optional document specification file upload (max 5MB • PDF, CSV, JSON, PNG, JPG).
   - **Step 5: Review & Final Submission**: Structured parameter review cards, live validation confirmation, and factual submission safeguard.
   - **Floating Docked Bottom Action Bar**: Sticky action bar with step progress indicator, back/continue controls, "Save Draft" button, and submission CTA with glowing hover aesthetics.

2. **Project Portfolio Dashboard (`src/app/projects/page.tsx` & `/projects`):**
   - Displays all business ideas created by the authenticated entrepreneur.
   - Tab filtering: All, Drafts, Submitted / Pending Analysis.
   - Project cards displaying category icon, location node, capital runway, business scale, and status badge.
   - Direct action to resume drafts in the wizard (`/wizard/[id]`) or view submitted project records (`/projects/[id]`).
   - Draft deletion with confirmation.
   - Responsive empty state with a direct CTA to launch the wizard.

3. **Project Detail & Submission Confirmation (`src/app/projects/[id]/page.tsx`):**
   - Verified server-side ownership enforcement.
   - Factual confirmation banner stating that the project has been recorded and is awaiting Module 3 Data Aggregation.
   - Full breakdown of submitted parameters (category, location, coordinates, radius, budget, audience, footprint, attached catalog).
   - Architectural boundary statement: No fake scores, competitor records, or recommendations are fabricated.

4. **Database Architecture & PostgreSQL Migration (`supabase/migrations/20261006000000_module2_projects_wizard_schema.sql`):**
   - Dedicated `public.projects` table with enums `public.project_status` and `public.business_scale`.
   - Links submitted projects to `public.feasibility_reports` via foreign key `report_id`.
   - Row-Level Security (RLS) enabled and forced on `public.projects`.
   - RLS policies ensure users can only select, insert, update, or delete their own drafts. Submitted projects are immutable.
   - Automatic `updated_at` trigger.

5. **REST API Handlers:**
   - `GET /api/projects`: List authenticated user's projects.
   - `POST /api/projects`: Initialize a project draft.
   - `GET /api/projects/[id]`: Retrieve single project by ID with strict ownership verification.
   - `PATCH /api/projects/[id]`: Update draft project (rejects modifications to submitted projects).
   - `DELETE /api/projects/[id]`: Delete draft project.
   - `POST /api/projects/[id]/submit`: Idempotent submission endpoint validating the complete project, updating status to `submitted`, and initializing a linked `feasibility_reports` record with status `pending`.
   - `POST /api/projects/upload`: Private product specification document upload handler.

6. **SSR Middleware Protection:**
   - Updated `src/lib/supabase/middleware.ts` to protect `/projects` and `/wizard` routes, redirecting unauthenticated visitors to `/login?redirectTo=...`.

---

## 2. SRS Requirements Traceability Matrix

| Requirement | Implementation Detail | Status |
| :--- | :--- | :--- |
| **FR-2.1: Store Requirement Input** | Predefined commercial categories, target location text, and validated budget in USD/PKR | ✅ Complete |
| **FR-2.2: Advanced Input Options** | Target audience (age, gender, income), business scale (Small, Medium, Large), product types & upload | ✅ Complete |
| **FR-2.3: Location & Commercial Hubs** | Seeded Pakistan commercial hubs (Lahore, Karachi, Islamabad) + worldwide city/postal input | ✅ Complete |
| **FR-2.4: Budget Validation & Currency** | Validation range check, clear formatting, and USD/PKR dual-currency conversion | ✅ Complete |
| **FR-2.5: Optional Inputs** | Business model (D2C / Hybrid), storefront footprint pills (Kiosk, Boutique, Outlet, Flagship) | ✅ Complete |
| **FR-2.6: Submission Lifecycle** | Idempotent submission transitions status to `submitted` and creates linked `feasibility_reports` row | ✅ Complete |
| **FR-2.7: Search Radius** | Dynamic radius slider (5–25 km with 10–15 km standard defaults) | ✅ Complete |

---

## 3. Database Schema Reference

```sql
create type public.project_status as enum ('draft', 'submitted', 'analyzing', 'completed', 'failed');
create type public.business_scale as enum ('small', 'medium', 'large');

create table public.projects (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references auth.users(id) on delete cascade,
  title                text,
  category             text not null,
  custom_category      text,
  target_location      text not null,
  city                 text,
  region               text,
  country              text default 'Pakistan',
  postal_code          text,
  lat                  double precision,
  lng                  double precision,
  radius_km            numeric(4,1) not null default 10.0,
  budget_amount        numeric(12,2) not null check (budget_amount > 0),
  budget_currency      text not null default 'USD' check (budget_currency in ('USD', 'PKR')),
  budget_pkr           bigint,
  target_audience      jsonb not null default '{}'::jsonb,
  business_scale       public.business_scale not null default 'small',
  business_model       text not null default 'hybrid',
  storefront_footprint text default 'boutique',
  product_description  text,
  product_types        text[] not null default '{}',
  product_file_url     text,
  product_file_name    text,
  product_file_size    integer,
  current_step         integer not null default 1 check (current_step between 1 and 5),
  form_version         integer not null default 1,
  metadata             jsonb not null default '{}'::jsonb,
  status               public.project_status not null default 'draft',
  report_id            uuid references public.feasibility_reports(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  submitted_at         timestamptz
);
```

---

## 4. Verification Performed & Results

- **Automated Verification Suite (`scripts/verify-module2.mjs`)**: 31 out of 31 automated assertions passed.
- **Production Build (`npm run build`)**: Next.js 16.3.8 (Turbopack) successfully compiled all 18 routes with 0 TypeScript errors.
- **Client & Server Validation**: Validated bounds for USD ($100 to $10,000,000) and PKR (Rs. 10,000 to Rs. 500,000,000).
- **Tenant Isolation**: Row-Level Security policies and server API checks prevent cross-tenant access.

---

## 5. Next Recommended Milestone

**Module 3: Smart Data Aggregation & Spatial POI Ingestion**
- Ingestion of OpenStreetMap Overpass POIs within the submitted project's `(lat, lng, radius_km)`.
- Integration of `rent_cache` area records and Google Trends interest series.
