# Work Breakdown Structure (WBS)
## AI E-Commerce Advisor & Auto Store Generator

**Document type:** Project delivery baseline  
**Version:** 1.0  
**Prepared:** 13 October 2026  
**Basis:** `SRS_AI_ECommerce_Advisor.docx`, current AntiGravity prompt roadmap (Modules 0–11), and identified SRS coverage gaps  
**Status note:** This is a planning and scope artifact. A listed work package is not evidence that the feature has been implemented or verified. AntiGravity must audit the repository before each package and record actual status.

---

## 1. Project objective

Deliver a secure, responsive SaaS platform that helps entrepreneurs evaluate an e-commerce business idea, review evidence-based feasibility and recommendations, obtain manager approval, configure and generate a storefront, operate the generated store, analyze its performance, and deploy it through configured cloud providers.

The platform must distinguish verified data and measured model outputs from provisional analysis, estimates, demonstrations, and unavailable integrations. The system must enforce ownership, roles, approval gates, privacy, and provider-secret handling server-side.

## 2. Scope baseline

### 2.1 Included

- Requirements discovery, architecture, design integration, and traceability to the SRS.
- Authentication, profiles, roles, project creation, data acquisition and processing.
- Competition and cost analysis, feasibility scoring/model readiness, recommendations, user dashboards.
- Manager approvals and admin governance.
- Approved business-prompt generation and store-theme/component configuration.
- Storefront and, where explicitly in scope, generated store APIs/data schema/content.
- Store product, inventory, order, customer, payment-method operations.
- Store analytics and reporting.
- Cloud deployment and optional custom domains when credentials/providers are configured.
- Security, accessibility, testing, documentation, release readiness, and handover.

### 2.2 Exclusions unless the approved SRS or supervisor changes scope

- Claims that a store is live, a provider is connected, or a payment succeeded without provider evidence.
- A supervised ML model trained on synthetic/unverified labels or unsupported performance claims.
- Storing raw card details, exposing provider secrets, or deploying arbitrary AI-generated scripts.
- Scraping data without approved source, license, and usage terms.
- Production deployment or real payment transactions as test activity.

## 3. WBS use and status tracking

For every work package, maintain these fields in the project tracker:

`WBS ID | Work package | Owner | Status | Planned start | Planned finish | Dependencies | Deliverable | Acceptance evidence | Risks/blockers`

Recommended status values: **Not started**, **In progress**, **Implemented—unverified**, **Verified**, **Blocked**, **Deferred**, **Out of scope**.

A package is **Verified** only when its acceptance evidence is recorded. A prompt written for AntiGravity is not an implementation deliverable and does not change implementation status.

## 4. Hierarchical WBS

### 1.0 Project governance and delivery control

#### 1.1 Project initiation and scope
- 1.1.1 Confirm project objectives, users, supervisor expectations, and constraints.
- 1.1.2 Establish scope baseline from the complete SRS and resolve ambiguous requirements.
- 1.1.3 Identify stakeholders: entrepreneur/user, manager/analyst, administrator, supervisor, developer, and provider owners.
- 1.1.4 Define decision, escalation, and scope-change process.
- **Deliverables:** approved scope statement, stakeholder list, assumptions/constraints log.
- **Acceptance:** every SRS functional requirement is assigned to a WBS package or explicitly marked deferred/out of scope.

#### 1.2 Project planning and tracking
- 1.2.1 Create backlog and dependency graph using this WBS.
- 1.2.2 Estimate effort after repository audit; do not invent dates or capacity.
- 1.2.3 Track risks, issues, decisions, and external dependencies.
- 1.2.4 Review progress and acceptance evidence at each milestone.
- **Deliverables:** maintained project tracker, risk/decision logs, milestone reports.

#### 1.3 Requirements traceability and change control
- 1.3.1 Maintain SRS-to-WBS-to-code-to-test traceability.
- 1.3.2 Record approved changes to requirements, architecture, or module boundaries.
- **Acceptance:** no requirement is called complete without linked implementation and verification evidence.

### 2.0 Discovery, architecture, and design baseline — Prompt Module 0

