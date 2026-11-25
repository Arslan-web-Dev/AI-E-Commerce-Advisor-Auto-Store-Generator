# Module 4: Data Processing, Feature Engineering and Model Pipeline

## 1. Overview and authority

This document describes FR-4.1 and FR-4.2 data preparation plus the Task 5 FR-4 model-pipeline hardening. The authoritative source is `docs/FINAL_DELIVERY_BASELINE.md` and the October 2026 SRS/SDD. Older repository copy that calls this “Module 5” uses a legacy numbering alias; the source SRS places feature engineering and feasibility scoring in Module 4.

Module 4:

- Computes deterministic, auditable, unit-bearing ML-ready features from Task 3 collection records.
- Deduplicates competitor POIs using spatial thresholds (<50 m) and brand clustering.
- Records domain completeness, quality score, unavailable-field count and provenance.
- Persists explicit feature columns and a stable bounded `engineered_vector` (`feature_version = v1.1-fr4`).
- Provides the controlled training/comparison/versioning infrastructure described in `docs/module-4-ml-pipeline.md`.

**It does not claim a supervised production score.** While OI-6 is open, project reports use the labelled provisional MCDA index and supervised feasibility targets fail closed.

---

## 2. Feature formulations and units (FR-4.1)

A missing or non-positive denominator yields `null` (`N/A` in UI). No zero, Punjab/Lahore default, or synthetic value is substituted for an unavailable local observation. Canonical money is integer PKR; a documented `278 PKR/USD` rate is used only for explicit currency conversion.

| Feature | Formula | Unit / null condition |
| --- | --- | --- |
| `competitors_count` | Deduplicated valid POI count | count |
| `competitor_density_per_km2` | `N / (π × radius_km²)` | POIs/km²; null when radius invalid |
| `avg_competitor_rating` | Mean of available ratings | 0–5; null when no ratings |
| `rent_per_sqft` | Parsed sourced PKR rent rate, converted only for an explicit USD project | PKR/sq.ft or USD/sq.ft per `currency`; null when no sourced record |
| `estimated_monthly_rent` | Sourced monthly rent midpoint | PKR/month; null on coverage gap |
| `rent_to_budget_ratio` | `monthly_rent / (budget / 12)` | dimensionless; null on zero/missing denominator |
| `budget_to_setup_cost_ratio` | `budget / setup_cost` | dimensionless; null on zero/missing/negative input |
| `demand_score` | Fresh, in-scope trend index | 0–100; null when trend unavailable, stale or cross-region |
| `category_saturation` | `N / population` | ratio; null when population absent/non-positive |
| `saturation_index` | `category_saturation × 100000` | competitors per 100,000 residents |

Legacy fields `budget_ratio`, `avg_demand_index`, `trend_slope` and `trend_slope_score` remain for backwards compatibility and MCDA explainability. `trend_slope_score` is `+1` growing, `0` stable, `−1` declining, and `null` when the trend is stale or out of scope.

### Bounded ML vector

Stable key order is asserted by tests:

```json
{
  "norm_competitors_density": 0.1000,
  "norm_category_saturation": 0.0000,
  "norm_budget_ratio": 0.7100,
  "norm_avg_demand": 0.7420,
  "trend_slope_score": 0.0,
  "norm_internet_penetration": 0.5430,
  "norm_ecommerce_growth": 0.4625,
  "footprint_scale": 2,
  "channel_type": 1
}
```

The vector clamps outliers to documented bounds. Values whose source is unavailable or out of scope are `null` instead of neutral placeholders and are excluded by MCDA. The example above shows only a fully populated record; it is not a calibrated probability and is not evidence of a supervised model.

---

## 3. Data cleaning, unavailable fields and deduplication (FR-4.2)

- **Spatial proximity:** competitors within 50 m (0.05 km) are duplicates.
- **Brand clustering:** identical normalized brand names within 1 km are merged.
- **Metadata merging:** the record with the strongest rating/review metadata is retained.
- **Demographics:** missing internet penetration and e-commerce growth stay `null`; no benchmark is substituted as a local observation. Both are counted in the compatibility field `imputations_count` and named in `domain_completeness.missing_fields`.
- **Population:** never imputed; saturation remains `null` when population is unavailable.
- **Rent:** only a labelled, non-`unavailable` cost record with a positive amount supplies a monthly rent feature. A cost row with amount `0`/`unavailable` is a coverage gap, not free premises.
- **Trends:** the requested versus actual geography and freshness stay on the `DemandTrendRecord`; a stale or national value is not relabelled as a fresh local observation.

### Quality score and completeness

Four domains are weighted equally at 25 points each: competitors, regional demographics, trends and costs.

- `complete`: score ≥80 and population present.
- `partial`: score ≥40.
- `unavailable`: score <40; scoring is aborted rather than fabricated.

---

## 4. Database schema and RLS

### `project_processing_runs`

`id`, `project_id`, `collection_run_id`, `status`, `quality_score`, `data_completeness`, `imputations_count`, `deduplication_stats`, `domain_completeness`, `provenance_summary`, timestamps and failure log. RLS uses `public.can_access_project(project_id)`.

### `project_features`

Legacy columns plus Task 5 explicit columns:

- `competitor_density_per_km2`
- `avg_competitor_rating`
- `rent_per_sqft`
- `estimated_monthly_rent`
- `rent_to_budget_ratio`
- `budget_to_setup_cost_ratio`
- `demand_score`
- `saturation_index`

All Task 5 feature columns are nullable so unavailable inputs remain honest. RLS uses `public.can_access_project(project_id)`.

### Migration

`supabase/migrations/20261125130000_module4_model_pipeline_hardening.sql` is additive and forward-only. It also adds report provenance/version columns, registry artifact metadata and the admin-controlled scoring-config version table with RLS. Manual rollback guidance is in the migration header.
