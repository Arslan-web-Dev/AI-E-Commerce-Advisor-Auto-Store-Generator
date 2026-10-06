import { SupabaseClient } from '@supabase/supabase-js';
import { Project } from '@/types/project';
import {
  CompetitorRecord,
  MarketObservation,
  DemandTrendRecord,
  CostEstimateRecord,
} from '@/types/data-collection';
import {
  FeatureProcessingResult,
  ProcessingRunRecord,
  ProjectFeatureRecord,
} from '@/types/feature-processing';
import { deduplicateCompetitors } from './deduplicator';
import { cleanAndValidateData } from './cleaner';
import { engineerFeatures } from './feature-engineer';

export async function processProjectFeatures(
  supabase: SupabaseClient,
  project: Project
): Promise<FeatureProcessingResult> {
  const startedAt = new Date().toISOString();

  // 1. Fetch latest collection run if any
  const { data: latestColRun } = await supabase
    .from('project_collection_runs')
    .select('id')
    .eq('project_id', project.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const collectionRunId = latestColRun?.id || null;

  // 2. Fetch raw collected records
  const [
    { data: rawCompetitors },
    { data: observations },
    { data: trends },
    { data: costs },
  ] = await Promise.all([
    supabase
      .from('project_competitors')
      .select('*')
      .eq('project_id', project.id),
    supabase
      .from('project_market_observations')
      .select('*')
      .eq('project_id', project.id),
    supabase
      .from('project_demand_trends')
      .select('*')
      .eq('project_id', project.id)
      .order('retrieved_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('project_cost_estimates')
      .select('*')
      .eq('project_id', project.id),
  ]);

  const competitorList: CompetitorRecord[] = rawCompetitors || [];
  const observationList: MarketObservation[] = observations || [];
  const demandTrendRecord: DemandTrendRecord | null = trends || null;
  const costList: CostEstimateRecord[] = costs || [];

  // 3. Deduplicate Competitors
  const { deduplicated, stats: deduplicationStats } = deduplicateCompetitors(competitorList);

  // 4. Clean & Validate Data, calculate quality score & completeness
  const cleanedDataset = cleanAndValidateData(
    deduplicated,
    observationList,
    demandTrendRecord,
    costList,
    (project.budget_currency as 'USD' | 'PKR') || 'PKR'
  );

  // 5. Create initial processing run record in database
  const { data: runRecord, error: runError } = await supabase
    .from('project_processing_runs')
    .insert({
      project_id: project.id,
      collection_run_id: collectionRunId,
      status: 'running',
      quality_score: cleanedDataset.quality_score,
      data_completeness: cleanedDataset.data_completeness,
      imputations_count: cleanedDataset.imputations_count,
      deduplication_stats: deduplicationStats,
      domain_completeness: cleanedDataset.domain_completeness,
      provenance_summary: cleanedDataset.provenance_summary,
      started_at: startedAt,
    })
    .select('*')
    .single();

  if (runError || !runRecord) {
    throw new Error(`Failed to create processing run: ${runError?.message || 'Unknown error'}`);
  }

  try {
    // 6. Engineer Features & ML Vector
    const engineeredFeatures = engineerFeatures(project, cleanedDataset, runRecord.id);

    // 7. Persist Features
    const { data: featureRecord, error: featError } = await supabase
      .from('project_features')
      .insert({
        project_id: project.id,
        processing_run_id: runRecord.id,
        competitors_count: engineeredFeatures.competitors_count,
        category_saturation: engineeredFeatures.category_saturation,
        budget_ratio: engineeredFeatures.budget_ratio,
        avg_demand_index: engineeredFeatures.avg_demand_index,
        trend_slope: engineeredFeatures.trend_slope,
        trend_slope_score: engineeredFeatures.trend_slope_score,
        population: engineeredFeatures.population,
        internet_penetration_pct: engineeredFeatures.internet_penetration_pct,
        ecommerce_growth_rate_pct: engineeredFeatures.ecommerce_growth_rate_pct,
        total_estimated_setup_cost: engineeredFeatures.total_estimated_setup_cost,
        total_estimated_monthly_cost: engineeredFeatures.total_estimated_monthly_cost,
        total_estimated_annual_cost: engineeredFeatures.total_estimated_annual_cost,
        user_budget: engineeredFeatures.user_budget,
        currency: engineeredFeatures.currency,
        engineered_vector: engineeredFeatures.engineered_vector,
        feature_version: engineeredFeatures.feature_version,
      })
      .select('*')
      .single();

    if (featError || !featureRecord) {
      throw new Error(`Failed to store project features: ${featError?.message || 'Unknown error'}`);
    }

    // 8. Update run to completed / partial
    const finalStatus = cleanedDataset.data_completeness === 'complete' ? 'completed' : 'partial';
    const completedAt = new Date().toISOString();

    const { data: updatedRun, error: updateError } = await supabase
      .from('project_processing_runs')
      .update({
        status: finalStatus,
        completed_at: completedAt,
      })
      .eq('id', runRecord.id)
      .select('*')
      .single();

    if (updateError || !updatedRun) {
      throw new Error(`Failed to finalize processing run: ${updateError?.message || 'Unknown error'}`);
    }

    return {
      run: updatedRun as ProcessingRunRecord,
      features: featureRecord as ProjectFeatureRecord,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Feature processing error';
    // Log failure on the run record
    await supabase
      .from('project_processing_runs')
      .update({
        status: 'failed',
        error_log: errorMsg,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runRecord.id);

    throw err;
  }
}
