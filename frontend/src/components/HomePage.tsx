import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Layers,
  Mail,
  Plus,
  PlusCircle,
  Send,
} from 'lucide-react';
import { ApplicationItem, JobStatsResponse, ResumeData, UserProfile } from '../types/job';
import { getProfileDocxUrl } from '../api/client';

interface HomePageProps {
  activeUserId: string;
  currentProfile: UserProfile | null;
  stats: JobStatsResponse | null;
  activeResume: ResumeData | null;
  trackedCount: number;
  applications: ApplicationItem[];
  onNavigateToListings: () => void;
  onNavigateToTracker: () => void;
  onNavigateToProfile: () => void;
  onOpenResumeModal: () => void;
  onOpenManualModal: () => void;
  onOpenDigestModal: () => void;
  onOpenAutoApplier?: () => void;
  onNavigateToDaily21?: () => void;
  onNavigateToThreads?: () => void;
  onNavigateToGoogleForms?: () => void;
  queuedCount?: number;
}

const CAPABILITIES_ACCORDION = [
  {
    id: 'threads',
    title: 'Threads Opportunity Radar',
    subtitle: 'Real-time signal extraction for Graphic Design, Tech, and Freelance Projects.',
    details:
      'Monitors Meta Threads via official Graph API keyword search, optional Apify connector, Fediverse public streams, and public no-login oEmbed parsing while filtering freelancer self-promotion.',
    tags: ['[Meta Graph API]', '[Intent Classifier]', '[Discord & Email Alerts]'],
  },
  {
    id: 'daily21',
    title: 'Daily 21 Curated Remote Drops',
    subtitle: 'Deterministic daily batch matching and 1-click Playwright form auto-filling.',
    details:
      'Ranks active remote engineering and AI roles against your verified Candidate Vault and attaches your authentic 1-page IIM PDF resume with screenshot verification.',
    tags: ['[1-Click Batch]', '[Review Mode Safe]', '[IIM 1-Page PDF]'],
  },
  {
    id: 'gforms',
    title: 'Google Forms Multi-Page Registrant',
    subtitle: 'Automated DOM parsing across short inputs, textareas, radios, and multi-section forms.',
    details:
      'Parses shared startup hiring links from community feeds or direct pasted URLs, navigates Next sections automatically, and stores full-page visual proof prior to submission.',
    tags: ['[Playwright DOM]', '[Multi-Page Traversal]', '[Proof Screenshots]'],
  },
  {
    id: 'vault',
    title: 'Wellfound Profile & Resume Tailoring',
    subtitle: 'ATS keyword checks and 1-page IIM PDF formatting with zero fabrication.',
    details:
      'Keeps every tailored CV and custom application answer strictly within your saved roles, work tenure, and verified skills.',
    tags: ['[Profile Only]', '[Classic / Exec / Tech]', '[ATS Gap Audit]'],
  },
];

