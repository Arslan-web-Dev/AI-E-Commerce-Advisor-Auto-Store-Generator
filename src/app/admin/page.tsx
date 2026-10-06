'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface SyncAuditLog {
  id: string;
  repository: string;
  branch: string;
  commit_sha?: string;
  status: 'success' | 'failed';
  exported_keys: string[];
  error_message?: string;
  created_at: string;
}

export default function AdminCommandCenterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success?: boolean;
    message?: string;
    commit_sha?: string;
    repository?: string;
    error?: string;
  } | null>(null);

  const [auditLogs, setAuditLogs] = useState<SyncAuditLog[]>([]);

  // Time state for UTC / PKT clocks
  const [utcTime, setUtcTime] = useState('');
  const [pktTime, setPktTime] = useState('');

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setUtcTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'UTC',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' UTC'
      );
      setPktTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Karachi',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' PKT'
      );
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function verifyAdmin() {
      setLoading(true);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login?redirectTo=/admin');
        return;
      }

      // Authoritative profile check
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.role !== 'admin') {
        router.push('/account/security?error=unauthorized_admin');
        return;
      }

      setIsAdmin(true);
      loadAuditLogs();
      setLoading(false);
    }

    verifyAdmin();
  }, [router, supabase]);

  const loadAuditLogs = async () => {
    const { data, error } = await supabase
      .from('config_sync_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setAuditLogs(data as SyncAuditLog[]);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        setSyncResult({
          success: false,
          error: data.error || 'GitHub sync failed.',
        });
      } else {
        setSyncResult({
          success: true,
          message: data.message,
          commit_sha: data.commit_sha,
          repository: data.repository,
        });
        loadAuditLogs();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error executing sync';
      setSyncResult({ success: false, error: msg });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1326] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#4cd7f6] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[13px] font-mono text-[#bbcabf]">Authorizing Admin Clearance...</span>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex flex-col font-sans selection:bg-[#10b981]/30 selection:text-[#4edea3]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#171f33]/90 backdrop-blur-xl border-b border-[#2d3449]">
        <div className="h-16 max-w-[1440px] mx-auto px-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#222a3d] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">admin_panel_settings</span>
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-[16px] text-[#dae2fd] leading-tight">
                  FeasibilityAdvisor
                </span>
                <span className="text-[10px] uppercase tracking-wider font-mono text-[#4cd7f6]">
                  Admin Infrastructure
                </span>
              </div>
            </Link>

            <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded bg-[#03b5d3]/15 text-[#4cd7f6] text-[10px] font-mono font-bold tracking-wider uppercase border border-[#03b5d3]/30">
              PLATFORM SUPERADMIN
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-[#131b2e] border border-[#2d3449] font-mono text-[11px] text-[#bbcabf]">
              <span>{utcTime}</span>
              <span className="text-[#3c4a42]">|</span>
              <span className="text-[#4edea3] font-semibold">{pktTime}</span>
            </div>

            <Link
              href="/account/security"
              className="text-[13px] text-[#bbcabf] hover:text-[#dae2fd] transition-colors"
            >
              Account Profile
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full pt-20 flex-1 max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        {/* Title & Telemetry Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[#bbcabf] mb-1">
              <span className="px-2 py-0.5 rounded bg-[#131b2e] text-[#4edea3]">SYSTEM LEVEL 4</span>
              <span>&bull;</span>
              <span>PostgreSQL 16 &bull; RLS Forced</span>
            </div>
            <h1 className="font-display text-[26px] font-bold text-[#dae2fd] tracking-tight">
              System Admin Command Center
            </h1>
            <p className="text-[13px] text-[#bbcabf] mt-0.5">
              Platform administration, versioned configuration sync, and edge advisory health telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/15 text-[#4edea3] text-[12px] font-semibold font-mono border border-[#4edea3]/30">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span>Cluster Status: Operational</span>
            </div>
          </div>
        </div>

        {/* 4 High-Density Metric Nodes (Stitch Reference) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#4edea3]"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-mono uppercase text-[#bbcabf]">RBAC Policy</span>
              <span className="material-symbols-outlined text-[#4edea3] text-[20px]">shield</span>
            </div>
            <div className="font-display text-[22px] font-bold text-[#dae2fd]">Owner &bull; Admin</div>
            <p className="text-[11px] text-[#bbcabf] mt-1">
              Default role: owner &bull; Elevation via bootstrap only
            </p>
          </div>

          <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#4cd7f6]"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-mono uppercase text-[#bbcabf]">Auth Engine</span>
              <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">key</span>
            </div>
            <div className="font-display text-[22px] font-bold text-[#dae2fd]">Supabase SSR</div>
            <p className="text-[11px] text-[#bbcabf] mt-1">
              Email + Google OAuth &bull; Session refresh active
            </p>
          </div>

          <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#45dfa4]"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-mono uppercase text-[#bbcabf]">Database Security</span>
              <span className="material-symbols-outlined text-[#45dfa4] text-[20px]">verified_user</span>
            </div>
            <div className="font-display text-[22px] font-bold text-[#dae2fd]">RLS Enforced</div>
            <p className="text-[11px] text-[#bbcabf] mt-1">
              Security definer helpers &bull; Search path pinned
            </p>
          </div>

          <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#10b981]"></div>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-mono uppercase text-[#bbcabf]">GitHub Sync</span>
              <span className="material-symbols-outlined text-[#10b981] text-[20px]">sync</span>
            </div>
            <div className="font-display text-[22px] font-bold text-[#dae2fd]">SRS FR-1.6</div>
            <p className="text-[11px] text-[#bbcabf] mt-1">
              Versioned non-PII config &bull; REST API integration
            </p>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: GitHub REST Sync Control Center (FR-1.6) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#2d3449]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#222a3d] flex items-center justify-center text-[#4cd7f6]">
                    <span className="material-symbols-outlined text-[22px]">cloud_sync</span>
                  </div>
                  <div>
                    <h2 className="font-display text-[18px] font-bold text-[#dae2fd]">
                      System GitHub REST Sync (SRS FR-1.6)
                    </h2>
                    <p className="text-[12px] text-[#bbcabf]">
                      Push versioned system configuration snapshot to GitHub repository.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerSync}
                  disabled={syncing}
                  className="px-4 py-2 rounded-xl bg-[#10b981] hover:bg-[#4edea3] text-[#003824] font-bold text-[13px] shadow-lg shadow-[#10b981]/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {syncing ? (
                    <div className="w-4 h-4 border-2 border-[#003824] border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span className="material-symbols-outlined text-[18px]">sync</span>
                  )}
                  <span>{syncing ? 'Pushing Sync...' : 'Trigger Sync'}</span>
                </button>
              </div>

              {/* Data Integrity & Security Guarantee Callout */}
              <div className="mt-4 p-4 rounded-xl bg-[#131b2e] border border-[#3c4a42]/50 text-[12px] text-[#bbcabf] space-y-2">
                <div className="flex items-center gap-2 text-[#4edea3] font-semibold">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  <span>Non-PII &amp; Secret Isolation Policy</span>
                </div>
                <p className="leading-relaxed">
                  The export payload strictly excludes all user profiles, emails, feasibility reports, store owner records, passwords, and API keys. Only operational presets (seed commercial hubs, scoring thresholds, theme presets, and aggregated rent-cache metrics) are pushed.
                </p>
              </div>

              {/* Sync Result Feedback */}
              {syncResult && (
                <div
                  className={`mt-4 p-4 rounded-xl border text-[13px] flex items-start gap-3 ${
                    syncResult.success
                      ? 'bg-[#059669]/15 border-[#4edea3]/40 text-[#4edea3]'
                      : 'bg-[#93000a]/20 border-[#ffb4ab]/40 text-[#ffb4ab]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
                    {syncResult.success ? 'check_circle' : 'error'}
                  </span>
                  <div className="space-y-1">
                    <p className="font-semibold text-[#dae2fd]">
                      {syncResult.success ? 'Configuration Sync Completed' : 'Configuration Sync Notice'}
                    </p>
                    <p className="text-[12px] text-[#bbcabf]">
                      {syncResult.message || syncResult.error}
                    </p>
                    {syncResult.commit_sha && (
                      <p className="text-[11px] font-mono text-[#4edea3]">
                        Commit SHA: {syncResult.commit_sha} &bull; Repo: {syncResult.repository}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Sync Audit History */}
              <div className="mt-6">
                <h3 className="text-[13px] font-semibold text-[#dae2fd] uppercase tracking-wider font-mono mb-3">
                  Configuration Sync Audit Log
                </h3>

                {auditLogs.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#131b2e] border border-[#2d3449] text-center text-[12px] text-[#bbcabf]">
                    No sync events recorded yet. Trigger your first sync above.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-[#131b2e] border border-[#2d3449] flex flex-col gap-1 text-[12px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[#dae2fd] font-semibold">{log.repository}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                              log.status === 'success'
                                ? 'bg-[#10b981]/20 text-[#4edea3]'
                                : 'bg-[#93000a]/20 text-[#ffb4ab]'
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#bbcabf] font-mono">
                          <span>
                            {new Date(log.created_at).toLocaleString('en-US', {
                              timeZone: 'Asia/Karachi',
                            })}{' '}
                            PKT
                          </span>
                          {log.commit_sha && (
                            <span>SHA: {log.commit_sha.substring(0, 7)}</span>
                          )}
                        </div>
                        {log.error_message && (
                          <p className="text-[11px] text-[#ffb4ab] mt-1 font-mono">
                            Error: {log.error_message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Platform Telemetry & Reference Config Items */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Approved Non-PII Configuration Items Preview */}
            <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 shadow-xl">
              <h3 className="font-display text-[16px] font-bold text-[#dae2fd] mb-1">
                Approved Export Items
              </h3>
              <p className="text-[12px] text-[#bbcabf] mb-4">
                These datasets are eligible for versioned system exports.
              </p>

              <div className="space-y-3 text-[12px]">
                <div className="p-3 rounded-xl bg-[#131b2e] border border-[#2d3449]">
                  <div className="flex items-center justify-between font-mono text-[#4edea3]">
                    <span>scoring_thresholds</span>
                    <span className="text-[10px] text-[#bbcabf]">XGBoost</span>
                  </div>
                  <p className="text-[11px] text-[#bbcabf] mt-1">
                    Continuous boundaries: 0.75 (Low), 0.55 (Moderate), 0.35 (High), &lt;0.35 (Critical).
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#131b2e] border border-[#2d3449]">
                  <div className="flex items-center justify-between font-mono text-[#4cd7f6]">
                    <span>seed_commercial_hubs</span>
                    <span className="text-[10px] text-[#bbcabf]">GIS Hubs</span>
                  </div>
                  <p className="text-[11px] text-[#bbcabf] mt-1">
                    Pre-seeded retail centers: Gulberg III, Liberty, Saddar, Clifton, Blue Area.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#131b2e] border border-[#2d3449]">
                  <div className="flex items-center justify-between font-mono text-[#45dfa4]">
                    <span>theme_presets</span>
                    <span className="text-[10px] text-[#bbcabf]">Configurator</span>
                  </div>
                  <p className="text-[11px] text-[#bbcabf] mt-1">
                    Color palettes, navbar styles, and storefront grid layouts.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#131b2e] border border-[#2d3449]">
                  <div className="flex items-center justify-between font-mono text-[#10b981]">
                    <span>rent_cache_snapshot</span>
                    <span className="text-[10px] text-[#bbcabf]">Rent Registry</span>
                  </div>
                  <p className="text-[11px] text-[#bbcabf] mt-1">
                    Aggregated commercial rent per sq. ft. by city and area with sample size.
                  </p>
                </div>
              </div>
            </div>

            {/* Bootstrap & Admin Security Note */}
            <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 shadow-xl space-y-3 text-[12px] text-[#bbcabf]">
              <div className="flex items-center gap-2 text-[#4edea3] font-semibold">
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Administrator Governance</span>
              </div>
              <p className="leading-relaxed">
                Platform admin privileges are granted exclusively through secure server-side bootstrap (`scripts/seed-admin.mjs`) or by an existing administrator. User-submitted signup payloads cannot elevate roles.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
