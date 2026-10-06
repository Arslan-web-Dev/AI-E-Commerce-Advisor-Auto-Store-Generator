'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Project, PREDEFINED_CATEGORIES } from '@/types/project';

export default function ProjectsListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'submitted'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      if (res.status === 401) {
        router.push('/login?redirectTo=/projects');
        return;
      }
      if (!res.ok) {
        showToast('Failed to load project records', 'error');
        return;
      }
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
      showToast('Network error loading projects', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDeleteDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this draft? This cannot be undone.')) return;

    try {
      setDeletingId(id);
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        showToast(err.error || 'Failed to delete draft', 'error');
      } else {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        showToast('Draft project deleted', 'success');
      }
    } catch {
      showToast('Error deleting draft', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (filter === 'draft') return p.status === 'draft';
    if (filter === 'submitted') return p.status !== 'draft';
    return true;
  });

  const getCategoryIcon = (categoryName: string) => {
    const found = PREDEFINED_CATEGORIES.find((c) => c.name === categoryName);
    return found ? found.icon : 'storefront';
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] font-sans flex flex-col justify-between selection:bg-[#10b981]/30 selection:text-[#4edea3]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 border ${
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

      {/* Header */}
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
              <span className="text-[11px] text-[#bbcabf] font-mono">Business Projects</span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/wizard"
              className="bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-4 py-2 rounded-xl text-[13px] font-bold shadow-[0_0_20px_rgba(78,222,163,0.3)] transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>New Business Idea</span>
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

      {/* Main Content Area */}
      <main className="w-full pt-24 pb-20 flex-1 flex flex-col">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col gap-6">
          {/* Top Title & Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#2d3449]/60">
            <div>
              <h1 className="text-[28px] md:text-[32px] font-bold text-[#dae2fd] tracking-tight">
                My Business Ventures &amp; Projects
              </h1>
              <p className="text-[14px] text-[#bbcabf]">
                Manage your submitted feasibility analysis projects and in-progress drafts.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-[#131b2e] p-1.5 rounded-xl border border-[#2d3449] self-start md:self-auto">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  filter === 'all'
                    ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                    : 'text-[#bbcabf] hover:text-[#dae2fd]'
                }`}
              >
                All ({projects.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('draft')}
                className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  filter === 'draft'
                    ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                    : 'text-[#bbcabf] hover:text-[#dae2fd]'
                }`}
              >
                Drafts ({projects.filter((p) => p.status === 'draft').length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('submitted')}
                className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                  filter === 'submitted'
                    ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                    : 'text-[#bbcabf] hover:text-[#dae2fd]'
                }`}
              >
                Submitted ({projects.filter((p) => p.status !== 'draft').length})
              </button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-[#131b2e] border border-[#2d3449] rounded-xl p-6 h-60 animate-pulse flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#222a3d]"></div>
                    <div className="flex flex-col gap-2 w-3/4">
                      <div className="w-24 h-4 rounded bg-[#222a3d]"></div>
                      <div className="w-36 h-3 rounded bg-[#222a3d]"></div>
                    </div>
                  </div>
                  <div className="w-full h-8 rounded bg-[#222a3d]"></div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredProjects.length === 0 && (
            <div className="bg-[#131b2e] border border-[#2d3449] rounded-2xl p-10 md:p-16 text-center flex flex-col items-center justify-center gap-4 my-8">
              <div className="w-16 h-16 rounded-2xl bg-[#4edea3]/10 border border-[#4edea3]/20 flex items-center justify-center text-[#4edea3]">
                <span className="material-symbols-outlined text-[36px]">lightbulb</span>
              </div>
              <div className="flex flex-col gap-1 max-w-md">
                <h2 className="text-[20px] font-bold text-[#dae2fd]">
                  {filter === 'all' ? 'No business ideas created yet' : `No ${filter} projects found`}
                </h2>
                <p className="text-[13px] text-[#bbcabf] leading-relaxed">
                  Start your first venture feasibility audit in 3 minutes. Define your target vertical, location catchment, and budget runway.
                </p>
              </div>
              <Link
                href="/wizard"
                className="mt-2 bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] px-6 py-2.5 rounded-xl text-[14px] font-bold shadow-[0_0_20px_rgba(78,222,163,0.3)] transition-all flex items-center gap-2"
              >
                <span>Launch Guided Wizard</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>
          )}

          {/* Projects Grid */}
          {!loading && filteredProjects.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map((project) => {
                const isDraft = project.status === 'draft';
                const currencyPrefix = project.budget_currency === 'PKR' ? 'Rs. ' : '$ ';

                return (
                  <div
                    key={project.id}
                    className="bg-[#131b2e] border border-[#2d3449]/70 hover:border-[#4edea3]/50 rounded-xl p-5 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between gap-4 group"
                  >
                    {/* Header: Icon, Category & Status */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#222a3d] text-[#4edea3] flex items-center justify-center border border-[#2d3449]">
                            <span className="material-symbols-outlined text-[24px]">
                              {getCategoryIcon(project.category)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider block">
                              {project.category}
                            </span>
                            <h2 className="text-[16px] font-bold text-[#dae2fd] group-hover:text-[#4edea3] transition-colors leading-tight">
                              {project.title || `${project.category} Project`}
                            </h2>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {isDraft ? (
                          <span className="bg-[#d97706]/15 border border-[#d97706]/30 text-[#d97706] text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            Draft (Step {project.current_step}/5)
                          </span>
                        ) : (
                          <span className="bg-[#4edea3]/15 border border-[#4edea3]/30 text-[#4edea3] text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                            Submitted • Pending Analysis
                          </span>
                        )}
                      </div>

                      {/* Location & Radius */}
                      <div className="flex items-center gap-2 text-[12px] text-[#bbcabf]">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-[16px] shrink-0">
                          pin_drop
                        </span>
                        <span className="truncate">{project.target_location}</span>
                        <span className="text-[#86948a] font-mono shrink-0">({project.radius_km} km)</span>
                      </div>

                      {/* Budget */}
                      <div className="bg-[#171f33] p-3 rounded-lg border border-[#2d3449] flex items-center justify-between text-[12px]">
                        <span className="text-[#bbcabf]">Capital Runway:</span>
                        <span className="font-bold text-[#4edea3] text-[14px]">
                          {currencyPrefix}{Number(project.budget_amount).toLocaleString()}{' '}
                          <span className="text-[11px] font-mono text-[#bbcabf]">({project.budget_currency})</span>
                        </span>
                      </div>

                      {/* Product narrative snippet */}
                      {project.product_description && (
                        <p className="text-[12px] text-[#bbcabf] italic line-clamp-2 leading-relaxed">
                          &quot;{project.product_description}&quot;
                        </p>
                      )}
                    </div>

                    {/* Footer: Date & Actions */}
                    <div className="pt-3 border-t border-[#2d3449]/60 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#86948a] font-mono">
                        {new Date(project.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>

                      <div className="flex items-center gap-2">
                        {isDraft ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteDraft(project.id, e)}
                              disabled={deletingId === project.id}
                              className="text-[#86948a] hover:text-[#ffb4ab] p-1.5 rounded-lg hover:bg-[#222a3d] transition-colors"
                              title="Delete Draft"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>

                            <Link
                              href={`/wizard/${project.id}`}
                              className="bg-[#222a3d] hover:bg-[#4edea3] hover:text-[#003824] text-[#dae2fd] text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 border border-[#2d3449]"
                            >
                              <span>Continue Draft</span>
                              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </Link>
                          </>
                        ) : (
                          <Link
                            href={`/projects/${project.id}`}
                            className="bg-[#171f33] hover:bg-[#222a3d] text-[#4edea3] text-[12px] font-semibold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 border border-[#4edea3]/30"
                          >
                            <span>View Details</span>
                            <span className="material-symbols-outlined text-[14px]">visibility</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
