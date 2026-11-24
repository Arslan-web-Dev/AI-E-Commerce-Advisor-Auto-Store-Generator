# Module 2: Business Idea Input and Project Creation — Specification & Architecture

## 1. Overview & Objectives

Module 2 implements the **Business Idea Input and Project Creation** wizard for the **AI E-Commerce Advisor & Auto Store Generator**. It enables authenticated entrepreneurs to configure, validate, persist, and submit their commercial e-commerce business concepts for downstream feasibility analysis.

### Primary Goals:
1. **Guided Multi-Step Wizard**: Modern, accessible, responsive interface matching Stitch design tokens (`onboarding_wizard_feasibility_advisor`).
2. **Comprehensive Requirement Input (SRS FR-2.1)**: Predefined commercial categories, target location with postal/city support and seeded commercial hubs, validated budget with USD/PKR options.
3. **Advanced Input Options (SRS FR-2.2)**: Target audience demographics (age group, gender, income level), business scale (Small, Medium, Large), operating model (D2C vs Hybrid), storefront footprint, and product description/catalog specification.
4. **Resilient Draft & Submission Lifecycle**: Auto-saving drafts, resume capabilities, server-side validation, idempotent submission transitioning project status to `submitted` and creating a pending `feasibility_reports` record.
5. **Ownership & Access Security**: Server-enforced session authentication and PostgreSQL Row-Level Security (RLS) guaranteeing strict tenant data isolation.
6. **Project Management Portal**: Dedicated projects dashboard (`/projects`) and project confirmation/detail view (`/projects/[id]`).

---

## 2. SRS Requirements Traceability

| Requirement ID | Description | Module 2 Implementation | State |
| :--- | :--- | :--- | :--- |
| **FR-2.1** | Store Requirement Input: Category, Target Location, Available Budget | Guided three-step wizard (Step 1 Profile & Location, Step 2 Finance & Operations, Step 3 Review & Submission) with the five approved categories, Punjab district/city selection, seeded commercial hub chips, and budget input with USD/PKR allocation | ✅ Fully In Scope |
| **FR-2.2** | Advanced Input Options: Target Audience, Business Scale, Product Details | Wizard Step 2 with age/gender/income selectors, Small/Med/Large scale picker, product description, and optional file upload | ✅ Fully In Scope |
| **FR-2.3** | Commercial Hub picker & location resolution | Punjab-only commercial hub presets resolving district/city/lat/lng. Province is fixed to Punjab and country to Pakistan; no out-of-province or invented localities | ✅ Fully In Scope |
| **FR-2.4** | Budget range validation & canonical currency | Server-side range validation (PKR Rs. 10,000–50,000,000; USD $50–$200,000) storing canonical integer `budget_pkr` with disclosed SBP benchmark provenance | ✅ Fully In Scope |
| **FR-2.5** | Optional inputs: business model, audience, footprint | D2C Online vs Hybrid vs Physical, footprint pills (Kiosk, Boutique, Outlet, Flagship) | ✅ Fully In Scope |
| **FR-2.6** | Submission creates `feasibility_reports` row with status `pending` | Idempotent submit endpoint `/api/projects/[id]/submit` submits exclusively via the secure `submit_project_for_feasibility` RPC | ✅ Fully In Scope |
| **FR-2.7** | Search radius selection (10–15 km) | Buffer radius slider (5–15 km range, 10 km recommended default) | ✅ Fully In Scope |

---

## 3. Data Model & Database Architecture

