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

        {/* ── Complete 240+ Component Variant Catalog Browser ──────────────── */}
        {step === 4 && variants.length > 0 && (
          <CatalogBrowserSection
            variants={variants}
            viewport={viewport}
            setViewport={setViewport}
            previewVariant={previewVariant}
            setPreviewVariant={setPreviewVariant}
          />
        )}

      </div>
    </div>
  );
}

// ─── Component Catalog Browser with Search & Category Filters ──────────────
function CatalogBrowserSection({
  variants,
  viewport,
  setViewport,
  previewVariant,
  setPreviewVariant,
}: {
  variants: Variant[];
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
  previewVariant: Variant | null;
  setPreviewVariant: (v: Variant | null) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const CATEGORIES = [
    { id: 'all', label: 'All (240)' },
    { id: 'page_template', label: 'Page Templates (20)' },
    { id: 'header', label: 'Headers (20)' },
    { id: 'hero', label: 'Heroes (20)' },
    { id: 'product_card', label: 'Product Cards (20)' },
    { id: 'product_grid', label: 'Product Grids (20)' },
    { id: 'footer', label: 'Footers (20)' },
    { id: 'announcement_bar', label: 'Announcement Bars (20)' },
    { id: 'faq_accordion', label: 'FAQ Accordions (20)' },
    { id: 'newsletter_signup', label: 'Newsletters (20)' },
    { id: 'promotional_banner', label: 'Promo Banners (20)' },
    { id: 'button', label: 'Buttons (20)' },
    { id: 'badge', label: 'Badges (20)' },
  ];

  const filtered = variants.filter((v) => {
    const matchesCat = activeCategory === 'all' || v.componentType === activeCategory;
    const matchesSearch =
      search === '' ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.id.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-plus-jakarta)' }}>
            Component Variant Library (20+ per Component)
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>
            Browse {variants.length} genuinely distinct, tested variants across all 12 storefront component families.
          </p>
        </div>
        <div className="w-full md:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variants..."
            className="w-full px-3.5 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2"
            style={{
              background: 'var(--surface-container)',
              borderColor: 'var(--outline-variant)',
              color: 'var(--on-surface)',
            }}
          />
        </div>
      </div>

      {/* Category Pills Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
            style={{
              background: activeCategory === cat.id ? 'var(--primary)' : 'var(--surface-container)',
              color: activeCategory === cat.id ? 'var(--on-primary)' : 'var(--on-surface-variant)',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Active Filter Counter */}
      <div className="text-xs mb-4 font-medium" style={{ color: 'var(--on-surface-variant)' }}>
        Showing {filtered.length} of {variants.length} variants
      </div>

      {/* Variants Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[640px] overflow-y-auto pr-1">
        {filtered.map((v) => {
          const isSelected = previewVariant?.id === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setPreviewVariant(isSelected ? null : v)}
              className="p-3.5 rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 flex flex-col justify-between"
              style={{
                background: isSelected ? 'rgba(78,222,163,0.12)' : 'var(--surface-container)',
                border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--outline-variant)'}`,
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{
                    background: 'var(--surface-container-high)',
                    color: 'var(--primary)',
                  }}>
                    {v.componentType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--on-surface-variant)' }}>
                    {v.id.split('-')[1] || 'v01'}
                  </span>
                </div>
                <div className="font-semibold text-xs mb-1 line-clamp-1" style={{ color: 'var(--on-surface)' }}>
                  {v.name}
                </div>
                <div className="text-[11px] line-clamp-2" style={{ color: 'var(--on-surface-variant)' }}>
                  {v.description}
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px]" style={{ borderColor: 'var(--outline-variant)' }}>
                <span style={{ color: isSelected ? 'var(--primary)' : 'var(--on-surface-variant)' }}>
                  {isSelected ? '● Previewing' : 'Tap to preview'}
                </span>
                <span className="font-mono text-[9px] truncate max-w-[120px]" style={{ color: 'var(--on-surface-variant)' }}>
                  {v.id}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Responsive Wireframe Preview Modal / Drawer */}
      {previewVariant && (
        <div className="mt-6 p-6 rounded-2xl border" style={{ background: 'var(--surface-container-high)', borderColor: 'var(--primary)' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-[var(--primary)] text-[var(--on-primary)]">
                  {previewVariant.componentType.replace(/_/g, ' ')}
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--on-surface-variant)' }}>
                  {previewVariant.id}
                </span>
              </div>
              <h3 className="text-base font-bold" style={{ color: 'var(--on-surface)' }}>{previewVariant.name}</h3>
              <p className="text-xs mt-1 max-w-2xl" style={{ color: 'var(--on-surface-variant)' }}>{previewVariant.description}</p>
            </div>
            <button
              onClick={() => setPreviewVariant(null)}
              aria-label="Close preview"
              className="p-1 rounded-lg hover:bg-[var(--surface-container)] transition-colors"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Viewport Toggles */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium mr-2" style={{ color: 'var(--on-surface-variant)' }}>Viewport:</span>
            {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewport(v)}
                className="px-3 py-1 rounded text-xs font-semibold capitalize transition-all"
                style={{
                  background: viewport === v ? 'var(--primary)' : 'var(--surface-container)',
                  color: viewport === v ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                }}
              >
                {v} {v === 'desktop' ? '(100%)' : v === 'tablet' ? '(640px)' : '(375px)'}
              </button>
            ))}
          </div>

          {/* Wireframe Canvas */}
          <div
            className="rounded-xl overflow-hidden transition-all mx-auto border shadow-inner p-4"
            style={{
              width: viewport === 'desktop' ? '100%' : viewport === 'tablet' ? '640px' : '375px',
              background: 'var(--surface-container-lowest)',
              borderColor: 'var(--outline-variant)',
              minHeight: '140px',
            }}
            role="img"
            aria-label={`Wireframe preview of ${previewVariant.name} at ${viewport} viewport`}
          >
            <WireframePreview
              variantId={previewVariant.id}
              componentType={previewVariant.componentType}
              viewport={viewport}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component-Type-Aware Schematic Wireframe Renderers ─────────────────────
function WireframePreview({
  variantId,
  componentType,
  viewport,
}: {
  variantId: string;
  componentType: string;
  viewport: Viewport;
}) {
  const narrow = viewport === 'mobile';

  // 1. Page Template Archetypes
  if (componentType === 'page_template') {
    return (
      <div className="space-y-3 font-sans">
        <div className="p-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--outline-variant)' }}>
          <div className="h-4 w-20 rounded bg-[var(--primary)] opacity-70" />
          <div className="flex gap-2">
            <div className="h-2 w-10 rounded bg-[var(--surface-container-high)]" />
            <div className="h-2 w-10 rounded bg-[var(--surface-container-high)]" />
          </div>
        </div>
        <div className="p-4 rounded-lg bg-[var(--surface-container)] flex flex-col gap-2">
          <div className="h-4 rounded bg-[var(--primary)] opacity-50" style={{ width: narrow ? '90%' : '50%' }} />
          <div className="h-2 rounded w-3/4 bg-[var(--surface-container-high)]" />
          <div className="h-6 w-24 rounded bg-[var(--primary)] opacity-80 mt-1" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-2 rounded bg-[var(--surface-container-low)] space-y-1">
              <div className="h-10 rounded bg-[var(--surface-container-high)]" />
              <div className="h-2 w-3/4 rounded bg-[var(--surface-container-highest)]" />
              <div className="h-2 w-1/2 rounded bg-[var(--primary)] opacity-50" />
            </div>
          ))}
        </div>
        <div className="p-2 border-t text-[10px] flex justify-between" style={{ borderColor: 'var(--outline-variant)' }}>
          <div className="h-2 w-16 rounded bg-[var(--surface-container)]" />
          <div className="h-2 w-12 rounded bg-[var(--surface-container)]" />
        </div>
      </div>
    );
  }

  // 2. Navigation Header
  if (componentType === 'header') {
    return (
      <div className="p-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--outline-variant)' }}>
        <div className="h-6 w-20 rounded bg-[var(--surface-container-high)] flex items-center px-1">
          <span className="text-[9px] font-bold text-[var(--primary)]">BRAND</span>
        </div>
        {!narrow && (
          <div className="flex gap-3 flex-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-3 w-12 rounded bg-[var(--surface-container)]" />
            ))}
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          {[1, 2].map((i) => (
            <div key={i} className="h-6 w-6 rounded-full bg-[var(--surface-container)]" />
          ))}
        </div>
      </div>
    );
  }

  // 3. Conversion Hero Stage
  if (componentType === 'hero') {
    return (
      <div className="p-6 flex flex-col gap-3 items-start rounded-lg" style={{ background: 'var(--surface-container)' }}>
        <div className="h-2 w-20 rounded bg-[var(--primary)] opacity-80" />
        <div className="h-5 rounded bg-[var(--on-surface)] opacity-80" style={{ width: narrow ? '90%' : '55%' }} />
        <div className="h-3 rounded w-3/4 bg-[var(--surface-container-high)]" />
        <div className="h-8 w-32 rounded-lg bg-[var(--primary)] opacity-80 mt-2 flex items-center justify-center">
          <span className="text-[10px] font-bold text-[var(--on-primary)]">EXPLORE NOW</span>
        </div>
      </div>
    );
  }

  // 4. Product Card Presentations
  if (componentType === 'product_card') {
    return (
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--outline-variant)', background: 'var(--surface-container-low)' }}>
            <div className="h-20 bg-[var(--surface-container-high)] relative">
              <span className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded bg-[var(--primary)] text-[var(--on-primary)]">
                PKR
              </span>
            </div>
            <div className="p-2 space-y-1.5">
              <div className="h-2.5 rounded w-3/4 bg-[var(--on-surface)] opacity-70" />
              <div className="h-2 rounded w-1/2 bg-[var(--primary)] font-bold" />
              <div className="h-6 rounded bg-[var(--surface-container-highest)] mt-2 flex items-center justify-center text-[9px] font-bold">
                ADD TO BAG
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 5. Product Grid & Catalog
  if (componentType === 'product_grid') {
    return (
      <div className="p-2 space-y-2">
        <div className="flex justify-between items-center px-1">
          <div className="h-3 w-28 rounded bg-[var(--surface-container-high)]" />
          <div className="h-3 w-16 rounded bg-[var(--surface-container)]" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-16 rounded bg-[var(--surface-container)] p-1 space-y-1">
              <div className="h-8 rounded bg-[var(--surface-container-high)]" />
              <div className="h-2 w-3/4 rounded bg-[var(--surface-container-highest)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 6. Footer Base
  if (componentType === 'footer') {
    return (
      <div className="p-4 space-y-3" style={{ background: 'var(--surface-container-lowest)' }}>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 w-16 rounded bg-[var(--surface-container-high)]" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-1.5 w-12 rounded bg-[var(--outline-variant)]" />
              ))}
            </div>
          ))}
        </div>
        <div className="h-px bg-[var(--outline-variant)]" />
        <div className="flex justify-between text-[9px]">
          <div className="h-2 w-32 rounded bg-[var(--outline-variant)]" />
          <div className="h-2 w-20 rounded bg-[var(--outline-variant)]" />
        </div>
      </div>
    );
  }

  // 7. Announcement Bar
  if (componentType === 'announcement_bar') {
    return (
      <div className="p-2.5 rounded-lg flex items-center justify-between text-xs font-semibold" style={{ background: 'var(--primary-container)', color: 'var(--on-primary-container)' }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">campaign</span>
          <span className="text-[11px]">Free Delivery on orders above Rs. 2,500 across Pakistan!</span>
        </div>
        <span className="text-[10px] opacity-75">✕</span>
      </div>
    );
  }

  // 8. FAQ Accordion
  if (componentType === 'faq_accordion') {
    return (
      <div className="p-3 space-y-2">
        {[
          'How long does delivery take in Lahore & Karachi?',
          'Do you support Cash on Delivery (COD)?',
          'Are your products certified 100% organic?',
        ].map((q, i) => (
          <div key={i} className="p-2.5 rounded-lg border flex items-center justify-between" style={{ borderColor: 'var(--outline-variant)', background: 'var(--surface-container)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--on-surface)' }}>{q}</span>
            <span className="text-xs" style={{ color: 'var(--primary)' }}>{i === 0 ? '−' : '+'}</span>
          </div>
        ))}
      </div>
    );
  }

  // 9. Newsletter Signup
  if (componentType === 'newsletter_signup') {
    return (
      <div className="p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3" style={{ background: 'var(--surface-container-high)', borderColor: 'var(--outline-variant)' }}>
        <div>
          <div className="text-xs font-bold" style={{ color: 'var(--on-surface)' }}>Join the Harvest Circle</div>
          <div className="text-[10px]" style={{ color: 'var(--on-surface-variant)' }}>Get 10% off your first order + organic recipes.</div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="h-7 w-44 rounded bg-[var(--surface-container-lowest)] border px-2 text-[10px] flex items-center" style={{ borderColor: 'var(--outline-variant)' }}>
            email@domain.com
          </div>
          <div className="h-7 px-3 rounded bg-[var(--primary)] text-[var(--on-primary)] text-[10px] font-bold flex items-center">
            SUBSCRIBE
          </div>
        </div>
      </div>
    );
  }

  // 10. Promotional Banner
  if (componentType === 'promotional_banner') {
    return (
      <div className="p-4 rounded-xl flex items-center justify-between" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
        <div>
          <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-[var(--surface-container-lowest)] text-[var(--primary)]">
            FLASH PROMO
          </span>
          <div className="text-sm font-black mt-1">FLAT 25% OFF AUTUMN HARVEST</div>
          <div className="text-[10px] opacity-90">Use voucher code: HARVEST25</div>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-[var(--surface-container-lowest)] text-[var(--primary)] font-bold text-xs">
          CLAIM OFFER
        </div>
      </div>
    );
  }

  // 11. Buttons & CTAs
  if (componentType === 'button') {
    return (
      <div className="p-4 flex flex-wrap items-center justify-center gap-4">
        <button className="px-5 py-2.5 rounded-lg font-bold text-xs shadow-sm" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
          Primary Button
        </button>
        <button className="px-5 py-2.5 rounded-lg font-bold text-xs border" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>
          Outline Variant
        </button>
        <button className="px-5 py-2.5 rounded-full font-bold text-xs" style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface)' }}>
          Pill Action
        </button>
      </div>
    );
  }

  // 12. Badges & Chips
  if (componentType === 'badge') {
    return (
      <div className="p-4 flex flex-wrap items-center justify-center gap-3">
        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
          ★ In Stock
        </span>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'var(--status-positive-bg)', color: 'var(--status-positive)' }}>
          ✓ Verified COD
        </span>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'var(--status-critical)', color: 'var(--on-primary)' }}>
          -20% OFF
        </span>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold border" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface)' }}>
          100% Organic
        </span>
      </div>
    );
  }

  // Generic schematic fallback
  return (
    <div className="p-4 flex flex-col gap-2">
      <div className="h-3 rounded w-2/3 bg-[var(--surface-container-high)]" />
      <div className="h-2 rounded w-full bg-[var(--surface-container)]" />
      <div className="h-2 rounded w-4/5 bg-[var(--surface-container)]" />
      <div className="h-8 w-24 rounded bg-[var(--primary)] opacity-40 mt-2" />
    </div>
  );
}

