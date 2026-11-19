# AI E-Commerce Feasibility Advisor & Auto Store Generator

A Pakistan-first FYP platform for evaluating e-commerce ideas and preparing multi-tenant storefronts. The repository currently contains project intake and analysis workflows, store configuration drafts, merchant operations, and analytics foundations. The customer-facing storefront and verified publish/deployment lifecycle are still under development; a saved draft is not a live shop.

## Current delivery baseline

- [Final delivery baseline and module prompt pack](docs/FINAL_DELIVERY_BASELINE.md)
- [Software requirements specification](docs/SRS.md)
- [Work breakdown structure](docs/WBS.md)
- [Requirements traceability](docs/requirements-traceability.md)
- [API reference](docs/api.md)

The delivery baseline and traceability follow the user-supplied October 2026 advanced SRS/SDD v1.0. They distinguish implemented foundations from partial, unverified, deferred, and not implemented work. The checked-in SRS v2.0 and WBS contain historical scope that differs from the advanced requirements; use the delivery baseline for current implementation work.

## Requirements and evidence policy

Do not treat a UI screen, file, migration, or prompt as proof that a requirement is complete. Record acceptance evidence for each requirement. The demand curve is synthetic demo data; regional indicators are embedded estimates. Feasibility scores use provisional MCDA unless a valid supervised model and dataset are separately approved and registered. COD is the only payment method currently represented as active.

## Local setup

### Prerequisites

- Node.js compatible with the versions in `package-lock.json`.
- A Supabase project with Auth and PostgreSQL enabled.
- GitHub sync credentials only if the optional admin configuration-sync feature is used.

### Configure environment

Copy `.env.example` to `.env.local`, then set the Supabase URL, anon key, and service-role key. Keep service-role and GitHub tokens server-only; never commit `.env.local` or expose these values to browser code.

For a local run, set `FORCE_DEMO_DATA=true` only when you explicitly want the synthetic demonstration providers. Set it to `false` for the configured provider bundle. In either mode, check the provenance labels before using analysis results. The current trend and regional adapters remain synthetic/estimated even when forced demo mode is off.

### Apply the database schema

Apply the SQL migrations under `supabase/migrations/` in timestamp order to a fresh Supabase project. `supabase/combined_schema.sql` is the consolidated schema for review or one-shot setup; do not apply it on top of migrations already applied to the same database. Review changes and take a backup before applying new migrations to a database with data.

### Install and run

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The seed administrator script reads `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`; use a unique secret and change the initial password after setup.

Available package scripts are `dev`, `build`, `start`, `lint`, and `seed:admin`. There is no configured test runner in `package.json`; the `scripts/verify-*.mjs` files are repository-specific source/schema checks and must not be mistaken for full integration or security tests.

## Integrations and known limitations

- OSM Overpass is the implemented competitor-data integration; availability and returned coverage depend on the public service.
- Regional indicators are embedded estimates, not a live PBS feed.
- Demand curves are synthetic, not Google Trends observations.
- The current advisor uses deterministic rules; a live LLM fallback chain is not yet confirmed in the implementation.
- Feasibility output is provisional MCDA, not a calibrated probability of business success.
- Theme configuration produces a validated draft manifest; it does not publish a customer-facing store.
- COD is represented in merchant operations. No online payment gateway is configured.
- Domain verification, live storefront deployment, and custom-domain provisioning are not complete.

See the baseline for the implementation sequence, acceptance gates, and copy-ready prompts for each workstream.
