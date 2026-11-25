import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  DEFAULT_RISK_THRESHOLDS,
  riskThresholdsFromConfig,
  validateRiskThresholds,
} from '@/lib/ml/scoring-contract';
import type { RiskThresholds } from '@/lib/ml/scoring-contract';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase: null, userId: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return {
      supabase: null,
      userId: null,
      response: NextResponse.json({ error: 'Unable to verify administrator access' }, { status: 500 }),
    } as const;
  }
  if (profile?.role !== 'admin') {
    return {
      supabase: null,
      userId: null,
      response: NextResponse.json({ error: 'Forbidden. Administrator access required.' }, { status: 403 }),
    } as const;
  }
  return { supabase, userId: user.id, response: null } as const;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { supabase } = auth;

  const [{ data: current, error: currentError }, { data: versions, error: versionsError }] =
    await Promise.all([
      supabase
        .from('system_config')
        .select('payload, updated_at')
        .eq('config_key', 'scoring_thresholds')
        .maybeSingle(),
      supabase
        .from('ml_scoring_config_versions')
        .select('id, version, config, created_by, created_at')
        .order('created_at', { ascending: false }),
    ]);

  if (currentError || versionsError) {
    return NextResponse.json({ error: 'Failed to read scoring threshold configuration.' }, { status: 500 });
  }

  let currentThresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS;
  if (current?.payload) {
    try {
      currentThresholds = riskThresholdsFromConfig(
        current.payload,
        DEFAULT_RISK_THRESHOLDS.version
      );
    } catch {
      return NextResponse.json(
        { error: 'Stored scoring threshold configuration is invalid.' },
        { status: 422 }
      );
    }
  }

  return NextResponse.json({
    current: currentThresholds,
    updated_at: current?.updated_at ?? null,
    versions: versions ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const { supabase, userId } = auth;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const version = typeof body.version === 'string' ? body.version.trim() : '';
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(version)) {
    return NextResponse.json(
      { error: 'version must be 1-80 characters using letters, numbers, dot, underscore, colon or hyphen.' },
      { status: 400 }
    );
  }

  let thresholds;
  try {
    thresholds = validateRiskThresholds({ ...body, version });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid thresholds.' },
      { status: 422 }
    );
  }

  const { data: existing, error: lookupError } = await supabase
    .from('ml_scoring_config_versions')
    .select('version')
    .eq('version', version)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: 'Unable to check configuration version.' }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ error: 'That threshold version already exists.' }, { status: 409 });
  }

  // Append the immutable version record first. If the live config update then
  // fails, the attempted change remains auditable without taking effect.
  const { error: versionError } = await supabase.from('ml_scoring_config_versions').insert({
    version,
    config: thresholds,
    created_by: userId,
  });
  if (versionError) {
    // A concurrent insert can win between the lookup and insert. Treat the
    // unique violation as the same conflict the pre-check reports.
    if (versionError.code === '23505') {
      return NextResponse.json({ error: 'That threshold version already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: versionError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from('system_config')
    .update({
      payload: thresholds,
      description: 'SRS FR-4.4 risk boundaries; changed only through the admin threshold API.',
      updated_at: new Date().toISOString(),
    })
    .eq('config_key', 'scoring_thresholds');

  if (updateError) {
    return NextResponse.json(
      { error: `Threshold version was audited, but the live config update failed: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ thresholds });
}
