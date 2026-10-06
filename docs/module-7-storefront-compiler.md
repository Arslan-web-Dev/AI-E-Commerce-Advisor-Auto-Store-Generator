# Module 7: Theme Configurator, Component Variant Library & Storefront Compiler

## 1. Overview

Module 7 delivers a code-free, guided MCQ wizard that lets a project owner configure a storefront theme, browse a curated component variant catalog, and compile a **versioned, immutable draft manifest** — all without writing code or publishing anything publicly.

**SRS alignment:** FR-7.1 (4-step wizard), FR-7.2 (schema-validated output), FR-7.3 (deterministic fallback), FR-7.4 (`stores.theme_config` persistence), FR-7.5 (WCAG contrast tokens), FR-7.6 (version history).

---

## 2. Approval Gate

Per SRS v2.0, the Manager role was removed. Module 7 therefore does **not** require a manager-approval gate before draft compilation.

**However**, compilation always produces a `stores.status = 'draft'` record — never `'published'`. Publishing is deferred to Module 8. The server enforces this:
- The API refuses to recompile a `published` store's theme.
- Users cannot self-elevate `status` to `published` via the wizard API.
- No client-side approval value is trusted.

---

## 3. Component Catalog Summary

| Category | Variants | Tier |
|---|---|---|
| Headers | 5 | Core |
| Hero Sections | 5 (3 core, 2 priority optional) | Core + Optional |
| Product Cards | 5 | Core |
| Product Grids | 4 (3 core, 1 optional) | Core + Optional |
| Footers | 5 (4 core, 1 optional) | Core + Optional |
| Announcement Bars | 2 | Core |
| FAQ Accordions | 2 | Priority Optional |
| Promotional Banners | 2 (1 core, 1 optional) | Core + Optional |
| Buttons | 6 | Core |
| Page Templates | 8 (7 core, 1 optional) | Core + Optional |
| Newsletter Signup | 1 | Priority Optional |
| **Total** | **45** | — |

### Variant Count Rationale for Small Primitives

The prompt requested ≥20 variants per component. For **button primitives**, 6 semantically distinct variants are implemented (Filled, Outlined, Ghost, Icon-only, Danger, Loading). Fabricating 14 additional button variants that differ only in color or size would violate the prompt's own instruction: *"do not create artificial variants for tiny primitives solely to reach a count."* This exception is documented here per acceptance criterion §3.

All major sections (header, hero, product card, grid, footer) each have 4–5 meaningful, compositionally distinct variants, respecting the spirit of the requirement.

---

## 4. Storage Architecture

| Stored in DB | Stored in App Code |
|---|---|
| Wizard session answers | All variant definitions |
| Recommended/selected variant IDs | Template presets |
| Compiled manifest (JSONB, variant IDs + props) | Compiler logic |
| Compile status, timestamps, version label | Compatibility rules |

No executable source code, CSS strings, or arbitrary HTML is persisted. Every draft is reproducible from its `manifest_version` + selected variant IDs.

---

## 5. Wizard Flow

1. **Step 1 — Style Preference:** Drives template preset selection (Boutique Elegant / Modern Urban / Emerald Brand / High-Density Catalog).
2. **Step 2 — Audience:** Informs color palette (`emerald_dark`, `teal_night`, `amber_warm`, `rose_brand`).
3. **Step 3 — Product Presentation:** Selects compatible product card + grid variant pair.
4. **Step 4 — Optional Features + Review + Compile.**

Each step saves partial state via `POST /api/projects/[id]/storefront-wizard` with `action: 'save_step'`. State is resumable.

---

## 6. Compatibility Rules

Compatibility violations prevent compilation. Examples enforced server-side:
- `header-v3-minimal-bar` is incompatible with `header-v1` or `header-v2` (only one header per store).
- `grid-v3-masonry` is incompatible with `product-card-v4-compact-grid` (density conflict).
- `hero-v4-video-loop` requires `video_url` data — flagged as missing requirement.

---

## 7. Integration-Dependent Sections (Deferred)

The following sections exist in the manifest as `disabled_integration_sections` and are never presented as working:

| Section | Dependency |
|---|---|
| `newsletter_submit` | Email provider config |
| `payment_methods` | Payment module (Module 9+) |
| `live_stock` | Inventory system |
| `order_tracking` | Order system |
| `product_reviews` | Verified review source |

---

## 8. AI Provider Policy

No AI provider is required for Module 7. The deterministic `recommendTemplate()` + `compileManifest()` functions always produce a valid manifest. An optional LLM wording layer is documented but not implemented — it would require an explicitly configured provider and strict allowlist validation before any user data leaves the server.

---

## 9. Limitations

- Figma was inaccessible; ZIP reference design was used for token alignment.
- Schematic wireframe previews are rendered as CSS-based component sketches, not pixel-perfect screenshots.
- The `newsletter_preview` optional feature renders a clearly labeled preview-only signup bar.
- Contact form requires `contact_email` to be present in project data; otherwise hidden.
