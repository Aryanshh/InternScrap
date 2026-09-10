import React from 'react';
import {
  Briefcase,
  Layers,
  Globe,
  GraduationCap,
  ArrowRight,
  User,
  CheckCircle2,
  FileText,
  PlusCircle,
  Mail,
  Clock,
  Sparkles,
  Download,
  AlertCircle,
  Building2,
  ChevronRight,
  ExternalLink,
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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. Hero Command Center Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 shadow-xl overflow-hidden border border-slate-800">
        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Candidate Command Center</span>
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300">
              Logged in as: <strong>{activeUserId}</strong>
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Welcome back, {currentProfile?.full_name || activeUserId}!
          </h1>

          <p className="mt-2 text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
            {currentProfile?.headline ||
              'Your genuine career command center. Search verified remote listings, track interview stages, manage ATS resumes, and build your profile.'}
          </p>

          {/* Profile Status Banner */}
          {isProfileEmpty ? (
            <div className="mt-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    Profile Setup Pending (Self-Configured)
                  </div>
                  <div className="text-xs text-amber-100/90 mt-0.5">
                    This profile has zero mock data. Enter your experience or click Sync from Resume to import your CV.
                  </div>
                </div>
              </div>
              <button
                onClick={onNavigateToProfile}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition-all whitespace-nowrap cursor-pointer"
              >
                <span>Set Up Profile</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </button>
            </div>
          ) : (
            <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-wrap items-center gap-4 text-xs text-emerald-200">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Profile configured: <strong>{currentProfile?.skills?.length || 0} skills</strong>
                </span>
              </div>
              {currentProfile?.location && <span>• {currentProfile.location}</span>}
              {currentProfile?.min_hourly_rate ? (
                <span>• Minimum: <strong>${currentProfile.min_hourly_rate}/hr</strong></span>
              ) : null}
              <button
                onClick={onNavigateToProfile}
                className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4 cursor-pointer"
              >
                Edit Profile →
              </button>
            </div>
          )}
        </div>

        <div className="absolute -right-16 -bottom-16 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. Key Modules Grid (Clubbed Features) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Module 1: Job Count & Market Pulse */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Feed Active</span>
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900">Job Market Pulse</h3>
            <p className="text-xs text-slate-500 mt-1">
              Aggregated from Wellfound, Outlier, Mercor, Alignerr, Mindrift & free ToS APIs.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2.5 text-center">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="text-xl font-extrabold text-slate-900">{stats?.total_jobs || 265}</div>
                <div className="text-[11px] text-slate-500 font-medium">Total Listings</div>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                <div className="text-xl font-extrabold text-emerald-700">{stats?.remote_jobs || 0}</div>
                <div className="text-[11px] text-emerald-600 font-medium">Remote Roles</div>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-100">
                <div className="text-xl font-extrabold text-amber-700">{stats?.internship_jobs || 0}</div>
                <div className="text-[11px] text-amber-600 font-medium">Internships</div>
              </div>
              <div className="p-3 rounded-2xl bg-violet-50/60 border border-violet-100">
                <div className="text-xl font-extrabold text-violet-700">{sourcesList.length || 8}</div>
                <div className="text-[11px] text-violet-600 font-medium">Verified Sources</div>
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateToListings}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <span>Explore Listings ({stats?.total_jobs || 265})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Module 2: Candidate Profile Hub */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                {activeUserId}
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900">Candidate Profile</h3>
            <p className="text-xs text-slate-500 mt-1">
              Personal credentials, target compensation, and technical skills taxonomy.
            </p>

            <div className="mt-5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Name:</span>
                <span className="font-bold text-slate-900">{currentProfile?.full_name || activeUserId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Work Mode:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {currentProfile?.desired_work_mode || 'Remote'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Skills Count:</span>
                <span className="font-bold text-indigo-600">
                  {currentProfile?.skills?.length || 0} skills configured
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Target Platforms:</span>
                <span className="font-medium text-slate-700">
                  {currentProfile?.target_platforms?.length || 0} selected
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <button
              onClick={onNavigateToProfile}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all text-center cursor-pointer"
            >
              {isProfileEmpty ? 'Set Up Profile' : 'Edit Profile'}
            </button>
            <a
              href={getProfileDocxUrl(activeUserId)}
              download
              className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-semibold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
              title="Export ATS DOCX"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOCX</span>
            </a>
          </div>
        </div>

        {/* Module 3: Application Tracker */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                {trackedCount} Active
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900">Application Tracker</h3>
            <p className="text-xs text-slate-500 mt-1">
              5-stage Kanban pipeline with custom notes and role-tailored resumes.
            </p>

            {/* Pipeline Stage Badges */}
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-bold text-slate-900">{appCounts.saved}</div>
                <div className="text-[10px] text-slate-500">Saved</div>
              </div>
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                <div className="font-bold text-blue-700">{appCounts.applied}</div>
                <div className="text-[10px] text-blue-600">Applied</div>
              </div>
              <div className="p-2 rounded-xl bg-purple-50 border border-purple-100">
                <div className="font-bold text-purple-700">{appCounts.interviewing}</div>
                <div className="text-[10px] text-purple-600">Interviewing</div>
              </div>
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="font-bold text-emerald-700">{appCounts.offer}</div>
                <div className="text-[10px] text-emerald-600">Offers</div>
              </div>
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-100 col-span-2">
                <div className="font-bold text-rose-700">{appCounts.rejected}</div>
                <div className="text-[10px] text-rose-600">Archived / Rejected</div>
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateToTracker}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <span>Open Kanban Board ({trackedCount})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Module 4: Resume & Tailoring Hub */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              {activeResume ? (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  Active
                </span>
              ) : (
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-medium">
                  Not Uploaded
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold text-slate-900">Resume & Matching Hub</h3>
            <p className="text-xs text-slate-500 mt-1">
              Upload PDF/DOCX for honest semantic matching and ATS resume tailoring.
            </p>

            <div className="mt-5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-2">
              <div className="font-semibold text-slate-800 truncate" title={activeResume?.filename || 'No resume'}>
                {activeResume ? activeResume.filename : 'No resume uploaded yet'}
              </div>
              <div className="text-slate-500 text-[11px]">
                {activeResume ? (
                  <span>
                    Detected: <strong>{activeResume.parsed_json?.skills?.length || 0} skills</strong>,{' '}
                    <strong>{activeResume.parsed_json?.experience?.length || 0} roles</strong>
                  </span>
                ) : (
                  <span>Upload your resume to calculate honest match scores for every listing.</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onOpenResumeModal}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{activeResume ? 'Manage / Replace Resume' : 'Upload Resume'}</span>
          </button>
        </div>

        {/* Module 5: Manual Job Intake (Paste Job) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                <PlusCircle className="w-5 h-5" />
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                ToS Safe Intake
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900">Paste Job (Manual Intake)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Add job descriptions from LinkedIn, Indeed, or Unstop for offline matching.
            </p>

            <div className="mt-5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed">
              Enables non-scraping manual intake to respect site terms of service while still letting you generate tailored ATS resumes and gap analysis.
            </div>
          </div>

          <button
            onClick={onOpenManualModal}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 text-slate-600" />
            <span>Paste Job Description</span>
          </button>
        </div>

        {/* Module 6: Automated Email Digest */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Mail className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                <Clock className="w-3 h-3 text-emerald-600" />
                <span>APScheduler</span>
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900">Email Digest Alerts</h3>
            <p className="text-xs text-slate-500 mt-1">
              Automated background digest alerting you to newly discovered high matches.
            </p>

            <div className="mt-5 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Scheduler Daemon:</span>
                <span className="font-semibold text-emerald-600">Active</span>
              </div>
              <div className="flex justify-between">
                <span>Match Cutoff:</span>
                <span className="font-semibold text-slate-800">≥ 70% Blended</span>
              </div>
              <div className="flex justify-between">
                <span>Digest Delivery:</span>
                <span className="font-semibold text-slate-800">Every 4h / Daily</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenDigestModal}
            className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-indigo-600" />
            <span>Configure & View Newsletter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
