'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Reveal from '@/components/ui/Reveal';

function UpdatePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isForced = searchParams.get('forced') === 'true';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [userRole, setUserRole] = useState<'owner' | 'admin'>('owner');

  const supabase = createClient();

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, must_change_password')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.role) {
          setUserRole(profile.role);
        }
      }
    }
    checkUser();
  }, [supabase]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (password.length < 8) {
      setErrorMessage('New password must be at least 8 characters in length.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setLoading(true);

    try {
      // Complete the password change and the privileged flag update server-side.
      // Success is reported only when both operations succeed on the server.
      const response = await fetch('/api/auth/complete-password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirm_password: confirmPassword }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Covers both Auth password failures and profile-completion failures.
        // The form remains available so the user can safely retry.
        setErrorMessage(payload?.error || 'Password update failed. Please try again.');
        setLoading(false);
        return;
      }

      setSuccessMessage('Password updated successfully! Redirecting to your dashboard...');

      setTimeout(() => {
        if (userRole === 'admin') {
          router.push('/admin');
        } else {
          router.push('/account/security');
        }
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Password update failed';
      setErrorMessage(msg);
      setLoading(false);
    }
  };

  return (
    <Reveal>
    <div className="min-h-screen bg-[#0b1326] flex flex-col justify-center items-center p-4 selection:bg-[#10b981]/30 selection:text-[#4edea3]">
      <div className="w-full max-w-md glass-strong ui-card-3d rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <div className="w-12 h-12 rounded-xl bg-[#10b981]/15 text-[#4edea3] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[26px]">key</span>
          </div>
          <h1 className="font-display text-[24px] font-bold text-[#dae2fd]">
            {isForced ? 'Security Requirement: Update Password' : 'Set New Account Password'}
          </h1>
          <p className="text-[13px] text-[#bbcabf] mt-1.5 leading-relaxed">
            {isForced
              ? 'Your account was initialized with a temporary password. You must choose a secure permanent password before proceeding.'
              : 'Choose a strong, unique password to secure your Feasibility Advisor workspace.'}
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-[#93000a]/20 border border-[#ffb4ab]/40 text-[#ffb4ab] text-[13px] flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-[#059669]/20 border border-[#4edea3]/40 text-[#4edea3] text-[13px] flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">check_circle</span>
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-[#dae2fd]" htmlFor="newPassword">
              New Password
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-3 text-[18px] text-[#86948a]">
                lock
              </span>
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full bg-[#131b2e] text-[#dae2fd] placeholder:text-[#86948a] py-2.5 px-4 pl-10 pr-10 rounded-xl border border-[#2d3449] outline-none focus:border-[#4edea3] transition-colors text-[14px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-[#86948a] hover:text-[#dae2fd]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[13px] font-medium text-[#dae2fd]" htmlFor="confirmPassword">
              Confirm New Password
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3.5 top-3 text-[18px] text-[#86948a]">
                lock_clock
              </span>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-[#131b2e] text-[#dae2fd] placeholder:text-[#86948a] py-2.5 px-4 pl-10 rounded-xl border border-[#2d3449] outline-none focus:border-[#4edea3] transition-colors text-[14px]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#10b981] hover:bg-[#4edea3] text-[#003824] font-bold text-[14px] py-3 rounded-xl shadow-lg shadow-[#10b981]/25 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[#003824] border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>Save Password &amp; Continue</span>
            )}
          </button>
        </form>
      </div>
    </div>
    </Reveal>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b1326] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#4edea3] border-t-transparent animate-spin"></div>
        </div>
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