#### 2.1 Repository and existing-system audit
- 2.1.1 Inspect repository, current branch, working tree, stack, build, tests, and deployment setup.
- 2.1.2 Audit existing modules and avoid duplicating or overwriting completed work.
- 2.1.3 Identify missing inputs, credentials, integration accounts, and infrastructure.

#### 2.2 SRS analysis
- 2.2.1 Extract functional and nonfunctional requirements, roles, workflows, data, constraints, and acceptance criteria.
- 2.2.2 Verify SRS section/FR numbering and map requirements to implementation packages.
- 2.2.3 Identify inconsistencies and decisions requiring supervisor confirmation.

#### 2.3 UI/design analysis
- 2.3.1 Inspect Figma, supplied UI ZIP, assets, templates, and design system when accessible.
- 2.3.2 Document screens, components, interaction states, breakpoints, and assets.
- 2.3.3 Record unavailable references honestly.

#### 2.4 Architecture and integration baseline
- 2.4.1 Document frontend, backend, database, auth, storage, AI, data providers, jobs, deployment, and observability.
- 2.4.2 Define module boundaries, data ownership, error handling, API conventions, and security boundaries.
- 2.4.3 Establish integration inventory with real/stub/mock/unconfigured status.
- **Deliverables:** architecture overview, requirements traceability, UI inventory, dependency/risk register.
- **Acceptance:** architecture reflects the actual repository and all critical external dependencies are identified.

### 3.0 Application foundation and identity — Prompt Module 1

#### 3.1 App shell and design system
- 3.1.1 Establish route/layout conventions and shared tokens/components consistent with supplied UI.
- 3.1.2 Implement responsive navigation and shared states.

#### 3.2 Authentication and session management
- 3.2.1 Registration, login, logout, session refresh/expiry, and password recovery using the approved auth provider.
- 3.2.2 Profile/preferences and account lifecycle.
- 3.2.3 Secure server-side identity and role resolution.

#### 3.3 Authorization foundation
- 3.3.1 Define User, Manager/Analyst, and Admin permissions from the SRS.
- 3.3.2 Add route/API authorization patterns and database RLS policies.
- 3.3.3 Test anonymous, wrong-role, and cross-user access failures.
- **Deliverables:** working identity foundation, role matrix, reusable authorization layer.
- **Acceptance:** server-side authorization protects routes/data; UI hiding is not the only control.

### 4.0 Business idea and project intake — Prompt Module 2

#### 4.1 Project creation
- 4.1.1 Category, location, budget, audience, product description, and other SRS fields.
- 4.1.2 Form validation, autosave/draft behavior if required, and project ownership.

#### 4.2 Project lifecycle
- 4.2.1 Create and persist project state and versioned inputs.
- 4.2.2 Project list/detail/history with ownership checks.
- **Deliverables:** project intake flow, project schema/API, validation and tests.
- **Acceptance:** valid projects persist under the authenticated owner; invalid and cross-user operations fail safely.

### 5.0 Data acquisition — Prompt Module 3

#### 5.1 Provider and source adapters
- 5.1.1 Inspect SRS-required sources (e.g. maps, market, population, trends, cost data).
- 5.1.2 Implement only authorized/configured providers through server-side adapters.
- 5.1.3 Provide honest unavailable/mock states and source attribution.

#### 5.2 Collection workflow
- 5.2.1 Collect competitor, population, demand/trend, and cost inputs as available.
- 5.2.2 Persist raw responses with provenance, timestamps, and project association.
- 5.2.3 Handle rate limits, provider failures, retries, timeouts, and idempotency.

#### 5.3 Data source governance
- 5.3.1 Verify data source terms, licensing, geographic coverage, freshness, and permitted use.
- **Deliverables:** collection APIs/jobs, source/provenance records, provider setup documentation.
- **Acceptance:** no provider is reported as connected unless a real successful integration check supports that status.

### 6.0 Data processing and feature engineering — Prompt Module 4

#### 6.1 Data validation and cleaning
- 6.1.1 Normalize formats, units, locations, categories, and timestamps.
- 6.1.2 Deduplicate and address missing/outlier values using documented rules.

