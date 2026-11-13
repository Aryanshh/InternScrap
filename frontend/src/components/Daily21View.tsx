import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  Globe,

  ArrowRight,
  Eye,
  SlidersHorizontal,
  Search,
} from 'lucide-react';
import {
  Daily21Job,
  Daily21ProgressResponse,
  Daily21ProgressResult,
  getDaily21Drops,
  triggerDaily21ApplyAll,
  getDaily21Progress,
  getIimPdfUrl,
} from '../api/client';
import { IimResumeTheme } from '../types/job';

interface Daily21ViewProps {
  activeUserId: string;
  onNavigateToTracker: () => void;
  onOpenAutoApplierModal: (url?: string) => void;
  showToast: (msg: string) => void;
}

export const Daily21View: React.FC<Daily21ViewProps> = ({
  activeUserId,
  onNavigateToTracker,
  onOpenAutoApplierModal,
  showToast,
}) => {
  const [jobs, setJobs] = useState<Daily21Job[]>([]);
  const [dateStr, setDateStr] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Runner controls
  const [mode, setMode] = useState<'review' | 'submit'>('review');
  const [theme, setTheme] = useState<IimResumeTheme>('classic');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<Daily21ProgressResponse | null>(null);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);

  // Inspection states
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDailyJobs = async (force: boolean = false) => {
    try {
      if (force) setIsRefreshing(true);
      else setIsLoading(true);

      const res = await getDaily21Drops(activeUserId, force);
      if (res.success && res.jobs) {
        setJobs(res.jobs);
        setDateStr(res.date);
      }
    } catch (err) {
      console.error('Failed to load Daily 21 drops', err);
      showToast('Could not load Daily 21 drops. Please check your connection.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDailyJobs();
  }, [activeUserId]);

  // Polling active batch progress
  useEffect(() => {
    if (!activeBatchId) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    const poll = async () => {
      try {
        const prog = await getDaily21Progress(activeBatchId);
        setBatchProgress(prog);

        // Update local jobs status if any results completed
        if (prog.results && prog.results.length > 0) {
          const completedMap = new Map<string, string>();
          prog.results.forEach((r) => {
            if (r.job_id) {
              completedMap.set(r.job_id, r.status === 'submitted' ? 'applied' : 'saved');
            }
          });
          setJobs((prev) =>
            prev.map((j) => (completedMap.has(j.id) ? { ...j, application_status: completedMap.get(j.id)! } : j))
          );
        }

        if (prog.status === 'completed' || prog.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (prog.status === 'completed') {
            showToast(`Batch completed: Successfully processed ${prog.completed_count} applications!`);
          } else {
            showToast('Batch execution stopped with errors.');
          }
        }
      } catch (err) {
        console.error('Polling batch progress failed', err);
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 2500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeBatchId]);

  const handleApplyAll = async () => {
    if (batchProgress?.status === 'running') {
      showToast('A batch application is currently running.');
      return;
    }

    try {
      setIsTriggering(true);
      const res = await triggerDaily21ApplyAll({
        mode,
        theme,
      });

      if (res.success && res.batch_id) {
        setActiveBatchId(res.batch_id);
        setShowLogs(true);
        showToast(`1-Click Batch Apply started for all 21 remote jobs (${mode.toUpperCase()} mode).`);
      }
    } catch (err: any) {
      console.error('Failed to trigger apply all', err);
      showToast(err.response?.data?.detail || 'Failed to start batch application.');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleApplySingle = async (job: Daily21Job) => {
    try {
      showToast(`Triggering auto-applier for ${job.company}...`);
      const res = await triggerDaily21ApplyAll({
        mode,
        theme,
        job_ids: [job.id],
      });
      if (res.success && res.batch_id) {
        setActiveBatchId(res.batch_id);
        setShowLogs(true);
      }
    } catch (err: any) {
      console.error('Failed to apply single job', err);
      showToast(err.response?.data?.detail || 'Failed to start auto-apply.');
    }
  };

  const completedCount = jobs.filter((j) => j.application_status === 'applied' || j.application_status === 'saved').length;
  const filteredJobs = jobs.filter((j) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      j.skills.some((s) => s.toLowerCase().includes(q))
    );
  });

  const isBatchRunning = batchProgress?.status === 'running';
  const progressPercent = batchProgress ? Math.round((batchProgress.completed_count / (batchProgress.total || 21)) * 100) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Executive Dark Slate Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-br from-[#070b19] via-[#0d1633] to-[#1e1b4b] text-[#f8faff] p-7 sm:p-10 overflow-hidden border border-indigo-400/20">
        <div className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl oi-mesh-drift" aria-hidden="true" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#c7d2fe] text-[10px] font-mono uppercase tracking-[0.25em] font-medium border border-white/15">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Daily 21 Remote Drops
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Curated for {activeUserId} • {dateStr || 'Today'}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] bg-white/5 text-slate-300 border border-white/10">
              Profile-Only Fill
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight leading-[1.05] text-[#f6f8fe]">
            Daily <span className="italic text-[#7dd3fc]">21</span> Remote Jobs
          </h1>
          <p className="mt-2 text-slate-400 text-xs sm:text-sm leading-relaxed max-w-2xl">
            21 verified remote engineering and AI roles selected daily against your profile. Click 1-Click Apply to automatically navigate from job postings to application forms and fill all your verified details.
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/[0.04] p-3.5 rounded-2xl border border-white/10">
              <div className="text-white font-mono text-lg font-bold">21</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Verified Drops</div>
            </div>
            <div className="bg-white/[0.04] p-3.5 rounded-2xl border border-white/10">
              <div className="text-emerald-400 font-mono text-lg font-bold">{completedCount} / 21</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Applied / Ready</div>
            </div>
            <div className="bg-white/[0.04] p-3.5 rounded-2xl border border-white/10">
              <div className="text-white font-mono text-lg font-bold">100%</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Remote Worldwide</div>
            </div>
            <div className="bg-white/[0.04] p-3.5 rounded-2xl border border-white/10">
              <div className="text-amber-400 font-mono text-lg font-bold">$35 - $120/hr</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Rate Range</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Command Center & 1-Click Apply Controls */}
      <div className="bg-white rounded-3xl border border-[#d4dcf0] p-6 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left: Primary 1-Click Action */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleApplyAll}
                disabled={isBatchRunning || isTriggering || isLoading || jobs.length === 0}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-mono uppercase tracking-[0.2em] text-xs font-medium text-[#f6f8fe] bg-[#4338ca] hover:bg-indigo-700 active:scale-[0.98] transition-all duration-300 ease-premium disabled:opacity-60 cursor-pointer interactive-button oi-btn-pulse"
              >
                {isBatchRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Applying ({batchProgress?.completed_count || 0} / 21)...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                    <span>Apply to All 21 Remote Jobs (1-Click)</span>
                  </>
                )}
              </button>

              <button
                onClick={() => loadDailyJobs(true)}
                disabled={isRefreshing || isBatchRunning}
                className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full font-mono uppercase tracking-[0.18em] text-[10px] font-medium text-[#0f172a] bg-[#f6f8fe] hover:border-[#4f46e5] transition-colors border border-[#d4dcf0] cursor-pointer interactive-button"
                title="Refresh today's 21 drop selection"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh Drops</span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Fills only saved details from your Candidate Vault and attaches your 1-page IIM PDF resume.
            </p>
          </div>

          {/* Right: Mode & Resume Theme Selectors */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs">
            {/* Mode Selector */}
            <div className="flex items-center bg-[#e8eefc] p-1 rounded-full border border-[#d4dcf0] font-medium">
              <button
                type="button"
                onClick={() => setMode('review')}
                disabled={isBatchRunning}
                className={`px-3.5 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap transition-all cursor-pointer ${
                  mode === 'review'
                    ? 'bg-[#1e1b4b] text-[#f6f8fe] font-medium'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Review Mode (Safe)
              </button>
              <button
                type="button"
                onClick={() => setMode('submit')}
                disabled={isBatchRunning}
                className={`px-3.5 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap transition-all cursor-pointer ${
                  mode === 'submit'
                    ? 'bg-[#1e1b4b] text-[#f6f8fe] font-medium'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Auto-Submit Mode
              </button>
            </div>

            {/* Resume Theme Selector */}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500 whitespace-nowrap">IIM Resume:</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as IimResumeTheme)}
                disabled={isBatchRunning}
                className="px-3.5 py-2 rounded-full border border-[#d4dcf0] bg-[#f6f8fe] text-xs font-medium text-[#0f172a] focus:ring-2 focus:ring-[#4338ca]/20 focus:border-[#4338ca] focus:outline-none"
              >
                <option value="classic">Classic (Crimson)</option>
                <option value="executive">Executive (Navy)</option>
                <option value="tech">Tech (Emerald)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Live Progress Card (if batch is running or completed) */}
        {batchProgress && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {batchProgress.status === 'running' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                      In Progress ({batchProgress.completed_count} of {batchProgress.total} completed)
                    </span>
                  ) : batchProgress.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      All {batchProgress.total} Applications Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      Batch Finished with Alerts
                    </span>
                  )}

                  {batchProgress.current_job && batchProgress.status === 'running' && (
                    <span className="text-xs text-slate-600 font-medium truncate max-w-md hidden sm:inline">
                      Current: {batchProgress.current_job.title} at {batchProgress.current_job.company}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showLogs ? 'Hide Logs' : 'View Terminal Logs'}</span>
                    {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-slate-900 h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Collapsible log console */}
              {showLogs && (
                <div className="mt-3 p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded-lg border border-slate-800 max-h-48 overflow-y-auto space-y-1">
                  {batchProgress.logs?.map((l, i) => (
                    <div key={i} className="leading-relaxed">
                      {l}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Search / Filter bar for Daily 21 */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search within today's 21 drops (title, company, skill)..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 shadow-2xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
          />
        </div>
        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-900">{filteredJobs.length}</span> of {jobs.length} drops
        </div>
      </div>

      {/* 4. The 21 Job Cards Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-slate-900 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-700">Curating your Daily 21 Remote Drops...</p>
          <p className="text-xs text-slate-400 mt-1">Ranking verified remote roles matching your saved profile</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-sm font-medium text-slate-600">No jobs match your search filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job, idx) => {
            const isApplied = job.application_status === 'applied';
            const isSaved = job.application_status === 'saved';
            const initial = job.company ? job.company.charAt(0).toUpperCase() : 'J';

            // Find matching progress result if any
            const resultItem = batchProgress?.results?.find((r) => r.job_id === job.id);

            return (
              <div
                key={job.id}
                className="bg-white rounded-3xl border border-[#d4dcf0] hover:border-[#4338ca]/40 p-6 oi-card-subtle transition-all duration-500 ease-premium flex flex-col justify-between group"
              >
                <div>
                  {/* Top Row: Index, Company monogram, Match Score */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-2xl bg-[#f6f8fe] border border-[#d4dcf0] text-[#0f172a] font-serif italic font-bold text-sm flex items-center justify-center shrink-0 group-hover:border-[#4338ca] group-hover:text-[#4338ca] transition-colors">
                        {initial}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[150px]">
                          {job.company}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Drop #{idx + 1} • {job.primary_source}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      {job.match_score}% Match
                    </span>
                  </div>

                  {/* Role Title */}
                  <h3 className="font-serif text-base font-normal text-[#0f172a] group-hover:text-[#4338ca] transition-colors line-clamp-2 leading-snug mb-2">
                    {job.title}
                  </h3>

                  {/* Compensation & Remote Tag */}
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-3 flex-wrap">
                    <span className="font-mono text-emerald-700 bg-emerald-50/70 px-2 py-0.5 rounded-md border border-emerald-200/60 font-semibold">
                      {job.salary_range}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <Globe className="w-3 h-3 text-slate-400" />
                      Remote
                    </span>
                  </div>

                  {/* Skills tags */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-4">
                    {job.skills.slice(0, 4).map((sk, sidx) => (
                      <span
                        key={sidx}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-medium text-slate-600 border border-slate-200/60"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Row: Status Badge & Actions */}
                <div className="pt-4 border-t border-[#d4dcf0] flex items-center justify-between gap-2">
                  <div>
                    {isApplied ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        <Check className="w-3 h-3 text-indigo-600" />
                        Submitted
                      </span>
                    ) : isSaved ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Form Filled (Ready)
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400">
                        Queued for Today
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {resultItem?.screenshot_url && (
                      <button
                        onClick={() => setSelectedScreenshot(resultItem.screenshot_url!)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                        title="View proof-of-application screenshot"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <a
                      href={job.apply_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Direct Link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handleApplySingle(job)}
                      disabled={isBatchRunning}
                      className="px-3.5 py-1.5 font-mono uppercase tracking-[0.18em] text-[10px] font-medium rounded-full bg-[#f6f8fe] hover:border-[#4338ca] hover:text-[#4338ca] text-[#0f172a] transition-colors border border-[#d4dcf0] cursor-pointer disabled:opacity-50 interactive-button"
                      title="Autofill this application now"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Proof Screenshot Inspection Modal */}
      {selectedScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#f6f8fe] rounded-3xl max-w-4xl w-full p-5 overflow-hidden border border-[#d4dcf0] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-sm text-slate-900">Proof-of-Application Screenshot</span>
              </div>
              <button
                onClick={() => setSelectedScreenshot(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-auto flex-1 bg-slate-900 rounded-xl p-2 flex items-center justify-center">
              <img
                src={selectedScreenshot}
                alt="Proof of application"
                className="max-w-full h-auto rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
