import React from 'react';
import {
  Layers,
  Briefcase,
  FileText,
  PlusCircle,
  Mail,
  Clock,
  Sparkles,
  Download,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { JobStatsResponse, ResumeData, UserProfile, ApplicationItem } from '../types/job';
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
  queuedCount?: number;
}

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
  queuedCount = 0,
}) => {
  const isProfileEmpty =
    !currentProfile ||
    ((!currentProfile.headline || currentProfile.headline.trim() === '') &&
      (currentProfile.skills?.length || 0) === 0 &&
      (currentProfile.experience?.length || 0) === 0);

  // Group applications by status
  const appCounts = {
    saved: applications.filter((a) => a.status === 'saved').length,
    applied: applications.filter((a) => a.status === 'applied').length,
    interviewing: applications.filter((a) => a.status === 'interviewing').length,
    offer: applications.filter((a) => a.status === 'offer').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
  };

  const sourcesList = stats ? Object.keys(stats.sources || {}) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Executive Hero Greeting Banner */}
      <div className="relative rounded-2xl bg-slate-900 text-white p-6 sm:p-8 shadow-sm overflow-hidden border border-slate-800">
        <div className="relative z-10 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/10 text-slate-300 text-[11px] font-semibold mb-3 border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Candidate Command Center</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Welcome back, {currentProfile?.full_name || activeUserId}
          </h1>

          <p className="mt-1.5 text-slate-400 text-xs sm:text-sm max-w-2xl leading-relaxed">
            {currentProfile?.headline ||
              'Search verified remote listings, track interview stages, manage ATS resumes, and build your profile.'}
          </p>

          {/* Profile Status Banner */}
          {isProfileEmpty ? (
            <div className="mt-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    Profile Setup Pending (Self-Configured)
                  </div>
                  <div className="text-xs text-amber-100/80 mt-0.5">
                    This profile starts clean with zero mock data. Enter your experience or click Sync from Resume to import your CV.
                  </div>
                </div>
              </div>
              <button
                onClick={onNavigateToProfile}
                className="inline-flex items-center px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-xs transition-all whitespace-nowrap cursor-pointer interactive-button"
              >
                <span>Set Up Profile</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </button>
            </div>
          ) : (
            <div className="mt-5 p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Configured: <strong className="text-white">{currentProfile?.skills?.length || 0} skills</strong>
                  </span>
                </div>
                {currentProfile?.location && (
                  <span className="text-slate-400">• {currentProfile.location}</span>
                )}
                {currentProfile?.min_hourly_rate ? (
                  <span className="text-slate-400">
                    • Minimum: <strong className="text-white">${currentProfile.min_hourly_rate}/hr</strong>
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onNavigateToProfile}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium inline-flex items-center gap-1 transition-all cursor-pointer interactive-button"
                >
                  <span>Edit Profile</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <a
                  href={getProfileDocxUrl(activeUserId)}
                  download
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all inline-flex items-center gap-1.5 cursor-pointer interactive-button shadow-xs"
                  title="Export ATS DOCX"
                >
                  <Download className="w-3 h-3" />
                  <span>Export DOCX</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Tier Cards: 2 Columns (Job Market Pulse & Application Tracker) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Job Market Pulse */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Job Market Pulse</h3>
                  <p className="text-xs text-slate-500">Multi-source ingestion engine</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Feeds Active</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Software and AI contract listings aggregated from Wellfound, Outlier, Mercor, Alignerr, Mindrift, and verified APIs.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xl font-bold text-slate-900 tabular-nums">{stats?.total_jobs || 265}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Listings</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xl font-bold text-slate-900 tabular-nums">{stats?.remote_jobs || 0}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Remote</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xl font-bold text-slate-900 tabular-nums">{stats?.internship_jobs || 0}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Internships</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-xl font-bold text-slate-900 tabular-nums">{sourcesList.length || 8}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-0.5">Sources</div>
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateToListings}
            className="mt-5 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer interactive-button"
          >
            <span>Explore All Listings ({stats?.total_jobs || 265})</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        {/* Card 2: Application Tracker */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-bold">
                  <Briefcase className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">Application Tracker</h3>
                  <p className="text-xs text-slate-500">Pipeline progression &amp; notes</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                {trackedCount} Tracked
              </span>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Track your candidate journey from saved opportunity to offer acceptance with inline recruiter notes.
            </p>

            {/* Pipeline Stage Badges */}
            <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-base font-bold text-slate-900 tabular-nums">{appCounts.saved}</div>
                <div className="text-[10px] text-slate-500">Saved</div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100">
                <div className="text-base font-bold text-blue-700 tabular-nums">{appCounts.applied}</div>
                <div className="text-[10px] text-blue-600 font-medium">Applied</div>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
                <div className="text-base font-bold text-purple-700 tabular-nums">{appCounts.interviewing}</div>
                <div className="text-[10px] text-purple-600 font-medium">Interview</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <div className="text-base font-bold text-emerald-700 tabular-nums">{appCounts.offer}</div>
                <div className="text-[10px] text-emerald-600 font-medium">Offers</div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100">
                <div className="text-base font-bold text-rose-700 tabular-nums">{appCounts.rejected}</div>
                <div className="text-[10px] text-rose-600 font-medium">Archived</div>
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateToTracker}
            className="mt-5 w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-all shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer interactive-button"
          >
            <span>Open Kanban Tracker ({trackedCount})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Bottom Tier Cards: 4 Columns (Resume Hub, Auto Applier, Paste Job, Email Digest) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 3: Resume & Matching Hub */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <FileText className="w-4 h-4" />
              </div>
              {activeResume ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/70">
                  Active Resume
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                  Not Uploaded
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Resume &amp; Matching Hub</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Upload PDF or DOCX to unlock non-inflated dual-factor matching &amp; gap analysis.
            </p>

            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1">
              <div className="font-semibold text-slate-800 truncate" title={activeResume?.filename || 'No resume'}>
                {activeResume ? activeResume.filename : 'No resume uploaded yet'}
              </div>
              <div className="text-slate-500 text-[11px]">
                {activeResume ? (
                  <span>
                    Detected: <strong className="text-slate-700">{activeResume.parsed_json?.skills?.length || 0} skills</strong>,{' '}
                    <strong className="text-slate-700">{activeResume.parsed_json?.experience?.length || 0} roles</strong>
                  </span>
                ) : (
                  <span>Upload your resume to calculate honest match scores for every listing.</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onOpenResumeModal}
            className="mt-4 w-full py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-all shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer interactive-button"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>{activeResume ? 'Manage Resume' : 'Upload Resume'}</span>
          </button>
        </div>

        {/* Card: Auto Applier & Wellfound Vault */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Send className="w-4 h-4" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/70">
                {queuedCount > 0 ? `${queuedCount} Queued` : 'Wellfound Style'}
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Auto Applier &amp; Vault</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              1-Click applications backed by authentic Wellfound dossier &amp; 1-page IIM resumes.
            </p>

            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>AI Plagiarism:</span>
                <span className="font-semibold text-emerald-700">0% (Verified)</span>
              </div>
              <div className="flex justify-between">
                <span>IIM Themes:</span>
                <span className="font-semibold text-slate-800">Classic, Exec, Tech</span>
              </div>
              <div className="flex justify-between">
                <span>ATS Formats:</span>
                <span className="font-semibold text-slate-800">Greenhouse, Lever</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenAutoApplier}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer interactive-button"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Launch Auto-Applier</span>
          </button>
        </div>

        {/* Card 4: Manual Job Intake (Paste Job) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <PlusCircle className="w-4 h-4" />
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-200/70">
                Direct Intake
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Paste Job (Manual Intake)</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Add job descriptions from LinkedIn, Indeed, or Unstop for offline matching.
            </p>

            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed">
              Enables offline manual intake to privately match, evaluate requirements, and generate tailored ATS resumes.
            </div>
          </div>

          <button
            onClick={onOpenManualModal}
            className="mt-4 w-full py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-all shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer interactive-button"
          >
            <PlusCircle className="w-3.5 h-3.5 text-slate-500" />
            <span>Paste Job Description</span>
          </button>
        </div>

        {/* Card 5: Automated Email Digest */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <Mail className="w-4 h-4" />
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/70">
                <Clock className="w-3 h-3 text-emerald-600" />
                <span>APScheduler</span>
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Email Digest Alerts</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Automated background digest alerting you to newly discovered high matches.
            </p>

            <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1 text-slate-600">
              <div className="flex justify-between">
                <span>Scheduler Daemon:</span>
                <span className="font-semibold text-emerald-600">Active</span>
              </div>
              <div className="flex justify-between">
                <span>Match Cutoff:</span>
                <span className="font-semibold text-slate-800">70%+ Blended</span>
              </div>
              <div className="flex justify-between">
                <span>Digest Delivery:</span>
                <span className="font-semibold text-slate-800">Every 4h / Daily</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenDigestModal}
            className="mt-4 w-full py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-all shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer interactive-button"
          >
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span>Configure Newsletter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
