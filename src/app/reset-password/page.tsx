'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const supabase = createClient();

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        console.error('[Reset Password Error]:', error.message);
      }

      // Avoid account enumeration: always show success message regardless of whether email exists
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reset request failed';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1326] flex flex-col justify-center items-center p-4 selection:bg-[#10b981]/30 selection:text-[#4edea3]">
      <div className="w-full max-w-md bg-[#171f33] border border-[#2d3449] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Top Back Link */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#bbcabf] hover:text-[#dae2fd] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Sign In</span>
        </Link>

        <div>
          <div className="w-12 h-12 rounded-xl bg-[#10b981]/15 text-[#4edea3] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[26px]">lock_reset</span>
          </div>
          <h1 className="font-display text-[24px] font-bold text-[#dae2fd]">
            Reset Your Password
          </h1>
          <p className="text-[13px] text-[#bbcabf] mt-1.5 leading-relaxed">
            Enter your registered email address and we&apos;ll send you a cryptographic reset link.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-[#93000a]/20 border border-[#ffb4ab]/40 text-[#ffb4ab] text-[13px]">
            {errorMessage}
          </div>
        )}

        {submitted ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#059669]/20 border border-[#4edea3]/40 text-[#dae2fd] text-[13px] space-y-2">
              <div className="flex items-center gap-2 text-[#4edea3] font-semibold">
                <span className="material-symbols-outlined text-[20px]">mark_email_read</span>
                <span>Reset Instructions Dispatched</span>
              </div>
              <p className="text-[#bbcabf] leading-relaxed">
                If an account matches <strong className="text-[#dae2fd]">{email}</strong>, a secure link to update your password has been sent. Please check your inbox and spam folder.
              </p>
            </div>
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center py-3 rounded-xl bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] text-[13px] font-semibold transition-colors"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[13px] font-medium text-[#dae2fd]" htmlFor="resetEmail">
                Account Email
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3 text-[18px] text-[#86948a]">
                  mail
                </span>
                <input
                  id="resetEmail"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@venture.pk"
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
                <span>Send Password Reset Link</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
