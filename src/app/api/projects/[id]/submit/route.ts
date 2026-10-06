import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateCompleteProject } from '@/lib/validation/project';
import { EXCHANGE_RATE_USD_TO_PKR } from '@/types/project';
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

    // Fetch existing project to verify ownership
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

    // Server-side validation of the full project
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

    // Coordinate fallbacks for Pakistan if missing
    let lat = project.lat !== null && project.lat !== undefined ? Number(project.lat) : 31.5204;
    let lng = project.lng !== null && project.lng !== undefined ? Number(project.lng) : 74.3587;
    // Bound coordinates to Pakistan range required by feasibility_reports check constraint
    if (lat < 23.5 || lat > 37.2) lat = 31.5204;
    if (lng < 60.8 || lng > 77.9) lng = 74.3587;

    const radiusKm = Math.min(15, Math.max(10, Math.round(project.radius_km || 10)));
    const budgetPkr =
      project.budget_pkr ||
      (project.budget_currency === 'PKR'
        ? Math.round(project.budget_amount)
        : Math.round(project.budget_amount * EXCHANGE_RATE_USD_TO_PKR));

    // 1. Create linked feasibility_reports row with status 'pending' (SRS FR-2.6)
    const { data: report, error: reportError } = await supabase
      .from('feasibility_reports')
      .insert({
        owner_id: user.id,
        category: project.category,
        idea_text: project.product_description || `${project.category} venture at ${project.target_location}`,
        city: project.city || 'Lahore',
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
      // If error occurs inserting feasibility_reports, report error
      return NextResponse.json(
        { error: `Failed to initialize feasibility report: ${reportError.message}` },
        { status: 500 }
      );
    }

    // 2. Move project lifecycle status to 'submitted'
    const submittedAt = new Date().toISOString();
    const { data: updatedProject, error: updateError } = await supabase
      .from('projects')
      .update({
        status: 'submitted',
        submitted_at: submittedAt,
        report_id: report.id,
        current_step: 5,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // 3. Initiate Module 3 Data Collection for the submitted project
    let collectionResult = null;
    try {
      collectionResult = await runDataCollection(id, user.id);
    } catch (collErr) {
      console.warn('Initial data collection notice:', collErr);
    }

    return NextResponse.json({
      message: 'Project submitted successfully for feasibility analysis',
      project: updatedProject,
      report_id: report.id,
      collection: collectionResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
