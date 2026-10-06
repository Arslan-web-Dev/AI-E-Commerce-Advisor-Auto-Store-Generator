'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const initialError = searchParams.get('error') || '';
  const redirectTo = searchParams.get('redirectTo') || '/account/security';

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [successMessage, setSuccessMessage] = useState('');

  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get('mode') === 'signup') {
      setAuthMode('signup');
    }
  }, [searchParams]);

  // Handle Email + Password authentication
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (authMode === 'signup') {
        // Enforce password length rule
        if (password.length < 8) {
          setErrorMessage('Password must be at least 8 characters long.');
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              // Note: role is NEVER set from user metadata; database trigger enforces 'owner'
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          },
        });

        if (error) {
          // Prevent account enumeration by providing generic message if user already exists
          if (error.message.toLowerCase().includes('already registered')) {
            setSuccessMessage(
              'If this email is eligible, a confirmation link has been dispatched to your inbox.'
            );
          } else {
            setErrorMessage(error.message);
          }
        } else if (data.session) {
          router.push(redirectTo);
          router.refresh();
        } else {
          setSuccessMessage(
            'Account registration initiated! Please check your email inbox to verify your account.'
          );
        }
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setErrorMessage(error.message);
        } else if (data.user) {
          // Check if admin with must_change_password flag
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, must_change_password')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profile?.must_change_password) {
            router.push('/update-password?forced=true');
          } else if (profile?.role === 'admin' && redirectTo === '/account/security') {
            router.push('/admin');
          } else {
            router.push(redirectTo);
          }
          router.refresh();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setOauthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setOauthLoading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google OAuth initialization failed';
      setErrorMessage(msg);
      setOauthLoading(false);
    }
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 min-h-screen">
      {/* LEFT PANEL: Brand & Platform Telemetry Showcase (From Stitch Reference) */}
      <div className="hidden lg:flex lg:col-span-5 bg-[#131b2e] relative flex-col justify-between p-8 xl:p-12 overflow-hidden border-r border-[#2d3449]">
        {/* Ambient Lighting Blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#4edea3]/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-10 right-0 w-80 h-80 bg-[#4cd7f6]/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2d3449] flex items-center justify-center p-1.5 shadow-md">
              <span className="material-symbols-outlined text-[#4edea3] text-[22px]">radar</span>
            </div>
            <span className="font-display text-[18px] font-bold text-[#dae2fd]">
              Feasibility<span className="text-[#4edea3]">Advisor</span>
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#222a3d] text-[#bbcabf] text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
            RLS Protected
          </span>
        </div>

        {/* Center Visual: Telemetry Analytics Glass Card */}
        <div className="relative z-10 my-8 bg-[#171f33]/90 backdrop-blur-md border border-[#2d3449] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]"></span>
              </span>
              <span className="text-[11px] text-[#4edea3] uppercase tracking-wider font-semibold font-mono">
                Telemetry Buffer
              </span>
            </div>
            <span className="bg-[#222a3d] px-2 py-0.5 rounded text-[#bbcabf] text-[11px] font-mono">
              Lahore &bull; KHI &bull; ISB
            </span>
          </div>

          <div className="grid grid-cols-12 gap-3 items-center bg-[#131b2e] p-4 rounded-xl mb-4 border border-[#2d3449]/70">
            <div className="col-span-4 flex flex-col items-center justify-center text-center">
              <span className="font-display text-[26px] font-bold text-[#4edea3]">0.85</span>
              <span className="text-[10px] text-[#bbcabf] uppercase tracking-wider">Viability</span>
            </div>
            <div className="col-span-8 flex flex-col space-y-1 pl-2 border-l border-[#2d3449]">
              <span className="text-[12px] font-semibold text-[#dae2fd]">XGBoost Low Risk</span>
              <p className="text-[11px] text-[#bbcabf]">Optimal commercial rent-to-budget ratio for SME launch.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="bg-[#222a3d]/60 p-3 rounded-lg flex flex-col">
              <span className="text-[10px] text-[#bbcabf] uppercase font-mono">Spatial Radius</span>
              <span className="font-semibold text-[#dae2fd] mt-0.5">10–15 KM POIs</span>
            </div>
            <div className="bg-[#222a3d]/60 p-3 rounded-lg flex flex-col">
              <span className="text-[10px] text-[#bbcabf] uppercase font-mono">Store Provision</span>
              <span className="font-semibold text-[#4edea3] mt-0.5">Multi-Tenant COD</span>
            </div>
          </div>
        </div>

        {/* Bottom Quote */}
        <div className="relative z-10 bg-[#171f33]/70 backdrop-blur-sm border border-[#2d3449] rounded-xl p-4 text-[13px] text-[#bbcabf]">
          <p className="italic mb-2">
            &ldquo;Provides empirical evidence on competition, rent, and market demand before investing capital.&rdquo;
          </p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#10b981]/20 text-[#4edea3] flex items-center justify-center text-[10px] font-bold font-mono">
              PK
            </div>
            <span className="text-[11px] font-medium text-[#dae2fd]">Pakistan SME Feasibility Architecture</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Authentication Workspace */}
      <div className="lg:col-span-7 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-16 bg-[#0b1326]">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Top Back Link */}
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[13px] text-[#bbcabf] hover:text-[#dae2fd] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Back to Overview</span>
            </Link>
            <span className="text-[11px] text-[#4edea3] flex items-center gap-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              Auth Engine Online
            </span>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="bg-[#131b2e] p-1 rounded-xl flex items-center border border-[#2d3449]">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2 px-4 rounded-lg text-[13px] font-semibold transition-all ${
                authMode === 'signin'
                  ? 'bg-[#10b981]/20 text-[#4edea3] shadow-sm'
                  : 'text-[#bbcabf] hover:text-[#dae2fd]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2 px-4 rounded-lg text-[13px] font-semibold transition-all ${
                authMode === 'signup'
                  ? 'bg-[#10b981]/20 text-[#4edea3] shadow-sm'
                  : 'text-[#bbcabf] hover:text-[#dae2fd]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Header Title */}
          <div>
            <h1 className="font-display text-[26px] font-bold text-[#dae2fd]">
              {authMode === 'signup' ? 'Start Your Venture' : 'Welcome Back'}
            </h1>
            <p className="text-[13px] text-[#bbcabf] mt-1">
              {authMode === 'signup'
                ? 'Register an entrepreneur owner account to model feasibility and launch stores.'
                : 'Sign in to access your feasibility studies, store configurations, and reports.'}
            </p>
          </div>

          {/* Error / Success Notifications */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-[#93000a]/20 border border-[#ffb4ab]/40 text-[#ffb4ab] text-[13px] flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-[#059669]/20 border border-[#4edea3]/40 text-[#4edea3] text-[13px] flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">check_circle</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={oauthLoading || loading}
            className="w-full bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] text-[13px] font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 border border-[#3c4a42]/50 transition-all duration-150 disabled:opacity-50"
          >
            {oauthLoading ? (
              <div className="w-5 h-5 border-2 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
                  fill="#4285F4"
                />
                <path
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.13C3.26 21.36 7.33 24 12 24z"
                  fill="#34A853"
                />
                <path
                  d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.13z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="w-full h-px bg-[#2d3449]"></div>
            <span className="absolute bg-[#0b1326] px-3 text-[11px] uppercase tracking-widest text-[#bbcabf] font-mono">
              Or continue with email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {/* Full Name (Sign Up only) */}
            {authMode === 'signup' && (
              <div className="space-y-1">
                <label className="block text-[13px] font-medium text-[#dae2fd]" htmlFor="fullNameInput">
                  Full Name
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-3 text-[18px] text-[#86948a]">
                    person
                  </span>
                  <input
                    id="fullNameInput"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Muhammad Bilal"
                    className="w-full bg-[#131b2e] text-[#dae2fd] placeholder:text-[#86948a] py-2.5 px-4 pl-10 rounded-xl border border-[#2d3449] outline-none focus:border-[#4edea3] transition-colors text-[14px]"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1">
              <label className="block text-[13px] font-medium text-[#dae2fd]" htmlFor="emailInput">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3 text-[18px] text-[#86948a]">
                  mail
                </span>
                <input
                  id="emailInput"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@venture.pk"
                  className="w-full bg-[#131b2e] text-[#dae2fd] placeholder:text-[#86948a] py-2.5 px-4 pl-10 rounded-xl border border-[#2d3449] outline-none focus:border-[#4edea3] transition-colors text-[14px]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[13px] font-medium text-[#dae2fd]" htmlFor="passwordInput">
                  Password
                </label>
                {authMode === 'signin' && (
                  <Link
                    href="/reset-password"
                    className="text-[12px] text-[#4edea3] hover:underline transition-colors"
                  >
                    Forgot Password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3 text-[18px] text-[#86948a]">
                  lock
                </span>
                <input
                  id="passwordInput"
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
                  className="absolute right-3.5 top-3 text-[#86948a] hover:text-[#dae2fd] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || oauthLoading}
              className="w-full bg-[#10b981] hover:bg-[#4edea3] text-[#003824] font-bold text-[14px] py-3 px-6 rounded-xl shadow-lg shadow-[#10b981]/25 transition-all duration-150 flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#003824] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>{authMode === 'signup' ? 'Create Owner Account' : 'Sign In to Dashboard'}</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Alternate Mode Prompt */}
          <div className="text-center text-[13px] text-[#bbcabf]">
            {authMode === 'signup' ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className="text-[#4edea3] font-semibold hover:underline ml-1"
                >
                  Sign in here &rarr;
                </button>
              </p>
            ) : (
              <p>
                Don&apos;t have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className="text-[#4edea3] font-semibold hover:underline ml-1"
                >
                  Register here &rarr;
                </button>
              </p>
            )}
          </div>

          {/* Security Notice */}
          <div className="flex items-center justify-center gap-2 text-[#86948a] text-[11px] pt-2">
            <span className="material-symbols-outlined text-[16px] text-[#4edea3]">encrypted</span>
            <span>256-bit Row-Level Security (RLS) Encrypted &amp; Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b1326] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#4edea3] border-t-transparent animate-spin"></div>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
