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
import { AutoApplierModal } from './components/AutoApplierModal';
import { Daily21View } from './components/Daily21View';
import { GoogleFormsScraperView } from './components/GoogleFormsScraperView';
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
import { Loader2, Sparkles, ChevronLeft, ChevronRight, Inbox, Layers, Globe, GraduationCap, Send } from 'lucide-react';

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
  const [activeView, setActiveView] = useState<'home' | 'daily21' | 'google_forms' | 'listings' | 'tracker' | 'profile'>('home');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [isAutoApplierOpen, setIsAutoApplierOpen] = useState(false);
  const [autoApplierInitialUrl, setAutoApplierInitialUrl] = useState<string | undefined>(undefined);
  const [autoApplierInitialUrls, setAutoApplierInitialUrls] = useState<string[] | undefined>(undefined);
  const [queuedJobs, setQueuedJobs] = useState<Map<string, Job>>(new Map());
  const [tailoringJob, setTailoringJob] = useState<Job | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenAutoApplier = (url?: string) => {
    setAutoApplierInitialUrl(url);
    setAutoApplierInitialUrls(undefined);
    setIsAutoApplierOpen(true);
  };

  const handleToggleQueue = (job: Job) => {
    setQueuedJobs((prev) => {
      const next = new Map(prev);
      if (next.has(job.id)) {
        next.delete(job.id);
        showToast(`Removed "${job.title}" from Auto-Apply queue.`);
      } else {
        next.set(job.id, job);
        showToast(`Added "${job.title}" to Auto-Apply queue!`);
      }
      return next;
    });
  };

  const handleLaunchQueuedAutoApply = () => {
    const urls = Array.from(queuedJobs.values())
      .flatMap((j) => j.apply_urls || [])
      .filter((u) => u && (u.startsWith('http://') || u.startsWith('https://')));
    if (urls.length === 0) {
      showToast('No valid apply URLs found in queued jobs.');
      return;
    }
    setAutoApplierInitialUrl(undefined);
    setAutoApplierInitialUrls(urls);
    setIsAutoApplierOpen(true);
  };

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
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-slate-100 px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2.5 text-xs font-medium border border-slate-800 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
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
        onOpenAutoApplier={() => handleOpenAutoApplier()}
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
            onOpenAutoApplier={() => handleOpenAutoApplier()}
            onNavigateToDaily21={() => setActiveView('daily21')}
            queuedCount={queuedJobs.size}
          />
        ) : activeView === 'daily21' ? (
          <Daily21View
            activeUserId={activeUserId}
            onNavigateToTracker={() => setActiveView('tracker')}
            onOpenAutoApplierModal={(url) => handleOpenAutoApplier(url)}
            showToast={showToast}
          />
        ) : activeView === 'google_forms' ? (
          <GoogleFormsScraperView
            activeUserId={activeUserId}
            onNavigateToTracker={() => setActiveView('tracker')}
            showToast={showToast}
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
            <div className="mb-6 p-6 sm:p-8 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.1)] relative overflow-hidden">
              <div className="relative z-10 max-w-3xl">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700/80">
                    Enterprise Remote Feed
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Wellfound • Outlier • Mercor • Alignerr • Mindrift • Remotive
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Explore Verified Remote Listings
                </h1>
                <p className="mt-2 text-slate-400 text-xs sm:text-sm leading-relaxed">
                  Vetted roles with transparent compensation ($30–$120/hr) across modern AI and tech platforms. Filter by work mode, verify live link vitality, and auto-queue for 1-click application submissions.
                </p>

                {/* Live Stats Cards */}
                {stats && (
                  <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center space-x-2.5 bg-slate-800/60 px-3.5 py-2 rounded-xl border border-slate-700/60">
                      <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <div className="font-bold text-white text-sm font-mono leading-none">{stats.total_jobs}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5 uppercase tracking-wider">Total Listings</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2.5 bg-slate-800/60 px-3.5 py-2 rounded-xl border border-slate-700/60">
                      <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <div className="font-bold text-white text-sm font-mono leading-none">{stats.remote_jobs}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5 uppercase tracking-wider">Remote Roles</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2.5 bg-slate-800/60 px-3.5 py-2 rounded-xl border border-slate-700/60">
                      <GraduationCap className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-bold text-white text-sm font-mono leading-none">{stats.internship_jobs}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5 uppercase tracking-wider">Internships</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2.5 bg-slate-800/60 px-3.5 py-2 rounded-xl border border-slate-700/60">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      <div>
                        <div className="font-bold text-white text-sm font-mono leading-none">{availableSources.length} Feeds</div>
                        <div className="text-slate-400 text-[10px] mt-0.5 uppercase tracking-wider">Active Feeds</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
                    onAutoApply={(selectedJob) =>
                      handleOpenAutoApplier(selectedJob.apply_urls?.[0] || '')
                    }
                    isTracked={trackedJobIds.has(job.id)}
                    isQueued={queuedJobs.has(job.id)}
                    onToggleQueue={handleToggleQueue}
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
      <footer className="bg-white border-t border-slate-200/80 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="font-semibold text-slate-800">InternScrap Enterprise Platform</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">Zero AI Plagiarism Job Automation Engine</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Wellfound Dossier Sync</span>
            <span>•</span>
            <span>ATS Resume Standard</span>
          </div>
        </div>
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

      <AutoApplierModal
        isOpen={isAutoApplierOpen}
        onClose={() => {
          setIsAutoApplierOpen(false);
          setAutoApplierInitialUrl(undefined);
          setAutoApplierInitialUrls(undefined);
        }}
        activeUserId={activeUserId}
        initialUrl={autoApplierInitialUrl}
        initialUrls={autoApplierInitialUrls}
        onApplicationApplied={() => {
          loadInitialData();
          showToast('Application logged to Application Tracker!');
        }}
      />

      {/* Floating Auto-Apply Queue Bar */}
      {queuedJobs.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-950/90 backdrop-blur-md text-white px-5 py-2.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] border border-slate-800 flex items-center gap-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-200">
              {queuedJobs.size} Job{queuedJobs.size > 1 ? 's' : ''} queued
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <button
              onClick={handleLaunchQueuedAutoApply}
              className="interactive-button px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Launch Auto-Applier</span>
            </button>
            <button
              onClick={() => {
                setQueuedJobs(new Map());
                showToast('Auto-Apply queue cleared.');
              }}
              className="interactive-button px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
