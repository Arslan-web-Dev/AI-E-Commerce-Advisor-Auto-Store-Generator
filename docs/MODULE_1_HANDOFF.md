# Module 1: Public Landing Page, Authentication, and RBAC — Milestone Handoff

## 1. Executive Summary & Deliverables

Module 1 of the **AI-Powered E-Commerce Feasibility Advisor & Auto Store Generator** has been implemented following the software requirements specification (SRS v2.0, IEEE 830 / ISO/IEC/IEEE 29148) and the supplied Stitch UI design references.

### Delivered Components:
1. **Public Landing Page (`src/app/page.tsx`):**
   - Responsive dark-mode layout matching the Stitch landing page reference.
   - Interactive, performant 3D hero visualization (`src/components/Hero3DVisual.tsx`) built with Three.js/WebGL featuring a rotating geospatial grid, scanning radar rings, central retail anchor, competitor beacons, and floating market signal particle clouds.
   - Graceful static SVG/CSS fallback if WebGL is unavailable or if `prefers-reduced-motion` is requested.
   - Factual telemetry showcase grounded in platform methodology (10–15 KM Overpass POI buffer, XGBoost continuous 0.00–1.00 scoring, multi-LLM failover chain, PKR-native commercial rent ratios).
   - Core capabilities, 4-step workflow, methodology accordion, and responsive footer with OpenStreetMap attribution.
   - Clear calls to action routing to authentication.

2. **Supabase Authentication Engine:**
   - Email/password sign-up and sign-in (`src/app/login/page.tsx`).
   - Google OAuth integration with state and code exchange (`src/app/auth/callback/route.ts`).
   - Safe account linking support based on verified email claims.
   - Password reset request (`src/app/reset-password/page.tsx`) and cryptographic password update flow (`src/app/update-password/page.tsx`).
   - Anti-enumeration protection: Sign-up and password-reset responses never reveal whether an email address is already registered.
   - Session restoration and refresh via Next.js SSR middleware (`src/middleware.ts` & `src/lib/supabase/middleware.ts`).
   - Sign-out routes supporting local session sign-out and global session revocation everywhere (`/api/auth/signout`).
   - Privileged server-side user-initiated account deletion (`/api/auth/delete-account`) that activates PostgreSQL foreign-key cascades on stores and feasibility reports.

3. **Role-Based Access Control (RBAC):**
   - Two application roles: `owner` (default for all new users) and `admin` (restricted).
   - Trigger `handle_new_user()` strictly assigns `'owner'` in database, ignoring any client-supplied metadata.
   - Profile table RLS prevents users from modifying their `role` or `must_change_password` attributes.
   - Server-side route guards and API checks reject unauthorized requests.
   - Enforces `must_change_password` for the seeded administrator before granting access to protected application screens.

4. **Database Migration & Row Level Security:**
   - Full migration: `supabase/migrations/20261004000000_module1_auth_rbac_schema.sql`.
   - Tables: `profiles`, `stores`, `feasibility_reports`, `rent_cache`, `ai_call_log`, `system_config`, and `config_sync_audit_log`.
   - RLS forced on tenant tables with security definer `is_admin()` helper with pinned search path.

5. **Seed-Admin Setup (`scripts/seed-admin.mjs`):**
   - Server-side bootstrap script using Supabase Admin Service-Role API.
   - Reads credentials strictly from environment secrets (`INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`).
   - Idempotent and safe to rerun without creating duplicate accounts.
   - Enforces `role = 'admin'` and `must_change_password = true`.

6. **Admin GitHub Configuration REST Sync (SRS FR-1.6):**
   - Admin-only route handler (`src/app/api/admin/sync/route.ts`) verified by server-side RBAC.
   - Exports only approved non-PII system configuration: scoring thresholds, theme presets, seed commercial hubs, and rent-cache snapshots.
   - Strictly excludes all user profiles, emails, feasibility reports, passwords, and tokens.
   - Pushes versioned JSON export via GitHub REST API with commit message and records audit entry in `config_sync_audit_log`.
   - UI in System Admin Command Center (`src/app/admin/page.tsx`).

---

## 2. Required Environment Variables

Copy `.env.example` to `.env.local` and configure the following keys:

| Variable | Scope | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public / Client | Supabase project URL (`https://<project-id>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public / Client | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only | Supabase service-role secret (never exposed to browser) |
| `INITIAL_ADMIN_EMAIL` | Server-Only | Bootstrap administrator email address (e.g., `admin@your-domain.pk`) |
| `INITIAL_ADMIN_PASSWORD` | Server-Only | Temporary initial password for seeded admin (min 8 chars) |
| `GITHUB_SYNC_TOKEN` | Server-Only | GitHub Personal Access Token (classic or fine-grained with `Contents: write`) |
| `GITHUB_SYNC_REPO` | Server-Only | Target GitHub repository (format: `owner/repo-name`) |
| `GITHUB_SYNC_BRANCH` | Server-Only | Target branch (default: `main`) |
| `NEXT_PUBLIC_APP_URL` | Public / Client | Public application URL (`http://localhost:3000` or production domain) |

---

## 3. Database Migration Execution

Apply the migration SQL file to your Supabase project using the Supabase SQL Editor or Supabase CLI:

```bash
# File location:
supabase/migrations/20261004000000_module1_auth_rbac_schema.sql
```

This creates the required types, tables, indexes, triggers, and Row Level Security policies.

---

## 4. Supabase Dashboard Configuration

### A. Authentication & Redirect URLs
In Supabase Dashboard &rarr; **Authentication** &rarr; **URL Configuration**:
- **Site URL**: `http://localhost:3000` (or your production domain)
- **Redirect URLs**:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/update-password`
  - `https://*.yourproject.pk/auth/callback`

### B. Google OAuth Configuration
In Supabase Dashboard &rarr; **Authentication** &rarr; **Providers** &rarr; **Google**:
1. Enable Google provider.
2. In Google Cloud Console &rarr; **APIs & Services** &rarr; **Credentials**:
   - Create an OAuth 2.0 Client ID (Web Application).
   - Set **Authorized redirect URIs** to your Supabase Auth callback: `https://<your-supabase-project-id>.supabase.co/auth/v1/callback`.
3. Copy Client ID and Client Secret into the Supabase Google Provider settings.

---

## 5. Seed Admin Execution

Run the admin bootstrap script from your terminal:

```bash
npm run seed:admin
```

Upon successful run:
1. The administrator account is created/updated in `auth.users` with confirmed email.
2. The `public.profiles` record is updated with `role = 'admin'` and `must_change_password = true`.
3. When the administrator signs in, middleware intercepts and forces them to `/update-password?forced=true`.
4. Once the password is changed, `must_change_password` becomes `false` and the administrator is granted access to `/admin`.
