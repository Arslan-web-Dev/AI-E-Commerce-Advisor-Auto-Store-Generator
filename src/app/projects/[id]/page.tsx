'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Project, PREDEFINED_CATEGORIES } from '@/types/project';
import MarketDataPanel from '@/components/data-collection/MarketDataPanel';
import FeatureQualityPanel from '@/components/data-processing/FeatureQualityPanel';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function loadProject() {
      try {
        setLoading(true);
        const res = await fetch(`/api/projects/${id}`);
        if (res.status === 401) {
          router.push(`/login?redirectTo=/projects/${id}`);
          return;
        }
        if (res.status === 403) {
          setError('Access denied: You do not have permission to view this project.');
          return;
        }
        if (!res.ok) {
          setError('Project not found or service unavailable.');
          return;
        }

        const data = await res.json();
        setProject(data.project);
      } catch {
        setError('Network error loading project details.');
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1326] flex items-center justify-center text-[#dae2fd]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[13px] font-mono text-[#bbcabf]">Loading Project Record...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex flex-col justify-between">
        <header className="h-16 border-b border-[#2d3449] flex items-center px-6">
          <Link href="/projects" className="text-[14px] text-[#4edea3] hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Back to Projects</span>
          </Link>
        </header>
        <div className="max-w-md mx-auto p-8 text-center flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-[48px] text-[#ffb4ab]">error</span>
          <h1 className="text-[20px] font-bold text-[#dae2fd]">Unable to Display Project</h1>
          <p className="text-[13px] text-[#bbcabf]">{error || 'Project record does not exist.'}</p>
          <Link
            href="/projects"
            className="bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] px-4 py-2 rounded-xl text-[13px] font-semibold"
          >
            Return to Projects
          </Link>
        </div>
        <div></div>
      </div>
    );
  }

  const isSubmitted = project.status !== 'draft';
  const currencyPrefix = project.budget_currency === 'PKR' ? 'Rs. ' : '$ ';
  const budgetNum = Number(project.budget_amount) || 0;
  const categoryMeta = PREDEFINED_CATEGORIES.find((c) => c.name === project.category);

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans flex flex-col justify-between selection:bg-[#10b981]/30 selection:text-[#4edea3]">
      {/* Top Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0b1326]/90 backdrop-blur-xl border-b border-[#2d3449]/50 shadow-[0_1px_8px_rgba(0,0,0,0.2)]">
        <div className="h-16 max-w-[1440px] mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="text-[#bbcabf] hover:text-[#dae2fd] flex items-center gap-1 text-[13px] font-medium"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>All Projects</span>
            </Link>
            <span className="text-[#2d3449]">|</span>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-[#dae2fd] truncate max-w-xs">
                {project.title || `${project.category} Project`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isSubmitted ? (
              <span className="bg-[#4edea3]/15 text-[#4edea3] border border-[#4edea3]/30 px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
                <span>Submitted • Ready for Feasibility Engine</span>
              </span>
            ) : (
              <Link
                href={`/wizard/${project.id}`}
                className="bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-4 py-1.5 rounded-xl text-[12px] font-bold shadow-md transition-all flex items-center gap-1"
              >
                <span>Continue Wizard</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full pt-24 pb-20 flex-1 flex flex-col">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col gap-6">
          {/* Submission Confirmation Hero Banner */}
          {isSubmitted ? (
            <div className="w-full bg-[#131b2e] border border-[#4edea3]/40 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-[#4edea3]/5 blur-3xl pointer-events-none"></div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#4edea3]/20 border border-[#4edea3]/40 text-[#4edea3] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[28px]">check_circle</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-[22px] md:text-[26px] font-bold text-[#dae2fd] tracking-tight">
                      Business Idea Persisted &amp; Submitted
                    </h1>
                    <span className="bg-[#4edea3]/20 text-[#4edea3] text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase">
                      ID: {project.id.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-[14px] text-[#bbcabf] max-w-2xl leading-relaxed">
                    This business idea has been recorded in PostgreSQL. It is now awaiting execution of Module 3 Smart Data Aggregation (OpenStreetMap Overpass POI collection, rent scraping cache, and Google Trends).
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#bbcabf] pt-2 font-mono">
                    {project.submitted_at && (
                      <span>Submitted: {new Date(project.submitted_at).toLocaleString()}</span>
                    )}
                    {project.report_id && (
                      <span className="text-[#4cd7f6]">Linked Report ID: {project.report_id.slice(0, 8)}...</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <Link
                  href="/projects"
                  className="bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] px-5 py-2.5 rounded-xl text-[13px] font-semibold text-center border border-[#2d3449] transition-all"
                >
                  All Projects
                </Link>
                <Link
                  href={`/projects/${project.id}/storefront-wizard`}
                  className="bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] px-5 py-2.5 rounded-xl text-[13px] font-semibold text-center border border-[#2d3449] transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">palette</span>
                  Storefront Wizard
                </Link>
                <Link
                  href={`/projects/${project.id}/store`}
                  className="bg-[#222a3d] hover:bg-[#2d3449] text-[#f59e0b] px-5 py-2.5 rounded-xl text-[13px] font-semibold text-center border border-[#2d3449] transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">storefront</span>
                  Manage Store
                </Link>
                <Link
                  href="/wizard"
                  className="bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-5 py-2.5 rounded-xl text-[13px] font-bold text-center shadow-[0_0_20px_rgba(78,222,163,0.3)] transition-all"
                >
                  + New Business Idea
                </Link>
              </div>
            </div>
          ) : (
            <div className="w-full bg-[#131b2e] border border-[#d97706]/40 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#d97706]/20 text-[#d97706] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[28px]">pending_actions</span>
                </div>
                <div>
                  <h1 className="text-[20px] font-bold text-[#dae2fd]">Draft in Progress</h1>
                  <p className="text-[13px] text-[#bbcabf]">
                    This idea has been saved as a draft at Step {project.current_step} of 5. You can resume editing and submit it when ready.
                  </p>
                </div>
              </div>
              <Link
                href={`/wizard/${project.id}`}
                className="bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-5 py-2.5 rounded-xl text-[13px] font-bold whitespace-nowrap"
              >
                Resume in Wizard
              </Link>
            </div>
          )}

          {/* Structured Parameters Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Commercial Vertical Card */}
            <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#bbcabf] text-[12px] uppercase font-semibold tracking-wider">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
                  {categoryMeta?.icon || 'storefront'}
                </span>
                <span>Commercial Archetype</span>
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-[#dae2fd]">{project.category}</h3>
                {project.custom_category && (
                  <p className="text-[13px] text-[#4cd7f6] mt-0.5 font-medium">Niche: {project.custom_category}</p>
                )}
              </div>
              {project.product_description && (
                <p className="text-[13px] text-[#bbcabf] italic leading-relaxed pt-2 border-t border-[#2d3449]/60">
                  &quot;{project.product_description}&quot;
                </p>
              )}
            </div>

            {/* Spatial Location Card */}
            <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#bbcabf] text-[12px] uppercase font-semibold tracking-wider">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">pin_drop</span>
                <span>Operating Hub &amp; Catchment</span>
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-[#dae2fd] truncate">{project.target_location}</h3>
                <p className="text-[13px] text-[#bbcabf] mt-0.5">
                  Buffer Radius: <span className="text-[#4edea3] font-semibold">{project.radius_km} km</span>
                </p>
              </div>
              <div className="text-[12px] text-[#86948a] font-mono pt-2 border-t border-[#2d3449]/60">
                Coordinates: {Number(project.lat || 31.5204).toFixed(4)}° N, {Number(project.lng || 74.3587).toFixed(4)}° E
              </div>
            </div>

            {/* Budget & Runway Card */}
            <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[#bbcabf] text-[12px] uppercase font-semibold tracking-wider">
                <span className="material-symbols-outlined text-[#4edea3] text-[18px]">account_balance_wallet</span>
                <span>Capital Runway</span>
              </div>
              <div>
                <span className="text-[28px] font-bold text-[#4edea3]">
                  {currencyPrefix}{budgetNum.toLocaleString()}
                </span>
                <span className="text-[12px] text-[#bbcabf] font-mono ml-1.5">({project.budget_currency})</span>
              </div>
              <div className="flex flex-col gap-1 text-[12px] text-[#bbcabf] pt-2 border-t border-[#2d3449]/60">
                <div className="flex justify-between">
                  <span>Operating Channel:</span>
                  <span className="font-semibold text-[#dae2fd] uppercase">{project.business_model}</span>
                </div>
                <div className="flex justify-between">
                  <span>Target Footprint:</span>
                  <span className="font-semibold text-[#dae2fd] capitalize">{project.storefront_footprint}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Profile & Document Details */}
          <div className="bg-[#131b2e] border border-[#2d3449]/60 rounded-xl p-6 shadow-sm flex flex-col gap-4">
            <h3 className="text-[16px] font-bold text-[#dae2fd] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4edea3] text-[20px]">tune</span>
              <span>Advanced Feasibility Parameters &amp; Specifications</span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
              <div className="bg-[#171f33] p-3.5 rounded-xl border border-[#2d3449]">
                <span className="text-[#bbcabf] block mb-1 text-[11px] uppercase tracking-wider font-semibold">
                  Business Scale
                </span>
                <span className="font-bold text-[#dae2fd] capitalize">{project.business_scale}</span>
              </div>

              <div className="bg-[#171f33] p-3.5 rounded-xl border border-[#2d3449]">
                <span className="text-[#bbcabf] block mb-1 text-[11px] uppercase tracking-wider font-semibold">
                  Target Age Group
                </span>
                <span className="font-bold text-[#dae2fd]">{project.target_audience?.age_group || 'General'}</span>
              </div>

              <div className="bg-[#171f33] p-3.5 rounded-xl border border-[#2d3449]">
                <span className="text-[#bbcabf] block mb-1 text-[11px] uppercase tracking-wider font-semibold">
                  Gender Focus
                </span>
                <span className="font-bold text-[#dae2fd]">{project.target_audience?.gender || 'Unisex'}</span>
              </div>

              <div className="bg-[#171f33] p-3.5 rounded-xl border border-[#2d3449]">
                <span className="text-[#bbcabf] block mb-1 text-[11px] uppercase tracking-wider font-semibold">
                  Income Segment
                </span>
                <span className="font-bold text-[#dae2fd]">{project.target_audience?.income_level || 'Mass Market'}</span>
              </div>
            </div>

            {project.product_types && project.product_types.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-[12px] text-[#bbcabf]">Target Products:</span>
                {project.product_types.map((t, idx) => (
                  <span
                    key={idx}
                    className="bg-[#222a3d] text-[#4edea3] text-[12px] font-medium px-3 py-1 rounded-full border border-[#2d3449]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            {project.product_file_name && (
              <div className="bg-[#171f33] p-3.5 rounded-xl border border-[#2d3449] flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2 text-[#4cd7f6]">
                  <span className="material-symbols-outlined text-[18px]">attachment</span>
                  <span className="font-medium">Attached Catalog: {project.product_file_name}</span>
                </div>
                {project.product_file_size && (
                  <span className="text-[11px] font-mono text-[#bbcabf]">
                    {(project.product_file_size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Module 3: Aggregated Market Intelligence Panel */}
          {isSubmitted && <MarketDataPanel projectId={project.id} isSubmitted={isSubmitted} />}

          {/* Module 4: Feature Engineering & Data Quality Panel */}
          {isSubmitted && <FeatureQualityPanel projectId={project.id} isSubmitted={isSubmitted} />}

          {/* Module Boundary & Architecture Integrity Statement */}
          <div className="bg-[#060e20] border border-[#2d3449] rounded-xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-[#10b981]/15 text-[#4edea3] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">info</span>
            </div>
            <div className="flex flex-col gap-1 text-[13px]">
              <span className="font-semibold text-[#dae2fd]">
                Module 3 &amp; 4 Data Pipeline &amp; Architecture Integrity
              </span>
              <p className="text-[#bbcabf] leading-relaxed">
                Module 3 aggregates raw competitor, demographic, search trend, and cost metrics. Module 4 cleans, deduplicates, and deterministically computes feature vectors (competitors count, category saturation, budget ratio, normalized demand vector) and auditable quality runs. Downstream predictive feasibility scoring and ML inference are strictly reserved for Module 5.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
