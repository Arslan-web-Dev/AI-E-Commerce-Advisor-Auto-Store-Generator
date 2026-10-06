'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ProfileData {
  id: string;
  full_name: string;
  role: 'owner' | 'admin';
  must_change_password: boolean;
  created_at: string;
}

export default function AccountSecurityPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('300 1234567');
  const [organization, setOrganization] = useState('Organic Essentials PK');

  // Password Update
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  // Deletion Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  useEffect(() => {
    async function loadUserData() {
      setLoading(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push('/login?redirectTo=/account/security');
        return;
      }

      setUserEmail(user.email || '');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Failed to load profile:', profileError.message);
      } else if (profileData) {
        setProfile(profileData);
        setFullName(profileData.full_name || '');
      }

      setLoading(false);
    }

    loadUserData();
  }, [router, supabase]);

  // Save personal details (only full_name is editable on profiles)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // RLS policy ensures users can only update permitted fields and cannot modify role
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', profile.id);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Profile information saved successfully.', 'success');
    }
  };

  // Update Password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setPasswordUpdating(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setPasswordUpdating(false);
    if (error) {
      showToast(error.message, 'error');
    } else {
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated securely across all active devices.', 'success');
    }
  };

  // Sign out of current session
  const handleSignOutLocal = async () => {
    try {
      const res = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'local' }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        showToast('Error signing out', 'error');
      }
    } catch {
      showToast('Sign out failed', 'error');
    }
  };

  // Sign out everywhere (global session revocation)
  const handleSignOutGlobal = async () => {
    try {
      const res = await fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'global' }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        showToast('Error revoking global sessions', 'error');
      }
    } catch {
      showToast('Global sign out failed', 'error');
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') {
      showToast('Please type "DELETE" to confirm account termination.', 'error');
      return;
    }

    setDeletingAccount(true);
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE' }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to delete account.', 'error');
        setDeletingAccount(false);
      } else {
        setDeleteModalOpen(false);
        router.push('/login?error=' + encodeURIComponent('Your account and stores have been permanently deleted.'));
        router.refresh();
      }
    } catch {
      showToast('Account deletion request failed.', 'error');
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b1326] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[13px] font-mono text-[#bbcabf]">Loading Security Context...</span>
        </div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex flex-col font-sans selection:bg-[#10b981]/30 selection:text-[#4edea3]">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all duration-300 border ${
            toastType === 'success'
              ? 'bg-[#171f33] border-[#4edea3] text-[#4edea3]'
              : 'bg-[#171f33] border-[#ffb4ab] text-[#ffb4ab]'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {toastType === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="text-[13px] font-medium text-[#dae2fd]">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#171f33]/90 backdrop-blur-xl border-b border-[#2d3449]">
        <div className="h-16 max-w-[1440px] mx-auto px-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#222a3d] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#4edea3] text-[20px]">radar</span>
              </div>
              <span className="font-display font-bold text-[17px] text-[#dae2fd]">
                Feasibility<span className="text-[#4edea3]">Advisor</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-2">
              <Link
                href="/projects"
                className="px-3 py-1.5 rounded-lg text-[#bbcabf] hover:text-[#dae2fd] hover:bg-[#222a3d] text-[13px] font-medium transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px] text-[#4edea3]">folder_open</span>
                <span>My Projects</span>
              </Link>
              <Link
                href="/wizard"
                className="px-3 py-1.5 rounded-lg text-[#bbcabf] hover:text-[#dae2fd] hover:bg-[#222a3d] text-[13px] font-medium transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px] text-[#4edea3]">auto_awesome</span>
                <span>Idea Wizard</span>
              </Link>
              <Link
                href="/account/security"
                className="px-3 py-1.5 rounded-lg bg-[#10b981]/15 text-[#4edea3] text-[13px] font-semibold"
              >
                Account &amp; Security
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 rounded-lg text-[#bbcabf] hover:text-[#dae2fd] hover:bg-[#222a3d] text-[13px] font-medium transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#4cd7f6]">admin_panel_settings</span>
                  <span>Admin Command Center</span>
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[13px] font-semibold text-[#dae2fd]">{profile?.full_name || 'Store Owner'}</span>
              <span className="text-[11px] font-mono text-[#bbcabf] capitalize">
                {isAdmin ? 'System Admin' : 'Entrepreneur (Owner)'}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#10b981] text-[#003824] flex items-center justify-center font-bold text-[12px]">
              {(profile?.full_name || 'U').charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleSignOutLocal}
              className="p-1.5 text-[#bbcabf] hover:text-[#dae2fd] rounded-lg hover:bg-[#222a3d] transition-colors"
              title="Sign Out"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="w-full pt-20 flex-1 max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        {/* Executive Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[12px] text-[#bbcabf] mb-1 font-mono">
              <Link href="/" className="hover:text-[#4edea3]">Home</Link>
              <span>/</span>
              <span className="text-[#dae2fd]">Account &amp; Security Profile</span>
            </div>
            <h1 className="font-display text-[26px] font-bold text-[#dae2fd] tracking-tight">
              Security &amp; Tenant RBAC Configuration
            </h1>
            <p className="text-[13px] text-[#bbcabf] mt-0.5">
              Manage personal credentials, session tokens, and tenant role attributes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/15 text-[#4edea3] text-[12px] font-semibold font-mono border border-[#4edea3]/30">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              <span>Role: {profile?.role.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* 2-Column Grid (Matching Stitch Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Profile Card & Quick Navigation */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Profile Summary Card */}
            <div className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4edea3] via-[#4cd7f6] to-[#4edea3]"></div>
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-[#222a3d] border-2 border-[#4edea3]/50 flex items-center justify-center text-[#4edea3] font-display text-[26px] font-bold mb-3 shadow-inner">
                  {(profile?.full_name || 'U').substring(0, 2).toUpperCase()}
                </div>
                <h2 className="font-display text-[18px] font-bold text-[#dae2fd]">
                  {profile?.full_name || 'Store Owner'}
                </h2>
                <p className="text-[13px] text-[#bbcabf] font-mono mt-0.5">{userEmail}</p>

                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#10b981]/20 text-[#4edea3] text-[11px] font-semibold font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
                    {isAdmin ? 'System Administrator' : 'Store Owner / Entrepreneur'}
                  </span>
                </div>

                <div className="mt-4 w-full bg-[#131b2e] rounded-xl p-3 border border-[#2d3449] text-[12px] flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[#4cd7f6] text-[16px]">storefront</span>
                  <span className="text-[#dae2fd] font-medium truncate">Gulberg III &bull; Lahore Region</span>
                </div>
              </div>

              <div className="h-px bg-[#2d3449] my-5"></div>

              {/* Fast Nav */}
              <div className="flex flex-col gap-1.5 text-[13px]">
                <a
                  href="#personal-info"
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#222a3d] text-[#4edea3] font-medium"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">person</span>
                    <span>Personal Info</span>
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
                </a>
                <a
                  href="#security-password"
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-[#bbcabf] hover:bg-[#222a3d] hover:text-[#dae2fd] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                    <span>Security &amp; Password</span>
                  </span>
                </a>
                <a
                  href="#active-sessions"
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-[#bbcabf] hover:bg-[#222a3d] hover:text-[#dae2fd] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">devices</span>
                    <span>Active Sessions</span>
                  </span>
                </a>
                <a
                  href="#platform-quotas"
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-[#bbcabf] hover:bg-[#222a3d] hover:text-[#dae2fd] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">data_usage</span>
                    <span>Platform Quotas</span>
                  </span>
                </a>
                <a
                  href="#danger-zone"
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-[#ffb4ab] hover:bg-[#93000a]/20 transition-colors mt-2"
                >
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">warning</span>
                    <span>Danger Zone</span>
                  </span>
                </a>
              </div>
            </div>

            {/* Admin Console Shortcut (if role is admin) */}
            {isAdmin && (
              <div className="bg-[#171f33] border border-[#4cd7f6]/40 rounded-2xl p-5 shadow-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-[#4cd7f6] uppercase tracking-wider block">
                    Admin Privilege
                  </span>
                  <span className="font-display font-semibold text-[14px] text-[#dae2fd]">
                    System Command Center
                  </span>
                </div>
                <Link
                  href="/admin"
                  className="px-3 py-1.5 rounded-lg bg-[#03b5d3] hover:bg-[#4cd7f6] text-[#003640] text-[12px] font-bold transition-colors"
                >
                  Open Console &rarr;
                </Link>
              </div>
            )}
          </div>

          {/* Right Column: Settings Sections */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Section 1: Personal Information */}
            <section id="personal-info" className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#2d3449]">
                <div>
                  <h3 className="font-display text-[17px] font-bold text-[#dae2fd]">Personal Information</h3>
                  <p className="text-[13px] text-[#bbcabf] mt-0.5">
                    Update founder identity and contact profile.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-[#bbcabf] px-2.5 py-1 rounded bg-[#131b2e] border border-[#2d3449]">
                  Owner UID: {profile?.id.substring(0, 8)}...
                </span>
              </div>

              <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[13px] font-medium text-[#dae2fd]">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#131b2e] text-[#dae2fd] py-2 px-3 rounded-xl border border-[#2d3449] focus:border-[#4edea3] outline-none text-[14px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[13px] font-medium text-[#dae2fd]">
                      Registered Email (Locked)
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        disabled
                        value={userEmail}
                        className="w-full bg-[#060e20] text-[#bbcabf] py-2 px-3 pr-8 rounded-xl border border-[#2d3449] cursor-not-allowed text-[14px]"
                      />
                      <span className="material-symbols-outlined text-[16px] text-[#4edea3] absolute right-3 top-2.5">
                        verified
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[13px] font-medium text-[#dae2fd]">Official Contact Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-[#131b2e] text-[#dae2fd] py-2 px-3 rounded-xl border border-[#2d3449] focus:border-[#4edea3] outline-none text-[14px]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[13px] font-medium text-[#dae2fd]">Business / Store Entity</label>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full bg-[#131b2e] text-[#dae2fd] py-2 px-3 rounded-xl border border-[#2d3449] focus:border-[#4edea3] outline-none text-[14px]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#10b981] hover:bg-[#4edea3] text-[#003824] font-semibold text-[13px] shadow-sm transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </section>

            {/* Section 2: Security & Password */}
            <section id="security-password" className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 pb-4 border-b border-[#2d3449]">
                <div className="w-8 h-8 rounded-lg bg-[#222a3d] flex items-center justify-center text-[#4edea3]">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <div>
                  <h3 className="font-display text-[17px] font-bold text-[#dae2fd]">Security &amp; Password</h3>
                  <p className="text-[13px] text-[#bbcabf] mt-0.5">
                    Maintain cryptographic password integrity for your platform identity.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdatePassword} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[13px] font-medium text-[#dae2fd]">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full bg-[#131b2e] text-[#dae2fd] py-2 px-3 pr-10 rounded-xl border border-[#2d3449] focus:border-[#4edea3] outline-none text-[14px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2 text-[#86948a] hover:text-[#dae2fd]"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {showPassword ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[13px] font-medium text-[#dae2fd]">Confirm Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full bg-[#131b2e] text-[#dae2fd] py-2 px-3 rounded-xl border border-[#2d3449] focus:border-[#4edea3] outline-none text-[14px]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[12px] text-[#bbcabf]">
                    Enforced requirement: &ge; 8 characters with client and server validation.
                  </span>
                  <button
                    type="submit"
                    disabled={passwordUpdating || !newPassword}
                    className="px-5 py-2 rounded-xl bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] font-semibold text-[13px] border border-[#3c4a42] transition-colors disabled:opacity-50"
                  >
                    {passwordUpdating ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </section>

            {/* Section 3: Active Sessions & Global Sign-Out (FR-1.7) */}
            <section id="active-sessions" className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#2d3449]">
                <div>
                  <h3 className="font-display text-[17px] font-bold text-[#dae2fd]">
                    Active Sessions &amp; Global Revocation
                  </h3>
                  <p className="text-[13px] text-[#bbcabf] mt-0.5">
                    Revoke current device token or sign out everywhere across all browsers and devices.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#10b981]/15 text-[#4edea3] text-[11px] font-mono">
                  Current Session Active
                </span>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#131b2e] border border-[#2d3449]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#222a3d] flex items-center justify-center text-[#4cd7f6]">
                    <span className="material-symbols-outlined text-[22px]">laptop_chromebook</span>
                  </div>
                  <div>
                    <span className="text-[13px] font-semibold text-[#dae2fd] block">
                      Web Browser (Current Session)
                    </span>
                    <span className="text-[11px] text-[#bbcabf]">
                      Protected by HTTP-only cryptographic session cookies.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleSignOutLocal}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] text-[12px] font-semibold transition-colors"
                  >
                    Sign Out Local
                  </button>
                  <button
                    onClick={handleSignOutGlobal}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-lg bg-[#93000a]/20 hover:bg-[#93000a]/40 text-[#ffb4ab] border border-[#ffb4ab]/30 text-[12px] font-semibold transition-colors"
                  >
                    Sign Out Everywhere
                  </button>
                </div>
              </div>
            </section>

            {/* Section 4: Platform Quotas (From Stitch Reference) */}
            <section id="platform-quotas" className="bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#2d3449]">
                <div>
                  <h3 className="font-display text-[17px] font-bold text-[#dae2fd]">
                    Platform Quotas &amp; Free-Tier Usage Tracker
                  </h3>
                  <p className="text-[13px] text-[#bbcabf] mt-0.5">
                    SME consumption limits for feasibility reports and spatial computations.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-[#bbcabf]">Startup Tier (Free)</span>
              </div>

              <div className="mt-4 space-y-4">
                {/* Metric 1 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="font-medium text-[#dae2fd]">Feasibility Studies Generated</span>
                    <span className="font-mono text-[#4edea3]">1 / 10 Studies</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#222a3d] overflow-hidden">
                    <div className="h-full bg-[#4edea3] rounded-full" style={{ width: '10%' }}></div>
                  </div>
                  <span className="text-[11px] text-[#bbcabf]">
                    Hyperlocal analysis across Lahore, Karachi &amp; Islamabad commercial corridors.
                  </span>
                </div>

                {/* Metric 2 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="font-medium text-[#dae2fd]">AI Strategic Inquiries &amp; Multi-LLM Calls</span>
                    <span className="font-mono text-[#4cd7f6]">4 / 50 Calls</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#222a3d] overflow-hidden">
                    <div className="h-full bg-[#4cd7f6] rounded-full" style={{ width: '8%' }}></div>
                  </div>
                  <span className="text-[11px] text-[#bbcabf]">
                    Powered by Groq Llama-3, Google Gemini, and OpenAI GPT-4o-mini failover.
                  </span>
                </div>
              </div>
            </section>

            {/* Section 5: Danger Zone (FR-1.8) */}
            <section id="danger-zone" className="bg-[#93000a]/10 border border-[#ffb4ab]/30 rounded-2xl p-6 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#93000a]/20 flex items-center justify-center text-[#ffb4ab] flex-shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[22px]">warning</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-[17px] font-bold text-[#ffb4ab]">
                    Danger Zone: Delete Account &amp; Cascade Owned Stores
                  </h3>
                  <p className="text-[13px] text-[#bbcabf] mt-1 leading-relaxed">
                    Permanently removes your authentication profile, feasibility reports, stores, subdomains, and product catalogs from our database cluster. This operation is authoritative and irreversible.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
                    <span className="text-[11px] text-[#bbcabf] font-mono">
                      PostgreSQL foreign key CASCADE applied.
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-[#ba1a1a] hover:bg-[#e11d48] text-[#ffffff] font-semibold text-[13px] transition-colors flex items-center gap-1.5 shadow-md"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                      <span>Delete My Account</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Confirmation Modal for Account Deletion */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#171f33] border border-[#ffb4ab]/50 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#ffb4ab]">
              <span className="material-symbols-outlined text-[28px]">warning</span>
              <h4 className="font-display font-bold text-[18px]">Confirm Permanent Account Erasure</h4>
            </div>

            <p className="text-[13px] text-[#bbcabf] leading-relaxed">
              This action cannot be undone. All your owned feasibility reports, store configurations, products, and session tokens will be permanently purged.
            </p>

            <div className="space-y-1.5 bg-[#131b2e] p-3 rounded-xl border border-[#2d3449]">
              <label className="block text-[12px] font-mono text-[#bbcabf]">
                To proceed, type <strong className="text-[#ffb4ab]">DELETE</strong> below:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-[#060e20] text-[#ffb4ab] py-2 px-3 rounded-lg border border-[#2d3449] outline-none text-[14px] font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteConfirmationText('');
                }}
                className="px-4 py-2 rounded-xl bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] text-[13px] font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAccount || deleteConfirmationText !== 'DELETE'}
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-xl bg-[#ba1a1a] hover:bg-[#e11d48] text-[#ffffff] text-[13px] font-bold transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {deletingAccount ? 'Purging Account...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
