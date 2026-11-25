import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mlClient } from '@/lib/ml-client';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { supabase: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    return {
      supabase: null,
      response: NextResponse.json({ error: 'Unable to verify administrator access' }, { status: 500 }),
    } as const;
  }
  if (profile?.role !== 'admin') {
    return {
      supabase: null,
      response: NextResponse.json({ error: 'Forbidden. Admin role required.' }, { status: 403 }),
    } as const;
  }
  return { supabase, response: null } as const;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const modelId = new URL(request.url).searchParams.get('model_id');
  try {
    if (modelId) {
      const details = await mlClient.getModelDetails(modelId);
      return NextResponse.json({ model: details });
    }
    const models = await mlClient.listModels();
    return NextResponse.json({ models });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to fetch models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  try {
    const body = await request.json();
    const { model_id } = body;
    if (!model_id || typeof model_id !== 'string' || !model_id.trim()) {
      return NextResponse.json({ error: 'A non-empty model_id is required.' }, { status: 400 });
    }

    // Registry gating happens before the Python activation. A candidate with an
    // unapproved or missing label policy must never become the active model,
    // even if a stale bundle still passes the Python-side shape checks.
    const { data: candidate, error: candidateError } = await supabase
      .from('model_registry')
      .select('id, version, label_approval_status, is_active')
      .eq('configuration->>python_model_id', model_id)
      .maybeSingle();

    if (candidateError) {
      return NextResponse.json(
        { error: `Unable to verify model registry state: ${candidateError.message}` },
        { status: 500 }
      );
    }
    if (!candidate) {
      return NextResponse.json(
        { error: 'No Supabase registry row exists for this Python model.' },
        { status: 404 }
      );
    }
    if (!candidate.version || candidate.label_approval_status !== 'APPROVED') {
      return NextResponse.json(
        {
          error:
            'Activation is blocked: the registry row must be versioned and carry OI-6 approval. ' +
            'No candidate is auto-promoted.',
        },
        { status: 422 }
      );
    }

    const activation = await mlClient.activateModel(model_id);

    // Serving state must agree with the registry. There is one active row per
    // scoring_mode; the Python service rejects unversioned/leaky artifacts.
    const { error: clearError } = await supabase
      .from('model_registry')
      .update({ is_active: false })
      .eq('scoring_mode', 'supervised_model');
    if (clearError) {
      return NextResponse.json(
        { error: `Python model activated, but registry clear failed: ${clearError.message}`, activation },
        { status: 500 }
      );
    }

    const { data: registryRow, error: activateError } = await supabase
      .from('model_registry')
      .update({ is_active: true })
      .eq('configuration->>python_model_id', model_id)
      .select('id, version, label_approval_status')
      .maybeSingle();

    if (activateError) {
      return NextResponse.json(
        { error: `Python model activated, but registry activation failed: ${activateError.message}`, activation },
        { status: 500 }
      );
    }
    if (!registryRow) {
      return NextResponse.json(
        {
          error: 'Python model activated, but no matching Supabase registry row exists. Serving state is inconsistent.',
          activation,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ activation, registry: registryRow });
  } catch (err: unknown) {
    const message = err instanceof Error && err.message ? err.message : 'Failed to activate model';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
