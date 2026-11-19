-- Conservative defaults prevent omitted provenance fields from implying live or licensed data.
alter table public.project_market_observations
  alter column provider set default 'curated_regional_reference_estimates',
  alter column provenance set default 'manual_estimate';

alter table public.project_demand_trends
  alter column provider set default 'synthetic_category_trend_curve',
  alter column provenance set default 'synthetic_demo';
