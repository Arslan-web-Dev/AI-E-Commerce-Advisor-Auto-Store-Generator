'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  findPalette,
  HERO_OPTIONS,
  NAVBAR_OPTIONS,
  PALETTE_OPTIONS,
  PRODUCT_GRID_OPTIONS,
} from '@/lib/theme/options';
import {
  isValidAnswerDraft,
  isValidThemeConfiguration,
  type ThemeAnswers,
  type ThemeConfiguration,
  type ThemeColors,
} from '@/lib/theme/schema';
import type { ThemeHistoryEntry, ThemeState } from '@/lib/theme/persistence';

type Step = 1 | 2 | 3 | 4;
type Stage = 'wizard' | 'review' | 'result';
type Viewport = 'desktop' | 'tablet' | 'mobile';
type Busy = 'draft' | 'generate' | 'save' | null;

type OptionItem = {
  id: string;
  label: string;
  description: string;
  preview?: string;
  swatches?: readonly string[];
};

type StepDefinition = {
  step: Step;
  key: keyof ThemeAnswers;
  label: string;
  hint: string;
  options: readonly OptionItem[];
};

const STEPS: readonly StepDefinition[] = [
  {
    step: 1,
    key: 'paletteId',
    label: 'Colour palette',
    hint: 'Choose the visual tone for the store.',
    options: PALETTE_OPTIONS,
  },
  {
    step: 2,
    key: 'navbarStyle',
    label: 'Navbar style',
    hint: 'Choose how navigation is arranged.',
    options: NAVBAR_OPTIONS,
  },
  {
    step: 3,
    key: 'heroStyle',
    label: 'Hero section',
    hint: 'Choose the first impression visitors see.',
    options: HERO_OPTIONS,
  },
  {
    step: 4,
    key: 'productGrid',
    label: 'Product grid layout',
    hint: 'Choose how catalogue cards are arranged.',
    options: PRODUCT_GRID_OPTIONS,
  },
];

const CONTRAST_LABELS: Record<keyof ThemeConfiguration['generation']['contrast'], string> = {
  primaryOnSurface: 'Primary on surface (large text / UI)',
  secondaryOnSurface: 'Secondary on surface (large text / UI)',
  onPrimaryOnPrimary: 'Text on primary (normal text)',
  onSurfaceOnSurface: 'Text on surface (normal text)',
};

async function apiRequest<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined
    ? undefined
    : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
  const payload: unknown = await response.json().catch(() => ({}));
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  if (!response.ok) {
    throw new Error(typeof record.error === 'string' ? record.error : 'The theme request failed.');
  }
  return record.data as T;
}

function OptionVisual({ stepKey, option }: { stepKey: keyof ThemeAnswers; option: OptionItem }) {
  if (stepKey === 'paletteId') {
    return (
      <span className="flex gap-1" aria-hidden="true">
        {(option.swatches ?? []).map((color) => (
          <span key={color} className="h-7 w-7 rounded-md border border-white/20" style={{ background: color }} />
        ))}
      </span>
    );
  }

  if (stepKey === 'navbarStyle') {
    const alignment = option.preview ?? 'left';
    return (
      <span className="flex h-8 w-full items-center rounded-md border border-white/10 bg-black/25 px-2" aria-hidden="true">
        <span className={`flex items-center gap-1 ${alignment === 'split' ? 'w-full justify-between' : alignment === 'floating' ? 'mx-auto w-3/4 justify-center rounded-full bg-white/15' : alignment === 'centered' ? 'w-full justify-center' : 'w-full justify-start'}`}>
          <span className="h-2 w-6 rounded-sm bg-current opacity-70" />
          <span className="h-1.5 w-8 rounded-sm bg-current opacity-30" />
          <span className="h-1.5 w-8 rounded-sm bg-current opacity-30" />
        </span>
      </span>
    );
  }

  if (stepKey === 'heroStyle') {
    return (
      <span className="flex h-10 w-full gap-1.5" aria-hidden="true">
        <span className={`${option.preview === 'full' ? 'w-full' : 'w-1/2'} flex flex-col justify-center gap-1 rounded-sm border border-white/10 bg-black/25 p-1.5`}>
          <span className="h-1.5 w-4/5 rounded-sm bg-current opacity-70" />
          <span className="h-1.5 w-3/5 rounded-sm bg-current opacity-30" />
        </span>
        {option.preview !== 'full' && (
          <span className={`${option.preview === 'editorial' ? 'w-1/5' : 'w-1/2'} rounded-sm border border-white/10 bg-white/10`} />
        )}
      </span>
    );
  }

  const columns = option.preview === 'two' ? 2 : option.preview === 'four' ? 4 : option.preview === 'featured' ? 3 : 3;
  return (
    <span className="grid w-full gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-hidden="true">
      {Array.from({ length: columns }, (_, index) => (
        <span key={index} className={`${option.preview === 'featured' && index === 0 ? 'row-span-2' : ''} h-5 rounded-sm border border-white/10 bg-white/10`} />
      ))}
      {option.preview === 'featured' && <><span className="h-5 rounded-sm bg-white/10" /><span className="h-5 rounded-sm bg-white/10" /></>}
    </span>
  );
}