export const HomePage: React.FC<HomePageProps> = ({
  activeUserId,
  currentProfile,
  stats,
  activeResume,
  trackedCount,
  applications,
  onNavigateToListings,
  onNavigateToTracker,
  onNavigateToProfile,
  onOpenResumeModal,
  onOpenManualModal,
  onOpenDigestModal,
  onOpenAutoApplier,
  onNavigateToDaily21,
  onNavigateToThreads,
  onNavigateToGoogleForms,
  queuedCount = 0,
}) => {
  const [openCapability, setOpenCapability] = useState<string>('threads');

  const isProfileEmpty =
    !currentProfile ||
    ((!currentProfile.headline || currentProfile.headline.trim() === '') &&
      (currentProfile.skills?.length || 0) === 0 &&
      (currentProfile.experience?.length || 0) === 0);

  const appCounts = {
    saved: applications.filter((a) => a.status === 'saved').length,
    applied: applications.filter((a) => a.status === 'applied').length,
    interviewing: applications.filter((a) => a.status === 'interviewing').length,
    offer: applications.filter((a) => a.status === 'offer').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const sourcesList = stats ? Object.keys(stats.sources || {}) : [];
  const rawFirst = (currentProfile?.full_name || activeUserId || '').trim().split(' ')[0];
  const displayFirstName = rawFirst && rawFirst.toLowerCase() !== 'demo' ? rawFirst : '';

  const showcaseModules = [
    {
      id: 'daily21',
      title: 'Daily 21',
      italicWord: 'Remote Drops',
      category: '[CURATED BATCH AUTOMATION]',
      metric: '21 Roles / Day',
      tint: 'bg-gradient-to-br from-indigo-100/80 via-blue-50 to-white',
      orbClass: 'bg-indigo-400/25',
      staggered: false,
      onClick: onNavigateToDaily21 || onNavigateToListings,
    },
    {
      id: 'threads',
      title: 'Threads',
      italicWord: 'Opportunity Radar',
      category: '[GRAPHIC • TECH • PROJECT]',
      metric: 'Intent Scanned',
      tint: 'bg-gradient-to-br from-violet-100/80 via-purple-50 to-white',
      orbClass: 'bg-violet-400/25',
      staggered: true,
      onClick: onNavigateToThreads || onNavigateToListings,
    },
    {
      id: 'listings',
      title: 'Explore',
      italicWord: 'Verified Feeds',
      category: `[${stats?.total_jobs || 0} ACTIVE LISTINGS]`,
      metric: `${stats?.remote_jobs || 0} Remote`,
      tint: 'bg-gradient-to-br from-sky-100/80 via-cyan-50 to-white',
      orbClass: 'bg-sky-400/25',
      staggered: false,
      onClick: onNavigateToListings,
    },
    {
      id: 'gforms',
      title: 'Google Forms',
      italicWord: 'Auto-Registrant',
      category: '[MULTI-PAGE PLAYWRIGHT BOT]',
      metric: 'Proof Ready',
      tint: 'bg-gradient-to-br from-emerald-100/75 via-teal-50 to-white',
      orbClass: 'bg-emerald-400/20',
      staggered: true,
      onClick: onNavigateToGoogleForms || onNavigateToListings,
    },
  ];

  return (
    <div className="bg-[#f6f8fe] text-[#0f172a]">
      {/* 1. Full-Bleed Midnight Sapphire Hero with Glowing Indigo/Sky Mesh + Wave Bridge */}
      <section className="relative min-h-[88vh] bg-gradient-to-br from-[#070b19] via-[#0d1633] to-[#1e1b4b] text-[#f8faff] flex flex-col justify-center items-center px-4 sm:px-8 pt-28 pb-40 overflow-hidden">
        {/* Drifting Mesh Background */}
        <div
          aria-hidden="true"
          className="oi-mesh-drift pointer-events-none absolute -top-24 -left-24 w-[36rem] h-[36rem] rounded-full bg-indigo-500/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="oi-mesh-drift pointer-events-none absolute -bottom-16 -right-20 w-[34rem] h-[34rem] rounded-full bg-sky-500/20 blur-3xl"
        />

        <div className="relative z-10 max-w-5xl mx-auto text-center oi-reveal">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-white/15 bg-white/5 mb-7">
            <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.3em] text-slate-300">
              Active Workspace
            </span>
          </div>

          <h1
            className="font-serif text-[#f6f8fe] tracking-tight leading-[0.88] text-balance"
            style={{ fontSize: 'clamp(2.75rem, 1.5rem + 5.8vw, 6.25rem)' }}
          >
            Remote <em className="italic font-normal text-sky-300">roles</em>
            <br />
            {displayFirstName ? `for ${displayFirstName}.` : 'matched to you.'}
          </h1>

          <p className="mt-7 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {currentProfile?.headline ||
              'Matches remote engineering roles, Threads hiring posts, and Google Forms, then pre-fills applications from your saved profile and 1-page IIM resume with zero fabrication.'}
          </p>

          {/* Compact Candidate Status Strip */}
          {isProfileEmpty ? (
            <div className="mt-8 inline-flex flex-col sm:flex-row items-center gap-3 px-5 py-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 text-xs">
              <div className="flex items-center gap-2 text-amber-200">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="font-mono uppercase tracking-[0.2em] text-[10px]">
                  Profile Setup Pending
                </span>
              </div>
              <button
                type="button"
                onClick={onNavigateToProfile}
                className="px-3.5 py-1.5 rounded-full bg-amber-300 text-[#0f172a] font-mono text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-amber-200 transition-colors cursor-pointer"
              >
                Set Up Profile
              </button>
            </div>
          ) : (
            <div className="mt-8 inline-flex flex-wrap items-center justify-center gap-3 px-5 py-2.5 rounded-full border border-white/15 bg-white/5 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>{currentProfile?.skills?.length || 0} Verified Skills</span>
              </span>
              {currentProfile?.location && (
                <span className="text-slate-500">• {currentProfile.location}</span>
              )}
              {currentProfile?.min_hourly_rate ? (
                <span className="text-slate-400 font-mono text-[11px]">
                  ${currentProfile.min_hourly_rate}/hr min
                </span>
              ) : null}
              <button
                type="button"
                onClick={onNavigateToProfile}
                className="ml-1 font-mono text-[10px] uppercase tracking-[0.22em] text-indigo-300 hover:text-white oi-link-underline cursor-pointer"
              >
                Edit Profile
              </button>
              <a
                href={getProfileDocxUrl(activeUserId)}
                download
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/80 hover:text-white oi-link-underline"
              >
                <Download className="w-3 h-3" aria-hidden="true" />
                <span>DOCX</span>
              </a>
            </div>
          )}
        </div>

        {/* Bottom Concave Wave Bridge + Crest CTA Button */}
        <div className="oi-wave-container" aria-hidden="true">
          <div className="oi-wave-curve" />
        </div>

        <div className="relative z-20 mt-10">
          <button
            type="button"
            onClick={onNavigateToDaily21 || onNavigateToListings}
            className="oi-btn-pulse interactive-button inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-[#4338ca] hover:bg-indigo-600 text-[#f6f8fe] font-mono text-xs uppercase tracking-[0.3em] font-bold cursor-pointer border border-indigo-400/40"
          >
            <span>Initialize Daily 21</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 2. Staggered 2-Column Editorial Discovery Modules Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12 border-b border-[#d4dcf0] pb-6">
          <div>
            <span className="oi-mono-label text-[11px] text-[#4338ca] block mb-2">
              Search Tools
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#0f172a]">
              Main <em className="italic font-normal">Workspaces</em>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md">
            Switch between daily remote drops, Threads hiring leads, and Google Forms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
          {showcaseModules.map((mod) => (
            <div
              key={mod.id}
              className={`group ${mod.staggered ? 'md:mt-14' : ''}`}
            >
              <button
                type="button"
                onClick={mod.onClick}
                className={`oi-card-lift relative w-full aspect-[4/3] rounded-[1rem] ${mod.tint} border border-[#d4dcf0] overflow-hidden p-7 flex flex-col justify-between text-left cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] focus-visible:outline-offset-4`}
              >
                {/* Blurred Orbital Center Glow */}
                <div
                  aria-hidden="true"
                  className={`absolute inset-0 m-auto w-56 h-56 rounded-full ${mod.orbClass} blur-3xl transition-transform duration-700 ease-premium group-hover:scale-125 pointer-events-none`}
                />

                <div className="relative z-10 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-600">
                    {mod.category}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#4338ca] bg-white/80 px-3 py-1 rounded-full border border-[#d4dcf0]">
                    {mod.metric}
                  </span>
                </div>

                <div className="relative z-10 flex items-end justify-between gap-4">
                  <div className="font-serif text-3xl sm:text-4xl leading-none text-[#0f172a]">
                    {mod.title}
                    <br />
                    <em className="italic font-normal text-[#4338ca]">{mod.italicWord}</em>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#0f172a] font-mono text-[10px] font-bold uppercase tracking-[0.25em] border border-[#d4dcf0] opacity-90 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-premium">
                    <span>View</span>
                    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
              </button>

              {/* Editorial Metadata Footer below Card */}
              <div className="mt-4 pt-3 border-t border-[#d4dcf0] flex items-center justify-between gap-2">
                <span className="font-serif text-lg font-bold text-[#0f172a]">
                  {mod.title} <em className="italic font-normal">{mod.italicWord}</em>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
                  {mod.id.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Core Capabilities Accordion Split */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-[#d4dcf0]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Sticky Header */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-5">
            <span className="oi-mono-label text-[11px] text-[#4338ca] block">
              How It Works
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl leading-[1.05] text-[#0f172a]">
              Core <em className="italic font-normal">Features</em>
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-md">
              Searches hiring channels, reads multi-page form fields, and drafts tailored resumes from your saved history.
            </p>
            {onOpenAutoApplier && (
              <button
                type="button"
                onClick={onOpenAutoApplier}
                className="oi-link-underline inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] font-bold text-[#4338ca] cursor-pointer"
              >
                <span>Launch Auto-Applier</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Right Vertical Accordion */}
          <div className="lg:col-span-7 divide-y divide-[#d4dcf0] border-y border-[#d4dcf0]">
            {CAPABILITIES_ACCORDION.map((item) => {
              const isOpen = openCapability === item.id;
              return (
                <div key={item.id} className="py-5">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenCapability(isOpen ? '' : item.id)}
                    className="w-full text-left flex items-center justify-between gap-4 group cursor-pointer"
                  >
                    <span
                      className={`font-serif text-2xl sm:text-3xl transition-colors duration-300 ease-premium ${
                        isOpen
                          ? 'text-[#0f172a] font-bold'
                          : 'text-slate-400 group-hover:text-[#0f172a]'
                      }`}
                    >
                      {item.title}
                    </span>
                    <Plus
                      className={`w-5 h-5 shrink-0 transition-transform duration-500 ease-premium ${
                        isOpen ? 'rotate-45 text-[#4338ca]' : 'text-slate-400 group-hover:text-[#0f172a]'
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-3 pr-6 animate-in fade-in duration-300">
                      <p className="text-sm font-medium text-[#0f172a]">{item.subtitle}</p>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {item.details}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className="font-mono text-[10px] tracking-[0.18em] text-[#4338ca] bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200/70"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Operational Telemetry & Workspace Tools */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Job Market Pulse */}
          <div className="oi-card-subtle bg-white rounded-2xl p-6 border border-[#d4dcf0] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#4338ca] flex items-center justify-center border border-indigo-100">
                    <Layers className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#0f172a]">Feed Activity</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      Synced job boards
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                  <span>Feeds Active</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center my-4">
                <div className="p-3 rounded-xl bg-[#f6f8fe] border border-[#d4dcf0]">
                  <div className="font-serif text-2xl font-bold text-[#0f172a] tabular-nums">
                    {stats?.total_jobs || 0}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-0.5">
                    Listings
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#f6f8fe] border border-[#d4dcf0]">
                  <div className="font-serif text-2xl font-bold text-[#0f172a] tabular-nums">
                    {stats?.remote_jobs || 0}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-0.5">
                    Remote
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#f6f8fe] border border-[#d4dcf0]">
                  <div className="font-serif text-2xl font-bold text-[#0f172a] tabular-nums">
                    {stats?.internship_jobs || 0}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-0.5">
                    Interns
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#f6f8fe] border border-[#d4dcf0]">
                  <div className="font-serif text-2xl font-bold text-[#0f172a] tabular-nums">
                    {sourcesList.length || 0}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-0.5">
                    Sources
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateToListings}
              className="mt-2 w-full py-2.5 px-4 rounded-xl bg-[#1e1b4b] hover:bg-[#4338ca] text-[#f6f8fe] font-mono text-[11px] uppercase tracking-[0.22em] transition-colors duration-300 ease-premium flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore All Listings ({stats?.total_jobs || 0})</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Application Tracker Pipeline */}
          <div className="oi-card-subtle bg-white rounded-2xl p-6 border border-[#d4dcf0] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#4338ca] flex items-center justify-center border border-indigo-100">
                    <Briefcase className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#0f172a]">Application Tracker</h3>
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
                      Pipeline progression &amp; notes
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full bg-[#f6f8fe] text-[#0f172a] font-bold border border-[#d4dcf0]">
                  {trackedCount} Tracked
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 text-center my-4">
                <div className="p-2.5 rounded-xl bg-[#f6f8fe] border border-[#d4dcf0]">
                  <div className="font-serif text-xl font-bold text-[#0f172a] tabular-nums">{appCounts.saved}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-slate-500">Saved</div>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100">
                  <div className="font-serif text-xl font-bold text-[#4338ca] tabular-nums">{appCounts.applied}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-[#4338ca]">Applied</div>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
                  <div className="font-serif text-xl font-bold text-purple-800 tabular-nums">{appCounts.interviewing}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-purple-700">Interview</div>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                  <div className="font-serif text-xl font-bold text-emerald-800 tabular-nums">{appCounts.offer}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-700">Offers</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100">
                  <div className="font-serif text-xl font-bold text-rose-800 tabular-nums">{appCounts.rejected}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-rose-700">Archived</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateToTracker}
              className="mt-2 w-full py-2.5 px-4 rounded-xl border border-[#d4dcf0] bg-[#f6f8fe] hover:border-[#4f46e5] text-[#0f172a] font-mono text-[11px] uppercase tracking-[0.22em] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Kanban Tracker ({trackedCount})</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Utility Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Resume Hub */}
          <div className="oi-card-subtle bg-white rounded-2xl p-5 border border-[#d4dcf0] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <FileText className="w-4 h-4 text-[#4338ca]" aria-hidden="true" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  {activeResume ? 'Active CV' : 'Missing'}
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-[#0f172a]">Resume &amp; Match Hub</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {activeResume
                  ? `${activeResume.filename} • ${activeResume.parsed_json?.skills?.length || 0} skills`
                  : 'Upload PDF or DOCX for semantic and keyword gap analysis.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenResumeModal}
              className="mt-4 w-full py-2 px-3 rounded-lg border border-[#d4dcf0] bg-[#f6f8fe] hover:border-[#4f46e5] font-mono text-[10px] uppercase tracking-[0.22em] text-[#0f172a] cursor-pointer"
            >
              {activeResume ? 'Manage Resume' : 'Upload Resume'}
            </button>
          </div>

          {/* Auto Applier */}
          <div className="oi-card-subtle bg-white rounded-2xl p-5 border border-[#d4dcf0] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <Send className="w-4 h-4 text-[#4338ca]" aria-hidden="true" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#4338ca]">
                  {queuedCount > 0 ? `${queuedCount} Queued` : 'Playwright'}
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-[#0f172a]">Auto Applier &amp; Vault</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Multi-link ATS submission using your saved Wellfound profile and IIM PDF themes.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAutoApplier}
              className="mt-4 w-full py-2 px-3 rounded-lg bg-[#4338ca] hover:bg-indigo-600 font-mono text-[10px] uppercase tracking-[0.22em] text-white cursor-pointer"
            >
              Launch Applier
            </button>
          </div>

          {/* Paste Job */}
          <div className="oi-card-subtle bg-white rounded-2xl p-5 border border-[#d4dcf0] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <PlusCircle className="w-4 h-4 text-[#4338ca]" aria-hidden="true" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Direct
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-[#0f172a]">Paste Job Intake</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Import any job description offline to score requirements and tailor CVs.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenManualModal}
              className="mt-4 w-full py-2 px-3 rounded-lg border border-[#d4dcf0] bg-[#f6f8fe] hover:border-[#4f46e5] font-mono text-[10px] uppercase tracking-[0.22em] text-[#0f172a] cursor-pointer"
            >
              Paste Description
            </button>
          </div>

          {/* Email Digest */}
          <div className="oi-card-subtle bg-white rounded-2xl p-5 border border-[#d4dcf0] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <Mail className="w-4 h-4 text-[#4338ca]" aria-hidden="true" />
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-700">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>Active</span>
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-[#0f172a]">Email Digest Alerts</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Scheduled high-match job alerts and automated Threads lead notifications.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenDigestModal}
              className="mt-4 w-full py-2 px-3 rounded-lg border border-[#d4dcf0] bg-[#f6f8fe] hover:border-[#4f46e5] font-mono text-[10px] uppercase tracking-[0.22em] text-[#0f172a] cursor-pointer"
            >
              Configure Alerts
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
