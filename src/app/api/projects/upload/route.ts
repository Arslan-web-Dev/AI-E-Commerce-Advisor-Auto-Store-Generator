import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ATTACHMENT_BUCKET = 'project-attachments';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/webp',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.csv', '.json', '.png', '.jpg', '.jpeg', '.webp'];

function validateFilename(filename: string): boolean {
  // Reject directory traversal or path manipulation attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('%')) {
    return false;
  }
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectId = (formData.get('project_id') as string | null)?.trim();

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum permitted limit of 5MB' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            'Invalid file type. Allowed formats: PDF (.pdf), CSV (.csv), JSON (.json), PNG (.png), JPEG (.jpg, .jpeg), WebP (.webp)',
        },
        { status: 400 }
      );
    }

    if (!validateFilename(file.name)) {
      return NextResponse.json(
        { error: 'Invalid filename or disallowed file extension.' },
        { status: 400 }
      );
    }

    // If projectId is provided, strictly verify project ownership and draft state.
    let isAdmin = false;
    if (projectId && projectId !== 'draft') {
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('id, owner_id, status')
        .eq('id', projectId)
        .maybeSingle();

      if (projErr || !project) {
        return NextResponse.json({ error: 'Associated project not found' }, { status: 404 });
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      isAdmin = profile?.role === 'admin';

      if (project.owner_id !== user.id && !isAdmin) {
        return NextResponse.json({ error: 'Access denied: You do not own this project' }, { status: 403 });
      }

      if (project.status !== 'draft' && !isAdmin) {
        return NextResponse.json({ error: 'Attachments cannot be changed after submission' }, { status: 400 });
      }
    }

    // Sanitize filename and format storage path: {user_id}/{project_id}/{unique_filename}
    const cleanBasename = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const uniqueFileId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const safeName = `${cleanBasename}_${uniqueFileId}${ext}`;
    const targetProjId = projectId && projectId !== 'draft' ? projectId : 'drafts';
    const storagePath = `${user.id}/${targetProjId}/${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Storage Upload Error]:', uploadError.message);
      return NextResponse.json(
        { error: `Failed to upload file to storage: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Generate short-lived signed URL (3600 seconds = 1 hour)
    let signedUrl = '';
    const { data: signedData, error: signError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (!signError && signedData?.signedUrl) {
      signedUrl = signedData.signedUrl;
    }

    // Update project record if an existing project ID was provided. A metadata
    // write failure must never be silent: remove the orphaned object and fail.
    if (projectId && projectId !== 'draft') {
      let metadataQuery = supabase
        .from('projects')
        .update({
          product_file_url: storagePath, // Store storage path canonically, not public URL
          product_file_name: file.name,
          product_file_size: file.size,
        })
        .eq('id', projectId);

      // Admins may manage another owner's project deliberately; regular users
      // remain strictly scoped to their own rows.
      if (!isAdmin) metadataQuery = metadataQuery.eq('owner_id', user.id);

      const { error: metadataError } = await metadataQuery;
      if (metadataError) {
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
        return NextResponse.json(
          { error: `File uploaded but attachment metadata could not be saved: ${metadataError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      storage_path: storagePath,
      file_url: storagePath, // Canonical backward-compatible field
      signed_url: signedUrl || null,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'File upload processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
