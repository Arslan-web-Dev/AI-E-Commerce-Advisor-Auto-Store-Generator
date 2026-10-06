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
| **FR-2.1** | Store Requirement Input: Category, Target Location, Available Budget | Guided Wizard Steps 1, 2, 3 with category taxonomy, location search & commercial hub chips, budget input with USD/PKR allocation | ✅ Fully In Scope |
| **FR-2.2** | Advanced Input Options: Target Audience, Business Scale, Product Details | Guided Wizard Step 4 with age/gender/income selectors, Small/Med/Large scale picker, product description, and optional file upload | ✅ Fully In Scope |
| **FR-2.3** | Commercial Hub picker & location resolution | Pakistan commercial hub presets (Lahore, Karachi, Islamabad) + worldwide city/postal input | ✅ Fully In Scope |
| **FR-2.4** | Budget range validation & canonical currency | Range validation (USD $500–$1,000,000 / PKR Rs. 50,000–50,000,000) with clear formatting | ✅ Fully In Scope |
| **FR-2.5** | Optional inputs: business model, audience, footprint | D2C Online vs Hybrid, footprint pills (Kiosk, Boutique, Outlet, Flagship) | ✅ Fully In Scope |
| **FR-2.6** | Submission creates `feasibility_reports` row with status `pending` | Idempotent submit endpoint `/api/projects/[id]/submit` creates linked `feasibility_reports` record | ✅ Fully In Scope |
| **FR-2.7** | Search radius selection (10–15 km) | Buffer radius slider (5–25 km range, 10–15 km recommended defaults) | ✅ Fully In Scope |

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

- **/wizard**: Interactive guided wizard implementing the 5-step workflow:
  - **Step 1**: Category & Commercial Vertical
  - **Step 2**: Target Location & Spatial Catchment
  - **Step 3**: Budget & Operational Capital Runway
  - **Step 4**: Target Audience, Scale & Product Details
  - **Step 5**: Review & Final Submission
- **/projects**: User project portfolio dashboard showing drafts and submitted projects with status tags.
- **/projects/[id]**: Project detail & submission confirmation view with clear status indicators.