#### 6.2 Feature computation
- 6.2.1 Compute SRS features such as competitor count, saturation, and budget ratio where inputs support them.
- 6.2.2 Validate ranges, feature version, provenance, and reproducibility.

#### 6.3 Processing pipeline
- 6.3.1 Persist versioned processing runs linked to source runs and project.
- 6.3.2 Handle failures/reprocessing without corrupting history.
- **Deliverables:** processing pipeline, feature schema, quality report, tests.
- **Acceptance:** features are deterministic for a given input/version and their sources/limitations are documented.

### 7.0 Market competition analysis — SRS section 4.6 (standalone prompt gap)

#### 7.1 Competitor presentation
- 7.1.1 Display verified competitor names, ratings, distances, and available details.
- 7.1.2 Add filtering, sorting, map/list presentation only where data/provider supports it.

#### 7.2 Saturation analysis
- 7.2.1 Define market saturation formula, geographic scope, category mapping, and missing-data behavior.
- 7.2.2 Link output to Module 4 feature values and show provenance/limitations.

#### 7.3 UI/API integration
- 7.3.1 Integrate in user project/report views; apply owner authorization and pagination.
- **Deliverables:** competition analysis UI/API, documented formulas, verification evidence.
- **Acceptance:** no invented competitors or distances; calculation can be reproduced from linked source data.

### 8.0 Feasibility scoring and ML readiness — Prompt Module 5

#### 8.1 Model readiness and evidence audit
- 8.1.1 Determine whether valid labeled outcomes, features, rights, and adequate sample size exist.
- 8.1.2 Document readiness, data gaps, and training prerequisites.

#### 8.2 Transparent scoring path
- 8.2.1 Implement the approved scoring mode (provisional MCDA or supervised model) with explicit labeling.
- 8.2.2 Classify scores using complete, gap-free thresholds and explain contributing factors.
- 8.2.3 Persist immutable runs with feature/model/scoring version references.

#### 8.3 Model registry and evaluation readiness
- 8.3.1 Store model metadata and metrics only when measured.
- 8.3.2 Defer training until verified data and approved compute are available.
- **Deliverables:** scoring engine/API/UI, model readiness report, migration and tests.
- **Acceptance:** provisional scores are never presented as trained probability; unsupported model metrics are never fabricated.

### 9.0 Budget and cost analysis — SRS section 4.7 (standalone prompt gap/Module 6 overlap)

#### 9.1 Cost model and assumptions
- 9.1.1 Define startup, inventory, marketing, operations, and logistics estimates from valid sources/approved assumptions.
- 9.1.2 Track currency, geography, category, timestamp, source, confidence/limitations.

#### 9.2 Budget comparison
- 9.2.1 Compare user-entered budget to estimated costs and identify shortfall/surplus.
- 9.2.2 Present transparent calculation and sensitivity where justified.

#### 9.3 Advisory integration
- 9.3.1 Feed validated cost/budget values into Module 6 recommendations without treating advice as verified actual pricing.
- **Deliverables:** cost service, budget comparison UI, formulas and source documentation.
- **Acceptance:** calculations are reproducible and estimates are labeled; currency conversions use a verified source or are not performed.

### 10.0 Strategic recommendations and risk mitigation — Prompt Module 6

#### 10.1 Recommendation generation
- 10.1.1 Consume persisted Module 5 score and Module 4 features.
- 10.1.2 Generate strengths, risks, mitigation, budget allocation, and location guidance only from evidence and documented rules.

#### 10.2 Explainability and persistence
- 10.2.1 Store advisory version, source run IDs, rules/provider, and output rationale.
- 10.2.2 Present uncertainty and disclaimers; do not imply advice guarantees success.
- **Deliverables:** recommendation engine, report UI, APIs, documentation/tests.
- **Acceptance:** every recommendation is traceable to a source or explicit rule; unsupported facts are excluded.

### 11.0 User dashboard and reports — SRS FR-9.1 (standalone prompt gap)

#### 11.1 User overview
- 11.1.1 Feasibility visualization and classification using truthful scoring mode.
- 11.1.2 Project history, status, recommendation cards, and next actions.

