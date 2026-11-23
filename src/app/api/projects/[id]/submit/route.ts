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
    const radiusKm = Math.round(requestedRadiusKm);

    // Compute canonical integer PKR budget and currency metadata
    const rawBudget = Number(project.budget_amount);
    let budgetPkr = project.budget_pkr;
    if (!budgetPkr || budgetPkr <= 0) {
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

    // Attempt Atomic & Idempotent Submission via PostgreSQL RPC
    let reportId: string | null = null;
    let finalProject: typeof project | null = null;

    const { data: rpcData, error: rpcError } = await supabase.rpc('submit_project_for_feasibility', {
      p_project_id: id,
      p_user_id: user.id,
    });

    if (!rpcError && rpcData?.success) {
      reportId = rpcData.report_id;
      const { data: refreshedProj } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      finalProject = refreshedProj;
    } else {
      // Fallback atomic execution in environments where the RPC function is pending deployment
      // 1. Create or reuse linked feasibility_reports row
      let repId = project.report_id;
      if (!repId) {
        const { data: report, error: reportError } = await supabase
          .from('feasibility_reports')
          .insert({
            owner_id: user.id,
            category: project.category,
            idea_text: project.product_description || `${project.category} venture at ${project.target_location}`,
            city: project.city,
            area: project.target_location,
            lat,
            lng,
            radius_km: radiusKm,
            budget_pkr: budgetPkr,
            status: 'pending',
          })
          .select('id')
          .single();

        if (reportError) {
          return NextResponse.json(
            { error: `Failed to initialize feasibility report: ${reportError.message}` },
            { status: 500 }
          );
        }
        repId = report.id;
      }

      // 2. Transition project to 'submitted'
      const submittedAt = new Date().toISOString();
      const { data: updatedProject, error: updateError } = await supabase
        .from('projects')
        .update({
          status: 'submitted',
          submitted_at: submittedAt,
          report_id: repId,
          budget_pkr: budgetPkr,
          current_step: 3,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      reportId = repId;
      finalProject = updatedProject;
    }

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
