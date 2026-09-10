import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { JobCard } from './components/JobCard';
import { ManualJobModal } from './components/ManualJobModal';
import { ResumeUploadModal } from './components/ResumeUploadModal';
import { TailorResumeModal } from './components/TailorResumeModal';
import { ApplicationTracker } from './components/ApplicationTracker';
import { EmailDigestModal } from './components/EmailDigestModal';
import { CandidateProfile } from './components/CandidateProfile';
import { HomePage } from './components/HomePage';
import { LoginPage } from './components/LoginPage';
import {
  getJobs,
  getStats,
  getCategories,
  triggerIngest,
  getActiveResume,
  getApplications,
  trackApplication,
  getProfilesList,
  getActiveUserId,
  getProfile,
  getAuthToken,
  clearAuth,
} from './api/client';
import {
  Job,
  JobStatsResponse,
  FilterState,
  ResumeData,
  LoginProfileSummary,
  UserProfile,
  ApplicationItem,
  AuthUser,
} from './types/job';
import { Loader2, Sparkles, ChevronLeft, ChevronRight, Inbox, Layers, Globe, GraduationCap } from 'lucide-react';

const initialFilters: FilterState = {
  search: '',
  remote_type: 'all',
  category: 'all',
  is_internship: null,
  source: 'all',
  min_match_score: undefined,
  sort_by: 'posted_date_desc',
  page: 1,
};

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getAuthToken()));
  const [activeUserId, setActiveUserId] = useState<string>(() => getActiveUserId());
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [loginProfiles, setLoginProfiles] = useState<LoginProfileSummary[]>([]);
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [trackedJobIds, setTrackedJobIds] = useState<Set<string>>(new Set());

  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<JobStatsResponse | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeResume, setActiveResume] = useState<ResumeData | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals & Navigation
  const [activeView, setActiveView] = useState<'home' | 'listings' | 'tracker' | 'profile'>('home');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [tailoringJob, setTailoringJob] = useState<Job | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadProfileData = useCallback(async (uid: string) => {
    try {
      const prof = await getProfile(uid);
      setCurrentProfile(prof);
    } catch (err) {
      console.error('Failed to load profile for user', uid, err);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [statsData, catData, resumeData, appsData, profilesList] = await Promise.all([
        getStats(),
        getCategories(),
        getActiveResume(),
        getApplications(),
        getProfilesList(),
      ]);
      setStats(statsData);
      setCategories(catData);
      setActiveResume(resumeData);
      setApplications(appsData);
      setTrackedJobIds(new Set(appsData.map((a) => a.job_id)));
      setLoginProfiles(profilesList);
      await loadProfileData(activeUserId);
    } catch (err) {
      console.error('Failed to load stats/categories/resume/applications/profiles', err);
    }
  }, [activeUserId, loadProfileData]);

  const handleLoginSuccess = async (user: AuthUser) => {
    setIsAuthenticated(true);
    setActiveUserId(user.id);
    showToast(`Logged in successfully as ${user.full_name || user.username}!`);
    await loadInitialData();
  };

  const handleLogout = () => {
    clearAuth();
    setIsAuthenticated(false);
    showToast('Signed out of InternScrap.');
  };

  const handleTrackJob = async (job: Job) => {
    try {
      if (trackedJobIds.has(job.id)) {
        showToast(`"${job.title}" is already in your tracker.`);
        return;
      }
      await trackApplication(job.id, 'saved');
      setTrackedJobIds((prev) => new Set(prev).add(job.id));
      const updatedApps = await getApplications();
      setApplications(updatedApps);
      showToast(`Added "${job.title}" to Application Tracker!`);
    } catch (err) {
      console.error('Failed to track job', err);
      showToast('Could not save application to tracker.');
    }
  };

  const loadJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getJobs({
        page: filters.page,
        page_size: 15,
        search: filters.search || undefined,
        remote_type: filters.remote_type !== 'all' ? filters.remote_type : undefined,
        category: filters.category !== 'all' ? filters.category : undefined,
        is_internship: filters.is_internship !== null ? filters.is_internship : undefined,
        source: filters.source !== 'all' ? filters.source : undefined,
        min_match_score: filters.min_match_score,
        sort_by: filters.sort_by,
      });
      setJobs(res.items);
      setTotalJobs(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated, loadInitialData]);

  useEffect(() => {
    if (isAuthenticated && activeView === 'listings') {
      loadJobs();
    }
  }, [isAuthenticated, activeView, loadJobs]);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const result = await triggerIngest(40);
      showToast(
        `Ingestion complete! Fetched ${result.total_fetched} jobs, added ${result.new_jobs_added} new, merged ${result.merged_duplicates} duplicates.`
      );
      await Promise.all([loadJobs(), loadInitialData()]);
    } catch (err) {
      console.error('Ingestion failed', err);
      showToast('Ingestion failed. Please check backend logs.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  const handleJobAdded = (newJob: Job) => {
    showToast(`Successfully added "${newJob.title}" at ${newJob.company}!`);
    loadJobs();
    loadInitialData();
  };

  const handleResumeUploaded = (res: ResumeData) => {
    setActiveResume(res);
    showToast(`Resume "${res.filename}" parsed! ${res.parsed_json?.skills?.length || 0} skills detected.`);
    loadJobs();
    loadProfileData(activeUserId);
  };

  const availableSources = stats ? Object.keys(stats.sources || {}) : [];

  // If user is not authenticated, render Login Page
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-sm border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Streamlined Header */}
      <Header
        activeView={activeView}
        trackedCount={trackedJobIds.size}
        activeUserId={activeUserId}
        loginProfiles={loginProfiles}
        isSyncing={isSyncing}
        onViewChange={setActiveView}
        onLogout={handleLogout}
        onSync={handleSync}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {activeView === 'home' ? (
          <HomePage
            activeUserId={activeUserId}
            currentProfile={currentProfile}
            stats={stats}
            activeResume={activeResume}
            trackedCount={trackedJobIds.size}
            applications={applications}
            onNavigateToListings={() => {
              setActiveView('listings');
              loadJobs();
            }}
            onNavigateToTracker={() => setActiveView('tracker')}
            onNavigateToProfile={() => setActiveView('profile')}
            onOpenResumeModal={() => setIsResumeModalOpen(true)}
            onOpenManualModal={() => setIsManualModalOpen(true)}
            onOpenDigestModal={() => setIsDigestModalOpen(true)}
          />
        ) : activeView === 'profile' ? (
          <CandidateProfile
            activeUserId={activeUserId}
            loginProfiles={loginProfiles}
            onBackToHome={() => {
              loadProfileData(activeUserId);
              setActiveView('home');
            }}
            onNavigateToListingsWithSource={(src) => {
              setFilters((prev) => ({ ...prev, source: src.toLowerCase(), page: 1 }));
              setActiveView('listings');
              loadJobs();
            }}
          />
        ) : activeView === 'tracker' ? (
          <ApplicationTracker
            onTailorJob={(selectedJob) => setTailoringJob(selectedJob)}
            onBackToHome={() => {
              loadInitialData();
              setActiveView('home');
            }}
          />
        ) : (
          /* Explore Listings View */
          <>
            {/* Banner Section */}
            <div className="mb-6 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10 max-w-3xl">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-indigo-200 backdrop-blur-md mb-3">
                  Remote Platforms & AI Candidate Profile • Wellfound, Outlier, Mercor, Alignerr, Mindrift
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Explore Remote Listings
                </h1>
                <p className="mt-2 text-indigo-100/80 text-sm leading-relaxed">
                  Direct listings with transparent hourly rates ($30–$120/hr) across Outlier, Mercor, Wellfound, Alignerr, and Mindrift. Filter by platform, match against your resume, and tailor ATS resumes.
                </p>

                {/* Live Stats Cards */}
                {stats && (
                  <div className="mt-6 pt-5 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center space-x-2.5 bg-white/10 backdrop-blur-sm px-3.5 py-2.5 rounded-2xl border border-white/10">
                      <Layers className="w-5 h-5 text-indigo-300 shrink-0" />
                      <div>
                        <div className="font-bold text-white text-base leading-none">{stats.total_jobs}</div>
                        <div className="text-indigo-200 text-[11px] mt-1">Total Jobs</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2.5 bg-white/10 backdrop-blur-sm px-3.5 py-2.5 rounded-2xl border border-white/10">
                      <Globe className="w-5 h-5 text-emerald-300 shrink-0" />
                      <div>
                        <div className="font-bold text-white text-base leading-none">{stats.remote_jobs}</div>
                        <div className="text-indigo-200 text-[11px] mt-1">Remote</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2.5 bg-white/10 backdrop-blur-sm px-3.5 py-2.5 rounded-2xl border border-white/10">
                      <GraduationCap className="w-5 h-5 text-amber-300 shrink-0" />
                      <div>
                        <div className="font-bold text-white text-base leading-none">{stats.internship_jobs}</div>
                        <div className="text-indigo-200 text-[11px] mt-1">Internships</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2.5 bg-white/10 backdrop-blur-sm px-3.5 py-2.5 rounded-2xl border border-white/10">
                      <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <div>
                        <div className="font-bold text-white text-base leading-none">{availableSources.length} Feeds</div>
                        <div className="text-indigo-200 text-[11px] mt-1">Live Sources</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* Filters */}
            <FilterBar
              filters={filters}
              categories={categories}
              sources={availableSources}
              hasActiveResume={Boolean(activeResume)}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
            />

            {/* Results Header */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs sm:text-sm font-medium text-slate-500">
                Showing <strong className="text-slate-800">{jobs.length}</strong> of{' '}
                <strong className="text-slate-800">{totalJobs}</strong> listings
              </p>
              {totalPages > 1 && (
                <p className="text-xs text-slate-400">
                  Page {filters.page} of {totalPages}
                </p>
              )}
            </div>

            {/* Content Area */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                <p className="text-sm font-medium text-slate-500">Evaluating listings against your profile...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-xl mx-auto my-8 shadow-sm">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Inbox className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">No Listings Found</h3>
                <p className="text-sm text-slate-500 mb-6">
                  No listings match your current filters. Try resetting the filters or lowering the match score threshold.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onTailor={(selectedJob) => setTailoringJob(selectedJob)}
                    onTrack={handleTrackJob}
                    isTracked={trackedJobIds.has(job.id)}
                  />
                ))}
              </div>
            )}

            {/* Pagination Bar */}
            {totalPages > 1 && !isLoading && (
              <div className="flex items-center justify-center space-x-2 py-8">
                <button
                  onClick={() => handleFilterChange({ page: Math.max(1, filters.page - 1) })}
                  disabled={filters.page <= 1}
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="text-xs sm:text-sm font-medium text-slate-600 px-3">
                  Page {filters.page} of {totalPages}
                </span>

                <button
                  onClick={() => handleFilterChange({ page: Math.min(totalPages, filters.page + 1) })}
                  disabled={filters.page >= totalPages}
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p className="font-medium text-slate-500">
          Made with love with AI
        </p>
      </footer>

      {/* Modals */}
      <ManualJobModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onJobAdded={handleJobAdded}
      />

      <ResumeUploadModal
        isOpen={isResumeModalOpen}
        activeResume={activeResume}
        onClose={() => setIsResumeModalOpen(false)}
        onUploadSuccess={handleResumeUploaded}
      />

      {tailoringJob && (
        <TailorResumeModal
          job={tailoringJob}
          isOpen={!!tailoringJob}
          onClose={() => setTailoringJob(null)}
        />
      )}

      <EmailDigestModal
        isOpen={isDigestModalOpen}
        onClose={() => setIsDigestModalOpen(false)}
      />
    </div>
  );
};

export default App;