#### 11.2 Report experience
- 11.2.1 Consolidate competition, budget, feasibility, and recommendations with source/time/version context.
- 11.2.2 Handle no-data, pending approval, stale run, and failure states.
- **Deliverables:** owner dashboard/report routes and data contracts.
- **Acceptance:** user sees only owned projects; visualization labels accurately reflect score semantics.

### 12.0 Manager review and admin governance — Prompt Module 11

#### 12.1 Manager review and approval
- 12.1.1 Review queue, project details, approval/rejection, comments, and history.
- 12.1.2 Persist auditable decisions and enforce self-approval prohibition.
- 12.1.3 Provide approval state to generation/deployment gates.

#### 12.2 Admin dashboard and role administration
- 12.2.1 Show real user/project/system counts.
- 12.2.2 Assign/change/revoke roles with least privilege and immutable audit records.

#### 12.3 Dataset governance
- 12.3.1 Upload, quarantine, validate, version, activate/archive datasets with provenance and safe file handling.
- 12.3.2 Protect datasets referenced by processing/model runs.

#### 12.4 Model governance
- 12.4.1 Monitor actual model status/evaluation; distinguish MCDA from supervised models.
- 12.4.2 Retraining remains gated by verified labels, reproducible pipeline, and configured compute.
- **Deliverables:** manager/admin UI, secure APIs, role matrix, audit trail, dataset/model status docs.
- **Acceptance:** direct API bypass and unauthorized role actions fail; no fabricated model/dataset metrics.

### 13.0 AI business-prompt generator — SRS section 4.10 (standalone prompt gap)

#### 13.1 Prompt composition
- 13.1.1 Generate a structured store-generation brief from approved category, location, audience, budget, style, and features.
- 13.1.2 Include verified inputs and identify missing/assumed details.

#### 13.2 User editing and regeneration
- 13.2.1 Allow authorized editing, save versions, regenerate, and compare revisions.
- 13.2.2 Sanitize content and treat user/product text as untrusted prompt input.

#### 13.3 Approval and provider handling
- 13.3.1 Enforce required feasibility/manager approval before final prompt use.
- 13.3.2 Use configured AI provider securely; provide deterministic fallback only if labeled.
- **Deliverables:** prompt builder/editor, versioned API/data, provider status, tests.
- **Acceptance:** prompt is traceable to inputs and cannot bypass approval; secrets remain server-side.

### 14.0 Storefront theme configurator and compiler — Prompt Module 7

#### 14.1 Requirements analysis and component inventory
- 14.1.1 Inspect SRS, Figma, UI ZIP, category, and prompt to identify all storefront pages/components.
- 14.1.2 Catalog selectable components from full pages down to primitives.

#### 14.2 Theme/variant selection
- 14.2.1 Build accessible questionnaire, curated defaults, catalog, and responsive live preview.
- 14.2.2 Implement and verify at least 20 distinct variants per selectable component as required by user.

#### 14.3 Safe storefront manifest/compiler
- 14.3.1 Persist allowlisted variant IDs and typed configuration, not executable AI-generated source.
- 14.3.2 Version compiled drafts and enforce approval/generation gates.
- **Deliverables:** component catalog/variant coverage report, configurator, preview, safe compiled storefront draft.
- **Acceptance:** every selectable component has 20+ implemented/rendered variants or module is explicitly partial; generation is server-authorized.

### 15.0 Complete generated-store backend/schema/content (FR-11.3–FR-11.5; gap to resolve)

#### 15.1 Generated-store architecture boundary
- 15.1.1 Decide whether generated stores share a multi-tenant runtime or receive isolated generated code/deployment, consistent with SRS and architecture.
- 15.1.2 Define ownership, tenant isolation, manifest/API/schema versioning, and upgrades.

#### 15.2 Store APIs and data schema
- 15.2.1 Implement documented REST APIs for products, orders, authentication, cart, and checkout only within approved scope.
- 15.2.2 Define and migrate product/order/customer/payment/inventory schema with constraints and access control.
- 15.2.3 Implement safe cart/order state, server-calculated totals, and no raw payment credential storage.

