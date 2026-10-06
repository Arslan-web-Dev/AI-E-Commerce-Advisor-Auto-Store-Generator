'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import the 3D scene with SSR disabled to prevent layout shifts & server rendering issues
const Hero3DVisual = dynamic(() => import('@/components/Hero3DVisual'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[340px] md:h-[420px] rounded-2xl bg-[#060e20]/80 border border-[#2d3449] flex items-center justify-center animate-pulse">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[#4edea3] border-t-transparent animate-spin"></div>
        <span className="text-[12px] font-mono text-[#bbcabf]">Initializing Spatial Engine...</span>
      </div>
    </div>
  ),
});

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex flex-col font-sans selection:bg-[#10b981]/30 selection:text-[#4edea3]">
      {/* 1. Header / Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 lg:px-8 pt-3">
        <div className="max-w-[1440px] mx-auto">
          <div className="h-16 px-4 md:px-6 rounded-xl bg-[#171f33]/85 backdrop-blur-xl border border-[#3c4a42]/40 flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.2)]">
            {/* Brand Logo */}
            <Link href="/" className="flex items-center gap-3 group focus:outline-none">
              <div className="relative flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[#4edea3] shadow-md shadow-[#4edea3]/50"></div>
                <div className="absolute w-5 h-5 rounded-full bg-[#4edea3]/20 animate-ping"></div>
              </div>
              <span className="font-display text-[18px] font-bold text-[#dae2fd] tracking-tight">
                Feasibility<span className="text-[#4edea3]">Advisor</span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-[13px] font-medium text-[#bbcabf]">
              <Link href="/wizard" className="text-[#4edea3] hover:text-[#6ffbbe] font-semibold transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                <span>Idea Wizard</span>
              </Link>
              <Link href="/projects" className="hover:text-[#4edea3] transition-colors">
                My Projects
              </Link>
              <a href="#features" className="hover:text-[#4edea3] transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="hover:text-[#4edea3] transition-colors">
                How It Works
              </a>
              <a href="#spatial-intelligence" className="hover:text-[#4edea3] transition-colors">
                Spatial Engine
              </a>
              <a href="#faqs" className="hover:text-[#4edea3] transition-colors">
                Methodology & FAQs
              </a>
            </nav>

            {/* Auth CTAs */}
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden sm:inline-flex text-[13px] font-medium text-[#bbcabf] hover:text-[#dae2fd] px-3 py-1.5 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/wizard"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#10b981] hover:bg-[#4edea3] text-[#003824] font-semibold text-[13px] shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-150 transform hover:-translate-y-0.5"
              >
                Launch Wizard
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-[#bbcabf] hover:text-[#dae2fd]"
                aria-label="Toggle mobile menu"
              >
                <span className="material-symbols-outlined text-[24px]">
                  {mobileMenuOpen ? 'close' : 'menu'}
                </span>
              </button>
            </div>
          </div>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-2 p-4 rounded-xl bg-[#171f33]/95 backdrop-blur-xl border border-[#3c4a42]/40 shadow-2xl flex flex-col gap-3 text-[14px]">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 px-3 rounded-lg hover:bg-[#222a3d] text-[#bbcabf]"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 px-3 rounded-lg hover:bg-[#222a3d] text-[#bbcabf]"
              >
                How It Works
              </a>
              <a
                href="#spatial-intelligence"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 px-3 rounded-lg hover:bg-[#222a3d] text-[#bbcabf]"
              >
                Spatial Engine
              </a>
              <a
                href="#faqs"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 px-3 rounded-lg hover:bg-[#222a3d] text-[#bbcabf]"
              >
                Methodology & FAQs
              </a>
              <div className="h-px bg-[#2d3449] my-1"></div>
              <Link
                href="/login"
                className="py-2 px-3 rounded-lg hover:bg-[#222a3d] text-[#4edea3] font-medium"
              >
                Sign In to Dashboard
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* 2. Hero Section */}
      <main className="flex-1 pt-24">
        {/* Radial Ambient Backdrop Spotlights */}
        <div className="relative w-full overflow-hidden">
          <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[#4edea3]/10 rounded-full blur-[140px] -z-10"></div>
          <div className="pointer-events-none absolute top-[30%] -left-32 w-[420px] h-[420px] bg-[#4cd7f6]/10 rounded-full blur-[120px] -z-10"></div>

          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-8 pb-16">
            {/* Announcement Pill */}
            <div className="flex items-center justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#222a3d]/80 backdrop-blur-md border border-[#3c4a42]/50 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]"></span>
                </span>
                <span className="text-[12px] text-[#bbcabf] font-medium tracking-wide">
                  Pakistan-First E-Commerce Feasibility &amp; Automated Multi-Tenant Stores
                </span>
                <span className="material-symbols-outlined text-[#4edea3] text-[14px]">arrow_forward</span>
              </div>
            </div>

            {/* Main Headline & Subtitle */}
            <div className="text-center max-w-4xl mx-auto mb-10">
              <h1 className="font-display text-[34px] sm:text-[46px] lg:text-[56px] leading-[1.15] font-bold text-[#dae2fd] tracking-tight mb-5">
                Launch Your E-Commerce Store with{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4edea3] via-[#45dfa4] to-[#4cd7f6]">
                  AI Feasibility
                </span>{' '}
                &amp; Spatial Intelligence
              </h1>
              <p className="text-[16px] sm:text-[18px] text-[#bbcabf] max-w-2xl mx-auto leading-relaxed">
                Validate competition in Pakistani commercial hubs, analyze local rent &amp; demand with XGBoost, and auto-deploy a live multi-tenant storefront in minutes.
              </p>

              {/* CTA Cluster */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/wizard"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#10b981] hover:bg-[#4edea3] text-[#003824] font-semibold text-[14px] shadow-lg shadow-[#10b981]/25 transition-all duration-150 transform hover:-translate-y-0.5"
                >
                  <span className="material-symbols-outlined text-[18px]">auto_graph</span>
                  <span>Analyze Your Business Idea</span>
                </Link>
                <a
                  href="#how-it-works"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#222a3d]/90 hover:bg-[#31394d] text-[#dae2fd] text-[14px] font-medium border border-[#3c4a42]/60 transition-all duration-150"
                >
                  <div className="w-5 h-5 rounded-full bg-[#4edea3]/20 flex items-center justify-center text-[#4edea3]">
                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                  </div>
                  <span>Explore Methodology</span>
                </a>
              </div>
            </div>

            {/* Interactive 3D Hero Visual & Live Telemetry Glass Card */}
            <div className="relative w-full max-w-6xl mx-auto rounded-2xl bg-[#171f33]/85 backdrop-blur-xl border border-[#2d3449] shadow-2xl p-4 sm:p-6 lg:p-8">
              {/* Top Status Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-6 border-b border-[#2d3449] bg-[#131b2e]/60 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-[#4edea3] shadow-sm shadow-[#4edea3]/50"></div>
                  <div>
                    <span className="text-[11px] text-[#bbcabf] uppercase tracking-wider block font-mono">
                      Decision Engine Focus
                    </span>
                    <span className="font-display text-[16px] text-[#dae2fd] font-semibold">
                      Gulberg III, Main Boulevard — Lahore Commercial Corridor
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-[#10b981]/15 text-[#4edea3] text-[12px] flex items-center gap-1.5 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                    Model: XGBoost Spatial v4.2
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-[#222a3d] text-[#bbcabf] text-[11px] font-mono">
                    PKR-Native
                  </span>
                </div>
              </div>

              {/* Grid: 3D Scene + Telemetry Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* 3D Scene Container (7 cols) */}
                <div className="lg:col-span-7 flex flex-col">
                  <Hero3DVisual />
                  <p className="text-[11px] text-[#bbcabf] text-center mt-2 font-mono">
                    Interactive 3D POI scan • Drag to rotate coordinate angle • Powered by Three.js & WebGL
                  </p>
                </div>

                {/* Telemetry Breakdown Cards (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  {/* Card 1: XGBoost Viability Score */}
                  <div className="bg-[#131b2e]/80 border border-[#2d3449] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[13px] font-semibold text-[#dae2fd] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#4edea3] text-[18px]">verified</span>
                        Viability Score Output
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#222a3d] text-[#4edea3]">
                        0.85 / 1.00
                      </span>
                    </div>
                    <div className="w-full bg-[#2d3449] rounded-full h-2 overflow-hidden mb-2">
                      <div className="bg-[#4edea3] h-2 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#bbcabf]">
                      <span>Risk Threshold: &ge;0.75</span>
                      <span className="text-[#4edea3] font-semibold">Low Risk (Favorable)</span>
                    </div>
                  </div>

                  {/* Card 2: Competitor Density (Overpass API) */}
                  <div className="bg-[#131b2e]/80 border border-[#2d3449] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-semibold text-[#dae2fd] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">location_on</span>
                        OSM Competitor Buffer
                      </span>
                      <span className="text-[11px] text-[#bbcabf] font-mono">10–15 KM Radius</span>
                    </div>
                    <p className="text-[12px] text-[#bbcabf] leading-snug">
                      Queries live OpenStreetMap Overpass points of interest to compute competitive saturation index.
                    </p>
                  </div>

                  {/* Card 3: Commercial Rent-to-Budget Ratio */}
                  <div className="bg-[#131b2e]/80 border border-[#2d3449] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-semibold text-[#dae2fd] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[#45dfa4] text-[18px]">payments</span>
                        Rent-to-Budget Ratio
                      </span>
                      <span className="text-[12px] font-bold text-[#dae2fd]">Rs. 65k / mo</span>
                    </div>
                    <p className="text-[12px] text-[#bbcabf] leading-snug">
                      Pre-scraped commercial rent cache estimates average sq. ft. cost for Pakistani business hubs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 3. Methodology & Specifications Banner */}
        <section className="w-full bg-[#131b2e]/90 border-y border-[#2d3449] py-8">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="flex flex-col items-center">
                <span className="font-display text-[26px] md:text-[32px] font-bold text-[#4edea3]">10–15 KM</span>
                <span className="text-[13px] font-semibold text-[#dae2fd] mt-1">Spatial Search Radius</span>
                <span className="text-[11px] text-[#bbcabf]">OpenStreetMap Overpass POIs</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-display text-[26px] md:text-[32px] font-bold text-[#4cd7f6]">XGBoost</span>
                <span className="text-[13px] font-semibold text-[#dae2fd] mt-1">Continuous Scoring</span>
                <span className="text-[11px] text-[#bbcabf]">0.00 – 1.00 &amp; 4 Risk Bands</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-display text-[26px] md:text-[32px] font-bold text-[#45dfa4]">Multi-AI</span>
                <span className="text-[13px] font-semibold text-[#dae2fd] mt-1">Provider Failover Chain</span>
                <span className="text-[11px] text-[#bbcabf]">GPT-4o-mini &rarr; Gemini &rarr; Groq</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="font-display text-[26px] md:text-[32px] font-bold text-[#dae2fd]">PKR Native</span>
                <span className="text-[13px] font-semibold text-[#dae2fd] mt-1">Currency &amp; COD Focus</span>
                <span className="text-[11px] text-[#bbcabf]">Tailored for Pakistani SMEs</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Core Capabilities (3 Pillars) */}
        <section id="features" className="max-w-[1440px] mx-auto px-4 lg:px-8 py-20">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-[11px] uppercase tracking-widest text-[#4edea3] font-semibold">
              CORE CAPABILITIES
            </span>
            <h2 className="font-display text-[28px] sm:text-[36px] font-bold text-[#dae2fd] mt-2 mb-4">
              Engineered for Evidence-Based SME Feasibility
            </h2>
            <p className="text-[15px] text-[#bbcabf] leading-relaxed">
              Eliminate guesswork with factual competitor clustering, local commercial rental metrics, and an automated multi-tenant storefront pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Capability 1 */}
            <div className="rounded-2xl bg-[#171f33]/70 border border-[#2d3449] p-6 flex flex-col justify-between hover:border-[#4edea3]/50 transition-all duration-200">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#10b981]/10 flex items-center justify-center text-[#4edea3] mb-4">
                  <span className="material-symbols-outlined text-[26px]">network_node</span>
                </div>
                <h3 className="font-display text-[18px] font-semibold text-[#dae2fd] mb-2">
                  XGBoost Feasibility Scoring
                </h3>
                <p className="text-[13px] text-[#bbcabf] leading-relaxed mb-6">
                  Engineered features assess competitor density, saturation index, estimated rental costs, and regional Google Trends to generate a calibrated feasibility score.
                </p>
              </div>
              <div className="bg-[#131b2e] p-3 rounded-xl border border-[#2d3449]/60 text-[11px] text-[#bbcabf] space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span>Score Output:</span>
                  <span className="text-[#4edea3] font-bold">0.00 – 1.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk Levels:</span>
                  <span>Low &bull; Mod &bull; High &bull; Crit</span>
                </div>
              </div>
            </div>

            {/* Capability 2 */}
            <div className="rounded-2xl bg-[#171f33]/70 border border-[#2d3449] p-6 flex flex-col justify-between hover:border-[#4cd7f6]/50 transition-all duration-200">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#03b5d3]/10 flex items-center justify-center text-[#4cd7f6] mb-4">
                  <span className="material-symbols-outlined text-[26px]">psychology</span>
                </div>
                <h3 className="font-display text-[18px] font-semibold text-[#dae2fd] mb-2">
                  Multi-AI Advisory &amp; Action Matrix
                </h3>
                <p className="text-[13px] text-[#bbcabf] leading-relaxed mb-6">
                  Structured facts are explained by an intelligent LLM advisor in English or Roman Urdu, backed by a fault-tolerant failover chain (OpenAI, Gemini, Groq) and a rule-based fallback.
                </p>
              </div>
              <div className="bg-[#131b2e] p-3 rounded-xl border border-[#2d3449]/60 text-[11px] text-[#bbcabf] space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span>Languages:</span>
                  <span className="text-[#4cd7f6] font-bold">English / Roman Urdu</span>
                </div>
                <div className="flex justify-between">
                  <span>Outage Resilience:</span>
                  <span>3-tier automated failover</span>
                </div>
              </div>
            </div>

            {/* Capability 3 */}
            <div className="rounded-2xl bg-[#171f33]/70 border border-[#2d3449] p-6 flex flex-col justify-between hover:border-[#45dfa4]/50 transition-all duration-200">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#00b982]/10 flex items-center justify-center text-[#45dfa4] mb-4">
                  <span className="material-symbols-outlined text-[26px]">storefront</span>
                </div>
                <h3 className="font-display text-[18px] font-semibold text-[#dae2fd] mb-2">
                  Auto Multi-Tenant Storefront
                </h3>
                <p className="text-[13px] text-[#bbcabf] leading-relaxed mb-6">
                  Complete the 4-step MCQ configurator to generate a validated JSON theme and publish a live customer-facing store with Cash on Delivery (COD) and automated SEO.
                </p>
              </div>
              <div className="bg-[#131b2e] p-3 rounded-xl border border-[#2d3449]/60 text-[11px] text-[#bbcabf] space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span>Deployment:</span>
                  <span className="text-[#45dfa4] font-bold">slug.domain.pk</span>
                </div>
                <div className="flex justify-between">
                  <span>Checkout:</span>
                  <span>Cash on Delivery (COD)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. End-to-End Workflow (How It Works) */}
        <section id="how-it-works" className="w-full bg-[#131b2e]/60 border-y border-[#2d3449] py-20">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-[11px] uppercase tracking-widest text-[#4edea3] font-semibold">
                SYSTEM WORKFLOW
              </span>
              <h2 className="font-display text-[28px] sm:text-[36px] font-bold text-[#dae2fd] mt-2 mb-4">
                From Idea to Feasibility to Live Store
              </h2>
              <p className="text-[15px] text-[#bbcabf]">
                Two linked engines: Decision Engine (Modules 2–6) followed by Execution Engine (Modules 7–8).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="p-6 rounded-xl bg-[#171f33] border border-[#2d3449] relative">
                <div className="w-8 h-8 rounded-lg bg-[#10b981]/20 text-[#4edea3] font-display font-bold text-[14px] flex items-center justify-center mb-4">
                  01
                </div>
                <h4 className="font-display text-[16px] font-semibold text-[#dae2fd] mb-2">Input Idea &amp; Hub</h4>
                <p className="text-[13px] text-[#bbcabf] leading-relaxed">
                  Specify category, idea details, PKR budget, and target commercial hub (e.g. Liberty Market, Clifton, Saddar).
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-6 rounded-xl bg-[#171f33] border border-[#2d3449] relative">
                <div className="w-8 h-8 rounded-lg bg-[#03b5d3]/20 text-[#4cd7f6] font-display font-bold text-[14px] flex items-center justify-center mb-4">
                  02
                </div>
                <h4 className="font-display text-[16px] font-semibold text-[#dae2fd] mb-2">Spatial Aggregation</h4>
                <p className="text-[13px] text-[#bbcabf] leading-relaxed">
                  Fetches nearby competitors via Overpass API, extracts rent from cached registry, and samples demand trends.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-xl bg-[#171f33] border border-[#2d3449] relative">
                <div className="w-8 h-8 rounded-lg bg-[#00b982]/20 text-[#45dfa4] font-display font-bold text-[14px] flex items-center justify-center mb-4">
                  03
                </div>
                <h4 className="font-display text-[16px] font-semibold text-[#dae2fd] mb-2">XGBoost &amp; Multi-AI</h4>
                <p className="text-[13px] text-[#bbcabf] leading-relaxed">
                  Computes viability score, risk tier, and an action checklist explained in clear English or Roman Urdu.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-6 rounded-xl bg-[#171f33] border border-[#2d3449] relative">
                <div className="w-8 h-8 rounded-lg bg-[#10b981]/20 text-[#4edea3] font-display font-bold text-[14px] flex items-center justify-center mb-4">
                  04
                </div>
                <h4 className="font-display text-[16px] font-semibold text-[#dae2fd] mb-2">Storefront Launch</h4>
                <p className="text-[13px] text-[#bbcabf] leading-relaxed">
                  Configure theme with 4 MCQs and publish an SEO-optimized storefront with COD checkout and admin console.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. FAQs & Methodology Accordion */}
        <section id="faqs" className="max-w-[1000px] mx-auto px-4 lg:px-8 py-20">
          <div className="text-center mb-12">
            <span className="text-[11px] uppercase tracking-widest text-[#4edea3] font-semibold">
              TRANSPARENT METHODOLOGY
            </span>
            <h2 className="font-display text-[26px] sm:text-[32px] font-bold text-[#dae2fd] mt-2 mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-[14px] text-[#bbcabf]">
              Ground truth on our data sources, model constraints, and platform design.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: 'Where does competitor and rent data come from in Pakistan?',
                a: 'Competitors are queried from OpenStreetMap (OSM) Overpass API within a 10–15 km radius. Rent estimates are aggregated from a cached commercial scrape tagged with source date and confidence level, avoiding expensive commercial data fees.',
              },
              {
                q: 'How does the XGBoost scoring model work?',
                a: 'The model ingests 10 engineered spatial and financial features (competitor density, rent-to-budget ratio, saturation index, trend slope, etc.) to produce a continuous viability score between 0.00 and 1.00 mapped to 4 risk tiers.',
              },
              {
                q: 'What happens if an AI provider experiences downtime?',
                a: 'Our AI router automatically cascades: OpenAI GPT-4o-mini &rarr; Google Gemini &rarr; Groq Llama-3. If all external APIs fail, a deterministic rule-based summary generates an action matrix so the user is never left without guidance.',
              },
              {
                q: 'What roles exist on the platform?',
                a: 'Only two roles exist: "owner" (assigned to every registering entrepreneur) and "admin" (assigned only via secure bootstrap or platform superadmin). PostgreSQL Row-Level Security (RLS) strictly isolates tenant stores and reports.',
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-[#171f33] border border-[#2d3449] overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between text-[15px] font-semibold text-[#dae2fd] hover:text-[#4edea3] transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="material-symbols-outlined text-[20px] text-[#bbcabf]">
                    {activeFaq === idx ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
                {activeFaq === idx && (
                  <div className="px-5 pb-4 text-[13px] text-[#bbcabf] leading-relaxed border-t border-[#2d3449]/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 7. Bottom CTA Banner */}
        <section className="max-w-[1440px] mx-auto px-4 lg:px-8 pb-20">
          <div className="rounded-2xl bg-gradient-to-r from-[#171f33] via-[#131b2e] to-[#171f33] border border-[#3c4a42]/50 p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="pointer-events-none absolute -top-20 right-10 w-72 h-72 bg-[#4edea3]/10 rounded-full blur-3xl"></div>
            <h3 className="font-display text-[26px] sm:text-[34px] font-bold text-[#dae2fd] mb-4">
              Ready to Validate Your E-Commerce Venture?
            </h3>
            <p className="text-[15px] text-[#bbcabf] max-w-xl mx-auto mb-8">
              Sign up today to explore Pakistan commercial market telemetry, run XGBoost feasibility models, and auto-deploy your first online storefront.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login?mode=signup"
                className="px-6 py-3.5 rounded-xl bg-[#10b981] hover:bg-[#4edea3] text-[#003824] font-semibold text-[14px] shadow-lg shadow-[#10b981]/30 transition-all transform hover:-translate-y-0.5"
              >
                Create Free Owner Account
              </Link>
              <Link
                href="/login"
                className="px-6 py-3.5 rounded-xl bg-[#222a3d] hover:bg-[#31394d] text-[#dae2fd] font-medium text-[14px] border border-[#3c4a42]/60 transition-colors"
              >
                Sign In to Existing Account
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 8. Footer */}
      <footer className="w-full bg-[#060e20] border-t border-[#2d3449] py-10 text-[13px] text-[#bbcabf]">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-[#4edea3]"></div>
              <span className="font-display font-bold text-[#dae2fd]">FeasibilityAdvisor</span>
            </div>
            <span className="hidden sm:inline text-[#3c4a42]">&bull;</span>
            <span>Final Year Project (COMSATS University Islamabad)</span>
            <span className="hidden sm:inline text-[#3c4a42]">&bull;</span>
            <span className="text-[12px] text-[#86948a]">&copy; OpenStreetMap contributors</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-[#dae2fd] transition-colors">
              Sign In
            </Link>
            <Link href="/login?mode=signup" className="hover:text-[#dae2fd] transition-colors">
              Register
            </Link>
            <a href="#how-it-works" className="hover:text-[#dae2fd] transition-colors">
              Methodology
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