### `public.projects` Table

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
  district             text,
  region               text,
  country              text,
  postal_code          text,
  lat                  double precision,
  lng                  double precision,
  radius_km            numeric(4,1) not null default 10.0,
  budget_amount        numeric(12,2) not null check (budget_amount > 0),
  budget_currency      text not null default 'USD' check (budget_currency in ('USD', 'PKR')),
  budget_pkr           bigint,
  -- Advanced Options (FR-2.2)
  target_audience      jsonb not null default '{}'::jsonb, -- { age_group, gender, income_level }
  business_scale       public.business_scale not null default 'small',
  business_model       text not null default 'hybrid' check (business_model in ('d2c', 'hybrid', 'physical')),
  storefront_footprint text default 'boutique',
  product_description  text,
  product_types        text[] not null default '{}',
  product_file_url     text,
  product_file_name    text,
  product_file_size    integer,
  -- Wizard state & metadata
  current_step         integer not null default 1 check (current_step between 1 and 5),
  form_version         integer not null default 1,
  metadata             jsonb not null default '{}'::jsonb,
  -- Lifecycle & Audit
  status               public.project_status not null default 'draft',
  report_id            uuid references public.feasibility_reports(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  submitted_at         timestamptz
);
```

### Row Level Security (RLS) Policies

1. **`projects_owner_select`**: Users can view only their own projects (`owner_id = auth.uid()`), or admins can view all (`is_admin()`).
2. **`projects_owner_insert`**: Authenticated users can insert projects where `owner_id = auth.uid()`.
3. **`projects_owner_update`**: Authenticated users can update their own projects only while `status = 'draft'` (submitted projects are immutable).
4. **`projects_owner_delete`**: Authenticated users can delete their own drafts.

---

## 4. REST API Endpoints

- `GET /api/projects`: List projects owned by the authenticated user.
- `POST /api/projects`: Create a new project draft.
- `GET /api/projects/[id]`: Retrieve a single project by ID (validating ownership).
- `PATCH /api/projects/[id]`: Update an existing draft (rejects edits if already submitted).
- `POST /api/projects/[id]/submit`: Submit a project for feasibility analysis.
- `POST /api/projects/upload`: Upload an optional product specification document.

---

## 5. User Interface Architecture

- **/wizard**: Interactive guided three-step wizard (`BusinessIdeaWizard.tsx`) with continuous draft autosave (1500 ms debounce) and resume:
  - **Step 1 — Business Profile & Location**: five approved categories, business name & product description, and Punjab location (fixed province, district select, city select, commercial hub chips, locality input, coordinates, 5–15 km radius slider).
  - **Step 2 — Financial & Operational Information**: PKR/USD budget input with canonical PKR conversion and disclosure, then business scale, operating model, storefront footprint, target audience profiling, and private specification-document attachment.
  - **Step 3 — Review & Submission**: read-only review cards (Business Profile, Location & Catchment Radius, Capital Allocation & Currency, Operational Setup) with per-card edit links, followed by atomic submission.
- **/projects**: User project portfolio dashboard showing drafts and submitted projects with status tags.
- **/projects/[id]**: Project detail & submission confirmation view with clear status indicators.

### Approved business categories

The five approved categories are consistent across the frontend, the API, the database taxonomy and every data-collection provider (competitors, demand trends):

1. Grocery / General Stores
2. Clothing / Footwear
3. Mobile Phones / Accessories
4. Restaurants / Cafes
5. Pharmacies / Medical Stores

### Punjab geography

Province is fixed to `Punjab` and country to `Pakistan`. The wizard offers a district select (`PUNJAB_DISTRICTS` in `src/types/project.ts`) whose city select is populated only once a district is chosen, and validation rejects any city that does not belong to the selected district. Commercial hub presets (`COMMERCIAL_HUB_PRESETS`) are Punjab-only and supply verified district/city/lat/lng values.

### Drafts, validation and submission

- Drafts are created with `POST /api/projects` and updated with `PATCH /api/projects/[id]`. Both routes run `validateProjectFields` server-side so no invalid value is ever persisted, even for partial drafts.
- Ownership is enforced server-side: `owner_id` is always derived from the authenticated session on create and can never be set from the request body.
- Submission uses only `POST /api/projects/[id]/submit`, which validates completeness and delegates to the `SECURITY DEFINER` RPC `submit_project_for_feasibility(p_project_id uuid)` (added by `supabase/migrations/20261124000000_secure_submit_project_rpc.sql`).
- The `district` column is added forward-only by `supabase/migrations/20261124020000_module2_wizard_district.sql`.

---

## 6. Known Limitations & Documented Decisions

- **ML dataset taxonomy is not yet aligned (documented, not silently resolved).** The five Task 3 categories are applied consistently to the frontend, API, database taxonomy and every data-collection provider. However, the Python training dataset (`ml-service/datasets/sample_dataset_generator.py`) still uses a separate six-category taxonomy (`Fashion & Apparel`, `Electronics & Mobile`, `Grocery & Gourmet`, `Health & Beauty`, `Home & Living`, `Specialty Crafts`). The real project→ML feature path derives numeric engineered features and does not feed the raw project category as a categorical model input, and the encoder uses `handle_unknown='ignore'`, so unseen categories degrade to a neutral (all-zero) encoding rather than erroring. Re-aligning the ML dataset taxonomy is out of scope for this task.
- **Punjab-only hubs.** The former non-Punjab commercial hub presets (Islamabad, Karachi) were removed because the current scope is fixed to Punjab. The wizard offers seven districts (Lahore, Rawalpindi, Faisalabad, Multan, Gujranwala, Sialkot, Bahawalpur) and eleven Punjab commercial hubs.
- **`current_step` range.** The database constraint still permits `current_step` 1–5 for backward compatibility, while the Task 3 wizard only uses steps 1–3.
- **Legacy `custom_category` column.** The column remains in the schema for backward compatibility but the custom-category input was removed from the wizard; only the five approved categories can be selected.