#### 15.3 AI content generation
- 15.3.1 Generate SEO/product/category content only from verified inputs and configured provider.
- 15.3.2 Make generated content reviewable/editable and disclose placeholders.

#### 15.4 Integration/contract testing
- 15.4.1 Verify storefront UI, APIs, database, auth, and payment provider contracts together.
- **Deliverables:** generated-store runtime/scaffold, schema/API docs, integration tests, security review.
- **Acceptance:** end-to-end data contracts work in test environment; no fake checkout or insecure generated code.

### 16.0 Store operations — Prompt Module 8

#### 16.1 Product catalog and inventory
- 16.1.1 Product CRUD, validation, variants, media references, prices, and status.
- 16.1.2 Inventory adjustment, audit, concurrency safety, and low-stock alerts.

#### 16.2 Orders, customers, and invoices
- 16.2.1 Store-scoped order list/detail and valid status transitions.
- 16.2.2 Customer profiles/history with privacy controls.
- 16.2.3 Invoices from persisted order snapshots.

#### 16.3 Payment methods
- 16.3.1 Cash on Delivery status workflow and configured gateway only.
- 16.3.2 Verify webhook signatures/idempotency; no fake charges/refunds.
- **Deliverables:** owner operations UI/APIs/schema, integration status, verification.
- **Acceptance:** all actions are tenant-scoped; real provider behavior is verified or marked unconfigured.

### 17.0 Generated-store analytics and reports — Prompt Module 9

#### 17.1 Metric definitions and event coverage
- 17.1.1 Define revenue, orders, AOV, views, visitors, traffic sources, and abandonment formulas.
- 17.1.2 Add privacy-conscious event collection only where required and approved.

#### 17.2 Analytics aggregation/dashboard
- 17.2.1 Store-scoped date filters, trends, product behavior, data freshness, and honest empty states.
- 17.2.2 Avoid invented conversion/attribution metrics or mixed-currency totals.

#### 17.3 Reports
- 17.3.1 Secure PDF export with selected period, timezone/currency, definitions, and limitations.
- **Deliverables:** analytics UI/APIs, event/aggregation system if justified, PDF reports, metric docs.
- **Acceptance:** metrics reconcile with source data; customer/store isolation and privacy rules pass.

### 18.0 Cloud deployment and custom domains — Prompt Module 10

#### 18.1 Readiness and artifact pipeline
- 18.1.1 Validate approval, compiled artifact, schema version, provider config, and target environment.
- 18.1.2 Build trusted artifacts without secrets or untrusted executable content.

#### 18.2 Deployment orchestration
- 18.2.1 Submit jobs asynchronously; track states, retries, cancellation, and provider callbacks.
- 18.2.2 Preserve audit history and last-known-good deployment.
- 18.2.3 Publish provider-confirmed URL only after verified ready state.

#### 18.3 Custom domains and initial admin access
- 18.3.1 Verify domain ownership and provider DNS/TLS status.
- 18.3.2 Use one-time invite/setup credential flow; never expose reusable plaintext defaults.
- **Deliverables:** deployment UI/service/worker, provider adapter, domain flow, operational docs.
- **Acceptance:** sandbox/provider tests pass; production status is never fabricated; secrets are protected.

### 19.0 Cross-cutting quality, security, and compliance

#### 19.1 Security engineering
- 19.1.1 Threat model authentication, tenant access, uploads, AI inputs, payments, webhooks, generated code, and deployment secrets.
- 19.1.2 Validate RLS, authorization, encryption/secret boundaries, rate limits, logs, and dependency health.

#### 19.2 Privacy and data governance
- 19.2.1 Document collected personal/event data, purpose, retention, access, deletion, and consent behavior per SRS/policy.
- 19.2.2 Verify dataset license/provenance and prevent unauthorized reuse.

#### 19.3 Accessibility and responsive quality
- 19.3.1 Keyboard/screen-reader/contrast/reduced-motion review for all major flows.
- 19.3.2 Validate representative phone/tablet/desktop layouts.

