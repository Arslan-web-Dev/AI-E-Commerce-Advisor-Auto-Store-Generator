import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient } from '@/lib/ml-client';
import { loadScoringThresholds } from '@/lib/scoring/mcda';
import { APPROVED_CATEGORIES } from '@/types/project';
import type { RiskThresholds } from '@/lib/ml/scoring-contract';

export const dynamic = 'force-dynamic';

const NUMERIC_LIMITS: Record<string, { min: number; max: number; label: string }> = {
  initial_capital_pkr: { min: 1, max: 1e12, label: 'initial_capital_pkr' },
  monthly_burn_budget_pkr: { min: 1, max: 1e12, label: 'monthly_burn_budget_pkr' },
  commercial_rent_sqft_pkr: { min: 0, max: 1e7, label: 'commercial_rent_sqft_pkr' },
  competitor_density_1km: { min: 0, max: 100000, label: 'competitor_density_1km' },
  online_search_interest: { min: 0, max: 100, label: 'online_search_interest' },
  urbanization_rate: { min: 0, max: 100, label: 'urbanization_rate' },
  purchasing_power_index: { min: 0, max: 100, label: 'purchasing_power_index' },
  logistics_accessibility_score: { min: 0, max: 10, label: 'logistics_accessibility_score' },
  digital_payment_adoption_pct: { min: 0, max: 100, label: 'digital_payment_adoption_pct' },
  runway_months: { min: 0, max: 1200, label: 'runway_months' },
};

/** Rejects negative, non-finite and out-of-range sandbox inputs before inference. */
function validateSandboxFeatures(features: Record<string, unknown>): string | null {
  const category = features.business_category;
  if (typeof category !== 'string' || !APPROVED_CATEGORIES.includes(category)) {
    return `business_category must be one of: ${APPROVED_CATEGORIES.join(', ')}.`;
  }
  for (const [key, limit] of Object.entries(NUMERIC_LIMITS)) {
    const value = features[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `${limit.label} must be a finite number.`;
    }
    if (value < limit.min || value > limit.max) {
      return `${limit.label} must be between ${limit.min} and ${limit.max}.`;
    }
  }
  for (const key of ['district', 'target_audience']) {
    const value = features[key];
    if (typeof value !== 'string' || value.trim().length < 1 || value.length > 120) {
      return `${key} must be a non-empty string of at most 120 characters.`;
    }
  }
  return null;
}

/**
 * Admin-only ML sandbox inference.
 *
 * This endpoint intentionally does NOT persist a project feasibility report.
 * Project-scoped, ownership-checked reports are created only by
 * `POST /api/projects/[id]/feasibility`, which writes the provisional MCDA
 * result with full provenance. Allowing arbitrary sandbox predictions to be
 * attached to a project would blur that boundary.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: 'Unable to verify administrator access' }, { status: 500 });
  }
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { input_features, model_id } = body;

    if (!input_features || typeof input_features !== 'object' || Array.isArray(input_features)) {
      return NextResponse.json({ error: 'input_features object is required' }, { status: 400 });
    }

    const validationError = validateSandboxFeatures(input_features);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 422 });
    }

    const thresholdResult = await loadScoringThresholds(supabase);
    if (!thresholdResult.thresholds) {
      return NextResponse.json(
        { error: thresholdResult.error ?? 'Invalid scoring thresholds.' },
        { status: thresholdResult.status ?? 422 }
      );
    }

    // Forward the live feature-schema contract so the Python scorer rejects a
    // stale payload even when an artifact's columns happen to match.
    const policy = await mlClient.getTrainingPolicy();
    const prediction = await mlClient.predict(
      input_features,
      typeof model_id === 'string' ? model_id : undefined,
      thresholdResult.thresholds as RiskThresholds,
      policy.feature_schema_version
    );

    return NextResponse.json({
      prediction,
      context: {
        sandbox_only: true,
        project_report_persisted: false,
        threshold_version_applied: thresholdResult.thresholds.version,
        disclaimer: prediction.disclaimer ?? 'Estimate based on a model trained on limited data',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Prediction failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
