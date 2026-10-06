'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4;
type StylePref = 'elegant' | 'modern' | 'dense' | 'brand';
type Audience = 'general' | 'youth' | 'professional' | 'family';
type ProductPresentation = 'image_heavy' | 'info_heavy' | 'balanced';
type Viewport = 'desktop' | 'tablet' | 'mobile';

interface Answers {
  style_preference?: StylePref;
  audience?: Audience;
  product_presentation?: ProductPresentation;
  optional_features: string[];
}

interface Variant {
  id: string;
  name: string;
  componentType: string;
  description: string;
  availability: string;
}

// ─── Step definitions ────────────────────────────────────────────────────────
const STEP_1_OPTIONS: { value: StylePref; label: string; description: string; icon: string }[] = [
  { value: 'elegant', label: 'Boutique Elegant', description: 'Refined, minimal, luxury feel', icon: 'diamond' },
  { value: 'modern', label: 'Modern Urban', description: 'Bold, contemporary, high-contrast', icon: 'apartment' },
  { value: 'dense', label: 'High-Density Catalog', description: 'Information-rich, practical, fast', icon: 'grid_view' },
  { value: 'brand', label: 'Emerald Brand', description: 'Signature emerald theme, all categories', icon: 'palette' },
];

const STEP_2_OPTIONS: { value: Audience; label: string; icon: string }[] = [
  { value: 'general', label: 'General Public', icon: 'people' },
  { value: 'youth', label: 'Youth / Gen-Z', icon: 'emoji_events' },
  { value: 'professional', label: 'Professional / B2B', icon: 'work' },
  { value: 'family', label: 'Families & Households', icon: 'family_restroom' },
];

const STEP_3_OPTIONS: { value: ProductPresentation; label: string; description: string; icon: string }[] = [
  { value: 'image_heavy', label: 'Visual-First', description: 'Large images, overlay CTAs, editorial feel', icon: 'image' },
  { value: 'balanced', label: 'Balanced', description: 'Image + price + name, clean cards', icon: 'view_module' },
  { value: 'info_heavy', label: 'Spec-Rich', description: 'Details, attributes, comparison-friendly', icon: 'list_alt' },
];

const STEP_4_OPTIONS: { value: string; label: string; icon: string; note?: string }[] = [
  { value: 'announcement_bar', label: 'Announcement Bar', icon: 'campaign' },
  { value: 'faq', label: 'FAQ Section', icon: 'help' },
  { value: 'about', label: 'About Us Page', icon: 'info' },
  { value: 'contact', label: 'Contact Page', icon: 'mail' },
  { value: 'newsletter_preview', label: 'Newsletter Signup', icon: 'mark_email_unread', note: 'Preview only — needs email provider' },
];

const STEP_LABELS = ['Style', 'Audience', 'Products', 'Features'];