#### 19.4 Performance and reliability
- 19.4.1 Measure SRS targets using repeatable environment and representative load.
- 19.4.2 Add bounded queries, pagination, caching, retries, and monitoring where justified.
- **Deliverables:** threat model, privacy/data notes, accessibility/performance findings, remediation backlog.

### 20.0 Verification, release, and handover

#### 20.1 Verification planning
- 20.1.1 Build requirement-based test matrix: unit, API, integration, authorization, UI, migration, accessibility, performance, and provider sandbox.

#### 20.2 End-to-end verification
- 20.2.1 Test user journey from registration/project intake through data, scoring, recommendations, approval, store configuration, operations, analytics, and deployment where prerequisites exist.
- 20.2.2 Verify blocked prerequisites produce truthful, safe states.

#### 20.3 Release readiness
- 20.3.1 Review migrations, environment variables, secrets, backups, rollback, logging, and support process.
- 20.3.2 Confirm no credentials or production data in repository/test artifacts.

#### 20.4 Handover
- 20.4.1 Deliver setup/runbook, API docs, architecture, known limitations, and external account checklist.
- 20.4.2 Present outstanding data/GPU/provider/domain approvals and next actions.
- **Acceptance:** release decision is based on test evidence and known risks; unverified items are explicitly listed.

## 5. Recommended execution sequence and dependencies

1. WBS 1–3: governance, discovery, foundation/auth.
2. WBS 4–6: project intake, source collection, processing.
3. WBS 7–11: competition, scoring, budget, recommendations, user dashboard.
4. WBS 12: manager/admin approval and governance should be in place before enabling generation/deployment gates.
5. WBS 13: business-prompt generator; depends on approved project inputs and provider setup if AI is used.
6. WBS 14–15: storefront configuration plus full generated-store backend/schema/content; depends on prompt/approval and architecture decision.
7. WBS 16: store operations; depends on generated-store data model and provisioned store runtime.
8. WBS 17: analytics; depends on real order data and/or approved event collection.
9. WBS 18: deployment; depends on valid store artifact, approval, configured provider, and secrets.
10. WBS 19–20: continuous quality/security checks throughout; final end-to-end verification and handover after prerequisites are available.

## 6. Milestone and exit criteria

- **M0 — Baseline approved:** SRS/UI/repository audited, architecture and traceability established.
- **M1 — Secure foundation:** authentication, role model, ownership, project intake work.
- **M2 — Evidence pipeline:** collection and processing provenance are testable.
- **M3 — Decision support:** scoring, competition, budget, recommendations, and user reporting use truthful data/labels.
- **M4 — Governance gate:** manager approval/admin permissions are persisted and enforced server-side.
- **M5 — Store generation:** approved prompt, configurable storefront, validated manifest, and required backend/schema contracts are testable.
- **M6 — Store operations:** authorized owner can manage supported products, inventory, orders, and customers.
- **M7 — Analytics:** metrics reconcile with verified records and event coverage.
- **M8 — Deployment:** configured provider confirms ready deployment and URL; custom-domain setup is verified or honestly unavailable.
- **M9 — Release/handover:** security, accessibility, performance, regression, documentation, and known limitations reviewed.

## 7. Current prompt coverage versus identified prompt gaps

The saved prompt pack currently contains prompts labeled **Modules 0–11**. The following SRS areas need standalone prompt coverage or an explicit audit proving they are fully covered by another module:

- SRS section 4.6: Competition Analysis (WBS 7.0).
- SRS section 4.7: Budget Analysis (WBS 9.0; partly overlaps Module 6 recommendations).
- SRS FR-9.1: User Dashboard (WBS 11.0).
- SRS section 4.10: AI Prompt Generator (WBS 13.0).
- SRS FR-11.3–FR-11.5: generated backend APIs, database schema, and AI content (WBS 15.0; Module 7 primarily covers storefront configuration/compiler).

## 8. Definition of project completion

The project is complete only when every in-scope SRS requirement is traceable to implemented code and verified acceptance evidence; role and store ownership protections pass; external integrations are truthfully configured and verified or explicitly excluded/blocked; model claims reflect real training evidence; generated stores can be operated and deployed through a safe supported lifecycle; and documentation/handover are complete.
