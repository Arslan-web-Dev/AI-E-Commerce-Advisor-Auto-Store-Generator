import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient } from '@/lib/ml-client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  try {
    const datasets = await mlClient.listDatasets();
    return NextResponse.json({ datasets });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to list datasets';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const action = formData.get('action');

    if (action === 'generate_sample') {
      const sample = await mlClient.generateSampleDataset();
      return NextResponse.json({ dataset: sample });
    }

    const uploaded = await mlClient.uploadDataset(formData);

    // Record in Supabase ml_datasets
    try {
      await supabase.from('ml_datasets').insert({
        id: uploaded.id.length === 36 ? uploaded.id : undefined,
        name: uploaded.name,
        file_name: uploaded.file_name,
        file_path: uploaded.file_path,
        file_size_bytes: uploaded.file_size_bytes,
        row_count: uploaded.row_count,
        column_count: uploaded.column_count,
        target_column: uploaded.target_column,
        problem_type: uploaded.problem_type,
        columns_metadata: uploaded.columns_metadata,
        data_quality_report: uploaded.data_quality_report,
        is_sample: uploaded.is_sample,
      });
    } catch (dbErr) {
      console.warn('Note: ml_datasets table insert:', dbErr);
    }

    return NextResponse.json({ dataset: uploaded });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to upload dataset';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