function LivePreview({
  answers,
  colors,
  viewport,
}: {
  answers: Partial<ThemeAnswers>;
  colors: ThemeColors;
  viewport: Viewport;
}) {
  const navbar = NAVBAR_OPTIONS.find((option) => option.id === answers.navbarStyle)?.preview ?? 'left';
  const hero = HERO_OPTIONS.find((option) => option.id === answers.heroStyle)?.preview ?? 'split';
  const gridColumns = PRODUCT_GRID_OPTIONS.find((option) => option.id === answers.productGrid)?.preview === 'two'
    ? 2
    : PRODUCT_GRID_OPTIONS.find((option) => option.id === answers.productGrid)?.preview === 'four'
      ? 4
      : 3;
  const widths: Record<Viewport, string> = { desktop: '100%', tablet: 'min(100%, 42rem)', mobile: 'min(100%, 24rem)' };

  return (
    <div
      role="img"
      aria-label={`Live storefront preview: navbar ${answers.navbarStyle ?? 'not selected'}, hero ${answers.heroStyle ?? 'not selected'}, ${gridColumns} product columns.`}
      className="mx-auto overflow-hidden rounded-xl border shadow-lg"
      style={{
        ...({
          '--pv-primary': colors.primary,
          '--pv-secondary': colors.secondary,
          '--pv-surface': colors.surface,
          '--pv-on-surface': colors.onSurface,
        } as CSSProperties),
        width: widths[viewport],
        background: colors.surface,
        color: colors.onSurface,
        borderColor: colors.primary,
      }}
    >
      <div className={`flex items-center gap-2 border-b border-white/10 px-3 py-2 ${navbar === 'centered' ? 'justify-center' : navbar === 'split' ? 'justify-between' : navbar === 'floating' ? 'm-2 w-[calc(100%-1rem)] rounded-full bg-white/10' : 'justify-start'}`}>
        <span className="h-2.5 w-10 rounded-sm" style={{ background: colors.primary }} />
        <span className="h-1.5 w-12 rounded-sm opacity-40" />
        <span className="h-1.5 w-12 rounded-sm opacity-40" />
        {navbar === 'split' && <span className="h-4 w-10 rounded-full" style={{ background: colors.secondary }} />}
      </div>
      <div className={`flex gap-3 px-4 py-5 ${hero === 'full' ? 'flex-col text-center' : hero === 'editorial' ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`${hero === 'full' ? 'w-full' : hero === 'minimal' ? 'w-3/4' : 'w-1/2'} space-y-2`}>
          <span className="block h-3 w-4/5 rounded-sm" style={{ background: colors.primary }} />
          <span className="block h-2 w-3/5 rounded-sm opacity-50" />
          <span className="mt-2 inline-block h-4 w-16 rounded-full" style={{ background: colors.secondary }} />
        </div>
        {hero !== 'minimal' && (
          <div className={`${hero === 'editorial' ? 'w-1/4' : 'w-1/2'} min-h-16 rounded-md bg-white/10`} />
        )}
      </div>
      <div className="px-4 pb-4">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}>
          {Array.from({ length: Math.min(gridColumns * 2, 8) }, (_, index) => (
            <div key={index} className="rounded-md border border-white/10 bg-white/5 p-1.5">
              <span className="block aspect-square w-full rounded-sm bg-white/10" />
              <span className="mt-1 block h-1.5 w-3/4 rounded-sm bg-current opacity-40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ThemeConfigurator({ projectId }: { projectId: string }) {
  const [step, setStep] = useState<Step>(1);
  const [stage, setStage] = useState<Stage>('wizard');
  const [answers, setAnswers] = useState<Partial<ThemeAnswers>>({});
  const [generated, setGenerated] = useState<ThemeConfiguration | null>(null);
  const [configuration, setConfiguration] = useState<ThemeConfiguration | null>(null);
  const [history, setHistory] = useState<ThemeHistoryEntry[]>([]);
  const [projectName, setProjectName] = useState('Store');
  const [storeVersion, setStoreVersion] = useState<number | null>(null);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [unsaved, setUnsaved] = useState(false);

  const loadState = useCallback(async (id: string) => {
    const data = await apiRequest<ThemeState>(`/api/projects/${id}/theme-configurator`);
    if (isValidAnswerDraft(data.draft?.answers)) setAnswers(data.draft.answers);
    if (data.draft?.step >= 1 && data.draft.step <= 4) setStep(data.draft.step as Step);
    if (data.configuration && isValidThemeConfiguration(data.configuration)) {
      setConfiguration(data.configuration);
      setGenerated(data.configuration);
    }
    setHistory(Array.isArray(data.history) ? data.history : []);
    setProjectName(data.project?.name ?? 'Store');
    setStoreVersion(data.store?.version ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        await loadState(projectId);
        if (active) setStage('wizard');
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load the configurator.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void init();
    return () => { active = false; };
  }, [projectId, loadState]);

  const completeAnswers = useMemo<ThemeAnswers | null>(() => {
    if (!answers.paletteId || !answers.navbarStyle || !answers.heroStyle || !answers.productGrid) return null;
    return {
      paletteId: answers.paletteId,
      navbarStyle: answers.navbarStyle,
      heroStyle: answers.heroStyle,
      productGrid: answers.productGrid,
    };
  }, [answers]);

  const previewColors = useMemo<ThemeColors>(() => {
    if (generated?.colors) return generated.colors;
    if (configuration?.colors) return configuration.colors;
    const palette = findPalette(answers.paletteId ?? 'emerald_night');
    return {
      ...palette.colors,
      onPrimary: '#FFFFFF',
      onSurface: '#FFFFFF',
    };
  }, [generated, configuration, answers.paletteId]);

  const persistDraft = async (target: Step) => {
    setBusy('draft');
    setError('');
    try {
      await apiRequest(`/api/projects/${projectId}/theme-configurator`, {
        action: 'save_draft',
        answers,
        step: target,
      });
      setStep(target);
      setStatus(`Step ${target} selections saved.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Selections could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const handleGenerate = async () => {
    if (!completeAnswers) {
      setError('Answer all four questions before generating a theme.');
      return;
    }
    setBusy('generate');
    setError('');
    setStatus('');
    try {
      const data = await apiRequest<ThemeConfiguration>(`/api/projects/${projectId}/theme-configurator`, {
        action: 'generate',
        answers: completeAnswers,
      });
      setGenerated(data);
      setUnsaved(true);
      setStage('result');
      setStatus(data.generation.fallback
        ? 'Groq was unavailable or returned invalid data; an approved deterministic preset was used.'
        : 'Theme generated by the server-side Groq provider.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Theme generation failed.');
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    if (!completeAnswers || !generated) {
      setError('Generate a validated theme before saving.');
      return;
    }
    setBusy('save');
    setError('');
    try {
      const data = await apiRequest<{ version: number; previousPreserved: boolean }>(`/api/projects/${projectId}/theme-configurator`, {
        action: 'save',
        answers: completeAnswers,
        configuration: generated,
      });
      await loadState(projectId);
      setUnsaved(false);
      setStage('result');
      setStatus(data.previousPreserved
        ? `Saved as version ${data.version}; the previous configuration is preserved in history.`
        : `Saved as version ${data.version}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Theme could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const handleReRun = () => {
    setUnsaved(false);
    setStage('review');
    setStatus('Ready to run the configurator again. Your answers are preserved.');
  };

  if (loading) {
    return (
      <div className="flex min-h-[24rem] items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8" style={{ color: 'var(--on-surface)' }}>
        <div className="flex flex-col items-center gap-3">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" aria-hidden="true" />
          <p className="text-sm">Loading theme configurator…</p>
        </div>
      </div>
    );
  }

  const currentStep = STEPS[step - 1];

  return (
    <section className="space-y-6" aria-labelledby="theme-configurator-heading">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] opacity-60">Module 7 · Interactive configurator</p>
          <h2 id="theme-configurator-heading" className="mt-1 text-2xl font-bold" style={{ color: 'var(--on-surface)' }}>
            Configure {projectName}
          </h2>
          <p className="mt-1 text-sm opacity-70">Answer four visual questions, review the live preview, then generate and save a validated theme.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs" style={{ color: 'var(--on-surface-variant)' }}>
            {storeVersion === null ? 'No saved version' : `Saved v${storeVersion}`}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs" style={{ color: 'var(--on-surface-variant)' }}>
            {history.length} history {history.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </header>

      <div aria-live="polite" className="space-y-2">
        {error && (
          <div role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}
        {status && !error && (
          <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{status}</p>
        )}
      </div>

      {stage === 'wizard' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Configurator steps">
              {STEPS.map((definition) => (
                <li key={definition.step}>
                  <button
                    type="button"
                    onClick={() => definition.step < step ? void persistDraft(definition.step) : undefined}
                    disabled={definition.step > step || busy !== null}
                    aria-current={definition.step === step ? 'step' : undefined}
                    className={`w-full rounded-lg border px-2 py-2 text-left text-xs transition ${definition.step === step ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-white/10'} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <span className="block font-semibold">{definition.step}. {definition.label}</span>
                    <span className="block opacity-60">{definition.step < step ? 'Saved' : definition.step === step ? 'Current' : 'Next'}</span>
                  </button>
                </li>
              ))}
            </ol>

            <fieldset>
              <legend className="text-lg font-semibold" style={{ color: 'var(--on-surface)' }}>{currentStep.label}</legend>
              <p className="mt-1 text-sm opacity-70">{currentStep.hint}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {currentStep.options.map((option) => {
                  const selected = answers[currentStep.key] === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`relative flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--primary)] ${selected ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-white/10 bg-black/10 hover:border-white/25'}`}
                    >
                      <input
                        type="radio"
                        name={currentStep.key}
                        value={option.id}
                        checked={selected}
                        onChange={() => setAnswers((previous) => ({ ...previous, [currentStep.key]: option.id }) as Partial<ThemeAnswers>)}
                        className="absolute h-px w-px opacity-0"
                      />
                      <OptionVisual stepKey={currentStep.key} option={option} />
                      <span>
                        <span className="block text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>{option.label}</span>
                        <span className="mt-0.5 block text-xs opacity-65">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void persistDraft((step - 1) as Step)}
                disabled={step === 1 || busy !== null}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === 'draft' ? 'Saving…' : 'Back'}
              </button>
              <button
                type="button"
                onClick={() => step < 4
                  ? void persistDraft((step + 1) as Step)
                  : setStage('review')}
                disabled={!answers[currentStep.key] || busy !== null}
                className="rounded-lg px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                {busy === 'draft' ? 'Saving…' : step === 4 ? 'Review answers' : 'Continue'}
              </button>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>Live preview</h3>
              <div className="flex gap-1" role="group" aria-label="Preview viewport">
                {(['desktop', 'tablet', 'mobile'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setViewport(value)}
                    aria-pressed={viewport === value}
                    className={`rounded-md border px-2 py-1 text-xs capitalize ${viewport === value ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-white/10'}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <LivePreview answers={answers} colors={previewColors} viewport={viewport} />
            <p className="text-xs opacity-60">Preview updates from your current selections. Colours are WCAG-checked before saving.</p>
          </aside>
        </div>
      )}

      {stage === 'review' && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--on-surface)' }}>Review your answers</h3>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {STEPS.map((definition) => (
              <div key={definition.step} className="rounded-lg border border-white/10 bg-black/10 p-3">
                <dt className="text-xs opacity-60">{definition.label}</dt>
                <dd className="mt-1 text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>
                  {definition.options.find((option) => option.id === answers[definition.key])?.label ?? 'Not selected'}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStage('wizard')}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm"
            >
              Edit answers
            </button>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={!completeAnswers || busy !== null}
              className="rounded-lg px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
            >
              {busy === 'generate' ? 'Generating…' : 'Generate theme'}
            </button>
          </div>
        </div>
      )}

      {stage === 'result' && generated && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--on-surface)' }}>Generated theme</h3>
              <span className={`rounded-full px-3 py-1 text-xs ${generated.generation.fallback ? 'bg-amber-400/15 text-amber-100' : 'bg-emerald-400/15 text-emerald-100'}`}>
                {generated.generation.fallback ? 'Deterministic preset fallback' : 'Groq generated'}
              </span>
              {unsaved && <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs text-sky-100">Unsaved</span>}
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="opacity-60">Provider / model</dt><dd className="text-right">{generated.generation.provider} · {generated.generation.model}</dd></div>
              <div className="flex justify-between gap-3"><dt className="opacity-60">Attempts</dt><dd>{generated.generation.attempts}</dd></div>
              <div className="flex justify-between gap-3"><dt className="opacity-60">Adjusted colours</dt><dd className="text-right">{generated.generation.adjustedColors.length ? generated.generation.adjustedColors.join(', ') : 'None required'}</dd></div>
            </dl>
            <div className="mt-4 grid grid-cols-5 gap-2" aria-label="Generated colour tokens">
              {Object.entries(generated.colors).map(([token, color]) => (
                <div key={token} className="rounded-lg border border-white/10 p-2 text-center">
                  <span className="block h-8 w-full rounded-md border border-white/20" style={{ background: color }} />
                  <span className="mt-1 block truncate text-[10px] opacity-60">{token}</span>
                  <span className="block text-[10px] font-mono">{color}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--on-surface)' }}>WCAG AA contrast</h4>
              <ul className="mt-2 space-y-1 text-xs">
                {(Object.entries(generated.generation.contrast) as Array<[keyof typeof CONTRAST_LABELS, number]>).map(([key, ratio]) => {
                  const threshold = key.startsWith('on') ? 4.5 : 3;
                  return (
                    <li key={key} className="flex justify-between gap-3">
                      <span className="opacity-70">{CONTRAST_LABELS[key]}</span>
                      <span className={ratio >= threshold ? 'text-emerald-200' : 'text-amber-200'}>{ratio.toFixed(2)}:1 / {threshold}:1</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!unsaved || busy !== null}
                className="rounded-lg px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}
              >
                {busy === 'save' ? 'Saving…' : 'Save new configuration'}
              </button>
              <button type="button" onClick={handleReRun} disabled={busy !== null} className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-40">Run again</button>
              <button type="button" onClick={() => setStage('wizard')} disabled={busy !== null} className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-40">Edit answers</button>
            </div>
          </div>
          <aside className="space-y-3">
            <LivePreview answers={generated.answers} colors={generated.colors} viewport={viewport} />
            <div className="flex gap-1" role="group" aria-label="Saved preview viewport">
              {(['desktop', 'tablet', 'mobile'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setViewport(value)}
                  aria-pressed={viewport === value}
                  className={`rounded-md border px-2 py-1 text-xs capitalize ${viewport === value ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-white/10'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5" aria-labelledby="theme-history-heading">
        <h3 id="theme-history-heading" className="text-lg font-semibold" style={{ color: 'var(--on-surface)' }}>Saved history</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm opacity-60">No previous configurations. Saving a new theme will create the first version.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {history.map((entry) => (
              <li key={entry.id || entry.label} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm">
                <span className="font-semibold" style={{ color: 'var(--on-surface)' }}>{entry.label || `v${entry.version}`}</span>
                <span className="text-xs opacity-60">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Time unavailable'}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${entry.valid ? 'bg-emerald-400/15 text-emerald-100' : 'bg-slate-400/15 text-slate-200'}`}>
                  {entry.valid ? 'Valid current schema' : 'Legacy snapshot'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
