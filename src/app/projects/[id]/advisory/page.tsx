'use client';

import { useEffect, useMemo, useState } from 'react';

type Language = 'en' | 'ur_roman';

interface LocalizedTextLike {
  en?: string;
  ur?: string;
  ur_roman?: string;
}

interface InsightItem {
  title: LocalizedTextLike;
  description: LocalizedTextLike;
}

interface RiskFlag {
  id: string;
  label: string;
  status: 'triggered' | 'not_triggered' | 'unknown';
  value: number | null;
  threshold: number | null;
  reason: string;
  urRomanReason: string;
}

interface RiskEngine {
  baselineRiskLevel: string | null;
  combinedRiskLevel: string | null;
  status: string;
  flags: RiskFlag[];
  triggeredFlags: string[];
  unknownFlags: string[];
  disclaimer: string;
}

interface ActionItem {
  id: string;
  title: LocalizedTextLike;
  description: LocalizedTextLike;
  priority: 'High' | 'Med' | 'Low';
  impact: string;
  effort: string;
  relatedRisk: string;
  riskStatus: string;
  status: 'open' | 'completed';
  completedAt: string | null;
}

interface SimulationResult {
  score: number | null;
  riskLevel: string | null;
  classification: string | null;
  budgetRatio: number | null;
  rentToBudgetRatio: number | null;
  deltas: { score: number | null; riskLevel: string | null };
  disclaimers: string[];
  scoringMode: string;
}

interface AdvisoryReport {
  id: string;
  projects?: { category?: string; target_location?: string; budget_currency?: string };
  project_feasibility_runs?: {
    score_value?: number | null;
    classification?: string;
    scoring_mode?: string;
    risk_level?: string | null;
  };
  budget_total: number;
  budget_currency: string;
  budget_allocations: Record<string, number>;
  insights: {
    strengths?: InsightItem[];
    risks?: InsightItem[];
    immediate_actions?: InsightItem[];
  };
  location_recommendations?: { status?: string; reason: LocalizedTextLike };
  metadata?: {
    ai_summary?: LocalizedTextLike;
    ai_provider?: LocalizedTextLike;
    ai_fallback?: { en?: boolean; ur_roman?: boolean };
    risk_engine?: RiskEngine;
    action_matrix?: ActionItem[];
    generated_from_mode?: string;
  };
}

const COPY = {
  en: {
    title: 'Strategic Advisory',
    overview: 'Project Overview',
    summary: 'AI Advisory Summary',
    source: 'Source',
    ruleBased: 'Rule-based fallback',
    risk: 'Risk Engine',
    actions: 'Priority Action Matrix',
    simulation: 'Budget Re-simulation',
    generate: 'Generate Advisory Report',
    generating: 'Generating...',
    empty: 'No advisory report yet. Generate one from the latest completed feasibility run.',
    simulate: 'Re-simulate budget',
    simulating: 'Simulating...',
    noRiskFlags: 'No rule flags were evaluated.',
    noSimulation: 'Adjust the budget and run a stored-data simulation.',
    strengths: 'Strengths',
    risks: 'Risks',
    immediate: 'Immediate Actions',
    location: 'Location Recommendations',
    noStrengths: 'No major strengths found.',
    noRisks: 'No major risks identified.',
    allocation: 'Budget Allocation (Scenario)',
    note: 'Illustrative allocation only; it does not mutate the original report.',
  },
  ur_roman: {
    title: 'Hikmat-e-Amli (Strategy)',
    overview: 'Project Jhaat',
    summary: 'AI Advisory Khulasa',
    source: 'Zariya',
    ruleBased: 'Rule-based fallback',
    risk: 'Risk Engine',
    actions: 'Tarjihatein aur Checklist',
    simulation: 'Budget Dobara Hisab',
    generate: 'Advisory Report Banayein',
    generating: 'Banaya ja raha hai...',
    empty: 'Abhi advisory report nahi hai. Latest completed feasibility run se report banayein.',
    simulate: 'Budget dobara simulate karein',
    simulating: 'Simulate ho raha hai...',
    noRiskFlags: 'Koi rule flag evaluate nahi hua.',
    noSimulation: 'Budget badlein aur stored data se simulation chalayein.',
    strengths: 'Khoobiyan',
    risks: 'Khatre',
    immediate: 'Fauri Steps',
    location: 'Jagah Ki Tajweez',
    noStrengths: 'Koi badi khoobi nahi mili.',
    noRisks: 'Koi bada khatra nahi mila.',
    allocation: 'Budget Ki Taqseem',
    note: 'Yeh sirf andaza hai; original report nahi badalta.',
  },
} as const;

