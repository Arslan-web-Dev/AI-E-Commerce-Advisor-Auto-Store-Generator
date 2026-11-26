import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Project, BudgetCurrency } from '@/types/project';
import type {
  CompetitorRecord,
  MarketObservation,
  DemandTrendRecord,
  CostEstimateRecord,
} from '@/types/data-collection';
import { deduplicateCompetitors } from '@/lib/data-processing/deduplicator';
import { cleanAndValidateData } from '@/lib/data-processing/cleaner';
import { loadScoringThresholds } from '@/lib/scoring/mcda';
import { simulateBudget, validateSimulationBudget } from '@/lib/advisory/budget-simulation';
import { resolveLatestEligibleFeasibilityRun } from '@/lib/advisory/run-selection';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const payload = body as Record<string, unknown>;
  const allowed = new Set(['budget_amount', 'budget_currency']);
  if (Object.keys(payload).some((key) => !allowed.has(key))) {
    return NextResponse.json({ error: 'Only budget_amount and budget_currency are accepted.' }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();
  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found or inaccessible.' }, { status: 404 });
  }

  const validation = validateSimulationBudget(
    payload.budget_amount,
    payload.budget_currency ?? project.budget_currency,
  );
  if (!validation.valid || validation.amount === undefined || validation.currency === undefined) {
    return NextResponse.json({ error: validation.error ?? 'Invalid budget.' }, { status: 422 });
  }

  const resolved = await resolveLatestEligibleFeasibilityRun(supabase, projectId);
  if (resolved.error || !resolved.data) {
    return NextResponse.json(
      { error: resolved.error ?? 'No eligible feasibility run.' },
      { status: resolved.status ?? 404 },
    );
  }

  const thresholdsResult = await loadScoringThresholds(supabase);
  if (thresholdsResult.error || !thresholdsResult.thresholds) {
    return NextResponse.json(
      { error: 'Valid scoring thresholds are unavailable.' },
      { status: thresholdsResult.status ?? 422 },
    );
  }

  const [
    { data: rawCompetitors, error: competitorsError },
    { data: observations, error: observationsError },
    { data: trend, error: trendError },
    { data: costs, error: costsError },
  ] = await Promise.all([
    supabase.from('project_competitors').select('*').eq('project_id', projectId),
    supabase.from('project_market_observations').select('*').eq('project_id', projectId),
    supabase
      .from('project_demand_trends')
      .select('*')
      .eq('project_id', projectId)
      .order('retrieved_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('project_cost_estimates').select('*').eq('project_id', projectId),
  ]);

  if (competitorsError || observationsError || trendError || costsError) {
    return NextResponse.json({ error: 'Stored analysis records could not be read.' }, { status: 500 });
  }

  const currency: BudgetCurrency = validation.currency;
  const { deduplicated } = deduplicateCompetitors((rawCompetitors ?? []) as CompetitorRecord[]);
  const cleaned = cleanAndValidateData(
    deduplicated,
    (observations ?? []) as MarketObservation[],
    (trend ?? null) as DemandTrendRecord | null,
    (costs ?? []) as CostEstimateRecord[],
    currency,
    project as Project,
  );

  const result = simulateBudget({
    project: project as Project,
    dataset: cleaned,
    runId: resolved.data.id,
    budgetAmount: validation.amount,
    budgetCurrency: currency,
    thresholds: thresholdsResult.thresholds,
    baselineScore: resolved.data.score_value,
    baselineRiskLevel: resolved.data.risk_level,
  });

  return NextResponse.json({ data: result });
}
