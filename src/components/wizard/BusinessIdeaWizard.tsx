'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Project,
  ProjectFormData,
  PREDEFINED_CATEGORIES,
  COMMERCIAL_HUB_PRESETS,
  AGE_GROUP_OPTIONS,
  GENDER_OPTIONS,
  INCOME_LEVEL_OPTIONS,
  BUSINESS_SCALE_OPTIONS,
  FOOTPRINT_OPTIONS,
  EXCHANGE_RATE_USD_TO_PKR,
  BudgetCurrency,
  BusinessScale,
  BusinessModel,
  StorefrontFootprint
} from '@/types/project';
import { validateProjectStep, validateCompleteProject } from '@/lib/validation/project';

interface BusinessIdeaWizardProps {
  initialProjectId?: string;
}

export default function BusinessIdeaWizard({ initialProjectId }: BusinessIdeaWizardProps) {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [loading, setLoading] = useState(!!initialProjectId);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [formData, setFormData] = useState<ProjectFormData>({
    title: '',
    category: 'Grocery & Gourmet Food',
    custom_category: '',
    target_location: 'Gulberg III, Lahore, Pakistan',
    city: 'Lahore',
    region: 'Punjab',
    country: 'Pakistan',
    postal_code: '',
    lat: 31.5204,
    lng: 74.3587,
    radius_km: 12.5,
    budget_amount: 15000,
    budget_currency: 'USD',
    target_audience: {
      age_group: 'Young Professionals (25-34 years)',
      gender: 'All Genders / Unisex',
      income_level: 'Affluent / Upper Middle Class'
    },
    business_scale: 'small',
    business_model: 'hybrid',
    storefront_footprint: 'boutique',
    product_description: 'Premium wild mountain honey and cold-pressed walnut oils sourced directly from Hunza, targeting health-conscious households.',
    product_types: ['Organic Honey', 'Walnut Oil', 'Dry Fruits'],
    current_step: 1
  });

  const [productTypeInput, setProductTypeInput] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Load existing project if initialProjectId provided
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

        setFormData({
          title: p.title || '',
          category: p.category || 'Grocery & Gourmet Food',
          custom_category: p.custom_category || '',
          target_location: p.target_location || 'Gulberg III, Lahore, Pakistan',
          city: p.city || '',
          region: p.region || '',
          country: p.country || 'Pakistan',
          postal_code: p.postal_code || '',
          lat: p.lat ?? 31.5204,
          lng: p.lng ?? 74.3587,
          radius_km: p.radius_km || 12.5,
          budget_amount: Number(p.budget_amount) || 15000,
          budget_currency: p.budget_currency || 'USD',
          target_audience: p.target_audience || {},
          business_scale: p.business_scale || 'small',
          business_model: p.business_model || 'hybrid',
          storefront_footprint: p.storefront_footprint || 'boutique',
          product_description: p.product_description || '',
          product_types: p.product_types || [],
          product_file_url: p.product_file_url || undefined,
          product_file_name: p.product_file_name || undefined,
          product_file_size: p.product_file_size || undefined,
          current_step: p.current_step || 1
        });

        if (p.product_file_name) {
          setUploadedFileName(p.product_file_name);
        }

        if (p.current_step && p.current_step >= 1 && p.current_step <= 5) {
          setCurrentStep(p.current_step);
        }
        setLastSavedTime(new Date(p.updated_at).toLocaleTimeString());
      } catch {
        showToast('Error connecting to project service', 'error');
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [initialProjectId, router]);

  // Save Draft (Local & Server)
  const saveDraft = useCallback(async (stepToSave?: number, silent = false) => {
    try {
      if (!silent) setSavingDraft(true);

      const targetStep = stepToSave || currentStep;
      const payload = {
        ...formData,
        current_step: targetStep,
        title: formData.title || `${formData.category} - ${formData.city || formData.target_location.split(',')[0]} Venture`
      };

      let res;
      if (projectId) {
        res = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        const data = await res.json();
        if (!projectId && data.project?.id) {
          setProjectId(data.project.id);
          window.history.replaceState(null, '', `/wizard/${data.project.id}`);
        }
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        if (!silent) showToast('Draft saved successfully', 'success');
      } else {
        const err = await res.json();
        if (!silent) showToast(err.error || 'Failed to save draft', 'error');
      }
    } catch {
      if (!silent) showToast('Network error while saving draft', 'error');
    } finally {
      if (!silent) setSavingDraft(false);
    }
  }, [currentStep, formData, projectId]);

  // Navigate to step with validation
  const goToStep = async (step: number) => {
    // If going forward, validate current step first
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
    if (currentStep < 5) {
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

  // Submit complete project
  const handleSubmit = async () => {
    const fullValidation = validateCompleteProject(formData);
    if (!fullValidation.valid) {
      setErrors(fullValidation.errors);
      showToast('Validation errors found. Please review the highlighted fields.', 'error');
      return;
    }

    try {
      setSubmitting(true);

      // Ensure draft exists first
      let currentProjId = projectId;
      if (!currentProjId) {
        const createRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, current_step: 5 })
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          showToast(err.error || 'Failed to initialize project record', 'error');
          setSubmitting(false);
          return;
        }
        const createData = await createRes.json();
        currentProjId = createData.project.id;
        setProjectId(currentProjId);
      } else {
        // Save latest edits
        await fetch(`/api/projects/${currentProjId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, current_step: 5 })
        });
      }

      // Submit project for feasibility analysis
      const submitRes = await fetch(`/api/projects/${currentProjId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const submitData = await submitRes.json();

      if (!submitRes.ok) {
        showToast(submitData.error || 'Submission failed. Please check inputs.', 'error');
        if (submitData.details) setErrors(submitData.details);
        setSubmitting(false);
        return;
      }

      showToast('🎉 Project submitted successfully! Redirecting to confirmation...', 'success');
      setTimeout(() => {
        router.push(`/projects/${currentProjId}`);
      }, 1200);
    } catch {
      showToast('A network error occurred while submitting. Please try again.', 'error');
      setSubmitting(false);
    }
  };

  // Hub Chip selection helper
  const handleSelectHub = (hub: (typeof COMMERCIAL_HUB_PRESETS)[0]) => {
    setFormData((prev) => ({
      ...prev,
      target_location: `${hub.name}, Pakistan`,
      city: hub.city,
      lat: hub.lat,
      lng: hub.lng
    }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.target_location;
      return copy;
    });
  };

  // Currency switch
  const handleCurrencyChange = (newCurrency: BudgetCurrency) => {
    if (newCurrency === formData.budget_currency) return;

    let newAmount: number;
    if (newCurrency === 'PKR') {
      newAmount = Math.round(formData.budget_amount * EXCHANGE_RATE_USD_TO_PKR);
    } else {
      newAmount = Math.max(100, Math.round(formData.budget_amount / EXCHANGE_RATE_USD_TO_PKR));
    }

    setFormData((prev) => ({
      ...prev,
      budget_currency: newCurrency,
      budget_amount: newAmount
    }));
  };

  // Keyword helper
  const appendKeyword = (keyword: string) => {
    const cur = formData.product_description || '';
    if (cur.length + keyword.length < 500) {
      setFormData((prev) => ({
        ...prev,
        product_description: cur ? `${cur.trim()} Focus on ${keyword}.` : `Focus on ${keyword}.`
      }));
    }
  };

  // Add Product Type tag
  const addProductType = () => {
    const tag = productTypeInput.trim();
    if (tag && !formData.product_types.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        product_types: [...prev.product_types, tag]
      }));
      setProductTypeInput('');
    }
  };

  const removeProductType = (indexToRemove: number) => {
    setFormData((prev) => ({
      ...prev,
      product_types: prev.product_types.filter((_, i) => i !== indexToRemove)
    }));
  };

  // File Upload
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
        body: data
      });

      const resData = await res.json();
      if (!res.ok) {
        showToast(resData.error || 'Failed to upload specification document', 'error');
      } else {
        setUploadedFileName(resData.file_name);
        setFormData((prev) => ({
          ...prev,
          product_file_url: resData.file_url,
          product_file_name: resData.file_name,
          product_file_size: resData.file_size
        }));
        showToast('Document uploaded and attached successfully', 'success');
      }
    } catch {
      showToast('Upload failed due to network connection', 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  // Capital breakdown calculations
  const currencySymbol = formData.budget_currency === 'PKR' ? 'PKR' : 'USD $';
  const currencyPrefix = formData.budget_currency === 'PKR' ? 'Rs. ' : '$ ';
  const budgetNum = Number(formData.budget_amount) || 0;
  const allocInv = Math.round(budgetNum * 0.45);
  const allocRent = Math.round(budgetNum * 0.25);
  const allocMkt = Math.round(budgetNum * 0.18);
  const allocBuf = Math.round(budgetNum * 0.12);

  // Addressable reach & saturation simulation
  const reachCount = Math.round(Number(formData.radius_km || 10) * 27200);
  const saturationPercent = Math.min(Math.round(Number(formData.radius_km || 10) * 1.8), 85);

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
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center text-[#4edea3] group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-[17px] text-[#dae2fd] tracking-tight leading-none">
                Feasibility Advisor
              </span>
              <span className="text-[11px] text-[#bbcabf] font-mono">Module 2 • Idea Wizard</span>
            </div>
          </Link>

          {/* Center / Right actions */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#171f33] border border-[#2d3449]">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider">
                Advisor Engine Active
              </span>
            </div>

            <Link
              href="/projects"
              onClick={async (e) => {
                e.preventDefault();
                await saveDraft(currentStep, false);
                router.push('/projects');
              }}
              className="text-[#bbcabf] hover:text-[#dae2fd] text-[13px] font-medium px-3 py-1.5 rounded-lg hover:bg-[#171f33] transition-all flex items-center gap-1.5 border border-transparent hover:border-[#2d3449]"
            >
              <span className="material-symbols-outlined text-[18px]">exit_to_app</span>
              <span>Save Draft &amp; Exit</span>
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
                  <h1 className="text-[17px] font-semibold text-[#dae2fd] tracking-tight">Store Launchpad Engine</h1>
                  <p className="text-[12px] text-[#bbcabf]">AI Feasibility Audit &amp; Project Creator</p>
                </div>
                <span className="hidden sm:inline bg-[#4edea3]/10 border border-[#4edea3]/30 text-[#4edea3] text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  SME Launch Accelerator
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-[#171f33] px-3 py-1.5 rounded-full text-[#bbcabf] text-[12px] border border-[#2d3449]">
                  <span className="w-2 h-2 rounded-full bg-[#4cd7f6] animate-pulse"></span>
                  <span>Spatial Footfall DB v4.1 Sync</span>
                </div>
                {lastSavedTime && (
                  <span className="text-[#bbcabf] text-[12px] hidden lg:inline font-mono">
                    Draft saved {lastSavedTime}
                  </span>
                )}
              </div>
            </div>

            {/* Stepper Tabs (5 Steps) */}
            <nav aria-label="Wizard Steps" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-2">
              {[
                { step: 1, title: 'Category & Venture', subtitle: 'Step 01' },
                { step: 2, title: 'Location & Spatial', subtitle: 'Step 02' },
                { step: 3, title: 'Budget & Runway', subtitle: 'Step 03' },
                { step: 4, title: 'Audience & Scope', subtitle: 'Step 04' },
                { step: 5, title: 'Review & Submit', subtitle: 'Step 05' },
              ].map((s) => {
                const isActive = currentStep === s.step;
                const isCompleted = currentStep > s.step;

                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => goToStep(s.step)}
                    className={`text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-3 border ${
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
                      <span className={`text-[10px] uppercase font-semibold tracking-wider ${isActive ? 'text-[#4edea3]' : 'text-[#bbcabf]'}`}>
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
          {/* STEP 1: CATEGORY & VENTURE ARCHETYPE                          */}
          {/* ============================================================== */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[#4edea3] text-[13px] font-medium">
                  <span className="material-symbols-outlined text-[18px]">domain_verification</span>
                  <span>Commercial Vertical Archetype (SRS FR-2.1)</span>
                </div>
                <h2 className="text-[28px] md:text-[34px] font-bold text-[#dae2fd] tracking-tight">
                  What type of business are you launching?
                </h2>
                <p className="text-[15px] text-[#bbcabf] max-w-3xl leading-relaxed">
                  Choose the commercial vertical that best represents your catalog, inventory turnover cycle, and customer demographic.
                </p>
                {errors.category && (
                  <span className="text-[#ffb4ab] text-[13px] mt-1 flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-[16px]">error</span>
                    {errors.category}
                  </span>
                )}
              </div>

              {/* 6 Category Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PREDEFINED_CATEGORIES.map((cat) => {
                  const isSelected = formData.category === cat.name;

                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, category: cat.name }));
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.category;
                          return copy;
                        });
                      }}
                      className={`cursor-pointer rounded-xl p-5 transition-all duration-200 relative flex flex-col justify-between border ${
                        isSelected
                          ? 'bg-[#222a3d] border-[#4edea3] ring-2 ring-[#4edea3]/40 shadow-xl'
                          : 'bg-[#131b2e] border-[#2d3449]/60 hover:bg-[#171f33] hover:border-[#2d3449] shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform ${
                            isSelected ? 'bg-[#4edea3]/20 text-[#4edea3]' : 'bg-[#2d3449] text-[#4cd7f6]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[26px]">{cat.icon}</span>
                        </div>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-[#4edea3]/20 text-[#4edea3]'
                              : 'bg-[#2d3449] text-[#bbcabf]'
                          }`}
                        >
                          {cat.badge}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-[17px] font-semibold text-[#dae2fd]">{cat.name}</h3>
                          {isSelected && (
                            <span className="material-symbols-outlined text-[#4edea3] text-[20px]">
                              check_circle
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-[#bbcabf] leading-snug">{cat.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Category Input if "Other Niche Venture" */}
              {formData.category === 'Other Niche Venture' && (
                <div className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-5 flex flex-col gap-2">
                  <label className="text-[14px] font-semibold text-[#dae2fd] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[18px]">edit_note</span>
                    Specify Your Niche Commercial Category <span className="text-[#ffb4ab]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.custom_category}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, custom_category: e.target.value }));
                      setErrors((prev) => {
                        const copy = { ...prev };
                        delete copy.custom_category;
                        return copy;
                      });
                    }}
                    placeholder="e.g. Specialty Archery Gear, Artisanal Pottery & Clay Homeware, Pet Spa Botanicals..."
                    className="w-full bg-[#060e20] text-[#dae2fd] text-[14px] px-4 py-3 rounded-xl border border-[#2d3449] focus:outline-none focus:ring-2 focus:ring-[#4edea3]"
                  />
                  {errors.custom_category && (
                    <span className="text-[#ffb4ab] text-[12px] font-medium">{errors.custom_category}</span>
                  )}
                </div>
              )}

              {/* Venturing Narrative Free-text */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <label htmlFor="venture-description" className="text-[16px] font-semibold text-[#dae2fd] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[20px]">psychology</span>
                    Tell the AI about your venture vision
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="bg-[#4edea3]/10 border border-[#4edea3]/20 text-[#4edea3] px-2.5 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                      Multi-LLM Prompt Optimizer Active
                    </span>
                    <span className="text-[12px] text-[#bbcabf] font-mono">
                      {(formData.product_description || '').length} / 500 characters
                    </span>
                  </div>
                </div>

                <div className="relative w-full">
                  <textarea
                    id="venture-description"
                    rows={3}
                    maxLength={500}
                    value={formData.product_description || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, product_description: e.target.value }))}
                    placeholder="Describe your unique products, target customers, or brand vision (e.g. Premium mountain honey & sun-dried organic fruits sourced directly from Gilgit, targeting health-conscious families in Lahore)..."
                    className="w-full bg-[#060e20] text-[#dae2fd] text-[14px] leading-relaxed rounded-xl p-4 border border-[#2d3449] focus:outline-none focus:ring-2 focus:ring-[#4edea3] placeholder:text-[#86948a]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[#bbcabf] text-[12px]">Suggested Keywords:</span>
                  {[
                    'Organic Certification',
                    'Cold Storage Chain',
                    'Direct Farmer Sourcing',
                    'Eco-Friendly Packaging',
                    'B2B Corporate Hampers'
                  ].map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => appendKeyword(kw)}
                      className="bg-[#2d3449] hover:bg-[#31394d] text-[#dae2fd] px-2.5 py-1 rounded-full text-[11px] transition-colors border border-[#2d3449]/60"
                    >
                      + {kw}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 2: LOCATION & SPATIAL CATCHMENT SELECTOR                 */}
          {/* ============================================================== */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[#4edea3] text-[13px] font-medium">
                  <span className="material-symbols-outlined text-[18px]">pin_drop</span>
                  <span>Micro-Catchment &amp; Retail Agglomeration (SRS FR-2.1, FR-2.3)</span>
                </div>
                <h2 className="text-[28px] md:text-[34px] font-bold text-[#dae2fd] tracking-tight">
                  Where will your primary store or hub be located?
                </h2>
                <p className="text-[15px] text-[#bbcabf] max-w-3xl leading-relaxed">
                  Our spatial intelligence engine will evaluate competitor clusters, footfall density proxy, and 10–15 km delivery corridors based on your target node.
                </p>
              </div>

              {/* Location Input & Fast-Select Chips */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[#bbcabf] flex items-center justify-between">
                    <span>Primary Operating Node, City, or Postal/ZIP Code <span className="text-[#ffb4ab]">*</span></span>
                    <span className="text-[11px] text-[#4edea3]">Worldwide Text &amp; Seeded Hubs Supported</span>
                  </label>
                  <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#4edea3] text-[22px]">
                      location_searching
                    </span>
                    <input
                      type="text"
                      value={formData.target_location}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData((prev) => ({ ...prev, target_location: val }));
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.target_location;
                          return copy;
                        });
                      }}
                      placeholder="e.g. Gulberg III, Lahore, Pakistan or 54000 or Austin, TX..."
                      className="w-full bg-[#060e20] text-[#dae2fd] text-[16px] pl-12 pr-40 py-3.5 rounded-xl border border-[#2d3449] focus:outline-none focus:ring-2 focus:ring-[#4edea3]"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1.5 bg-[#2d3449] px-3 py-1.5 rounded-lg text-[#4cd7f6] text-[11px] font-medium border border-[#2d3449]">
                      <span className="w-2 h-2 rounded-full bg-[#4cd7f6]"></span>
                      <span>Verified Trade Node</span>
                    </div>
                  </div>
                  {errors.target_location && (
                    <span className="text-[#ffb4ab] text-[12px] font-medium flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {errors.target_location}
                    </span>
                  )}
                </div>

                {/* Quick Hub Chips */}
                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-[11px] text-[#bbcabf] uppercase tracking-wider font-semibold">
                    Fast-Select Commercial Trade Corridors:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {COMMERCIAL_HUB_PRESETS.map((hub) => {
                      const isSelected = formData.target_location.includes(hub.name);

                      return (
                        <button
                          key={hub.name}
                          type="button"
                          onClick={() => handleSelectHub(hub)}
                          className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all border ${
                            isSelected
                              ? 'bg-[#4edea3] text-[#003824] font-semibold border-[#4edea3] shadow-md ring-2 ring-[#4edea3]/40'
                              : 'bg-[#171f33] text-[#dae2fd] border-[#2d3449] hover:bg-[#222a3d]'
                          }`}
                        >
                          {hub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Radar Spatial Map Visual Container */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Map Simulation */}
                <div className="lg:col-span-8 bg-[#060e20] border border-[#2d3449] rounded-xl relative overflow-hidden min-h-[360px] p-5 flex flex-col justify-between shadow-2xl">
                  {/* Topographic grid simulation */}
                  <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#86948a" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-pattern)" />
                    <path d="M-10,120 Q180,90 320,160 T680,110 T1100,240" fill="none" opacity="0.4" stroke="#4cd7f6" strokeDasharray="6,4" strokeWidth="2" />
                    <path d="M220,-20 Q240,180 290,380" fill="none" opacity="0.3" stroke="#86948a" strokeWidth="1.5" />
                    <path d="M540,-20 Q480,210 520,440" fill="none" opacity="0.3" stroke="#86948a" strokeWidth="1.5" />
                  </svg>

                  {/* Pulsing Radar Ring Buffer */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                      className="rounded-full bg-[#4edea3]/10 transition-all duration-300 flex items-center justify-center border border-[#4edea3]/20"
                      style={{
                        width: `${Math.min(360, Math.max(160, Number(formData.radius_km || 10) * 16))}px`,
                        height: `${Math.min(360, Math.max(160, Number(formData.radius_km || 10) * 16))}px`
                      }}
                    >
                      <div className="w-3/4 h-3/4 rounded-full bg-[#4edea3]/15 transition-all flex items-center justify-center">
                        <div className="w-1/2 h-1/2 rounded-full bg-[#4edea3]/20 animate-pulse"></div>
                      </div>
                    </div>
                  </div>

                  {/* Top Overlays */}
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="bg-[#171f33]/90 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 border border-[#2d3449] shadow-lg">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#4edea3] animate-ping"></span>
                      <span className="text-[12px] font-medium text-[#dae2fd]">GIS Catchment Active</span>
                    </div>
                    <div className="bg-[#171f33]/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-[12px] font-mono text-[#4cd7f6] border border-[#2d3449] shadow-lg">
                      Lat: {Number(formData.lat || 31.5204).toFixed(4)}° N, Lng: {Number(formData.lng || 74.3587).toFixed(4)}° E
                    </div>
                  </div>

                  {/* Central Node Pin */}
                  <div className="relative z-10 my-auto flex flex-col items-center justify-center">
                    <div className="bg-[#4edea3] text-[#003824] px-3.5 py-1 rounded-full text-[12px] font-bold shadow-xl -mb-1 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">storefront</span>
                      <span>Target Flagship Location</span>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-[#4edea3] flex items-center justify-center shadow-lg ring-4 ring-[#4edea3]/40">
                      <div className="w-2 h-2 rounded-full bg-[#003824]"></div>
                    </div>
                  </div>

                  {/* Competitor Beacons simulation */}
                  <div className="relative z-10 flex justify-between items-center px-4">
                    <div className="bg-[#171f33]/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[#ffb4ab] flex items-center gap-1 shadow-md text-[11px] border border-[#2d3449]">
                      <span className="material-symbols-outlined text-[13px]">warning</span>
                      <span>Competitor Cluster A (0.8km)</span>
                    </div>
                    <div className="bg-[#171f33]/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[#4cd7f6] flex items-center gap-1 shadow-md text-[11px] border border-[#2d3449]">
                      <span className="material-symbols-outlined text-[13px]">local_shipping</span>
                      <span>Logistics Hub (1.4km)</span>
                    </div>
                    <div className="bg-[#171f33]/90 backdrop-blur-sm px-2.5 py-1 rounded-md text-[#ffb4ab] flex items-center gap-1 shadow-md text-[11px] border border-[#2d3449]">
                      <span className="material-symbols-outlined text-[13px]">warning</span>
                      <span>Competitor Cluster B (2.1km)</span>
                    </div>
                  </div>

                  {/* Bottom Map Bar Status */}
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-[#171f33]/85 backdrop-blur-md p-3 rounded-xl border border-[#2d3449] mt-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#4edea3] text-[18px]">radar</span>
                      <span className="text-[13px] text-[#dae2fd]">Catchment Buffer Radius:</span>
                      <span className="text-[14px] font-bold text-[#4edea3]">{formData.radius_km} km</span>
                    </div>
                    <div className="text-[12px] text-[#bbcabf]">
                      OpenStreetMap Data Layer: <span className="text-[#4edea3] font-medium">Ready for Ingestion</span>
                    </div>
                  </div>
                </div>

                {/* Spatial Parameter & Slider Panel */}
                <div className="lg:col-span-4 bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 flex flex-col justify-between gap-4 shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[17px] font-semibold text-[#dae2fd]">Delivery Catchment</h3>
                      <span className="bg-[#4cd7f6]/10 text-[#4cd7f6] px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                        Dynamic GIS
                      </span>
                    </div>
                    <p className="text-[13px] text-[#bbcabf] leading-relaxed">
                      Adjust the dispatch threshold to calibrate 15–30 min hyper-local delivery coverage and competitor scanning scope.
                    </p>

                    {/* Radius Slider */}
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[12px] text-[#bbcabf]">Buffer Radius</span>
                        <span className="text-[16px] font-bold text-[#4edea3]">{formData.radius_km} km</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="25"
                        step="0.5"
                        value={formData.radius_km}
                        onChange={(e) => setFormData((prev) => ({ ...prev, radius_km: parseFloat(e.target.value) }))}
                        className="w-full accent-[#4edea3] bg-[#222a3d] rounded-lg cursor-pointer h-2"
                      />
                      <div className="flex justify-between text-[11px] text-[#bbcabf]">
                        <span>5 km (Micro)</span>
                        <span>10–15 km (SRS Std)</span>
                        <span>25 km (Metro)</span>
                      </div>
                    </div>

                    {/* Live Catchment Indicators */}
                    <div className="flex flex-col gap-3 pt-2">
                      <div className="p-3.5 rounded-xl bg-[#171f33] border border-[#2d3449] flex flex-col gap-1">
                        <span className="text-[11px] text-[#bbcabf] uppercase tracking-wider font-semibold">
                          Estimated Addressable Reach
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[26px] font-bold text-[#dae2fd]">
                            {reachCount.toLocaleString()}
                          </span>
                          <span className="text-[13px] text-[#bbcabf]">households</span>
                        </div>
                        <span className="text-[11px] text-[#4edea3] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">timer</span>
                          Within 15-min delivery window
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#171f33] border border-[#2d3449] flex flex-col gap-1">
                        <span className="text-[11px] text-[#bbcabf] uppercase tracking-wider font-semibold">
                          Competitor Saturation Proxy
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-[15px] font-bold text-[#4edea3]">
                            {saturationPercent}% ({saturationPercent < 30 ? 'Low Risk' : saturationPercent < 60 ? 'Moderate' : 'High Competition'})
                          </span>
                          <span className="material-symbols-outlined text-[#4edea3] text-[18px]">query_stats</span>
                        </div>
                        <div className="w-full bg-[#2d3449] h-2 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-[#4edea3] h-full rounded-full transition-all duration-300"
                            style={{ width: `${saturationPercent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#2d3449]/40 border border-[#2d3449] text-[#bbcabf] text-[12px] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">lightbulb</span>
                    <span>Pro-tip: 10–15 km gives highest accuracy for urban retail footfall calculations.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 3: BUDGET & OPERATIONAL CAPITAL RUNWAY                   */}
          {/* ============================================================== */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[#4edea3] text-[13px] font-medium">
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                  <span>Capital Runway &amp; Unit Economics (SRS FR-2.1, FR-2.4)</span>
                </div>
                <h2 className="text-[28px] md:text-[34px] font-bold text-[#dae2fd] tracking-tight">
                  Set your budget and business scope
                </h2>
                <p className="text-[15px] text-[#bbcabf] max-w-3xl leading-relaxed">
                  Calibrate capital allocation, inventory runway, and storefront physical footprint for commercial viability testing.
                </p>
              </div>

              {/* Budget Hero Allocation Panel */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[12px] font-semibold text-[#bbcabf] uppercase tracking-wider">
                      Total Initial Capital Allocation
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-[24px] font-bold text-[#4edea3]">
                        {currencySymbol}
                      </span>
                      <span className="text-[36px] md:text-[42px] font-bold text-[#dae2fd] tracking-tight">
                        {budgetNum.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Currency Toggle */}
                  <div className="flex items-center gap-1 bg-[#060e20] p-1.5 rounded-xl border border-[#2d3449]">
                    <button
                      type="button"
                      onClick={() => handleCurrencyChange('USD')}
                      className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                        formData.budget_currency === 'USD'
                          ? 'bg-[#4edea3] text-[#003824] shadow-md'
                          : 'text-[#bbcabf] hover:text-[#dae2fd]'
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCurrencyChange('PKR')}
                      className={`px-4 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                        formData.budget_currency === 'PKR'
                          ? 'bg-[#4edea3] text-[#003824] shadow-md'
                          : 'text-[#bbcabf] hover:text-[#dae2fd]'
                      }`}
                    >
                      PKR (Rs)
                    </button>
                  </div>
                </div>

                {/* Range Slider & Manual Input */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={formData.budget_currency === 'PKR' ? 10000 : 500}
                      max={formData.budget_currency === 'PKR' ? 50000000 : 250000}
                      step={formData.budget_currency === 'PKR' ? 50000 : 500}
                      value={formData.budget_amount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setFormData((prev) => ({ ...prev, budget_amount: val }));
                        setErrors((prev) => {
                          const copy = { ...prev };
                          delete copy.budget_amount;
                          return copy;
                        });
                      }}
                      className="w-full accent-[#4edea3] bg-[#222a3d] rounded-lg cursor-pointer h-3"
                    />
                    <div className="w-48 shrink-0">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbcabf] text-[13px] font-bold">
                          {formData.budget_currency === 'PKR' ? 'Rs' : '$'}
                        </span>
                        <input
                          type="number"
                          value={formData.budget_amount}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setFormData((prev) => ({ ...prev, budget_amount: val }));
                            setErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.budget_amount;
                              return copy;
                            });
                          }}
                          className="w-full bg-[#060e20] text-[#dae2fd] text-[14px] font-bold pl-9 pr-3 py-2 rounded-lg border border-[#2d3449] focus:outline-none focus:ring-2 focus:ring-[#4edea3]"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#bbcabf]">
                    <span>
                      {formData.budget_currency === 'PKR' ? 'Rs. 10,000 (Micro Bootstrap)' : '$500 (Micro Bootstrap)'}
                    </span>
                    <span>
                      {formData.budget_currency === 'PKR' ? 'Rs. 25,000,000 (Commercial)' : '$100,000 (Commercial)'}
                    </span>
                    <span>
                      {formData.budget_currency === 'PKR' ? 'Rs. 50,000,000+ (Scale Launch)' : '$250,000+ (Scale Launch)'}
                    </span>
                  </div>
                  {errors.budget_amount && (
                    <span className="text-[#ffb4ab] text-[12px] font-medium flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {errors.budget_amount}
                    </span>
                  )}
                </div>

                {/* Capital Breakdown Bar Graphic */}
                <div className="flex flex-col gap-2 pt-1 border-t border-[#2d3449]/60">
                  <div className="flex justify-between items-center text-[#dae2fd] text-[13px]">
                    <span className="font-medium">Algorithmically Optimized Capital Allocation:</span>
                    <span className="text-[#4edea3] font-semibold">100% Calibrated</span>
                  </div>

                  {/* Segmented Color Bar */}
                  <div className="w-full h-4 rounded-full overflow-hidden flex bg-[#222a3d] shadow-inner">
                    <div className="bg-[#4edea3] h-full transition-all duration-300" style={{ width: '45%' }} title="Inventory (45%)"></div>
                    <div className="bg-[#4cd7f6] h-full transition-all duration-300" style={{ width: '25%' }} title="Rent & Setup (25%)"></div>
                    <div className="bg-[#00b982] h-full transition-all duration-300" style={{ width: '18%' }} title="Marketing (18%)"></div>
                    <div className="bg-[#31394d] h-full transition-all duration-300" style={{ width: '12%' }} title="Buffer (12%)"></div>
                  </div>

                  {/* Allocation breakdown tiles */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                    <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col">
                      <div className="flex items-center gap-1.5 text-[#bbcabf] text-[11px]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#4edea3]"></span>
                        <span>Inventory &amp; Sourcing (45%)</span>
                      </div>
                      <span className="text-[16px] font-bold text-[#dae2fd] mt-1">
                        {currencyPrefix}{allocInv.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col">
                      <div className="flex items-center gap-1.5 text-[#bbcabf] text-[11px]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#4cd7f6]"></span>
                        <span>Rent &amp; Setup (25%)</span>
                      </div>
                      <span className="text-[16px] font-bold text-[#dae2fd] mt-1">
                        {currencyPrefix}{allocRent.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col">
                      <div className="flex items-center gap-1.5 text-[#bbcabf] text-[11px]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00b982]"></span>
                        <span>Marketing &amp; Ads (18%)</span>
                      </div>
                      <span className="text-[16px] font-bold text-[#dae2fd] mt-1">
                        {currencyPrefix}{allocMkt.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-[#171f33] p-3 rounded-xl border border-[#2d3449] flex flex-col">
                      <div className="flex items-center gap-1.5 text-[#bbcabf] text-[11px]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#31394d]"></span>
                        <span>Emergency Buffer (12%)</span>
                      </div>
                      <span className="text-[16px] font-bold text-[#dae2fd] mt-1">
                        {currencyPrefix}{allocBuf.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Model & Shop Footprint */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Operating Model Radio Cards */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 flex flex-col gap-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[17px] font-semibold text-[#dae2fd]">Operating Channel Architecture</h3>
                    <span className="text-[#bbcabf] text-[11px] font-semibold">SRS FR-2.5</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    <label
                      onClick={() => setFormData((p) => ({ ...p, business_model: 'd2c' }))}
                      className={`cursor-pointer p-4 rounded-xl flex items-start gap-3 transition-all border ${
                        formData.business_model === 'd2c'
                          ? 'bg-[#222a3d] border-[#4edea3] ring-1 ring-[#4edea3]/40'
                          : 'bg-[#171f33] border-[#2d3449] hover:bg-[#222a3d]/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="biz-model"
                        checked={formData.business_model === 'd2c'}
                        onChange={() => setFormData((p) => ({ ...p, business_model: 'd2c' }))}
                        className="mt-1 accent-[#4edea3]"
                      />
                      <div className="flex flex-col">
                        <span className="text-[14px] font-semibold text-[#dae2fd]">Online Only (D2C Cloud Store)</span>
                        <span className="text-[12px] text-[#bbcabf] leading-snug">
                          Lower overhead capex, rapid 7-day launch, direct courier fulfillment &amp; dark warehouse.
                        </span>
                      </div>
                    </label>

                    <label
                      onClick={() => setFormData((p) => ({ ...p, business_model: 'hybrid' }))}
                      className={`cursor-pointer p-4 rounded-xl flex items-start gap-3 transition-all border ${
                        formData.business_model === 'hybrid'
                          ? 'bg-[#222a3d] border-[#4edea3] ring-1 ring-[#4edea3]/40'
                          : 'bg-[#171f33] border-[#2d3449] hover:bg-[#222a3d]/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="biz-model"
                        checked={formData.business_model === 'hybrid'}
                        onChange={() => setFormData((p) => ({ ...p, business_model: 'hybrid' }))}
                        className="mt-1 accent-[#4edea3]"
                      />
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-[#dae2fd]">Physical Retail + Online Hybrid</span>
                          <span className="bg-[#4edea3]/20 text-[#4edea3] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            Recommended
                          </span>
                        </div>
                        <span className="text-[12px] text-[#bbcabf] leading-snug">
                          High footfall synergy, walk-in showroom, premium brand trust &amp; omni-channel pickup.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Physical Storefront Footprint Picker */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 flex flex-col justify-between gap-4 shadow-sm">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[17px] font-semibold text-[#dae2fd]">Storefront Footprint Target</h3>
                      <span className="text-[#4cd7f6] text-[11px] font-semibold">Spatial Fit</span>
                    </div>
                    <p className="text-[13px] text-[#bbcabf]">
                      Target square footage for inventory density &amp; display shelving calculations.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {FOOTPRINT_OPTIONS.map((fp) => {
                      const isSelected = formData.storefront_footprint === fp.id;

                      return (
                        <button
                          key={fp.id}
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, storefront_footprint: fp.id }))}
                          className={`p-3.5 rounded-xl text-left transition-all flex flex-col border ${
                            isSelected
                              ? 'bg-[#4edea3] text-[#003824] border-[#4edea3] shadow-md ring-2 ring-[#4edea3]/40'
                              : 'bg-[#171f33] text-[#dae2fd] border-[#2d3449] hover:bg-[#222a3d]'
                          }`}
                        >
                          <span className="text-[13px] font-bold leading-tight">{fp.label}</span>
                          <span className={`text-[11px] mt-0.5 ${isSelected ? 'text-[#003824]/90 font-medium' : 'text-[#bbcabf]'}`}>
                            {fp.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="bg-[#171f33] p-3 rounded-lg border border-[#2d3449] flex items-center justify-between text-[#bbcabf] text-[12px]">
                    <span>Commercial Lease Estimate in Selected Area:</span>
                    <span className="text-[#dae2fd] font-semibold">
                      {formData.budget_currency === 'PKR' ? 'Rs. 75,000 - 140,000 / mo' : '$350 - 600 / mo'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 4: ADVANCED AUDIENCE, SCALE & PRODUCT SCOPE              */}
          {/* ============================================================== */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[#4edea3] text-[13px] font-medium">
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  <span>Advanced Venture Options (SRS FR-2.2)</span>
                </div>
                <h2 className="text-[28px] md:text-[34px] font-bold text-[#dae2fd] tracking-tight">
                  Define your audience, scale &amp; catalog specifications
                </h2>
                <p className="text-[15px] text-[#bbcabf] max-w-3xl leading-relaxed">
                  These optional attributes allow our multi-AI engine to tailor feasibility recommendations specifically to your venture profile.
                </p>
              </div>

              {/* Business Scale Selection (Small, Medium, Large) */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-3">
                <label className="text-[15px] font-semibold text-[#dae2fd] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4edea3] text-[18px]">straighten</span>
                  Planned Business Scale (SRS FR-2.2)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {BUSINESS_SCALE_OPTIONS.map((scale) => {
                    const isSelected = formData.business_scale === scale.id;

                    return (
                      <div
                        key={scale.id}
                        onClick={() => setFormData((p) => ({ ...p, business_scale: scale.id }))}
                        className={`cursor-pointer p-4 rounded-xl transition-all border flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#222a3d] border-[#4edea3] ring-1 ring-[#4edea3]/40'
                            : 'bg-[#171f33] border-[#2d3449] hover:bg-[#222a3d]/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[14px] font-bold text-[#dae2fd]">{scale.label}</span>
                          {isSelected && (
                            <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
                              check_circle
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#bbcabf] leading-snug">{scale.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Target Audience Demographics */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold text-[#dae2fd] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[18px]">group</span>
                    Target Audience Demographics (Optional)
                  </h3>
                  <span className="text-[11px] text-[#bbcabf]">Inclusive &amp; Non-Discriminatory</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Age Group */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-medium text-[#bbcabf]">Target Age Group</label>
                    <select
                      value={formData.target_audience.age_group || ''}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          target_audience: { ...p.target_audience, age_group: e.target.value }
                        }))
                      }
                      className="w-full bg-[#060e20] text-[#dae2fd] text-[13px] px-3.5 py-2.5 rounded-xl border border-[#2d3449] focus:outline-none focus:ring-2 focus:ring-[#4edea3]"
                    >
                      <option value="">Select Target Age Group...</option>
                      {AGE_GROUP_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Gender Focus */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-medium text-[#bbcabf]">Gender Demographics</label>
                    <select
                      value={formData.target_audience.gender || ''}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          target_audience: { ...p.target_audience, gender: e.target.value }
                        }))
                      }
                      className="w-full bg-[#060e20] text-[#dae2fd] text-[13px] px-3.5 py-2.5 rounded-xl border border-[#2d3449] focus:outline-none focus:ring-2 focus:ring-[#4edea3]"
                    >
                      <option value="">Select Gender Focus...</option>
                      {GENDER_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Income Level */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-medium text-[#bbcabf]">Household Income Bracket</label>
                    <select
                      value={formData.target_audience.income_level || ''}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          target_audience: { ...p.target_audience, income_level: e.target.value }
                        }))
                      }
                      className="w-full bg-[#060e20] text-[#dae2fd] text-[13px] px-3.5 py-2.5 rounded-xl border border-[#2d3449] focus:outline-none focus:ring-2 focus:ring-[#4edea3]"
                    >
                      <option value="">Select Income Bracket...</option>
                      {INCOME_LEVEL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Product Types and Specification Upload */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Product Type Tags */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 flex flex-col justify-between gap-4 shadow-sm">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-semibold text-[#dae2fd] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#4edea3] text-[18px]">category</span>
                      Target Product Types &amp; SKUs
                    </label>
                    <p className="text-[12px] text-[#bbcabf]">
                      Add the main product categories or key items you plan to offer.
                    </p>

                    <div className="flex items-center gap-2 mt-1">
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
                        placeholder="e.g. Mountain Honey, Cold-pressed Oil..."
                        className="flex-1 bg-[#060e20] text-[#dae2fd] text-[13px] px-3.5 py-2 rounded-xl border border-[#2d3449] focus:outline-none focus:ring-2 focus:ring-[#4edea3]"
                      />
                      <button
                        type="button"
                        onClick={addProductType}
                        className="bg-[#2d3449] hover:bg-[#31394d] text-[#dae2fd] px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors border border-[#2d3449]"
                      >
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 min-h-[44px]">
                      {formData.product_types.map((type, idx) => (
                        <span
                          key={idx}
                          className="bg-[#171f33] text-[#dae2fd] px-3 py-1 rounded-full text-[12px] flex items-center gap-1.5 border border-[#2d3449]"
                        >
                          <span>{type}</span>
                          <button
                            type="button"
                            onClick={() => removeProductType(idx)}
                            className="text-[#bbcabf] hover:text-[#ffb4ab]"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {formData.product_types.length === 0 && (
                        <span className="text-[12px] text-[#bbcabf] italic">No custom product tags added yet.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Document Specification Upload */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 flex flex-col justify-between gap-3 shadow-sm">
                  <div className="flex flex-col gap-1">
                    <label className="text-[15px] font-semibold text-[#dae2fd] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#4edea3] text-[18px]">upload_file</span>
                      Product Catalog or Specification (Optional)
                    </label>
                    <p className="text-[12px] text-[#bbcabf]">
                      Upload your catalog spreadsheet, PDF spec, or inventory breakdown (Max 5MB • PDF, CSV, JSON, PNG, JPG).
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-[#2d3449] hover:border-[#4edea3]/60 rounded-xl p-5 text-center flex flex-col items-center justify-center gap-2 transition-colors bg-[#060e20]">
                    <span className="material-symbols-outlined text-[#4edea3] text-[32px]">
                      {uploadingFile ? 'sync' : 'cloud_upload'}
                    </span>
                    <div className="flex flex-col text-[12px]">
                      {uploadedFileName ? (
                        <span className="text-[#4edea3] font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          {uploadedFileName}
                        </span>
                      ) : (
                        <>
                          <span className="text-[#dae2fd] font-medium">
                            {uploadingFile ? 'Uploading document...' : 'Click to select or drag and drop file'}
                          </span>
                          <span className="text-[#bbcabf]">Files are stored privately in your secure tenant partition</span>
                        </>
                      )}
                    </div>
                    <label className="mt-1 cursor-pointer bg-[#2d3449] hover:bg-[#31394d] text-[#dae2fd] text-[12px] font-semibold px-4 py-1.5 rounded-lg transition-colors border border-[#2d3449]">
                      <span>{uploadedFileName ? 'Replace File' : 'Browse File'}</span>
                      <input
                        type="file"
                        accept=".pdf,.csv,.json,.png,.jpg,.jpeg"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={uploadingFile}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* STEP 5: REVIEW & FINAL SUBMISSION                            */}
          {/* ============================================================== */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-6 w-full animate-fadeIn">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-[#4edea3] text-[13px] font-medium">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Review &amp; Submit Idea (SRS FR-2.1, FR-2.6)</span>
                </div>
                <h2 className="text-[28px] md:text-[34px] font-bold text-[#dae2fd] tracking-tight">
                  Review your business idea before feasibility submission
                </h2>
                <p className="text-[15px] text-[#bbcabf] max-w-3xl leading-relaxed">
                  Verify the parameters of your venture. Upon submission, this idea will be securely persisted and queued for Module 3 Smart Data Aggregation &amp; XGBoost Feasibility Scoring.
                </p>
              </div>

              {/* Review Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* 1. Category & Vision */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider">
                        Commercial Vertical
                      </span>
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="text-[#4edea3] hover:underline text-[12px] font-medium"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[#4edea3]/20 text-[#4edea3] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px]">store</span>
                      </div>
                      <span className="text-[17px] font-bold text-[#dae2fd]">{formData.category}</span>
                    </div>
                    {formData.custom_category && (
                      <p className="text-[12px] text-[#4cd7f6] mb-2 font-medium">
                        Niche: {formData.custom_category}
                      </p>
                    )}
                    <p className="text-[12px] text-[#bbcabf] leading-relaxed italic line-clamp-3">
                      &quot;{formData.product_description || 'No custom description provided.'}&quot;
                    </p>
                  </div>
                </div>

                {/* 2. Location & Catchment */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider">
                        Operating Node &amp; Radius
                      </span>
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className="text-[#4edea3] hover:underline text-[12px] font-medium"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[#4cd7f6]/20 text-[#4cd7f6] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px]">pin_drop</span>
                      </div>
                      <span className="text-[16px] font-bold text-[#dae2fd] truncate">
                        {formData.target_location}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-[12px] text-[#bbcabf]">
                      <div className="flex justify-between">
                        <span>Catchment Radius:</span>
                        <span className="font-semibold text-[#4edea3]">{formData.radius_km} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estimated Reach:</span>
                        <span className="font-semibold text-[#dae2fd]">{reachCount.toLocaleString()} households</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Coordinates:</span>
                        <span className="font-mono text-[#bbcabf]">
                          {Number(formData.lat || 31.5204).toFixed(3)}°N, {Number(formData.lng || 74.3587).toFixed(3)}°E
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Budget & Allocation */}
                <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider">
                        Capital Allocation
                      </span>
                      <button
                        type="button"
                        onClick={() => goToStep(3)}
                        className="text-[#4edea3] hover:underline text-[12px] font-medium"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-[26px] font-bold text-[#4edea3]">
                        {currencyPrefix}{budgetNum.toLocaleString()}
                      </span>
                      <span className="text-[12px] text-[#bbcabf] font-mono">({formData.budget_currency})</span>
                    </div>
                    <div className="flex flex-col gap-1 text-[12px] text-[#bbcabf]">
                      <div className="flex justify-between">
                        <span>Inventory (45%):</span>
                        <span className="font-semibold text-[#dae2fd]">{currencyPrefix}{allocInv.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rent &amp; Setup (25%):</span>
                        <span className="font-semibold text-[#dae2fd]">{currencyPrefix}{allocRent.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Operating Model:</span>
                        <span className="font-semibold text-[#4edea3] uppercase">{formData.business_model}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Audience, Scale & Product Details Review */}
              <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-5 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-[#dae2fd] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[18px]">tune</span>
                    Advanced Audience &amp; Scale Profile
                  </h3>
                  <button
                    type="button"
                    onClick={() => goToStep(4)}
                    className="text-[#4edea3] hover:underline text-[12px] font-medium"
                  >
                    Edit
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
                  <div className="bg-[#171f33] p-3 rounded-lg border border-[#2d3449]">
                    <span className="text-[#bbcabf] block mb-1">Business Scale:</span>
                    <span className="font-semibold text-[#dae2fd] capitalize">{formData.business_scale}</span>
                  </div>
                  <div className="bg-[#171f33] p-3 rounded-lg border border-[#2d3449]">
                    <span className="text-[#bbcabf] block mb-1">Age Group:</span>
                    <span className="font-semibold text-[#dae2fd]">{formData.target_audience.age_group || 'General'}</span>
                  </div>
                  <div className="bg-[#171f33] p-3 rounded-lg border border-[#2d3449]">
                    <span className="text-[#bbcabf] block mb-1">Gender Focus:</span>
                    <span className="font-semibold text-[#dae2fd]">{formData.target_audience.gender || 'Unisex'}</span>
                  </div>
                  <div className="bg-[#171f33] p-3 rounded-lg border border-[#2d3449]">
                    <span className="text-[#bbcabf] block mb-1">Income Level:</span>
                    <span className="font-semibold text-[#dae2fd]">{formData.target_audience.income_level || 'Mass Market'}</span>
                  </div>
                </div>

                {formData.product_types.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[12px] text-[#bbcabf]">Product Types:</span>
                    {formData.product_types.map((t, idx) => (
                      <span key={idx} className="bg-[#222a3d] text-[#4edea3] text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#2d3449]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {uploadedFileName && (
                  <div className="flex items-center gap-2 text-[12px] text-[#4cd7f6] pt-1">
                    <span className="material-symbols-outlined text-[16px]">attachment</span>
                    <span>Attached Document: {uploadedFileName}</span>
                  </div>
                )}
              </div>

              {/* Factual Integrity Banner (SRS Boundary Safeguard) */}
              <div className="bg-[#171f33] border border-[#4edea3]/30 rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#4edea3]/20 text-[#4edea3] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">verified_user</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] font-semibold text-[#dae2fd]">
                    Ready for Downstream Feasibility Ingestion
                  </span>
                  <p className="text-[13px] text-[#bbcabf] leading-relaxed">
                    By submitting this project, your inputs will be recorded in PostgreSQL with status <code className="text-[#4edea3]">submitted</code>, and an associated <code className="text-[#4edea3]">feasibility_reports</code> record with status <code className="text-[#4edea3]">pending</code> will be initialized. No placeholder scores or fabricated competitor records are presented until Module 3 data collection is performed.
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
          {/* Left: Previous CTA & Step Tracker */}
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
                  style={{ width: `${(currentStep / 5) * 100}%` }}
                ></div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-[#dae2fd]">
                  Step {currentStep} of 5 ({Math.round((currentStep / 5) * 100)}%)
                </span>
                <span className="text-[10px] text-[#bbcabf] hidden sm:inline">Auto-saved to cloud</span>
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
              ) : currentStep === 5 ? (
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
            Powered by OpenStreetMap POI Discovery • Multi-LLM Orchestration • 0.00–1.00 Continuous Viability Scoring
          </span>
        </div>
      </aside>
    </div>
  );
}
