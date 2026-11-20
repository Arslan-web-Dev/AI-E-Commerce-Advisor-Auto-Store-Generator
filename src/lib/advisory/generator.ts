import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { executeAIGateway, createAIAttemptLogger } from '@/lib/ai/gateway';

export interface BudgetAllocation {
  inventory: number;
  marketing: number;
  operations: number;
  contingency: number;
}

export interface BilingualText {
  en: string;
  ur: string;
}

export interface Insight {
  type: 'strength' | 'risk' | 'action';
  title: BilingualText;
  description: BilingualText;
  feature_ref?: string;
  value?: unknown;
  is_evidence_based: boolean;
}

export const DEFAULT_BUDGET_WEIGHTS = {
  inventory: 0.40,
  marketing: 0.25,
  operations: 0.20,
  contingency: 0.15,
};

export async function generateAdvisoryReport(
  supabase: SupabaseClient,
  projectId: string,
  feasibilityRunId: string,
  ownerId: string,
) {
  // 1. Fetch Feasibility Run
  const { data: feasibility, error: feasErr } = await supabase
    .from('project_feasibility_runs')
    .select(`
      *,
      project_processing_runs (*),
      projects (*)
    `)
    .eq('id', feasibilityRunId)
    .single();

  if (feasErr || !feasibility) {
    return { error: 'Feasibility run not found or inaccessible.', status: 404 };
  }
  
  if (feasibility.project_id !== projectId) {
     return { error: 'Feasibility run does not belong to this project.', status: 403 };
  }

  // 2. Fetch Features
  const processingRunId = feasibility.processing_run_id;
  const { data: features, error: featErr } = await supabase
    .from('project_features')
    .select('*')
    .eq('processing_run_id', processingRunId)
    .single();

  if (featErr || !features) {
    return { error: 'Features not found for this processing run.', status: 404 };
  }

  const project = feasibility.projects;
  const budgetTotal = Number(project.budget_amount);
  const budgetCurrency = project.budget_currency || 'PKR';

  // 3. Calculate Default Budget Allocations
  const budgetAllocations: BudgetAllocation = {
    inventory: Number((budgetTotal * DEFAULT_BUDGET_WEIGHTS.inventory).toFixed(2)),
    marketing: Number((budgetTotal * DEFAULT_BUDGET_WEIGHTS.marketing).toFixed(2)),
    operations: Number((budgetTotal * DEFAULT_BUDGET_WEIGHTS.operations).toFixed(2)),
    contingency: Number((budgetTotal * DEFAULT_BUDGET_WEIGHTS.contingency).toFixed(2)),
  };

  // 4. Generate Insights (Deterministic based on MCDA features)
  const insights: Insight[] = [];

  // Insight 1: Market Demand
  if (features.avg_demand_index > 60) {
    insights.push({
      type: 'strength',
      title: { en: 'Strong Search Demand', ur: 'Search Demand Bohat Achi Hai' },
      description: { 
        en: `The average demand index is solid (${features.avg_demand_index}/100), indicating active customer interest.`,
        ur: `Average demand index acha hai (${features.avg_demand_index}/100), log actively search kar rahay hain.`
      },
      feature_ref: 'avg_demand_index',
      value: features.avg_demand_index,
      is_evidence_based: true
    });
  } else {
    insights.push({
      type: 'risk',
      title: { en: 'Low Search Demand', ur: 'Search Demand Kam Hai' },
      description: { 
        en: 'Customer search interest is relatively low. Marketing will require more effort to educate the market.',
        ur: 'Customer search interest thora kam hai. Market ko educate karne ke liye marketing pe zayada focus chahiye.'
      },
      feature_ref: 'avg_demand_index',
      value: features.avg_demand_index,
      is_evidence_based: true
    });
  }

  // Insight 2: Saturation
  if (features.category_saturation !== null && features.category_saturation > 0.05) { // Threshold for saturation
    insights.push({
      type: 'risk',
      title: { en: 'High Competition Density', ur: 'Competition Bohat Zayada Hai' },
      description: { 
        en: 'There is a high concentration of competitors relative to the population. Consider finding a specific niche.',
        ur: 'Population ke hisaab se competitors bohat zayada hain. Kisi makhsoos niche pe focus karna behtar hoga.'
      },
      feature_ref: 'category_saturation',
      is_evidence_based: true
    });
  } else if (features.category_saturation !== null) {
    insights.push({
      type: 'strength',
      title: { en: 'Manageable Competition', ur: 'Competition Manageable Hai' },
      description: { 
        en: 'The competitor density is low, offering a good opportunity to capture market share.',
        ur: 'Competitor density kam hai, market share lenay ka acha moqa hai.'
      },
      feature_ref: 'category_saturation',
      is_evidence_based: true
    });
  }

  // Insight 3: Budget
  if (features.budget_ratio !== null && features.budget_ratio < 0.8) {
    insights.push({
      type: 'action',
      title: { en: 'Increase Budget or Reduce Scale', ur: 'Budget Barhain ya Scale Kam Karein' },
      description: { 
        en: 'Your budget is below the estimated minimum setup cost. Consider starting smaller or raising more capital.',
        ur: 'Aap ka budget estimated setup cost se kam hai. Chotay level se start karein ya budget barhain.'
      },
      feature_ref: 'budget_ratio',
      value: features.budget_ratio,
      is_evidence_based: true
    });
  } else {
    insights.push({
      type: 'action',
      title: { en: 'Lock Initial Allocation', ur: 'Initial Allocation Final Karein' },
      description: { 
        en: 'Budget is sufficient. Review and lock the budget allocation planning scenario to proceed safely.',
        ur: 'Budget kafi hai. Budget allocation scenario check karein aur final karein taa kay safely aagay barh sakein.'
      },
      feature_ref: 'budget_ratio',
      is_evidence_based: true
    });
  }

  // 5. Location Recommendations Placeholder
  const location_recommendations = {
    status: 'unavailable',
    reason: {
      en: 'No verified comparable spatial dataset is currently available for commercial hubs in Pakistan. Recommendation is deferred.',
      ur: 'Pakistan mein commercial hubs ka verified spatial data available nahi hai. Recommendation abhi nahi di ja sakti.'
    }
  };

  const advisoryFacts = {
    averageDemandIndex: features.avg_demand_index,
    categorySaturation: features.category_saturation,
    budgetRatio: features.budget_ratio,
    feasibilityScore: feasibility.score_value,
    classification: feasibility.classification,
    currency: budgetCurrency,
    budgetTotal,
    deterministicSignals: insights.map(({ type, title, feature_ref, value }) => ({
      type,
      title: title.en,
      feature: feature_ref ?? null,
      value: value ?? null,
    })),
  };
  const summarySchema = {
    type: 'object',
    required: ['summary_en', 'summary_ur_roman'],
    additionalProperties: false,
    properties: {
      summary_en: { type: 'string', minLength: 10, maxLength: 700 },
      summary_ur_roman: { type: 'string', minLength: 10, maxLength: 700 },
    },
  };
  const deterministicSummary = {
    summary_en: `This ${feasibility.classification} assessment is based on the stored market indicators and budget ratio. Review the listed evidence and risks before making a decision.`,
    summary_ur_roman: `Yeh ${feasibility.classification} assessment stored market indicators aur budget ratio par mabni hai. Faisla karne se pehle evidence aur risks ka jaiza lein.`,
  };
  const aiSummaryResult = await executeAIGateway({
    task: 'advisory',
    requestId: randomUUID(),
    language: 'en',
    systemPrompt: 'Explain only the supplied computed facts. Do not invent values or recommendations unsupported by them. Return one JSON object with summary_en and summary_ur_roman. No tools.',
    prompt: JSON.stringify(advisoryFacts),
    outputSchema: summarySchema,
  }, {
    ownerId,
    fallback: () => JSON.stringify(deterministicSummary),
    onAttempt: createAIAttemptLogger(ownerId),
  });
  let aiSummary = deterministicSummary;
  try {
    aiSummary = JSON.parse(aiSummaryResult.content) as typeof deterministicSummary;
  } catch {
    // The gateway validates structured output; retain deterministic text defensively.
  }

  // 6. Save Report
  const payload = {
    project_id: projectId,
    feasibility_run_id: feasibilityRunId,
    processing_run_id: processingRunId,
    budget_currency: budgetCurrency,
    budget_total: budgetTotal,
    budget_allocations: budgetAllocations,
    insights: {
      strengths: insights.filter(i => i.type === 'strength'),
      risks: insights.filter(i => i.type === 'risk'),
      immediate_actions: insights.filter(i => i.type === 'action'),
    },
    location_recommendations,
    metadata: {
      language_supported: ['en', 'ur'],
      generated_from_mode: feasibility.scoring_mode,
      ai_summary: aiSummary,
      ai_provider: aiSummaryResult.provider,
      ai_fallback: aiSummaryResult.fallback,
    }
  };

  const { data: report, error: saveErr } = await supabase
    .from('project_advisory_reports')
    .insert(payload)
    .select()
    .single();

  if (saveErr) {
    return { error: saveErr.message, status: 500 };
  }

  return { data: report };
}
