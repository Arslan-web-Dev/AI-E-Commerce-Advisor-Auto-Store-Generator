'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Project,
  ProjectFormData,
  PREDEFINED_CATEGORIES,
  AGE_GROUP_OPTIONS,
  GENDER_OPTIONS,
  INCOME_LEVEL_OPTIONS,
  BUSINESS_SCALE_OPTIONS,
  FOOTPRINT_OPTIONS,
  EXCHANGE_RATE_USD_TO_PKR,
  BudgetCurrency,
  BusinessModel,
} from '@/types/project';
import {
  PAKISTAN_REGIONS,
  DEFAULT_REGION_NAME,
  getRegion,
  getDistrict,
  getCitiesForDistrict,
  getHubPresetsForRegion,
} from '@/lib/geo/pakistan-geography';
import type { CommercialHubPreset } from '@/lib/geo/pakistan-geography';
import { validateProjectStep, validateCompleteProject } from '@/lib/validation/project';

interface BusinessIdeaWizardProps {
  initialProjectId?: string;
}

export default function BusinessIdeaWizard({ initialProjectId }: BusinessIdeaWizardProps) {
  const router = useRouter();

  // Wizard state: Unified 3-step architecture (SRS v1.0 Reconciliation)
  const [currentStep, setCurrentStep] = useState(1);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [loading, setLoading] = useState(!!initialProjectId);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State: Strictly neutral, non-fabricated defaults (SRS FR-2.1)
  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    category: '',
    custom_category: '',
    target_location: '',
    city: '',
    district: '',
    region: DEFAULT_REGION_NAME,
    country: 'Pakistan',
    postal_code: '',
    lat: undefined,
    lng: undefined,
    radius_km: 10,
    budget_amount: 0,
    budget_currency: 'PKR',
    target_audience: {
      age_group: '',
      gender: '',
      income_level: '',
    },
    business_scale: 'small',
    business_model: 'hybrid',
    storefront_footprint: 'boutique',
    product_description: '',
    product_types: [],
    current_step: 1,
  });

  const [productTypeInput, setProductTypeInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  const autosaveErrorShownRef = useRef(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // 1. Draft Restoration: Restores actual saved values without fabricating defaults
  useEffect(() => {
    if (!initialProjectId) return;

    async function fetchProject() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${initialProjectId}`);
        if (!res.ok) {
          const errData = await res.json();
          showToast(errData.error || 'Failed to load project draft', 'error');
          router.push('/projects');
          return;
        }

        const data = await res.json();
        const p: Project = data.project;

        if (p.status !== 'draft') {
          showToast('This project was already submitted. Viewing submission details.', 'success');
          router.push(`/projects/${p.id}`);
          return;
        }

        // Restore saved draft properties strictly from database record
        setFormData({
          title: p.title || '',
          category: p.category || '',
          custom_category: p.custom_category || '',
          target_location: p.target_location || '',
          city: p.city || '',
          district: p.district || '',
          region: p.region || DEFAULT_REGION_NAME,
          country: p.country || 'Pakistan',
          postal_code: p.postal_code || '',
          lat: p.lat ?? undefined,
          lng: p.lng ?? undefined,
          radius_km: Math.min(15, Math.max(5, Math.round(p.radius_km || 10))),
          budget_amount: Number(p.budget_amount) || 0,
          budget_currency: p.budget_currency || 'PKR',
          target_audience: p.target_audience || {},
          business_scale: p.business_scale || 'small',
          business_model: p.business_model || 'hybrid',
          storefront_footprint: p.storefront_footprint || 'boutique',
          product_description: p.product_description || '',
          product_types: p.product_types || [],
          product_file_url: p.product_file_url || undefined,
          product_file_name: p.product_file_name || undefined,
          product_file_size: p.product_file_size || undefined,
          current_step: Math.min(3, Math.max(1, p.current_step || 1)),
        });

        if (p.product_file_name) {
          setUploadedFileName(p.product_file_name);
        }

        if (p.current_step && p.current_step >= 1 && p.current_step <= 3) {
          setCurrentStep(p.current_step);
        }
        setAutosaveError(null);
        autosaveErrorShownRef.current = false;
        setLastSavedTime(new Date(p.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch {
        showToast('Error connecting to project service', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [initialProjectId, router]);

  // 2. Save Draft Action (Local & Server-persisted)
  // `silent` suppresses only the success toast: every failure is persisted in the
  // status strip and notified once, including debounced autosave failures.
  const saveDraft = useCallback(
    async (stepToSave?: number, silent = false): Promise<boolean> => {
      try {
        setSavingDraft(true);

        const targetStep = stepToSave || currentStep;
        const payload = {
          ...formData,
          current_step: targetStep,
          title:
            formData.title ||
            (formData.category
              ? `${formData.category} - ${formData.city || formData.target_location.split(',')[0] || formData.region || 'Pakistan'} Venture`
              : 'New Business Concept'),
          // Explicit nulls allow PATCH to clear an attachment the user removed.
          product_file_url: formData.product_file_url ?? null,
          product_file_name: formData.product_file_name ?? null,
          product_file_size: formData.product_file_size ?? null,
        };

        let res: Response;
        if (projectId) {
          res = await fetch(`/api/projects/${projectId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } else {
          res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }

        if (res.ok) {
          const data = await res.json();
          if (!projectId && data.project?.id) {
            setProjectId(data.project.id);
            window.history.replaceState(null, '', `/wizard/${data.project.id}`);
          }
          setAutosaveError(null);
          autosaveErrorShownRef.current = false;
          setLastSavedTime(
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          );
          if (!silent) showToast('Draft saved successfully', 'success');
          return true;
        }

        const err = await res.json().catch(() => ({}));
        const message = err.error || 'Failed to save draft';
        setAutosaveError(message);
        if (!autosaveErrorShownRef.current) {
          showToast(message, 'error');
          autosaveErrorShownRef.current = true;
        }
        return false;
      } catch {
        const message = 'Network error while saving draft';
        setAutosaveError(message);
        if (!autosaveErrorShownRef.current) {
          showToast(message, 'error');
          autosaveErrorShownRef.current = true;
        }
        return false;
      } finally {
        setSavingDraft(false);
      }
    },
    [currentStep, formData, projectId]
  );

  // 3. Real Debounced Autosave (1500ms delay after field edits)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (loading || submitting) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      if (
        formData.category ||
        formData.title ||
        formData.target_location ||
        (formData.budget_amount && formData.budget_amount > 0)
      ) {
        saveDraft(currentStep, true);
      }
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [formData, currentStep, loading, submitting, saveDraft]);

  // 4. Step Navigation with Validation Gatekeeping
  const goToStep = async (step: number) => {
    if (step > currentStep) {
      const stepVal = validateProjectStep(currentStep, formData);
      if (!stepVal.valid) {
        setErrors(stepVal.errors);
        showToast('Please complete the required fields before continuing', 'error');
        return;
      }
    }

    setErrors({});
    setCurrentStep(step);
    await saveDraft(step, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = () => {
    if (currentStep < 3) {
      goToStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  };

  // 5. Final Submission Trigger (Atomic & Idempotent via /api/projects/[id]/submit)
  const handleSubmit = async () => {
    const fullValidation = validateCompleteProject(formData);
    if (!fullValidation.valid) {
      setErrors(fullValidation.errors);
      showToast('Validation errors found. Please review the highlighted fields.', 'error');
      return;
    }

    try {
      setSubmitting(true);

      // Ensure draft exists and contains the latest form state before submitting.
      const draftPayload = {
        ...formData,
        current_step: 3,
        product_file_url: formData.product_file_url ?? null,
        product_file_name: formData.product_file_name ?? null,
        product_file_size: formData.product_file_size ?? null,
      };

      let currentProjId = projectId;
      if (!currentProjId) {
        const createRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftPayload),
        });
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          showToast(err.error || 'Failed to initialize project record', 'error');
          setSubmitting(false);
          return;
        }
        const createData = await createRes.json();
        currentProjId = createData.project.id;
        setProjectId(currentProjId);
      } else {
        // Never submit stale database state: a failed final save blocks submission.
        const saveRes = await fetch(`/api/projects/${currentProjId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftPayload),
        });
        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({}));
          const message = err.error || 'Failed to save the latest draft before submission';
          setAutosaveError(message);
          showToast(message, 'error');
          setSubmitting(false);
          return;
        }
      }
      setAutosaveError(null);
      autosaveErrorShownRef.current = false;

      // Execute atomic submission
      const submitRes = await fetch(`/api/projects/${currentProjId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const submitData = await submitRes.json();

      if (!submitRes.ok) {
        showToast(submitData.error || 'Submission failed. Please check inputs.', 'error');
        if (submitData.details) setErrors(submitData.details);
        setSubmitting(false);
        return;
      }

      showToast('🎉 Project submitted successfully! Redirecting to report...', 'success');
      setTimeout(() => {
        router.push(`/projects/${currentProjId}`);
      }, 1200);
    } catch {
      showToast('A network error occurred while submitting. Please try again.', 'error');
      setSubmitting(false);
    }
  };

  // Verified commercial hub selector (coverage-backed preset)
  const handleSelectHub = (hub: CommercialHubPreset) => {
    setFormData((prev) => ({
      ...prev,
      target_location: `${hub.name}, Pakistan`,
      city: hub.city,
      district: hub.district,
      lat: hub.lat,
      lng: hub.lng,
    }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.target_location;
      delete copy.coordinates;
      return copy;
    });
  };

  // Currency toggle with canonical PKR tracking
  const handleCurrencyChange = (newCurrency: BudgetCurrency) => {
    if (newCurrency === formData.budget_currency) return;

    let newAmount: number;
    if (newCurrency === 'PKR') {
      newAmount = Math.round((Number(formData.budget_amount) || 0) * EXCHANGE_RATE_USD_TO_PKR);
    } else {
      newAmount = Math.max(100, Math.round((Number(formData.budget_amount) || 0) / EXCHANGE_RATE_USD_TO_PKR));
    }

    setFormData((prev) => ({
      ...prev,
      budget_currency: newCurrency,
      budget_amount: newAmount,
    }));
  };

  const appendKeyword = (keyword: string) => {
    const cur = formData.product_description || '';
    if (cur.length + keyword.length < 1500) {
      setFormData((prev) => ({
        ...prev,
        product_description: cur ? `${cur.trim()} Focus on ${keyword}.` : `Focus on ${keyword}.`,
      }));
    }
  };

  const addProductType = () => {
    const tag = productTypeInput.trim();
    if (tag && !formData.product_types.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        product_types: [...prev.product_types, tag],
      }));
      setProductTypeInput('');
    }
  };

  const removeProductType = (indexToRemove: number) => {
    setFormData((prev) => ({
      ...prev,
      product_types: prev.product_types.filter((_, i) => i !== indexToRemove),
    }));
  };

  // Secure File Upload to private storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('File size exceeds the 5MB limit', 'error');
      return;
    }

    try {
      setUploadingFile(true);
      const data = new FormData();
      data.append('file', file);
      if (projectId) data.append('project_id', projectId);

      const res = await fetch('/api/projects/upload', {
        method: 'POST',
        body: data,
      });

      const resData = await res.json();
      if (!res.ok) {
        showToast(resData.error || 'Failed to upload specification document', 'error');
      } else {
        const canonicalPath = resData.storage_path || resData.file_url;
        setUploadedFileName(resData.file_name);
        setFormData((prev) => ({
          ...prev,
          product_file_url: canonicalPath,
          product_file_name: resData.file_name,
          product_file_size: resData.file_size,
        }));
        showToast('Document uploaded and attached successfully', 'success');
      }
    } catch {
      showToast('Upload failed due to network connection', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveAttachment = () => {
    setUploadedFileName(null);
    setFormData((prev) => ({
      ...prev,
      product_file_url: undefined,
      product_file_name: undefined,
      product_file_size: undefined,
    }));
    showToast('Attachment removed from draft', 'success');
  };

  // Region / District / City cascading selectors (national, Pakistan-wide; Task 3 §4)
  const selectedRegion = getRegion(formData.region);
  const regionDistricts = selectedRegion?.districts ?? [];
  const districtCurated = getDistrict(formData.region, formData.district);
  const cityOptions = getCitiesForDistrict(formData.region, formData.district);
  const regionHubs = getHubPresetsForRegion(formData.region);
  const regionHasCoverage = selectedRegion?.analysis_enabled === true;

  // Financial allocations
  const budgetNum = Number(formData.budget_amount) || 0;
  const currencyPrefix = formData.budget_currency === 'PKR' ? 'Rs. ' : '$ ';
  const allocInv = Math.round(budgetNum * 0.45);
  const allocRent = Math.round(budgetNum * 0.25);
  const allocMkt = Math.round(budgetNum * 0.18);
  const allocBuf = Math.round(budgetNum * 0.12);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1326] flex items-center justify-center text-[#dae2fd]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[13px] font-mono text-[#bbcabf]">Restoring Project Draft...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans flex flex-col justify-between selection:bg-[#10b981]/30 selection:text-[#4edea3]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-24 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 border ${
            toast.type === 'success'
              ? 'bg-[#171f33] border-[#4edea3] text-[#4edea3]'
              : 'bg-[#171f33] border-[#ffb4ab] text-[#ffb4ab]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="text-[13px] font-medium">{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0b1326]/90 backdrop-blur-xl border-b border-[#2d3449]/50 shadow-[0_1px_8px_rgba(0,0,0,0.2)]">
        <div className="h-16 max-w-[1440px] mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center text-[#4edea3] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-[17px] text-[#dae2fd] tracking-tight leading-none">
                Feasibility Advisor
              </span>
              <span className="text-[11px] text-[#bbcabf] font-mono">Module 2 • 3-Step Wizard</span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#171f33] border border-[#2d3449]">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider">
                Pakistan Market Engine Active
              </span>
            </div>

            <Link
              href="/projects"
              onClick={async (e) => {
                e.preventDefault();
                const saved = await saveDraft(currentStep, false);
                if (saved) router.push('/projects');
              }}
              className="text-[#bbcabf] hover:text-[#dae2fd] text-[13px] font-medium px-3 py-1.5 rounded-lg hover:bg-[#171f33] transition-all flex items-center gap-1.5 border border-transparent hover:border-[#2d3449]"
            >
              <span className="material-symbols-outlined text-[18px]">exit_to_app</span>
              <span>Save &amp; Exit</span>
            </Link>

            <Link
              href="/account/security"
              className="w-8 h-8 rounded-full bg-[#4edea3] text-[#003824] flex items-center justify-center font-bold text-[14px] hover:ring-2 hover:ring-[#4edea3]/40 transition-all"
              title="Account Security"
            >
              <span className="material-symbols-outlined text-[18px]">person</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Wizard Area */}
      <main className="w-full pt-20 pb-32 flex-1 flex flex-col">
        <section className="w-full max-w-[1440px] mx-auto px-4 md:px-8 py-4 flex flex-col gap-6">
          {/* Sub-Header Status Tracker & Stepper Pill Navigation */}
          <div className="w-full bg-[#131b2e] rounded-xl p-4 md:p-6 shadow-xl relative overflow-hidden flex flex-col gap-4 border border-[#2d3449]/40">
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#4edea3]/5 blur-3xl pointer-events-none"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#060e20] p-1.5 flex items-center justify-center text-[#4edea3] border border-[#2d3449]">
                  <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                </div>
                <div>
                  <h1 className="text-[17px] font-semibold text-[#dae2fd] tracking-tight">Business Intake &amp; Location Wizard</h1>
                  <p className="text-[12px] text-[#bbcabf]">3-Step Intelligent Business Creation</p>
                </div>
                <span className="hidden sm:inline bg-[#4edea3]/10 border border-[#4edea3]/30 text-[#4edea3] text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Pakistan SME Launchpad
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center gap-2 bg-[#171f33] px-3 py-1.5 rounded-full text-[12px] border ${
                    autosaveError ? 'border-[#ffb4ab] text-[#ffb4ab]' : 'border-[#2d3449] text-[#bbcabf]'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      autosaveError ? 'bg-[#ffb4ab]' : 'bg-[#4cd7f6] animate-pulse'
                    }`}
                  ></span>
                  <span>
                    {autosaveError
                      ? 'Draft not saved — latest edits are still in this browser'
                      : savingDraft
                        ? 'Autosaving...'
                        : lastSavedTime
                          ? `Draft saved ${lastSavedTime}`
                          : 'Cloud Autosave Active'}
                  </span>
                  {autosaveError && (
                    <button
                      type="button"
                      onClick={() => void saveDraft(currentStep, false)}
                      className="underline hover:text-[#ffcfc9] font-medium"
                      title={autosaveError}
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Stepper Tabs (3 Unified Logical Steps) */}
            <nav aria-label="Wizard Steps" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              {[
                { step: 1, title: 'Business Profile & Location', subtitle: 'Step 01 — Profile & Location' },
                { step: 2, title: 'Financial & Operational', subtitle: 'Step 02 — Finance & Operations' },
                { step: 3, title: 'Review & Submission', subtitle: 'Step 03 — Review & Submission' },
              ].map((s) => {
                const isActive = currentStep === s.step;
                const isCompleted = currentStep > s.step;

                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => goToStep(s.step)}
                    className={`text-left p-3.5 rounded-xl transition-all duration-200 flex items-center gap-3 border ${
                      isActive
                        ? 'bg-[#222a3d] text-[#dae2fd] border-[#4edea3]/60 shadow-[0_0_15px_rgba(78,222,163,0.15)] ring-1 ring-[#4edea3]/40'
                        : isCompleted
                          ? 'bg-[#171f33] text-[#dae2fd] border-[#2d3449] hover:bg-[#222a3d]/80'
                          : 'bg-[#171f33]/60 text-[#bbcabf] border-[#2d3449]/40 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full text-[12px] font-semibold flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-[#4edea3] text-[#003824]'
                          : isCompleted
                            ? 'bg-[#4edea3]/20 text-[#4edea3]'
                            : 'bg-[#2d3449] text-[#bbcabf]'
                      }`}
                    >
                      {isCompleted ? (
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      ) : (
                        s.step
                      )}
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <span
                        className={`text-[10px] uppercase font-semibold tracking-wider ${
                          isActive ? 'text-[#4edea3]' : 'text-[#bbcabf]'
                        }`}
                      >
                        {s.subtitle}
                      </span>
                      <span className="text-[13px] font-medium truncate text-[#dae2fd]">
                        {s.title}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ============================================================== */}
          {/* STEP 1: BUSINESS PROFILE & LOCATION (Task 3 §4)              */}
          {/* ============================================================== */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[#4edea3] text-[13px] font-medium">
                  <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                  <span>Step 1 — Business Profile &amp; Location (Task 3 §4)</span>
                </div>
                <h2 className="text-[28px] md:text-[34px] font-bold text-[#dae2fd] tracking-tight">
                  What business are you planning to establish in Pakistan?
                </h2>
                <p className="text-[15px] text-[#bbcabf] max-w-3xl leading-relaxed">
                  Provide your business name and description, select one of the five approved categories, and choose a province / region, district, city and commercial location.
                </p>
              </div>

              {/* Business Title & Category Selection */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-12 bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[#bbcabf]">
                      Business Venture Name / Working Title
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Al-Madina Artisan Textiles, Gourmet Spice Hub..."
                      className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl px-4 py-2.5 text-[14px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3] transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-medium text-[#bbcabf] flex items-center justify-between">
                      <span>Primary Commercial Category *</span>
                      {errors.category && <span className="text-[#ffb4ab] text-[12px]">{errors.category}</span>}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {PREDEFINED_CATEGORIES.map((cat) => {
                        const isSelected = formData.category === cat.name;
                        return (
                          <div
                            key={cat.id}
                            onClick={() => {
                              setFormData((p) => ({ ...p, category: cat.name }));
                              setErrors((p) => {
                                const c = { ...p };
                                delete c.category;
                                return c;
                              });
                            }}
                            className={`cursor-pointer p-3.5 rounded-xl transition-all border flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[#222a3d] border-[#4edea3] ring-1 ring-[#4edea3]/40'
                                : 'bg-[#171f33] border-[#2d3449] hover:bg-[#222a3d]/60'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[13px] font-semibold text-[#dae2fd]">{cat.name}</span>
                              {isSelected && (
                                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
                                  check_circle
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#bbcabf] leading-snug line-clamp-2">
                              {cat.description}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              </div>

              {/* Product Concept & Tag Builder */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[14px] font-semibold text-[#dae2fd]">
                      Product &amp; Proposition Details
                    </label>
                    <span className="text-[12px] text-[#bbcabf] font-mono">
                      {(formData.product_description || '').length} / 2000 chars
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={formData.product_description || ''}
                    onChange={(e) => setFormData((p) => ({ ...p, product_description: e.target.value }))}
                    placeholder="Describe your commercial products, sourcing, quality differentiation, customer value proposition, and intended offerings..."
                    className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl p-4 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3] resize-none transition-colors"
                  />
                  {errors.product_description && (
                    <span className="text-[#ffb4ab] text-[12px]">{errors.product_description}</span>
                  )}
                </div>

                {/* Keyword Chips for Quick Inspiration */}
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] text-[#bbcabf] font-medium">Quick Context Tags (click to append):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Direct Local Sourcing',
                      'High Street Footfall',
                      'Same-Day COD Delivery',
                      'Premium Packaging',
                      'B2B Wholesale Channel',
                      'Export Quality Standards',
                    ].map((kw) => (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => appendKeyword(kw)}
                        className="bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd] px-2.5 py-1 rounded-full text-[11px] transition-colors border border-[#2d3449]"
                      >
                        + {kw}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Tags Adder */}
                <div className="flex flex-col gap-2 pt-2 border-t border-[#2d3449]/40">
                  <label className="text-[13px] font-medium text-[#bbcabf]">
                    Individual Product Types &amp; Catalog Tags
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={productTypeInput}
                      onChange={(e) => setProductTypeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addProductType();
                        }
                      }}
                      placeholder="Add an item type (e.g. Lawn Stitched, Embroidered Kurtis, Unstitched) and press Enter"
                      className="flex-1 bg-[#171f33] border border-[#2d3449] rounded-xl px-4 py-2 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                    />
                    <button
                      type="button"
                      onClick={addProductType}
                      className="bg-[#2d3449] hover:bg-[#3d4660] text-[#dae2fd] px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors"
                    >
                      Add Tag
                    </button>
                  </div>
                  {formData.product_types.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {formData.product_types.map((tag, idx) => (
                        <span
                          key={idx}
                          className="bg-[#222a3d] border border-[#4edea3]/40 text-[#4edea3] px-3 py-1 rounded-full text-[12px] flex items-center gap-1.5"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeProductType(idx)}
                            className="hover:text-[#ffb4ab]"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* National Business Location: Region / District / City (Task 3 §4; Pakistan-wide) */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <label className="text-[15px] font-semibold text-[#dae2fd] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[20px]">pin_drop</span>
                    Business Location (Pakistan) *
                  </label>
                  <p className="text-[12px] text-[#bbcabf]">
                    Country is fixed to Pakistan. Select a province or administrative region, then a district and city. Verified feasibility data currently covers Punjab; every other recognised region stays selectable and is analysed on a best-effort, clearly-labelled basis.
                  </p>
                </div>

                {/* Region / District / City */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="wizard-region" className="text-[12px] text-[#bbcabf] font-medium">Province / Region *</label>
                    <select
                      id="wizard-region"
                      value={formData.region || ''}
                      onChange={(e) => {
                        const region = e.target.value;
                        setFormData((p) => ({ ...p, region, district: '', city: '', target_location: '', lat: undefined, lng: undefined }));
                        setErrors((p) => {
                          const c = { ...p };
                          delete c.region;
                          delete c.district;
                          delete c.city;
                          delete c.coordinates;
                          return c;
                        });
                      }}
                      className="bg-[#171f33] border border-[#2d3449] rounded-xl px-4 py-2.5 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                    >
                      <option value="">Select province / region...</option>
                      {PAKISTAN_REGIONS.map((r) => (
                        <option key={r.code} value={r.name}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                    </select>
                    {errors.region && <span className="text-[#ffb4ab] text-[12px]">{errors.region}</span>}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="wizard-district" className="text-[12px] text-[#bbcabf] font-medium">District *</label>
                    {selectedRegion?.district_registry_complete ? (
                      <select
                        id="wizard-district"
                        value={formData.district || ''}
                        onChange={(e) => {
                          const district = e.target.value;
                          setFormData((p) => ({ ...p, district, city: '', target_location: '', lat: undefined, lng: undefined }));
                          setErrors((p) => {
                            const c = { ...p };
                            delete c.district;
                            delete c.city;
                            delete c.coordinates;
                            return c;
                          });
                        }}
                        className="bg-[#171f33] border border-[#2d3449] rounded-xl px-4 py-2.5 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                      >
                        <option value="">Select district...</option>
                        {regionDistricts.map((d) => (
                          <option key={d.name} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="wizard-district"
                        type="text"
                        list="wizard-district-options"
                        value={formData.district || ''}
                        disabled={!selectedRegion}
                        placeholder={selectedRegion ? 'Enter district...' : 'Select region first'}
                        onChange={(e) => {
                          const district = e.target.value;
                          setFormData((p) => ({ ...p, district, city: '', lat: undefined, lng: undefined }));
                          setErrors((p) => {
                            const c = { ...p };
                            delete c.district;
                            delete c.city;
                            delete c.coordinates;
                            return c;
                          });
                        }}
                        className="bg-[#171f33] border border-[#2d3449] rounded-xl px-4 py-2.5 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3] disabled:opacity-50"
                      />
                    )}
                    <datalist id="wizard-district-options">
                      {regionDistricts.map((d) => (
                        <option key={d.name} value={d.name} />
                      ))}
                    </datalist>
                    {errors.district && <span className="text-[#ffb4ab] text-[12px]">{errors.district}</span>}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="wizard-city" className="text-[12px] text-[#bbcabf] font-medium">City / Tehsil *</label>
                    {cityOptions.length > 0 ? (
                      <select
                        id="wizard-city"
                        value={formData.city || ''}
                        disabled={!districtCurated}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, city: e.target.value }));
                          setErrors((p) => {
                            const c = { ...p };
                            delete c.city;
                            return c;
                          });
                        }}
                        className="bg-[#171f33] border border-[#2d3449] rounded-xl px-4 py-2.5 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3] disabled:opacity-50"
                      >
                        <option value="">{districtCurated ? 'Select city...' : 'Select district first'}</option>
                        {cityOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="wizard-city"
                        type="text"
                        list="wizard-city-options"
                        value={formData.city || ''}
                        disabled={!selectedRegion}
                        placeholder={selectedRegion ? 'Enter city / tehsil...' : 'Select region first'}
                        onChange={(e) => {
                          setFormData((p) => ({ ...p, city: e.target.value }));
                          setErrors((p) => {
                            const c = { ...p };
                            delete c.city;
                            return c;
                          });
                        }}
                        className="bg-[#171f33] border border-[#2d3449] rounded-xl px-4 py-2.5 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3] disabled:opacity-50"
                      />
                    )}
                    <datalist id="wizard-city-options">
                      {cityOptions.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                    {errors.city && <span className="text-[#ffb4ab] text-[12px]">{errors.city}</span>}
                  </div>
                </div>

                {/* Coverage badge — separates geographic identity from data coverage */}
                {selectedRegion && (
                  <div
                    className={`p-3 rounded-xl text-[12px] flex items-start gap-2 border ${
                      regionHasCoverage
                        ? 'bg-[#10b981]/15 border-[#10b981]/40 text-[#4edea3]'
                        : 'bg-[#d97706]/15 border-[#d97706]/40 text-[#f59e0b]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {regionHasCoverage ? 'verified' : 'info'}
                    </span>
                    <span>
                      <strong>
                        {selectedRegion.name} — data coverage:{' '}
                        {selectedRegion.coverage === 'verified' ? 'Verified' : selectedRegion.coverage === 'limited' ? 'Limited' : 'Not yet available'}.
                      </strong>{' '}
                      {selectedRegion.source_note}
                      {!regionHasCoverage && ' Recognised locations remain selectable; Punjab data is never substituted as local evidence.'}
                    </span>
                  </div>
                )}

                {/* Hub Presets Chips (only for regions with verified hub coverage) */}
                {regionHubs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {regionHubs.map((hub) => {
                      const isSelected = formData.city === hub.city && formData.target_location.includes(hub.name);
                      return (
                        <button
                          key={hub.name}
                          type="button"
                          onClick={() => handleSelectHub(hub)}
                          className={`px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all border flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#222a3d] border-[#4edea3] text-[#4edea3] ring-1 ring-[#4edea3]/30'
                              : 'bg-[#171f33] border-[#2d3449] text-[#bbcabf] hover:text-[#dae2fd] hover:bg-[#222a3d]/50'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          <span>{hub.name}</span>
                          <span className="text-[10px] opacity-60">({hub.city})</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Manual coordinates for regions without verified hub presets (enables the
                    nationwide OpenStreetMap provider where coordinates are supplied) */}
                {selectedRegion && regionHubs.length === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="wizard-lat" className="text-[12px] text-[#bbcabf] font-medium">Latitude *</label>
                      <input
                        id="wizard-lat"
                        type="number"
                        step="0.0001"
                        value={formData.lat ?? ''}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, lat: e.target.value === '' ? undefined : Number(e.target.value) }))
                        }
                        placeholder="e.g. 24.8607"
                        className="bg-[#171f33] border border-[#2d3449] rounded-xl px-4 py-2.5 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="wizard-lng" className="text-[12px] text-[#bbcabf] font-medium">Longitude *</label>
                      <input
                        id="wizard-lng"
                        type="number"
                        step="0.0001"
                        value={formData.lng ?? ''}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, lng: e.target.value === '' ? undefined : Number(e.target.value) }))
                        }
                        placeholder="e.g. 67.0011"
                        className="bg-[#171f33] border border-[#2d3449] rounded-xl px-4 py-2.5 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                      />
                    </div>
                  </div>
                )}

                {/* Manual Target Location Entry */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wizard-locality" className="text-[12px] text-[#bbcabf] font-medium">Specific Locality / Address Description *</label>
                  <input
                    id="wizard-locality"
                    type="text"
                    value={formData.target_location}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, target_location: e.target.value }));
                      setErrors((p) => {
                        const c = { ...p };
                        delete c.target_location;
                        return c;
                      });
                    }}
                    placeholder="e.g. M.M. Alam Road, Gulberg III, Lahore, Punjab"
                    className="bg-[#171f33] border border-[#2d3449] rounded-xl px-4 py-2.5 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                  />
                  {errors.target_location && (
                    <span className="text-[#ffb4ab] text-[12px]">{errors.target_location}</span>
                  )}
                </div>

                {/* Coordinate Status */}
                {formData.lat && formData.lng ? (
                  <div className="p-3 bg-[#10b981]/15 border border-[#10b981]/40 rounded-xl text-[12px] text-[#4edea3] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>
                      <strong>{regionHasCoverage ? 'Verified hub coordinates:' : 'Coordinates provided:'}</strong>{' '}
                      {formData.lat.toFixed(4)}° N, {formData.lng.toFixed(4)}° E ({formData.city || formData.district || selectedRegion?.name || 'Pakistan'}, Pakistan)
                    </span>
                  </div>
                ) : regionHasCoverage ? (
                  <div className="p-3 bg-[#d97706]/15 border border-[#d97706]/40 rounded-xl text-[12px] text-[#f59e0b] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">location_searching</span>
                    <span>
                      Please select a verified commercial hub above to attach exact spatial coordinates for competitive radar analysis.
                    </span>
                  </div>
                ) : (
                  <div className="p-3 bg-[#222a3d] border border-[#2d3449] rounded-xl text-[12px] text-[#bbcabf] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">public</span>
                    <span>
                      No verified hubs are bundled for this region. Enter latitude and longitude manually to continue; they are required for submission. Verified local feasibility data is not yet available for this region.
                    </span>
                  </div>
                )}
                {errors.coordinates && (
                  <span className="text-[#ffb4ab] text-[12px]">{errors.coordinates}</span>
                )}

                {/* Analysis Radius Slider (5 - 15 km) */}
                <div className="flex flex-col gap-2 pt-3 border-t border-[#2d3449]/40">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-semibold text-[#dae2fd] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#4edea3] text-[18px]">radar</span>
                      Competitor Analysis Catchment Radius:
                      <span className="text-[#4edea3] font-mono text-[14px]">
                        {formData.radius_km || 10} km
                      </span>
                    </label>
                    <span className="text-[11px] text-[#bbcabf]">Configurable: 5 km to 15 km (10 km standard default)</span>
                  </div>

                  <input
                    type="range"
                    min="5"
                    max="15"
                    step="1"
                    value={formData.radius_km || 10}
                    onChange={(e) => setFormData((p) => ({ ...p, radius_km: parseFloat(e.target.value) }))}
                    className="w-full accent-[#4edea3] bg-[#222a3d] rounded-lg cursor-pointer h-2"
                  />
                  <div className="flex justify-between text-[11px] text-[#bbcabf] font-mono">
                    <span>5 km</span>
                    <span>10 km (Recommended)</span>
                    <span>15 km (Max)</span>
                  </div>
                  {errors.radius_km && (
                    <span className="text-[#ffb4ab] text-[12px]">{errors.radius_km}</span>
                  )}
                </div>

                {/* Spatial Radar Simulation Preview */}
                <div className="bg-[#060e20] border border-[#2d3449] rounded-xl relative overflow-hidden min-h-[220px] p-5 flex flex-col justify-between shadow-inner">
                  <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
                    <defs>
                      <pattern id="grid-pattern-step1" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#86948a" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-pattern-step1)" />
                  </svg>

                  <div className="relative z-10 flex items-center justify-between">
                    <div className="bg-[#171f33]/90 px-3 py-1 rounded-lg text-[11px] text-[#4edea3] border border-[#2d3449] flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-ping"></span>
                      <span>Illustrative Catchment Radius ({formData.radius_km || 10} km)</span>
                    </div>
                    <span className="text-[11px] text-[#bbcabf] font-mono">
                      {formData.lat ? `${formData.lat.toFixed(4)}° N, ${formData.lng?.toFixed(4)}° E` : 'No coordinates'}
                    </span>
                  </div>

                  <div className="relative z-10 my-auto flex flex-col items-center justify-center py-4">
                    <div className="w-10 h-10 rounded-full bg-[#4edea3]/20 border border-[#4edea3] flex items-center justify-center text-[#4edea3] shadow-lg animate-pulse">
                      <span className="material-symbols-outlined text-[20px]">storefront</span>
                    </div>
                    <span className="text-[12px] font-semibold text-[#dae2fd] mt-1">
                      {formData.target_location ? formData.target_location.split(',')[0] : 'Selected Target Hub'}
                    </span>
                  </div>

                  <div className="relative z-10 flex items-center justify-between text-[11px] text-[#bbcabf]">
                    <span>Map Data: © OpenStreetMap Contributors</span>
                    <span>Live POI discovery runs upon submission</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 2: FINANCIAL & OPERATIONAL INFORMATION                   */}
          {/* ============================================================== */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[#4edea3] text-[13px] font-medium">
                  <span className="material-symbols-outlined text-[18px]">payments</span>
                  <span>Step 2 — Financial &amp; Operational Information (Task 3 §4)</span>
                </div>
                <h2 className="text-[28px] md:text-[34px] font-bold text-[#dae2fd] tracking-tight">
                  Define your investment budget &amp; operating assumptions
                </h2>
                <p className="text-[15px] text-[#bbcabf] max-w-3xl leading-relaxed">
                  Allocate your planned initial capital in PKR (canonical) or USD, and describe your scale, operating model, footprint and target customer audience.
                </p>
              </div>

              {/* Budget Configuration Card */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <label className="text-[15px] font-semibold text-[#dae2fd] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[20px]">account_balance_wallet</span>
                    Initial Investment Budget *
                  </label>

                  {/* Currency Switcher */}
                  <div className="flex items-center bg-[#171f33] p-1 rounded-xl border border-[#2d3449]">
                    <button
                      type="button"
                      onClick={() => handleCurrencyChange('PKR')}
                      className={`px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                        formData.budget_currency === 'PKR'
                          ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                          : 'text-[#bbcabf] hover:text-[#dae2fd]'
                      }`}
                    >
                      PKR (Rs.)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCurrencyChange('USD')}
                      className={`px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
                        formData.budget_currency === 'USD'
                          ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                          : 'text-[#bbcabf] hover:text-[#dae2fd]'
                      }`}
                    >
                      USD ($)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#bbcabf] font-mono text-[16px]">
                      {currencyPrefix}
                    </span>
                    <input
                      type="number"
                      value={formData.budget_amount || ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        setFormData((p) => ({ ...p, budget_amount: val }));
                        setErrors((p) => {
                          const c = { ...p };
                          delete c.budget_amount;
                          return c;
                        });
                      }}
                      placeholder="e.g. 500000"
                      className="w-full bg-[#171f33] border border-[#2d3449] rounded-xl pl-12 pr-4 py-3 text-[18px] font-mono text-[#dae2fd] focus:outline-none focus:border-[#4edea3] transition-colors"
                    />
                  </div>
                  {errors.budget_amount && (
                    <span className="text-[#ffb4ab] text-[12px]">{errors.budget_amount}</span>
                  )}
                  <span className="text-[12px] text-[#bbcabf]">
                    Acceptable platform range: Rs. 10,000 to Rs. 50,000,000 PKR (or USD equivalent).
                  </span>
                </div>

                {/* SBP Conversion Provenance Disclosure */}
                {formData.budget_currency === 'USD' && (
                  <div className="p-3 bg-[#171f33] border border-[#2d3449] rounded-xl flex items-center gap-2 text-[12px] text-[#bbcabf]">
                    <span className="material-symbols-outlined text-[16px] text-[#4cd7f6]">info</span>
                    <span>
                      Converted to canonical PKR using State Bank of Pakistan benchmark rate: <strong>Rs. 278.00 / USD</strong> (~Rs. {(budgetNum * EXCHANGE_RATE_USD_TO_PKR).toLocaleString()} PKR).
                    </span>
                  </div>
                )}

                {/* Financial Runway Breakdown Estimator */}
                {budgetNum > 0 && (
                  <div className="pt-4 border-t border-[#2d3449]/40 flex flex-col gap-3">
                    <span className="text-[12px] uppercase tracking-wider font-semibold text-[#bbcabf]">
                      Estimated Capital Allocation Breakdown (Rule-Based Guidelines)
                    </span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col">
                        <span className="text-[11px] text-[#bbcabf]">Inventory &amp; Production (45%)</span>
                        <span className="text-[14px] font-bold text-[#dae2fd] font-mono">
                          {currencyPrefix}{allocInv.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col">
                        <span className="text-[11px] text-[#bbcabf]">Rent &amp; Lease Reserve (25%)</span>
                        <span className="text-[14px] font-bold text-[#dae2fd] font-mono">
                          {currencyPrefix}{allocRent.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col">
                        <span className="text-[11px] text-[#bbcabf]">Marketing &amp; Digital Launch (18%)</span>
                        <span className="text-[14px] font-bold text-[#dae2fd] font-mono">
                          {currencyPrefix}{allocMkt.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col">
                        <span className="text-[11px] text-[#bbcabf]">Working Capital Buffer (12%)</span>
                        <span className="text-[14px] font-bold text-[#4edea3] font-mono">
                          {currencyPrefix}{allocBuf.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Operational Scope & Audience Profiling */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Business Scale */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                  <label className="text-[14px] font-semibold text-[#dae2fd] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[18px]">straighten</span>
                    Planned Scale
                  </label>
                  <div className="flex flex-col gap-2">
                    {BUSINESS_SCALE_OPTIONS.map((scale) => (
                      <div
                        key={scale.id}
                        onClick={() => setFormData((p) => ({ ...p, business_scale: scale.id }))}
                        className={`cursor-pointer p-3 rounded-xl transition-all border flex flex-col ${
                          formData.business_scale === scale.id
                            ? 'bg-[#222a3d] border-[#4edea3]'
                            : 'bg-[#171f33] border-[#2d3449] hover:bg-[#222a3d]/50'
                        }`}
                      >
                        <span className="text-[13px] font-bold text-[#dae2fd]">{scale.label}</span>
                        <span className="text-[11px] text-[#bbcabf]">{scale.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Business Model */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                  <label className="text-[14px] font-semibold text-[#dae2fd] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[18px]">hub</span>
                    Business Model
                  </label>
                  <div className="flex flex-col gap-2">
                    {[
                      { id: 'hybrid', label: 'Hybrid Retail', desc: 'Physical showroom/outlet + online COD storefront' },
                      { id: 'd2c', label: 'Online Only (D2C)', desc: 'Pure digital store with courier fulfillment' },
                      { id: 'physical', label: 'Physical Storefront', desc: 'Walk-in high-street retail outlet' },
                    ].map((model) => (
                      <div
                        key={model.id}
                        onClick={() => setFormData((p) => ({ ...p, business_model: model.id as BusinessModel }))}
                        className={`cursor-pointer p-3 rounded-xl transition-all border flex flex-col ${
                          formData.business_model === model.id
                            ? 'bg-[#222a3d] border-[#4edea3]'
                            : 'bg-[#171f33] border-[#2d3449] hover:bg-[#222a3d]/50'
                        }`}
                      >
                        <span className="text-[13px] font-bold text-[#dae2fd]">{model.label}</span>
                        <span className="text-[11px] text-[#bbcabf]">{model.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Storefront Footprint */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                  <label className="text-[14px] font-semibold text-[#dae2fd] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[18px]">store</span>
                    Storefront Footprint
                  </label>
                  <div className="flex flex-col gap-2">
                    {FOOTPRINT_OPTIONS.map((fp) => (
                      <div
                        key={fp.id}
                        onClick={() => setFormData((p) => ({ ...p, storefront_footprint: fp.id }))}
                        className={`cursor-pointer p-2.5 rounded-xl transition-all border flex flex-col ${
                          formData.storefront_footprint === fp.id
                            ? 'bg-[#222a3d] border-[#4edea3]'
                            : 'bg-[#171f33] border-[#2d3449] hover:bg-[#222a3d]/50'
                        }`}
                      >
                        <span className="text-[12px] font-bold text-[#dae2fd]">{fp.label}</span>
                        <span className="text-[11px] text-[#bbcabf]">{fp.sub}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Target Audience Profiling */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                <label className="text-[15px] font-semibold text-[#dae2fd] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4edea3] text-[18px]">groups</span>
                  Target Customer Audience Profiling (Optional Planning Matrix)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] text-[#bbcabf] font-medium">Age Group</label>
                    <select
                      value={formData.target_audience?.age_group || ''}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          target_audience: { ...p.target_audience, age_group: e.target.value },
                        }))
                      }
                      className="bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                    >
                      <option value="">Select age bracket...</option>
                      {AGE_GROUP_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] text-[#bbcabf] font-medium">Gender Focus</label>
                    <select
                      value={formData.target_audience?.gender || ''}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          target_audience: { ...p.target_audience, gender: e.target.value },
                        }))
                      }
                      className="bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                    >
                      <option value="">Select gender demographic...</option>
                      {GENDER_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] text-[#bbcabf] font-medium">Income Bracket</label>
                    <select
                      value={formData.target_audience?.income_level || ''}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          target_audience: { ...p.target_audience, income_level: e.target.value },
                        }))
                      }
                      className="bg-[#171f33] border border-[#2d3449] rounded-xl px-3 py-2 text-[13px] text-[#dae2fd] focus:outline-none focus:border-[#4edea3]"
                    >
                      <option value="">Select income class...</option>
                      {INCOME_LEVEL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Private Document Attachment Upload */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-3">
                <label className="text-[15px] font-semibold text-[#dae2fd] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4edea3] text-[18px]">attachment</span>
                  Specification Document / Product Catalog Attachment (Max 5MB)
                </label>
                <p className="text-[12px] text-[#bbcabf]">
                  Upload a PDF specification, CSV price list, or product image. Files are stored in a private Supabase bucket and accessed only via short-lived signed URLs.
                </p>

                <div className="flex items-center gap-4 mt-2">
                  <label className="cursor-pointer bg-[#222a3d] hover:bg-[#2d3752] text-[#dae2fd] text-[13px] font-medium px-4 py-2.5 rounded-xl border border-[#2d3449] flex items-center gap-2 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">upload_file</span>
                    <span>{uploadingFile ? 'Uploading...' : uploadedFileName ? 'Replace File' : 'Upload Specification'}</span>
                    <input
                      type="file"
                      accept=".pdf,.csv,.json,.png,.jpg,.jpeg,.webp"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </label>

                  {uploadedFileName && (
                    <div className="flex items-center gap-2 bg-[#171f33] px-3.5 py-2 rounded-xl border border-[#4edea3]/40 text-[#4edea3] text-[13px]">
                      <span className="material-symbols-outlined text-[16px]">task_alt</span>
                      <span className="font-medium">{uploadedFileName}</span>
                      <button
                        type="button"
                        onClick={handleRemoveAttachment}
                        className="ml-2 text-[#ffb4ab] hover:text-[#ff897d] text-[12px]"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: REVIEW & FEASIBILITY AUDIT SUBMISSION                 */}
          {/* ============================================================== */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[#4edea3] text-[13px] font-medium">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Step 3 — Review &amp; Submission (Task 3 §4)</span>
                </div>
                <h2 className="text-[28px] md:text-[34px] font-bold text-[#dae2fd] tracking-tight">
                  Review your business idea before feasibility submission
                </h2>
                <p className="text-[15px] text-[#bbcabf] max-w-3xl leading-relaxed">
                  Verify all entered details. Submitting this project creates a verified record in PostgreSQL and launches the Module 3 data collection pipeline.
                </p>
              </div>

              {/* Review Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Business Profile */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#dae2fd] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#4edea3] text-[16px]">lightbulb</span>
                      Business Profile
                    </span>
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="text-[#4edea3] hover:underline text-[11px]"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 text-[12px]">
                    <div>
                      <span className="text-[#bbcabf]">Venture Name: </span>
                      <strong className="text-[#dae2fd]">{formData.title || 'Untitled Venture'}</strong>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Commercial Category: </span>
                      <strong className="text-[#4edea3]">{formData.category || 'Not selected'}</strong>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Business Description: </span>
                      <span className="text-[#dae2fd]">{formData.product_description || 'Not provided'}</span>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Product Types: </span>
                      <span className="text-[#dae2fd]">
                        {formData.product_types.length > 0 ? formData.product_types.join(', ') : 'None specified'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Location & Spatial Catchment */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#dae2fd] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#4edea3] text-[16px]">pin_drop</span>
                      Location &amp; Catchment Radius
                    </span>
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="text-[#4edea3] hover:underline text-[11px]"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 text-[12px]">
                    <div>
                      <span className="text-[#bbcabf]">Province / Country: </span>
                      <span className="text-[#dae2fd] capitalize">{formData.region || DEFAULT_REGION_NAME}, Pakistan</span>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">District: </span>
                      <span className="text-[#dae2fd]">{formData.district || 'Not selected'}</span>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">City: </span>
                      <span className="text-[#dae2fd]">{formData.city || 'Not selected'}</span>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Target Hub: </span>
                      <strong className="text-[#dae2fd]">{formData.target_location || 'Not entered'}</strong>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Spatial Coordinates: </span>
                      <span className="text-[#dae2fd] font-mono">
                        {formData.lat && formData.lng
                          ? `${formData.lat.toFixed(4)}° N, ${formData.lng.toFixed(4)}° E`
                          : 'Not assigned'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Analysis Radius: </span>
                      <span className="text-[#4edea3] font-mono font-bold">{formData.radius_km || 10} km</span>
                    </div>
                  </div>
                </div>

                {/* 3. Budget & Capital Runway */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#dae2fd] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#4edea3] text-[16px]">payments</span>
                      Capital Allocation &amp; Currency
                    </span>
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="text-[#4edea3] hover:underline text-[11px]"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 text-[12px]">
                    <div>
                      <span className="text-[#bbcabf]">Declared Investment: </span>
                      <strong className="text-[#dae2fd] font-mono text-[14px]">
                        {currencyPrefix}{Number(formData.budget_amount || 0).toLocaleString()} {formData.budget_currency}
                      </strong>
                    </div>
                    {formData.budget_currency === 'USD' && (
                      <div>
                        <span className="text-[#bbcabf]">Canonical PKR Benchmark: </span>
                        <span className="text-[#4edea3] font-mono">
                          Rs. {(Number(formData.budget_amount || 0) * EXCHANGE_RATE_USD_TO_PKR).toLocaleString()} PKR
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-[#bbcabf]">Inventory Reserve (45%): </span>
                      <span className="text-[#dae2fd] font-mono">{currencyPrefix}{allocInv.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Rent Reserve (25%): </span>
                      <span className="text-[#dae2fd] font-mono">{currencyPrefix}{allocRent.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Operational Setup */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[#dae2fd] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[#4edea3] text-[16px]">hub</span>
                      Operational Setup
                    </span>
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="text-[#4edea3] hover:underline text-[11px]"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5 text-[12px]">
                    <div>
                      <span className="text-[#bbcabf]">Business Scale: </span>
                      <span className="text-[#dae2fd] capitalize">{formData.business_scale}</span>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Store Model: </span>
                      <span className="text-[#dae2fd] uppercase">{formData.business_model}</span>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Storefront Footprint: </span>
                      <span className="text-[#dae2fd] capitalize">{formData.storefront_footprint}</span>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Audience Focus: </span>
                      <span className="text-[#dae2fd]">
                        {formData.target_audience?.gender || 'All'} • {formData.target_audience?.age_group || 'Broad'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#bbcabf]">Specification Document: </span>
                      <span className="text-[#dae2fd]">{uploadedFileName || 'No attachment'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Factual Integrity Banner (SRS Boundary Safeguard) */}
              <div className="bg-[#171f33] border border-[#4edea3]/30 rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#4edea3]/20 text-[#4edea3] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">verified_user</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] font-semibold text-[#dae2fd]">
                    Atomic Submission &amp; Feasibility Ingestion Handshake
                  </span>
                  <p className="text-[13px] text-[#bbcabf] leading-relaxed">
                    By submitting this project, your inputs will be recorded in PostgreSQL with status <code className="text-[#4edea3]">submitted</code>, and an associated <code className="text-[#4edea3]">feasibility_reports</code> record with status <code className="text-[#4edea3]">pending</code> will be initialized. Real OpenStreetMap POI aggregation and Google Trends fetching will start automatically.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Floating Docked Bottom Action Bar */}
      <aside className="fixed bottom-0 left-0 right-0 z-40 bg-[#0b1326]/95 backdrop-blur-xl border-t border-[#2d3449] shadow-[0_-10px_30px_rgba(0,0,0,0.6)]">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left: Previous CTA & Step Progress */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStep === 1}
              className={`text-[13px] font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 border border-[#2d3449] ${
                currentStep === 1
                  ? 'opacity-40 cursor-not-allowed text-[#86948a]'
                  : 'text-[#bbcabf] hover:text-[#dae2fd] hover:bg-[#171f33]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Previous Step</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-28 bg-[#222a3d] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#4edea3] h-full transition-all duration-300"
                  style={{ width: `${(currentStep / 3) * 100}%` }}
                ></div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-[#dae2fd]">
                  Step {currentStep} of 3 ({Math.round((currentStep / 3) * 100)}%)
                </span>
                <span className="text-[10px] text-[#bbcabf] hidden sm:inline">
                  {savingDraft ? 'Saving to cloud...' : 'Auto-saved to cloud'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Save Draft & Primary Continue/Submit CTA */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => saveDraft(currentStep, false)}
              disabled={savingDraft || submitting}
              className="text-[#bbcabf] hover:text-[#dae2fd] text-[13px] font-medium px-4 py-2 rounded-xl hover:bg-[#171f33] transition-all flex items-center gap-1.5 border border-[#2d3449]"
            >
              {savingDraft ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[17px]">bookmark</span>
                  <span>Save Draft</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={submitting}
              className="w-full sm:w-auto bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-6 py-2.5 rounded-xl text-[14px] font-bold shadow-[0_0_25px_rgba(78,222,163,0.35)] hover:shadow-[0_0_35px_rgba(78,222,163,0.55)] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#003824] border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting Idea...</span>
                </>
              ) : currentStep === 3 ? (
                <>
                  <span>Submit Business Idea for Analysis</span>
                  <span className="material-symbols-outlined text-[20px]">send</span>
                </>
              ) : (
                <>
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Micro Trust Stamp */}
        <div className="w-full bg-[#060e20] py-1 px-4 text-center border-t border-[#2d3449]/40">
          <span className="text-[#bbcabf] text-[11px]">
            Pakistan Commercial Feasibility Engine • OpenStreetMap POI Radar • Continuous 0.00–1.00 Viability Evaluation
          </span>
        </div>
      </aside>
    </div>
  );
}
