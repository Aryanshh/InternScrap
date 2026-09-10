import React from 'react';
import { Briefcase, RefreshCw, PlusCircle, FileText, Mail, ShieldCheck, User } from 'lucide-react';
import { JobStatsResponse, ResumeData } from '../types/job';

interface HeaderProps {
  stats: JobStatsResponse | null;
  activeResume: ResumeData | null;
  isSyncing: boolean;
  activeView: 'listings' | 'tracker' | 'profile';
  trackedCount: number;
  onViewChange: (view: 'listings' | 'tracker' | 'profile') => void;
  onSync: () => void;
  onOpenManualModal: () => void;
  onOpenResumeModal: () => void;
  onOpenDigestModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  activeResume,
  isSyncing,
  activeView,
  trackedCount,
  onViewChange,
  onSync,
  onOpenManualModal,
  onOpenResumeModal,
  onOpenDigestModal,
}) => {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg sm:text-xl tracking-tight text-slate-900 whitespace-nowrap">
                InternScrap
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 whitespace-nowrap">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>ToS Safe</span>
              </span>
            </div>
          </div>

          {/* Navigation Segmented Control */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold shrink-0">
            <button
              onClick={() => onViewChange('listings')}
              className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                activeView === 'listings'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Explore Listings
            </button>
            <button
              onClick={() => onViewChange('tracker')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeView === 'tracker'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Tracker</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-700">
                {trackedCount}
              </span>
            </button>
            <button
              onClick={() => onViewChange('profile')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeView === 'profile'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Candidate Profile</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Live Count Pill (Visible on large screens) */}
            {stats && (
              <span className="hidden xl:inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl whitespace-nowrap font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span><strong className="text-slate-900">{stats.total_jobs}</strong> Jobs</span>
              </span>
            )}

            {/* Email Digest */}
            <button
              onClick={onOpenDigestModal}
              className="inline-flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 whitespace-nowrap"
              title="Automated high-match email digest and scheduler status"
            >
              <Mail className="w-3.5 h-3.5 sm:mr-1.5 text-indigo-600" />
              <span className="hidden md:inline">Email Digest</span>
            </button>

            {/* Resume Upload / Active Profile */}
            <button
              onClick={onOpenResumeModal}
              className={`inline-flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-all whitespace-nowrap ${
                activeResume
                  ? 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                  : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-200'
              }`}
              title={activeResume ? `Active: ${activeResume.filename}` : 'Upload your resume'}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              <span className="truncate max-w-[100px] sm:max-w-[120px]">
                {activeResume ? activeResume.filename : 'Upload Resume'}
              </span>
            </button>

            {/* Manual Intake */}
            <button
              onClick={onOpenManualModal}
              className="inline-flex items-center px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 whitespace-nowrap"
              title="Add job description manually for sites prohibiting automated scraping (LinkedIn, Indeed, etc.)"
            >
              <PlusCircle className="w-3.5 h-3.5 sm:mr-1.5 text-slate-600" />
              <span className="hidden sm:inline">Paste Job</span>
            </button>

            {/* Sync Trigger */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm shadow-indigo-100 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync APIs'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
