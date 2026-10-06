# Module 4: Data Processing and Feature Engineering Specification

## 1. Overview & Objective

Module 4 implements the data-cleaning, deduplication, imputation, and feature-engineering pipeline for the **AI E-Commerce Feasibility Advisor & Auto Store Generator**, fulfilling SRS requirements **FR-4.1** and **FR-4.2**.

It transforms raw, multi-source records gathered during Module 3 into deterministic, auditable, ML-ready feature representations. In compliance with system boundaries, Module 4:
- Computes mathematical features (`competitors_count`, `category_saturation`, `budget_ratio`, `avg_demand_index`, `trend_slope_score`, and bounded ML vectors).
- Deduplicates competitor POIs using spatial thresholds (< 50m) and brand clustering.
- Evaluates dataset completeness and quality (0–100%).
- Imputes non-critical benchmark metrics while tracking provenance.
- **Does NOT** calculate final feasibility scores (0.00–1.00), predictive classifications, risk levels, or store generations (strictly reserved for Module 5).

---

## 2. Feature Formulations & Math (FR-4.1)

### 2.1 Competitors Count (`competitors_count`)
$$N_{\text{competitors}} = |\text{Deduplicate}(\text{RawCompetitors})|$$
Count of distinct competitor POIs located within the user-specified geographic search radius.

### 2.2 Category Saturation (`category_saturation`)
$$\text{Saturation} = \frac{N_{\text{competitors}}}{\text{Population}}$$
- **Rule**: If census population is missing or non-positive, `category_saturation` is explicitly set to `null` and flagged in data completeness metadata.
- **Normalized Vector Value**: $\min\left(1.0, \text{Saturation} \times 100{,}000\right)$ (competitor density per 100k inhabitants).

### 2.3 Budget Ratio (`budget_ratio`)
$$\text{Total Annual Cost} = C_{\text{setup}} + (C_{\text{rent\_monthly}} \times 12) + C_{\text{marketing\_initial}}$$
$$\text{Budget Ratio} = \frac{\text{User Budget}}{\text{Total Annual Cost}}$$
- Both `User Budget` and `Total Annual Cost` are normalized to the project's selected currency using standardized exchange rates (e.g., 278 PKR/USD).
- **Normalized Vector Value**: $\min\left(1.0, \frac{\text{Budget Ratio}}{2.0}\right)$ (reaches 1.0 at 2.0x coverage).

### 2.4 Demand Trend Metrics
- **`avg_demand_index`**: Mean relative search volume index across the 12-month series $[0, 100]$.
- **`trend_slope`**: `'growing'` ($\Delta > +5\%$), `'stable'` ($-5\% \le \Delta \le +5\%$), or `'declining'` ($\Delta < -5\%$).
- **`trend_slope_score`**: $+1.0$ (growing), $0.0$ (stable), $-1.0$ (declining).

### 2.5 ML Feature Vector (`engineered_vector`)
A bounded, normalized JSON dictionary formatted for direct model intake:
```json
{
  "norm_competitors_density": 0.4667,
  "norm_category_saturation": 0.1077,
  "norm_budget_ratio": 0.7100,
  "norm_avg_demand": 0.7420,
  "trend_slope_score": 0.0,
  "norm_internet_penetration": 0.5430,
  "norm_ecommerce_growth": 0.4625,
  "footprint_scale": 2,
  "channel_type": 1
}
```

---

## 3. Data Cleaning, Imputation & Deduplication (FR-4.2)

### 3.1 Spatial & Brand Deduplication
- **Spatial Proximity Threshold**: Nodes within $50\text{ m}$ ($0.05\text{ km}$) are treated as duplicate listings.
- **Brand Clustered Match**: Identical normalized brand names within $1.0\text{ km}$ are merged.
- **Metadata Merging**: Keeps the node with the highest review count or rating.

### 3.2 Missing Value Imputation
- Demographics: Missing provincial internet penetration imputes national PTA benchmark ($54.3\%$).
- Demographics: Missing e-commerce growth imputes State Bank benchmark ($18.5\%$).
- Population: **Never arbitrarily imputed**; missing population preserves empirical integrity by leaving `category_saturation` as `null`.

### 3.3 Quality Score & Completeness Assessment
- 4 domains weighted equally at 25 points each (Competitors, Demographics, Trends, Costs).
- Completeness tier:
  - `complete`: Score $\ge 80\%$ with population present.
  - `partial`: Score $\ge 40\%$.
  - `unavailable`: Score $< 40\%$.

---

## 4. Database Schema & RLS

### `project_processing_runs`
- `id` (UUID, PK)
- `project_id` (UUID, FK to `projects`)
- `collection_run_id` (UUID, FK to `project_collection_runs`)
- `status` (`pending`, `running`, `completed`, `partial`, `failed`)
- `quality_score` (0.00 – 100.00)
- `data_completeness` (`complete`, `partial`, `unavailable`)
- `imputations_count` (int)
- `deduplication_stats` (JSONB)
- `domain_completeness` (JSONB)
- `provenance_summary` (JSONB)
- RLS: Protected with `public.can_access_project(project_id)`.

### `project_features`
- `id` (UUID, PK)
- `project_id` (UUID, FK to `projects`)
- `processing_run_id` (UUID, FK to `project_processing_runs`)
- `competitors_count` (int)
- `category_saturation` (numeric)
- `budget_ratio` (numeric)
- `avg_demand_index` (numeric)
- `trend_slope` (text)
- `trend_slope_score` (numeric)
- `engineered_vector` (JSONB)
- `feature_version` (text: `'v1.0'`)
- RLS: Protected with `public.can_access_project(project_id)`.
