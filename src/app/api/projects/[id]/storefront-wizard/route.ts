import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { compileManifest, WizardAnswers } from '@/lib/storefront/compiler';
import { validateManifest, validateVariantId } from '@/lib/storefront/variant-catalog';

const ALLOWED_STYLE_PREFERENCES = ['elegant', 'modern', 'dense', 'brand'] as const;
const ALLOWED_AUDIENCES = ['general', 'youth', 'professional', 'family'] as const;
const ALLOWED_PRODUCT_PRESENTATIONS = ['image_heavy', 'info_heavy', 'balanced'] as const;
const ALLOWED_OPTIONAL_FEATURES = ['faq', 'newsletter_preview', 'announcement_bar', 'contact', 'about'];

// GET — get current wizard session for a project
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  const { data: session, error } = await supabase
    .from('store_wizard_sessions')
    .select('*')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to fetch wizard session' }, { status: 500 });
  }

  return NextResponse.json({ data: session ?? null });
}

// POST — save wizard answers, compute recommended variants, optionally compile draft
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: projectId } = await params;

  // Verify project ownership server-side
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id, owner_id, category, status, budget_currency')
    .eq('id', projectId)
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  if (project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    answers,
    current_step,
    custom_variants,
    action,   // 'save_step' | 'compile'
  } = body;

  // ─── Validate MCQ Answers ───────────────────────────────────────────────────
  if (answers) {
    const errs: string[] = [];
    if (answers.style_preference && !ALLOWED_STYLE_PREFERENCES.includes(answers.style_preference)) {
      errs.push('Invalid style_preference value.');
    }
    if (answers.audience && !ALLOWED_AUDIENCES.includes(answers.audience)) {
      errs.push('Invalid audience value.');
    }
    if (answers.product_presentation && !ALLOWED_PRODUCT_PRESENTATIONS.includes(answers.product_presentation)) {
      errs.push('Invalid product_presentation value.');
    }
    if (answers.optional_features) {
      const invalid = (answers.optional_features as string[]).filter(f => !ALLOWED_OPTIONAL_FEATURES.includes(f));
      if (invalid.length) errs.push(`Unknown optional_features: ${invalid.join(', ')}`);
    }
    if (errs.length) return NextResponse.json({ error: errs.join(' ') }, { status: 400 });
  }

  // ─── Validate custom_variants are allowlisted IDs ──────────────────────────
  if (custom_variants) {
    const badIds = Object.values(custom_variants as Record<string, string>).filter(
      (id) => !validateVariantId(id)
    );
    if (badIds.length) {
      return NextResponse.json({ error: `Unknown variant IDs: ${badIds.join(', ')}` }, { status: 400 });
    }
    const violations = validateManifest(custom_variants);
    if (violations.length) {
      return NextResponse.json({ error: violations.join(' ') }, { status: 400 });
    }
  }

  // ─── Upsert wizard session ──────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('store_wizard_sessions')
    .select('id')
    .eq('project_id', projectId)
    .eq('owner_id', user.id)
    .eq('status', 'in_progress')
    .limit(1)
    .single();

  const safeAnswers = answers
    ? { ...answers, schema_version: 'v1.0', optional_features: answers.optional_features ?? [] }
    : undefined;

  const upsertPayload: any = {
    owner_id: user.id,
    project_id: projectId,
    current_step: current_step ?? 1,
    status: action === 'compile' ? 'completed' : 'in_progress',
  };

  if (safeAnswers) upsertPayload.answers = safeAnswers;

  // Compute recommendation if answers are complete (step 4+)
  if (safeAnswers && current_step >= 4) {
    const typedAnswers: WizardAnswers = {
      style_preference: safeAnswers.style_preference ?? 'modern',
      audience: safeAnswers.audience ?? 'general',
      product_presentation: safeAnswers.product_presentation ?? 'balanced',
      optional_features: safeAnswers.optional_features ?? [],
      schema_version: 'v1.0',
    };
    const manifest = compileManifest(typedAnswers, project.category ?? 'general', custom_variants);
    upsertPayload.recommended_template = manifest.template_id;
    upsertPayload.recommended_variants = manifest.variants;
  }

  let session;
  if (existing) {
    const { data: updated, error: updateErr } = await supabase
      .from('store_wizard_sessions')
      .update(upsertPayload)
      .eq('id', existing.id)
      .select()
      .single();
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    session = updated;
  } else {
    const { data: created, error: createErr } = await supabase
      .from('store_wizard_sessions')
      .insert(upsertPayload)
      .select()
      .single();
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });
    session = created;
  }

  // ─── Compile draft if requested ─────────────────────────────────────────────
  if (action === 'compile' && session.recommended_variants) {
    // Approval gate: check project status — only allow draft compilation
    // Full publish gate is enforced separately (Module 8)
    // Wizard compilation always produces a 'draft' store record, never 'published'

    const typedAnswers: WizardAnswers = {
      style_preference: session.answers?.style_preference ?? 'modern',
      audience: session.answers?.audience ?? 'general',
      product_presentation: session.answers?.product_presentation ?? 'balanced',
      optional_features: session.answers?.optional_features ?? [],
      schema_version: 'v1.0',
    };
    const manifest = compileManifest(typedAnswers, project.category ?? 'general', session.recommended_variants);

    // Check compatibility violations — block compile if critical violations exist
    if (manifest.compatibility_violations.length > 0) {
      return NextResponse.json({
        error: 'Manifest has compatibility violations. Resolve before compiling.',
        violations: manifest.compatibility_violations,
      }, { status: 422 });
    }

    // Check if a draft store exists for this owner; create or use existing
    let store;
    const { data: existingStore } = await supabase
      .from('stores')
      .select('id, status')
      .eq('owner_id', user.id)
      .limit(1)
      .single();

    if (!existingStore) {
      // Auto-generate a slug from project category + short UUID segment
      const slugBase = (project.category ?? 'store').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 20);
      const slugSuffix = Math.random().toString(36).slice(2, 7);
      const slug = `${slugBase}-${slugSuffix}`;

      const { data: newStore, error: storeErr } = await supabase
        .from('stores')
        .insert({
          owner_id: user.id,
          name: `${project.category ?? 'My Store'} Store`,
          slug,
          status: 'draft',
          theme_config: manifest,
          currency: project.budget_currency ?? 'PKR',
        })
        .select()
        .single();

      if (storeErr) return NextResponse.json({ error: storeErr.message }, { status: 500 });
      store = newStore;
    } else {
      // Cannot update a published store's theme without owner action
      if (existingStore.status === 'published') {
        return NextResponse.json({
          error: 'Cannot recompile theme for a published store without unpublishing first.',
        }, { status: 409 });
      }
      const { data: updatedStore, error: updateErr } = await supabase
        .from('stores')
        .update({ theme_config: manifest })
        .eq('id', existingStore.id)
        .select()
        .single();
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      store = updatedStore;
    }

    // Persist versioned draft record (immutable snapshot)
    const { data: draft, error: draftErr } = await supabase
      .from('store_draft_versions')
      .insert({
        store_id: store.id,
        wizard_session_id: session.id,
        project_id: projectId,
        manifest,
        manifest_version: manifest.manifest_version,
        compile_status: 'compiled',
        version_label: `v${Date.now()}`,
      })
      .select()
      .single();

    if (draftErr) return NextResponse.json({ error: draftErr.message }, { status: 500 });

    return NextResponse.json({ data: { session, store, draft, manifest } });
  }

  return NextResponse.json({ data: { session } });
}
