import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCompleteProject } from '@/lib/validation/project';
import { convertUsdToPkr } from '@/lib/currency/exchange-rate';
import { runDataCollection } from '@/lib/data-collection/orchestrator';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch existing project to verify ownership and initial state
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.owner_id !== user.id) {
      return NextResponse.json({ error: 'Access denied: You do not own this project' }, { status: 403 });
    }

    // Idempotent safeguard: if already submitted, return the existing submitted project
    if (project.status === 'submitted' || project.status === 'analyzing' || project.status === 'completed') {
      return NextResponse.json({
        message: 'Project has already been submitted for feasibility analysis',
        project,
        report_id: project.report_id,
        already_submitted: true,
      });
    }

    // Server-side validation of the complete project before submission
    const validation = validateCompleteProject(project);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Cannot submit project: required fields are missing or invalid',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Geographic verification: strictly inside Pakistan
    const lat = Number(project.lat);
    const lng = Number(project.lng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 23.5 || lat > 37.2 ||
      lng < 60.8 || lng > 77.9
    ) {
      return NextResponse.json(
        { error: 'Coordinates must be valid numbers within Pakistan geographic bounds (Lat: 23.5–37.2, Lng: 60.8–77.9).' },
        { status: 400 }
      );
    }

    if (typeof project.city !== 'string' || !project.city.trim()) {
      return NextResponse.json(
        { error: 'Please specify a target city within Pakistan before submitting.' },
        { status: 400 }
      );
    }

    if (project.country && project.country.toLowerCase() !== 'pakistan') {
      return NextResponse.json(
        { error: 'This platform evaluates business feasibility exclusively within Pakistan.' },
        { status: 400 }
      );
    }

    // Radius validation: 5 km to 15 km
    const requestedRadiusKm = Number(project.radius_km);
    if (!Number.isFinite(requestedRadiusKm) || requestedRadiusKm < 5 || requestedRadiusKm > 15) {
      return NextResponse.json(
        { error: 'Analysis radius must be between 5 and 15 km (10 km standard default).' },
        { status: 400 }
      );
    }
    // Compute canonical integer PKR budget and currency metadata
    const rawBudget = Number(project.budget_amount);
    let budgetPkr = Number(project.budget_pkr);
    if (!Number.isFinite(budgetPkr) || budgetPkr <= 0) {
      budgetPkr = project.budget_currency === 'USD'
        ? convertUsdToPkr(rawBudget)
        : Math.round(rawBudget);
    }

    if (budgetPkr < 10_000 || budgetPkr > 50_000_000) {
      return NextResponse.json(
        { error: 'Project investment capital must be between Rs. 10,000 and Rs. 50,000,000 PKR.' },
        { status: 400 }
      );
    }

    // Persist the canonical PKR budget on the owned draft project so the atomic
    // RPC reads the correct value. This is a draft normalization only — it does
    // not create a report or change submission status, so no partial submission
    // can result.
    if (Number(project.budget_pkr) !== budgetPkr) {
      const { error: budgetSyncError } = await supabase
        .from('projects')
        .update({ budget_pkr: budgetPkr })
        .eq('id', id)
        .eq('owner_id', user.id);

      if (budgetSyncError) {
        console.error('[Submit Project] Failed to normalize canonical PKR budget:', budgetSyncError.message);
        return NextResponse.json(
          { error: 'Failed to finalize project budget before submission. Please retry.' },
          { status: 500 }
        );
      }
    }

    // Atomic & idempotent submission via the secure RPC. Identity is derived
    // from auth.uid() inside PostgreSQL; the caller supplies only the project
    // ID. There is deliberately no non-atomic fallback path: if the RPC fails,
    // no report is created and the project status is left unchanged.
    let reportId: string | null = null;
    let finalProject: typeof project | null = null;

    const { data: rpcData, error: rpcError } = await supabase.rpc('submit_project_for_feasibility', {
      p_project_id: id,
    });

    if (rpcError || !rpcData?.success) {
      console.error(
        '[Submit Project] Atomic submission RPC failed:',
        rpcError?.message || 'RPC returned an unsuccessful result'
      );
      return NextResponse.json(
        { error: 'Failed to submit project for feasibility analysis. Please retry.' },
        { status: 500 }
      );
    }

    reportId = rpcData.report_id;
    const { data: refreshedProj } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    finalProject = refreshedProj;

    // 3. Initiate Module 3 Data Collection for the submitted project (Handoff)
    let collectionResult = null;
    try {
      collectionResult = await runDataCollection(id, user.id);
    } catch (collErr) {
      console.warn('Initial data collection handoff notice:', collErr);
    }

    return NextResponse.json({
      message: 'Project submitted successfully for feasibility analysis',
      project: finalProject || project,
      report_id: reportId,
      collection: collectionResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
