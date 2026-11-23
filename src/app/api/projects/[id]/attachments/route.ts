import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/attachments
 * Generates a short-lived private signed URL for downloading/viewing a project's attachment.
 * Strictly verifies user authentication and project ownership.
 */
export async function GET(request: NextRequest, context: RouteContext) {
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

    // Fetch project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, owner_id, product_file_url, product_file_name, product_file_size')
      .eq('id', id)
      .maybeSingle();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check ownership / admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const isAdmin = profile?.role === 'admin';

    if (project.owner_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Access denied: You do not own this project' }, { status: 403 });
    }

    if (!project.product_file_url) {
      return NextResponse.json({ error: 'No attachment found for this project' }, { status: 404 });
    }

    // Clean storage path if it was previously stored as a full URL
    let storagePath = project.product_file_url;
    if (storagePath.includes('/project-attachments/')) {
      storagePath = storagePath.split('/project-attachments/')[1];
    }

    // Generate 1-hour signed URL from private bucket
    const { data: signedData, error: signError } = await supabase.storage
      .from('project-attachments')
      .createSignedUrl(storagePath, 3600);

    if (signError || !signedData?.signedUrl) {
      return NextResponse.json(
        {
          error: signError?.message || 'Failed to generate signed download URL for private attachment',
          storage_path: storagePath,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      file_name: project.product_file_name || 'attachment',
      file_size: project.product_file_size || null,
      signed_url: signedData.signedUrl,
      expires_in: 3600,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