// ─── Component ───────────────────────────────────────────────────────────────
export default function StorefrontWizardPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [answers, setAnswers] = useState<Answers>({ optional_features: [] });
  const [variants, setVariants] = useState<Variant[]>([]);
  const [session, setSession] = useState<any>(null);
  const [compiledDraft, setCompiledDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState('');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [previewVariant, setPreviewVariant] = useState<Variant | null>(null);

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  // Load existing session + catalog
  useEffect(() => {
    if (!projectId) return;
    async function init() {
      try {
        const [sessionRes, variantsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/storefront-wizard`),
          fetch('/api/storefront/variants'),
        ]);
        const sessionData = await sessionRes.json();
        const variantsData = await variantsRes.json();

        if (sessionData.data) {
          setSession(sessionData.data);
          if (sessionData.data.answers) {
            setAnswers({
              style_preference: sessionData.data.answers.style_preference,
              audience: sessionData.data.answers.audience,
              product_presentation: sessionData.data.answers.product_presentation,
              optional_features: sessionData.data.answers.optional_features ?? [],
            });
            setStep(Math.min(sessionData.data.current_step, 4) as Step);
          }
        }
        if (variantsData.data) setVariants(variantsData.data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [projectId]);

  const saveStep = useCallback(async (nextStep: Step, partial?: Partial<Answers>) => {
    if (!projectId) return;
    setSaving(true);
    try {
      const merged = { ...answers, ...partial };
      const res = await fetch(`/api/projects/${projectId}/storefront-wizard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: merged,
          current_step: nextStep,
          action: 'save_step',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSession(data.data.session);
      setStep(nextStep);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [projectId, answers]);

  const handleCompile = async () => {
    if (!projectId) return;
    setCompiling(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${projectId}/storefront-wizard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          current_step: 4,
          action: 'compile',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.violations?.join('; '));
      setCompiledDraft(data.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCompiling(false);
    }
  };

  const toggleOptional = (val: string) => {
    setAnswers((prev) => ({
      ...prev,
      optional_features: prev.optional_features.includes(val)
        ? prev.optional_features.filter((f) => f !== val)
        : [...prev.optional_features, val],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--surface)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-[var(--on-surface-variant)] text-sm">Loading configurator…</p>
        </div>
      </div>
    );
  }

  // ─── Compiled draft view ──────────────────────────────────────────────────
  if (compiledDraft) {
    const manifest = compiledDraft.manifest;
    return (
      <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto space-y-8" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[var(--primary)] text-3xl">check_circle</span>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-plus-jakarta)', color: 'var(--on-surface)' }}>
            Storefront Draft Compiled
          </h1>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(78,222,163,0.15)', color: 'var(--primary)' }}>
            Template: {manifest.template_id}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
            Status: Draft — not published
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
            Version: {manifest.manifest_version}
          </span>
        </div>

        {/* Disclaimer */}
        <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--outline-variant)', background: 'var(--surface-container)' }}>
          <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
            <strong style={{ color: 'var(--on-surface)' }}>Draft only.</strong> This storefront configuration is saved but not published.
            Publishing will be available via the store management module. No store is publicly accessible yet.
          </p>
        </div>

        {/* Variant summary */}
        <div>
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--on-surface)' }}>Selected Components</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(manifest.variants as Record<string, string>).map(([slot, variantId]) => (
              <div key={slot} className="p-4 rounded-xl" style={{ background: 'var(--surface-container)' }}>
                <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--on-surface-variant)' }}>{slot}</div>
                <div className="font-medium text-sm" style={{ color: 'var(--primary)' }}>{variantId}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Missing requirements */}
        {manifest.missing_requirements.length > 0 && (
          <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--status-warning)', background: 'var(--status-warning-bg)' }}>
            <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--status-warning)' }}>Content Required</h3>
            <ul className="space-y-1">
              {manifest.missing_requirements.map((r: string, i: number) => (
                <li key={i} className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>• {r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Disabled sections */}
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--on-surface-variant)' }}>
            Integration-Dependent Sections (Deferred)
          </h3>
          <div className="flex flex-wrap gap-2">
            {manifest.disabled_integration_sections.map((s: string) => (
              <span key={s} className="px-2 py-0.5 rounded text-xs" style={{ background: 'var(--surface-container-high)', color: 'var(--outline)' }}>
                {s}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={() => setCompiledDraft(null)}
          className="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface)' }}
        >
          ← Back to Configurator
        </button>
      </div>
    );
  }

  // ─── Wizard steps ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-plus-jakarta)', color: 'var(--on-surface)' }}>
            Storefront Configurator
          </h1>
          <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
            Answer a few quick questions to generate a tailored storefront design.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            {STEP_LABELS.map((label, idx) => {
              const s = (idx + 1) as Step;
              const active = s === step;
              const done = s < step;
              return (
                <div key={idx} className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background: done ? 'var(--primary)' : active ? 'rgba(78,222,163,0.2)' : 'var(--surface-container)',
                        color: done ? 'var(--on-primary)' : active ? 'var(--primary)' : 'var(--on-surface-variant)',
                        border: active ? '2px solid var(--primary)' : 'none',
                      }}
                    >
                      {done
                        ? <span className="material-symbols-outlined text-base">check</span>
                        : s
                      }
                    </div>
                    <span className="text-xs hidden sm:block" style={{ color: active ? 'var(--primary)' : 'var(--on-surface-variant)' }}>
                      {label}
                    </span>
                  </div>
                  {idx < STEP_LABELS.length - 1 && (
                    <div className="h-px flex-1" style={{ background: done ? 'var(--primary)' : 'var(--outline-variant)' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: 'var(--error-container)', color: 'var(--on-error-container)' }}>
            {error}
          </div>
        )}

        {/* ── STEP 1: Style ─────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-plus-jakarta)' }}>
              What visual style suits your brand?
            </h2>
            <p className="text-sm mb-8" style={{ color: 'var(--on-surface-variant)' }}>
              This drives the overall template and layout selection.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
              {STEP_1_OPTIONS.map((opt) => {
                const selected = answers.style_preference === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setAnswers((p) => ({ ...p, style_preference: opt.value }))}
                    className="p-5 rounded-2xl text-left transition-all focus:outline-none focus-visible:ring-2"
                    style={{
                      background: selected ? 'rgba(78,222,163,0.12)' : 'var(--surface-container)',
                      border: `2px solid ${selected ? 'var(--primary)' : 'var(--outline-variant)'}`,
                      color: 'var(--on-surface)',
                    }}
                    aria-pressed={selected}
                  >
                    <span className="material-symbols-outlined text-3xl mb-3 block" style={{ color: selected ? 'var(--primary)' : 'var(--on-surface-variant)' }}>
                      {opt.icon}
                    </span>
                    <div className="font-semibold mb-1">{opt.label}</div>
                    <div className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>{opt.description}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => { setAnswers((p) => p); saveStep(2); }}
                disabled={!answers.style_preference || saving}
                className="px-8 py-3 rounded-xl font-semibold text-sm disabled:opacity-40 transition-all"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                {saving ? 'Saving…' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Audience ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-plus-jakarta)' }}>
              Who is your primary customer?
            </h2>
            <p className="text-sm mb-8" style={{ color: 'var(--on-surface-variant)' }}>
              Shapes color palette and typography weight choices.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
              {STEP_2_OPTIONS.map((opt) => {
                const selected = answers.audience === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setAnswers((p) => ({ ...p, audience: opt.value }))}
                    className="p-5 rounded-2xl text-left transition-all focus:outline-none focus-visible:ring-2"
                    style={{
                      background: selected ? 'rgba(78,222,163,0.12)' : 'var(--surface-container)',
                      border: `2px solid ${selected ? 'var(--primary)' : 'var(--outline-variant)'}`,
                    }}
                    aria-pressed={selected}
                  >
                    <span className="material-symbols-outlined text-2xl mb-2 block" style={{ color: selected ? 'var(--primary)' : 'var(--on-surface-variant)' }}>
                      {opt.icon}
                    </span>
                    <div className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{opt.label}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="px-6 py-2 text-sm rounded-lg" style={{ color: 'var(--on-surface-variant)', background: 'var(--surface-container)' }}>
                ← Back
              </button>
              <button
                onClick={() => saveStep(3)}
                disabled={!answers.audience || saving}
                className="px-8 py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                {saving ? 'Saving…' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Product Presentation ─────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-plus-jakarta)' }}>
              How should products be displayed?
            </h2>
            <p className="text-sm mb-8" style={{ color: 'var(--on-surface-variant)' }}>
              Selects compatible product card and grid variants.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              {STEP_3_OPTIONS.map((opt) => {
                const selected = answers.product_presentation === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setAnswers((p) => ({ ...p, product_presentation: opt.value }))}
                    className="p-5 rounded-2xl text-left transition-all focus:outline-none focus-visible:ring-2"
                    style={{
                      background: selected ? 'rgba(78,222,163,0.12)' : 'var(--surface-container)',
                      border: `2px solid ${selected ? 'var(--primary)' : 'var(--outline-variant)'}`,
                    }}
                    aria-pressed={selected}
                  >
                    <span className="material-symbols-outlined text-2xl mb-3 block" style={{ color: selected ? 'var(--primary)' : 'var(--on-surface-variant)' }}>
                      {opt.icon}
                    </span>
                    <div className="font-semibold mb-1" style={{ color: 'var(--on-surface)' }}>{opt.label}</div>
                    <div className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>{opt.description}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-6 py-2 text-sm rounded-lg" style={{ color: 'var(--on-surface-variant)', background: 'var(--surface-container)' }}>
                ← Back
              </button>
              <button
                onClick={() => saveStep(4)}
                disabled={!answers.product_presentation || saving}
                className="px-8 py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                {saving ? 'Saving…' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Optional Features + Compile ──────────────────────────── */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-plus-jakarta)' }}>
              Which optional sections do you want?
            </h2>
            <p className="text-sm mb-8" style={{ color: 'var(--on-surface-variant)' }}>
              You can add or remove these later. Integration-dependent features are marked.
            </p>

            {/* Summary of choices */}
            <div className="p-4 rounded-xl mb-6 flex flex-wrap gap-4 text-sm" style={{ background: 'var(--surface-container)' }}>
              <div><span style={{ color: 'var(--on-surface-variant)' }}>Style: </span><strong style={{ color: 'var(--primary)' }}>{answers.style_preference}</strong></div>
              <div><span style={{ color: 'var(--on-surface-variant)' }}>Audience: </span><strong style={{ color: 'var(--primary)' }}>{answers.audience}</strong></div>
              <div><span style={{ color: 'var(--on-surface-variant)' }}>Products: </span><strong style={{ color: 'var(--primary)' }}>{answers.product_presentation}</strong></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
              {STEP_4_OPTIONS.map((opt) => {
                const checked = answers.optional_features.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleOptional(opt.value)}
                    className="p-4 rounded-xl text-left flex items-start gap-3 transition-all focus:outline-none focus-visible:ring-2"
                    style={{
                      background: checked ? 'rgba(78,222,163,0.10)' : 'var(--surface-container)',
                      border: `2px solid ${checked ? 'var(--primary)' : 'var(--outline-variant)'}`,
                    }}
                    aria-pressed={checked}
                  >
                    <span className="material-symbols-outlined text-xl mt-0.5" style={{ color: checked ? 'var(--primary)' : 'var(--on-surface-variant)' }}>
                      {checked ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2" style={{ color: 'var(--on-surface)' }}>
                        {opt.label}
                        {opt.note && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-container-high)', color: 'var(--outline)' }}>
                            preview
                          </span>
                        )}
                      </div>
                      {opt.note && <div className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>{opt.note}</div>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Approval gate notice */}
            <div className="p-4 rounded-xl mb-6 border" style={{ borderColor: 'var(--outline-variant)', background: 'var(--surface-container)' }}>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-xl mt-0.5" style={{ color: 'var(--status-warning)' }}>info</span>
                <div className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
                  <strong style={{ color: 'var(--on-surface)' }}>Draft compilation only.</strong> This generates a versioned storefront draft.
                  The store will not be published or accessible publicly — that requires the store management workflow.
                  Your project data (category, location, budget) is prefilled from saved project records.
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="px-6 py-2 text-sm rounded-lg" style={{ color: 'var(--on-surface-variant)', background: 'var(--surface-container)' }}>
                ← Back
              </button>
              <button
                onClick={handleCompile}
                disabled={compiling}
                className="px-8 py-3 rounded-xl font-semibold text-sm disabled:opacity-40 flex items-center gap-2"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                {compiling && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />}
                {compiling ? 'Compiling…' : 'Compile Storefront Draft'}
              </button>
            </div>
          </div>
        )}

        {/* ── Variant browser (accessible from step 4) ────────────────────── */}
        {step === 4 && variants.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-plus-jakarta)' }}>
              Browse Component Catalog
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--on-surface-variant)' }}>
              {variants.length} variants available. Core components are applied automatically from your selections above.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {variants.filter(v => v.availability !== 'integration_dependent').slice(0, 18).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setPreviewVariant(previewVariant?.id === v.id ? null : v)}
                  className="p-4 rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2"
                  style={{
                    background: previewVariant?.id === v.id ? 'rgba(78,222,163,0.10)' : 'var(--surface-container)',
                    border: `1px solid ${previewVariant?.id === v.id ? 'var(--primary)' : 'var(--outline-variant)'}`,
                  }}
                >
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--on-surface-variant)' }}>
                    {v.componentType.replace(/_/g, ' ')}
                  </div>
                  <div className="font-semibold text-sm mb-1" style={{ color: 'var(--on-surface)' }}>{v.name}</div>
                  <div className="text-xs mb-2" style={{ color: 'var(--on-surface-variant)' }}>{v.description}</div>
                  <span className="px-2 py-0.5 rounded text-xs" style={{
                    background: v.availability === 'core' ? 'rgba(78,222,163,0.15)' : 'var(--surface-container-high)',
                    color: v.availability === 'core' ? 'var(--primary)' : 'var(--on-surface-variant)',
                  }}>
                    {v.availability === 'core' ? 'Core' : 'Optional'}
                  </span>
                </button>
              ))}
            </div>

            {previewVariant && (
              <div className="mt-6 p-6 rounded-2xl border" style={{ background: 'var(--surface-container-high)', borderColor: 'var(--primary)' }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold" style={{ color: 'var(--on-surface)' }}>{previewVariant.name}</h3>
                    <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>{previewVariant.description}</p>
                  </div>
                  <button onClick={() => setPreviewVariant(null)} aria-label="Close preview" className="ml-4 flex-shrink-0" style={{ color: 'var(--on-surface-variant)' }}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>
                  <strong>ID:</strong> {previewVariant.id}
                </div>

                {/* Responsive wireframe preview area */}
                <div className="mt-5">
                  <div className="flex gap-2 mb-3">
                    {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setViewport(v)}
                        className="px-3 py-1 rounded text-xs font-medium"
                        style={{
                          background: viewport === v ? 'var(--primary)' : 'var(--surface-container)',
                          color: viewport === v ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                        }}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div
                    className="rounded-xl overflow-hidden transition-all mx-auto"
                    style={{
                      width: viewport === 'desktop' ? '100%' : viewport === 'tablet' ? '640px' : '375px',
                      background: 'var(--surface-container-lowest)',
                      minHeight: '120px',
                    }}
                    role="img"
                    aria-label={`Wireframe preview of ${previewVariant.name} at ${viewport} viewport`}
                  >
                    {/* Schematic wireframe — component-type-aware placeholder */}
                    <WireframePreview variantId={previewVariant.id} componentType={previewVariant.componentType} viewport={viewport} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Inline schematic wireframe component ────────────────────────────────────
function WireframePreview({ variantId, componentType, viewport }: { variantId: string; componentType: string; viewport: Viewport }) {
  const narrow = viewport === 'mobile';
  const base = { background: 'var(--surface-container-lowest)', borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' };

  if (componentType === 'header') {
    return (
      <div className="p-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
        <div className="h-6 w-16 rounded" style={{ background: 'var(--surface-container-high)' }} />
        {!narrow && <div className="flex gap-3 flex-1">
          {[1,2,3].map(i => <div key={i} className="h-3 w-12 rounded" style={{ background: 'var(--surface-container)' }} />)}
        </div>}
        <div className="flex gap-2 ml-auto">
          {[1,2].map(i => <div key={i} className="h-5 w-5 rounded-full" style={{ background: 'var(--surface-container)' }} />)}
        </div>
      </div>
    );
  }
  if (componentType === 'hero') {
    return (
      <div className="p-6 flex flex-col gap-3 items-start" style={{ minHeight: '140px', background: 'var(--surface-container)' }}>
        <div className="h-4 rounded" style={{ width: narrow ? '80%' : '50%', background: 'var(--primary)', opacity: 0.5 }} />
        <div className="h-2 rounded w-3/4" style={{ background: 'var(--surface-container-high)' }} />
        <div className="h-8 w-28 rounded-lg mt-2" style={{ background: 'var(--primary)', opacity: 0.7 }} />
      </div>
    );
  }
  if (componentType === 'product_card') {
    return (
      <div className="p-3 grid grid-cols-3 gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="rounded-lg overflow-hidden" style={{ background: 'var(--surface-container)' }}>
            <div className="h-16 bg-[var(--surface-container-high)]" />
            <div className="p-2 space-y-1">
              <div className="h-2 rounded w-3/4" style={{ background: 'var(--surface-container-highest)' }} />
              <div className="h-2 rounded w-1/2" style={{ background: 'var(--primary)', opacity: 0.5 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (componentType === 'footer') {
    return (
      <div className="p-4" style={{ background: 'var(--surface-container-lowest)' }}>
        <div className="flex gap-6 mb-3">
          {[1,2,3].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="h-2 w-16 rounded" style={{ background: 'var(--surface-container-high)' }} />
              {[1,2,3].map(j => <div key={j} className="h-1.5 w-12 rounded" style={{ background: 'var(--outline-variant)' }} />)}
            </div>
          ))}
        </div>
        <div className="h-px mt-2" style={{ background: 'var(--outline-variant)' }} />
        <div className="mt-2 h-2 w-32 rounded" style={{ background: 'var(--outline-variant)' }} />
      </div>
    );
  }
  // Generic schematic for other types
  return (
    <div className="p-4 flex flex-col gap-2">
      <div className="h-3 rounded w-2/3" style={{ background: 'var(--surface-container-high)' }} />
      <div className="h-2 rounded w-full" style={{ background: 'var(--surface-container)' }} />
      <div className="h-2 rounded w-4/5" style={{ background: 'var(--surface-container)' }} />
      <div className="h-8 w-24 rounded mt-2" style={{ background: 'var(--primary)', opacity: 0.4 }} />
    </div>
  );
}
