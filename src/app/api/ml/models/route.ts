import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient } from '@/lib/ml-client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get('model_id');

  try {
    if (modelId) {
      const details = await mlClient.getModelDetails(modelId);
      return NextResponse.json({ model: details });
    }
    const models = await mlClient.listModels();
    return NextResponse.json({ models });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch models' }, { status: 500 });
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
    const body = await request.json();
    const { model_id } = body;

    if (!model_id) {
      return NextResponse.json({ error: 'model_id is required' }, { status: 400 });
    }

    const res = await mlClient.activateModel(model_id);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to activate model' }, { status: 500 });
  }
}
