import React, { useState, useEffect } from 'react';
import {
  FileText,
  Send,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  Check,
  X,
  Search,
  Globe,
  Sparkles,
  ArrowRight,
  ClipboardPaste,
  Layers,
  GraduationCap,
  Plus,
} from 'lucide-react';
import {
  Job,
  getGoogleFormJobs,
  scrapeGoogleForms,
  parseGoogleFormUrl,
  registerOnGoogleForm,
  GoogleFormRegistrationResult,
} from '../api/client';

interface GoogleFormsScraperViewProps {
  activeUserId: string;
  onNavigateToTracker: () => void;
  showToast: (msg: string) => void;
}

export const GoogleFormsScraperView: React.FC<GoogleFormsScraperViewProps> = ({
  activeUserId,
  onNavigateToTracker,
  showToast,
}) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [pastedUrl, setPastedUrl] = useState<string>('');
  const [isParsingUrl, setIsParsingUrl] = useState<boolean>(false);

  // Runner controls
  const [mode, setMode] = useState<'review' | 'submit'>('review');
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [resultsMap, setResultsMap] = useState<Map<string, GoogleFormRegistrationResult>>(new Map());

  // Proof inspection & logs
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [activeLogs, setActiveLogs] = useState<{ title: string; logs: string[] } | null>(null);

  const loadJobs = async () => {
    try {
      setIsLoading(true);
      const res = await getGoogleFormJobs();
      if (res && res.jobs) {
        setJobs(res.jobs);
      }
    } catch (err) {
      console.error('Failed to load Google Form jobs', err);
      showToast('Could not load Google Form job postings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleScrape = async () => {
    try {
      setIsScraping(true);
      showToast('Scraping community feeds (Reddit r/forhire, r/internships) for Google Forms...');
      const res = await scrapeGoogleForms();
      if (res.success) {
        showToast(`Scrape complete: Found ${res.total_scraped} forms (${res.newly_added} newly added).`);
        await loadJobs();
      }
    } catch (err) {
      console.error('Failed to scrape Google Forms', err);
      showToast('Failed to scrape community feeds.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleParsePastedUrl = async () => {
    const cleanUrl = pastedUrl.trim();
    if (!cleanUrl) {
      showToast('Please enter a valid Google Form URL.');
      return;
    }
    if (!cleanUrl.includes('docs.google.com/forms') && !cleanUrl.includes('forms.gle')) {
      showToast('URL must be a valid Google Form link (docs.google.com/forms or forms.gle).');
      return;
    }

    try {
      setIsParsingUrl(true);
      showToast('Inspecting Google Form and parsing job details...');
      const res = await parseGoogleFormUrl(cleanUrl);
      if (res.success && res.job) {
        showToast(`Successfully parsed "${res.job.title}"!`);
        setPastedUrl('');
        await loadJobs();
      }
    } catch (err: any) {
      console.error('Failed to parse Google Form URL', err);
      showToast(err.response?.data?.detail || 'Failed to inspect Google Form.');
    } finally {
      setIsParsingUrl(false);
    }
  };

  const handleRegister = async (job: Job) => {
    const targetUrl = job.apply_urls?.[0];
    if (!targetUrl) {
      showToast('No valid application URL found for this posting.');
      return;
    }

    try {
      setRunningJobId(job.id);
      showToast(`Launching Playwright to auto-fill "${job.company}" (${mode.toUpperCase()} mode)...`);

      const res = await registerOnGoogleForm({
        url: targetUrl,
        mode,
        user_id: activeUserId,
      });

      if (res.success && res.result) {
        const itemResult = res.result;
        setResultsMap((prev) => new Map(prev).set(job.id, itemResult));
        setActiveLogs({ title: job.title, logs: itemResult.logs || [] });

        if (itemResult.status === 'submitted') {
          showToast(`Successfully registered and submitted "${job.title}"!`);
        } else if (itemResult.status === 'ready_for_review') {
          showToast(`Autofill complete: ${itemResult.fields_count} fields filled. Ready for review!`);
        } else {
          showToast(`Registration processed: ${itemResult.status}`);
        }
      }
    } catch (err: any) {
      console.error('Failed to register on Google Form', err);
      showToast(err.response?.data?.detail || 'Failed to auto-register on Google Form.');
    } finally {
      setRunningJobId(null);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      (j.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="relative rounded-2xl bg-slate-900 text-white p-6 sm:p-8 shadow-sm overflow-hidden border border-slate-800">
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-mono font-bold border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Google Forms Scraper & Registrant
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              Zero AI Fabrication
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Wellfound Candidate Vault Integration
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Google Forms Job Postings & Auto-Registrant
          </h1>
          <p className="mt-2 text-slate-400 text-xs sm:text-sm leading-relaxed max-w-2xl">
            Scrape tech communities and startup networks for hiring Google Forms, or paste any form link directly. The engine parses question structures across multiple pages and autofills your authentic candidate details on your behalf.
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-6 pt-5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div className="text-white font-mono text-lg font-bold">{jobs.length}</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Google Form Jobs</div>
            </div>
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div className="text-emerald-400 font-mono text-lg font-bold">{resultsMap.size}</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Registered / Ready</div>
            </div>
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div className="text-white font-mono text-lg font-bold">Multi-Page</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Page Navigation</div>
            </div>
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <div className="text-amber-400 font-mono text-lg font-bold">Proof Ready</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Full Screenshot</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Command Bar: Paste URL & Scrape Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* URL Paste Input */}
          <div className="flex-1 max-w-2xl">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Direct Form Import: Paste any Google Form URL
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <ClipboardPaste className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="url"
                  value={pastedUrl}
                  onChange={(e) => setPastedUrl(e.target.value)}
                  placeholder="https://forms.gle/... or https://docs.google.com/forms/d/e/.../viewform"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 shadow-2xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>
              <button
                onClick={handleParsePastedUrl}
                disabled={isParsingUrl || !pastedUrl.trim()}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer interactive-button shrink-0"
              >
                {isParsingUrl ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Parsing...</span>
                  </span>
                ) : (
                  <span>Parse & Add Form</span>
                )}
              </button>
            </div>
          </div>

          {/* Scrape Community & Mode Selector */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleScrape}
              disabled={isScraping}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 cursor-pointer interactive-button"
              title="Scrape Reddit and tech community feeds for hiring Google Forms"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isScraping ? 'animate-spin' : ''}`} />
              <span>{isScraping ? 'Scraping Feeds...' : 'Scrape Latest Forms'}</span>
            </button>

            {/* Mode Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 font-semibold text-xs">
              <button
                type="button"
                onClick={() => setMode('review')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  mode === 'review'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Review Mode (Safe)
              </button>
              <button
                type="button"
                onClick={() => setMode('submit')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  mode === 'submit'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Auto-Submit Mode
              </button>
            </div>
          </div>
        </div>

        {/* Live log drawer if active */}
        {activeLogs && (
          <div className="mt-3 p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-1.5 text-xs text-slate-400 font-bold">
              <span>Registrant Activity: {activeLogs.title}</span>
              <button
                onClick={() => setActiveLogs(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {activeLogs.logs.map((l, idx) => (
                <div key={idx} className="leading-relaxed">
                  {l}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Search & Count */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search Google Form jobs by title, company, or keywords..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 shadow-2xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
          />
        </div>
        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-900">{filteredJobs.length}</span> of {jobs.length} postings
        </div>
      </div>

      {/* 4. Form Job Cards Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="w-8 h-8 text-slate-900 animate-spin mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading Google Form postings...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-sm font-medium text-slate-600 mb-3">No Google Form job postings found matching your filter.</p>
          <button
            onClick={handleScrape}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            Scrape Community Feeds Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const resultItem = resultsMap.get(job.id);
            const isRunning = runningJobId === job.id;
            const applyUrl = job.apply_urls?.[0] || '';
            const initial = job.company ? job.company.charAt(0).toUpperCase() : 'G';

            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Row: Avatar & Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                        {initial}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[150px]">
                          {job.company}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {job.primary_source}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Google Form
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug mb-2">
                    {job.title}
                  </h3>

                  {/* Compensation & Remote */}
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-3 flex-wrap">
                    <span className="font-mono text-emerald-700 bg-emerald-50/70 px-2 py-0.5 rounded-md border border-emerald-200/60 font-semibold">
                      {job.salary_range || '$35 - $65 / hr'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <Globe className="w-3 h-3 text-slate-400" />
                      Remote
                    </span>
                    {job.is_internship && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                        <GraduationCap className="w-3 h-3 text-amber-500" />
                        Internship
                      </span>
                    )}
                  </div>

                  {/* Description snippet */}
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">
                    {job.description}
                  </p>
                </div>

                {/* Bottom Row: Actions & Status */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    {resultItem?.status === 'submitted' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        <Check className="w-3 h-3 text-indigo-600" />
                        Submitted
                      </span>
                    ) : resultItem?.status === 'ready_for_review' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Form Filled (Ready)
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400">
                        Ready to Register
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {resultItem?.screenshot && (
                      <button
                        onClick={() => setSelectedScreenshot(`/api/auto-apply/screenshot/${resultItem.screenshot}`)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                        title="View proof-of-application screenshot"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <a
                      href={applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Open Google Form in browser"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handleRegister(job)}
                      disabled={isRunning}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer interactive-button"
                    >
                      {isRunning ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Filling...</span>
                        </span>
                      ) : (
                        <span>Register</span>
                      )}
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
          <div className="bg-white rounded-2xl max-w-4xl w-full p-4 overflow-hidden border border-slate-200 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-sm text-slate-900">Proof-of-Registration Screenshot (Google Form)</span>
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
                alt="Proof of Google Form Registration"
                className="max-w-full h-auto rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