function localized(value: unknown, language: Language): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as LocalizedTextLike;
  if (language === 'ur_roman') return record.ur_roman ?? record.ur ?? record.en ?? '';
  return record.en ?? '';
}

function statusLabel(status: string, language: Language): string {
  const labels = {
    triggered: language === 'en' ? 'Triggered' : 'Chalu',
    not_triggered: language === 'en' ? 'Within limit' : 'Limit ke andar',
    unknown: language === 'en' ? 'Unknown' : 'Maloom nahi',
  } as const;
  return labels[status as keyof typeof labels] ?? status;
}

function budgetBounds(currency: string) {
  return currency === 'USD'
    ? { min: 50, max: 200_000, step: 50 }
    : { min: 10_000, max: 50_000_000, step: 10_000 };
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string };
  return body.error ?? fallback;
}

export default function AdvisoryPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [report, setReport] = useState<AdvisoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [allocations, setAllocations] = useState<Record<string, number> | null>(null);
  const [budgetAmount, setBudgetAmount] = useState<number>(0);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const copy = COPY[language];

  useEffect(() => {
    params.then((value) => setProjectId(value.id));
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/projects/${projectId}/advisory`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(await readError(response, 'Failed to load the advisory report.'));
        }
        const data = await response.json() as { data: AdvisoryReport | null };
        if (!active) return;
        setReport(data.data);
        if (data.data) {
          setAllocations(data.data.budget_allocations ?? null);
          setBudgetAmount(Number(data.data.budget_total) || 0);
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load advisory.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [projectId]);

  const allocationTotal = useMemo(
    () => Object.values(allocations ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [allocations],
  );

  const handleGenerate = async () => {
    if (!projectId) return;
    setGenerating(true);
    setError('');
    try {
      const response = await fetch(`/api/projects/${projectId}/advisory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error(await readError(response, 'Unable to generate advisory.'));
      }
      const data = await response.json() as { data: AdvisoryReport };
      setReport(data.data);
      setAllocations(data.data.budget_allocations ?? null);
      setBudgetAmount(Number(data.data.budget_total) || 0);
      setSimulation(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to generate advisory.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAllocationChange = (key: string, value: number) => {
    setAllocations((current) => ({ ...(current ?? {}), [key]: value }));
  };

  const handleToggleAction = async (item: ActionItem) => {
    if (!projectId || !report || busyAction) return;
    setBusyAction(item.id);
    setError('');
    const nextCompleted = item.status !== 'completed';
    try {
      const response = await fetch(
        `/api/projects/${projectId}/advisory/actions/${encodeURIComponent(item.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: nextCompleted }),
        },
      );
      if (!response.ok) {
        throw new Error(await readError(response, 'Unable to save checklist state.'));
      }
      setReport((current) => {
        if (!current) return current;
        const matrix = current.metadata?.action_matrix ?? [];
        return {
          ...current,
          metadata: {
            ...(current.metadata ?? {}),
            action_matrix: matrix.map((entry) =>
              entry.id === item.id
                ? {
                    ...entry,
                    status: nextCompleted ? 'completed' as const : 'open' as const,
                    completedAt: nextCompleted ? new Date().toISOString() : null,
                  }
                : entry,
            ),
          },
        };
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to save checklist state.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSimulate = async () => {
    if (!projectId || !report) return;
    setSimulating(true);
    setError('');
    try {
      const response = await fetch(`/api/projects/${projectId}/advisory/simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget_amount: budgetAmount,
          budget_currency: report.budget_currency,
        }),
      });
      if (!response.ok) {
        throw new Error(await readError(response, 'Budget simulation failed.'));
      }
      const data = await response.json() as { data: SimulationResult };
      setSimulation(data.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Budget simulation failed.');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return <div className="p-8" role="status" aria-live="polite">Loading Advisory...</div>;
  }

  const bounds = budgetBounds(report?.budget_currency ?? 'PKR');
  const riskEngine = report?.metadata?.risk_engine;
  const actions = report?.metadata?.action_matrix ?? [];
  const provider = localized(report?.metadata?.ai_provider, language);
  const isFallback = language === 'en'
    ? Boolean(report?.metadata?.ai_fallback?.en)
    : Boolean(report?.metadata?.ai_fallback?.ur_roman);

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{copy.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {language === 'en'
                ? 'Stored-data advisory with transparent rules and provider disclosure.'
                : 'Stored data par mabni advisory, saaf rules aur provider disclosure ke saath.'}
            </p>
          </div>
          <div className="flex rounded-lg bg-slate-200 p-1" role="group" aria-label="Language">
            <button
              type="button"
              aria-pressed={language === 'en'}
              onClick={() => setLanguage('en')}
              className={`rounded-md px-3 py-2 text-sm font-medium ${language === 'en' ? 'bg-white shadow' : 'text-slate-600'}`}
            >
              English
            </button>
            <button
              type="button"
              aria-pressed={language === 'ur_roman'}
              onClick={() => setLanguage('ur_roman')}
              className={`rounded-md px-3 py-2 text-sm font-medium ${language === 'ur_roman' ? 'bg-white shadow' : 'text-slate-600'}`}
            >
              Roman Urdu
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        {!report && !error && (
          <section className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <p className="mb-4 text-slate-600">{copy.empty}</p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-md bg-emerald-700 px-6 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {generating ? copy.generating : copy.generate}
            </button>
          </section>
        )}

        {report && (
          <>
            {!error && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {generating ? copy.generating : copy.generate}
                </button>
              </div>
            )}

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{copy.overview}</h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Category</dt><dd className="font-medium">{report.projects?.category ?? '-'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Region</dt><dd className="font-medium">{report.projects?.target_location ?? '-'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Score</dt><dd className="font-medium">{report.project_feasibility_runs?.score_value ?? '-'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Classification</dt><dd className="font-medium">{report.project_feasibility_runs?.classification ?? '-'}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-600">Mode</dt><dd className="font-medium">{report.metadata?.generated_from_mode ?? report.project_feasibility_runs?.scoring_mode ?? '-'}</dd></div>
                </dl>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-900">{copy.summary}</h2>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isFallback ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {isFallback ? copy.ruleBased : `${copy.source}: ${provider || 'AI'}`}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {localized(report.metadata?.ai_summary, language) || copy.noStrengths}
                </p>
              </article>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">{copy.risk}</h2>
              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-md bg-slate-100 px-3 py-1">
                  {language === 'en' ? 'Baseline' : 'Bunyadi'}: {riskEngine?.baselineRiskLevel ?? '-'}
                </span>
                <span className="rounded-md bg-slate-100 px-3 py-1">
                  {language === 'en' ? 'Combined' : 'Mujhmal'}: {riskEngine?.combinedRiskLevel ?? '-'}
                </span>
                <span className="rounded-md bg-slate-100 px-3 py-1">
                  {language === 'en' ? 'Status' : 'Halat'}: {riskEngine?.status ?? '-'}
                </span>
              </div>
              {riskEngine?.flags?.length ? (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {riskEngine.flags.map((flag) => (
                    <li key={flag.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-900">{flag.label}</span>
                        <span className="text-xs font-semibold uppercase text-slate-600">{statusLabel(flag.status, language)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {language === 'en' ? flag.reason : flag.urRomanReason}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">{copy.noRiskFlags}</p>
              )}
              {riskEngine?.disclaimer && <p className="mt-4 text-xs text-slate-500">{riskEngine.disclaimer}</p>}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">{copy.actions}</h2>
              {actions.length ? (
                <ul className="space-y-3">
                  {actions.map((item) => (
                    <li key={item.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-3">
                        <input
                          id={`action-${item.id}`}
                          type="checkbox"
                          checked={item.status === 'completed'}
                          disabled={busyAction === item.id}
                          onChange={() => handleToggleAction(item)}
                          className="mt-1 h-5 w-5 accent-emerald-700"
                        />
                        <div>
                          <label htmlFor={`action-${item.id}`} className={`font-medium ${item.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                            {localized(item.title, language)}
                          </label>
                          <p className="mt-1 text-sm text-slate-600">{localized(item.description, language)}</p>
                          <p className="mt-2 text-xs text-slate-500">
                            Priority {item.priority} · Impact {item.impact} · Effort {item.effort} · Risk {item.relatedRisk}
                          </p>
                        </div>
                      </div>
                      {item.completedAt && <span className="text-xs text-slate-500">{new Date(item.completedAt).toLocaleString()}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">{language === 'en' ? 'No action items were generated.' : 'Koi action item nahi bana.'}</p>
              )}
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">{copy.simulation}</h2>
                <label htmlFor="simulation-budget" className="mb-2 block text-sm font-medium text-slate-700">
                  {language === 'en' ? 'Proposed total budget' : 'Mojooda budget'}: {budgetAmount.toLocaleString()} {report.budget_currency}
                </label>
                <input
                  id="simulation-budget"
                  type="range"
                  min={bounds.min}
                  max={bounds.max}
                  step={bounds.step}
                  value={budgetAmount}
                  onChange={(event) => setBudgetAmount(Number(event.target.value))}
                  className="w-full accent-emerald-700"
                />
                <button
                  type="button"
                  onClick={handleSimulate}
                  disabled={simulating || budgetAmount < bounds.min || budgetAmount > bounds.max}
                  className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {simulating ? copy.simulating : copy.simulate}
                </button>
                {simulation ? (
                  <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm" role="status" aria-live="polite">
                    <div className="grid grid-cols-2 gap-3">
                      <span>{language === 'en' ? 'Score' : 'Score'}: <strong>{simulation.score ?? '-'}</strong></span>
                      <span>{language === 'en' ? 'Risk' : 'Khatra'}: <strong>{simulation.riskLevel ?? '-'}</strong></span>
                      <span>Budget ratio: <strong>{simulation.budgetRatio ?? '-'}</strong></span>
                      <span>Rent ratio: <strong>{simulation.rentToBudgetRatio ?? '-'}</strong></span>
                      <span>{language === 'en' ? 'Score delta' : 'Score farq'}: <strong>{simulation.deltas.score ?? '-'}</strong></span>
                      <span>{language === 'en' ? 'Risk change' : 'Khatre mein tabdili'}: <strong>{simulation.deltas.riskLevel ?? '-'}</strong></span>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">{simulation.disclaimers.join(' ')}</p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">{copy.noSimulation}</p>
                )}
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">{copy.allocation}</h2>
                <div className="mb-4 text-xl font-bold text-slate-900">
                  {budgetAmount.toLocaleString()} <span className="text-sm font-medium text-slate-500">{report.budget_currency}</span>
                </div>
                <div className="space-y-4">
                  {['inventory', 'marketing', 'operations', 'contingency'].map((key) => (
                    <div key={key}>
                      <label htmlFor={`allocation-${key}`} className="mb-1 flex justify-between text-sm font-medium capitalize text-slate-700">
                        <span>{key}</span>
                        <span>{(allocations?.[key] ?? 0).toLocaleString()} {report.budget_currency}</span>
                      </label>
                      <input
                        id={`allocation-${key}`}
                        type="range"
                        min={0}
                        max={budgetAmount}
                        step={Math.max(1, Math.round(budgetAmount / 1000))}
                        value={allocations?.[key] ?? 0}
                        onChange={(event) => handleAllocationChange(key, Number(event.target.value))}
                        className="w-full accent-emerald-700"
                      />
                    </div>
                  ))}
                </div>
                {allocationTotal > budgetAmount && (
                  <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800" role="status">
                    {language === 'en'
                      ? 'Allocation total exceeds the proposed budget. Adjust before using this scenario.'
                      : 'Taqseem ka total budget se zayada hai. Istemal karne se pehle theek karein.'}
                  </p>
                )}
                <p className="mt-4 text-xs text-slate-500">* {copy.note}</p>
              </article>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {([
                ['strengths', copy.strengths, copy.noStrengths, 'green'],
                ['risks', copy.risks, copy.noRisks, 'red'],
                ['immediate_actions', copy.immediate, '', 'blue'],
              ] as const).map(([key, heading, emptyText, tone]) => {
                const items = report.insights[key] ?? [];
                const toneClass = tone === 'green' ? 'border-green-100 bg-green-50 text-green-900'
                  : tone === 'red' ? 'border-red-100 bg-red-50 text-red-900'
                    : 'border-blue-100 bg-blue-50 text-blue-900';
                return (
                  <article key={key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">{heading}</h2>
                    {items.length ? (
                      <div className="space-y-3">
                        {items.map((item, index) => (
                          <div key={`${key}-${index}`} className={`rounded-lg border p-3 ${toneClass}`}>
                            <div className="mb-1 font-semibold">{localized(item.title, language)}</div>
                            <div className="text-sm">{localized(item.description, language)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">{emptyText || (language === 'en' ? 'No immediate actions recorded.' : 'Koi fauri step nahi hai.')}</p>
                    )}
                  </article>
                );
              })}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-slate-900">{copy.location}</h2>
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                {report.location_recommendations?.status === 'unavailable'
                  ? localized(report.location_recommendations.reason, language)
                  : localized(report.location_recommendations, language)}
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
