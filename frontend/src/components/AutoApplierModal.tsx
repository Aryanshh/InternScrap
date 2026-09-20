import React, { useState, useEffect } from 'react';
import {
  Send,
  FileText,
  ShieldCheck,
  X,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Plus,
  Trash2,
  User,
  Briefcase,
  Code2,
  Save,
  Bookmark,
  Layers,
} from 'lucide-react';
import {
  runAutoApply,
  getAutoApplyVault,
  updateAutoApplyVault,
  getQueuedJobs,
  getIimPreviewUrl,
  getIimPdfUrl,
  getIimDocxUrl,
  AutoApplyResult,
} from '../api/client';
import { WellfoundProfileData, SkillWithYears, IimResumeTheme } from '../types/job';

interface AutoApplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUserId: string;
  initialUrl?: string;
  initialUrls?: string[];
  onApplicationApplied?: () => void;
}

export const AutoApplierModal: React.FC<AutoApplierModalProps> = ({
  isOpen,
  onClose,
  activeUserId,
  initialUrl,
  initialUrls,
  onApplicationApplied,
}) => {
  const [activeTab, setActiveTab] = useState<'applier' | 'resume' | 'vault'>('applier');
  const [vaultSubTab, setVaultSubTab] = useState<'identity' | 'preferences' | 'skills_pitch' | 'eeo'>('identity');

  // Applier state
  const [urlInput, setUrlInput] = useState('');
  const [mode, setMode] = useState<'review' | 'submit'>('review');
  const [theme, setTheme] = useState<IimResumeTheme>('classic');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<AutoApplyResult[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [isImportingJobs, setIsImportingJobs] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Resume state
  const [iframeKey, setIframeKey] = useState(0);

  // Vault state
  const [vaultData, setVaultData] = useState<WellfoundProfileData | null>(null);
  const [isSavingVault, setIsSavingVault] = useState(false);
  const [vaultSaveSuccess, setVaultSaveSuccess] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillYears, setNewSkillYears] = useState(2);

  useEffect(() => {
    if (isOpen) {
      if (initialUrls && initialUrls.length > 0) {
        setUrlInput(initialUrls.join('\n'));
      } else if (initialUrl && !urlInput.includes(initialUrl)) {
        setUrlInput((prev) => (prev ? `${initialUrl}\n${prev}` : initialUrl));
      }
      loadVault();
    }
  }, [isOpen, initialUrl, initialUrls]);

  const loadVault = async () => {
    try {
      const data = await getAutoApplyVault();
      setVaultData(data);
    } catch (e) {
      console.error('Failed to load vault', e);
    }
  };

  const handleSaveVault = async () => {
    if (!vaultData) return;
    try {
      setIsSavingVault(true);
      const updated = await updateAutoApplyVault(vaultData);
      setVaultData(updated);
      setVaultSaveSuccess(true);
      setTimeout(() => setVaultSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save vault', e);
      alert('Failed to save profile changes to vault.');
    } finally {
      setIsSavingVault(false);
    }
  };

  const handleAddSkill = () => {
    if (!newSkillName.trim() || !vaultData) return;
    const current = vaultData.skills_with_years || [];
    const exists = current.some((s) => s.skill.toLowerCase() === newSkillName.trim().toLowerCase());
    if (exists) {
      alert('This skill is already listed.');
      return;
    }
    const updatedSkills: SkillWithYears[] = [
      ...current,
      { skill: newSkillName.trim(), years: Number(newSkillYears) || 1 },
    ];
    setVaultData({
      ...vaultData,
      skills_with_years: updatedSkills,
      skills: [...(vaultData.skills || []), newSkillName.trim()],
    });
    setNewSkillName('');
    setNewSkillYears(2);
  };

  const handleRemoveSkill = (skillNameToRemove: string) => {
    if (!vaultData) return;
    const current = vaultData.skills_with_years || [];
    setVaultData({
      ...vaultData,
      skills_with_years: current.filter((s) => s.skill !== skillNameToRemove),
      skills: (vaultData.skills || []).filter((s) => s !== skillNameToRemove),
    });
  };

  const handleUpdateSkillYears = (skillName: string, years: number) => {
    if (!vaultData) return;
    const current = vaultData.skills_with_years || [];
    setVaultData({
      ...vaultData,
      skills_with_years: current.map((s) => (s.skill === skillName ? { ...s, years } : s)),
    });
  };

  const handleImportJobs = async (importMode: 'saved' | 'top_matches') => {
    try {
      setIsImportingJobs(true);
      const res = await getQueuedJobs(importMode);
      if (!res.jobs || res.jobs.length === 0) {
        setImportNotice(`No jobs found in ${importMode === 'saved' ? 'Saved Applications' : 'Top Matches (>80%)'}.`);
        setTimeout(() => setImportNotice(null), 4000);
        return;
      }
      const existingUrls = new Set(
        urlInput
          .split('\n')
          .map((u) => u.trim())
          .filter(Boolean)
      );
      const newUrls: string[] = [];
      res.jobs.forEach((j: any) => {
        if (j.apply_url && !existingUrls.has(j.apply_url)) {
          newUrls.push(j.apply_url);
        }
      });

      if (newUrls.length === 0) {
        setImportNotice(`All ${res.jobs.length} jobs are already in the application list.`);
        setTimeout(() => setImportNotice(null), 4000);
        return;
      }

      setUrlInput((prev) => {
        const cleanPrev = prev.trim();
        return cleanPrev ? `${cleanPrev}\n${newUrls.join('\n')}` : newUrls.join('\n');
      });

      setImportNotice(`Imported ${newUrls.length} new job links successfully.`);
      setTimeout(() => setImportNotice(null), 4000);
    } catch (e) {
      console.error('Failed to import jobs', e);
      alert('Failed to import jobs. Please try again.');
    } finally {
      setIsImportingJobs(false);
    }
  };

  const handleRun = async () => {
    const urls = urlInput
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

    if (urls.length === 0) {
      alert('Please enter at least one valid job link (starting with http:// or https://)');
      return;
    }

    try {
      setIsRunning(true);
      const res = await runAutoApply(urls, mode, theme);
      if (res.results) {
        setResults(res.results);
        if (onApplicationApplied) {
          onApplicationApplied();
        }
      }
    } catch (err: any) {
      console.error('Auto apply error', err);
      alert(err.response?.data?.detail || 'Failed to complete auto-apply.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Send className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Auto Applier &amp; Wellfound Dossier
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  Zero AI Plagiarism
                </span>
              </div>
              <p className="text-xs text-slate-300">
                1-Click multi-link job applications backed by authentic Wellfound candidate profiling &amp; 1-page IIM resumes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 sm:px-8 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('applier')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'applier'
                ? 'border-indigo-600 text-indigo-600 bg-white/70 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Multi-Link Auto Applier</span>
          </button>

          <button
            onClick={() => setActiveTab('resume')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'resume'
                ? 'border-indigo-600 text-indigo-600 bg-white/70 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>IIM Resume &amp; Themes</span>
          </button>

          <button
            onClick={() => setActiveTab('vault')}
            className={`py-3.5 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'vault'
                ? 'border-indigo-600 text-indigo-600 bg-white/70 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Wellfound Candidate Vault</span>
          </button>
        </div>

        {/* Tab 1: Auto Applier */}
        {activeTab === 'applier' && (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: URL Input & Config */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <div className="flex flex-wrap items-center justify-between mb-1.5 gap-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Target Job Application Links (One per line)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleImportJobs('saved')}
                        disabled={isImportingJobs}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                      >
                        <Bookmark className="w-3 h-3" />
                        <span>Import Saved Jobs</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImportJobs('top_matches')}
                        disabled={isImportingJobs}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Import Top Matches (&gt;80%)</span>
                      </button>
                      {urlInput.trim() && (
                        <button
                          type="button"
                          onClick={() => setUrlInput('')}
                          className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {importNotice && (
                    <div className="mb-2 p-2 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-800 flex items-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{importNotice}</span>
                    </div>
                  )}

                  <textarea
                    rows={4}
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://boards.greenhouse.io/company/jobs/12345&#10;https://jobs.lever.co/company/abcde&#10;https://jobs.ashbyhq.com/company/xyz&#10;https://myworkdayjobs.com/..."
                    className="w-full p-3.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 leading-relaxed"
                  />
                </div>

                {/* Theme & Mode Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Theme Selector */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Resume Theme:
                    </span>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as IimResumeTheme)}
                      className="w-full text-xs font-semibold p-2 rounded-xl bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="classic">Classic IIM Benchmark (Monochrome Density)</option>
                      <option value="executive">Executive Modern (Deep Navy Polish)</option>
                      <option value="tech">Technical Elite (Clean Tech Borders)</option>
                    </select>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      Attached automatically as strict 1-page PDF.
                    </span>
                  </div>

                  {/* Mode Selector */}
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Execution Mode:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMode('review')}
                        className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                          mode === 'review'
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="text-xs block">Fill &amp; Review</span>
                        <span className="text-[10px] text-slate-500 block">Screenshots ready</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode('submit')}
                        className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                          mode === 'submit'
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="text-xs block">Auto Submit</span>
                        <span className="text-[10px] text-slate-500 block">End-to-end</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Launch Button */}
                <button
                  onClick={handleRun}
                  disabled={isRunning || !urlInput.trim()}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white font-bold text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Applying via Playwright ATS Engine...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>
                        Run Auto-Applier ({urlInput.split('\n').filter((u) => u.trim()).length} Link
                        {urlInput.split('\n').filter((u) => u.trim()).length !== 1 ? 's' : ''})
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Right Col: Wellfound Candidate Snapshot */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Wellfound Candidate Snapshot
                    </span>
                    <button
                      onClick={() => setActiveTab('vault')}
                      className="text-[11px] text-indigo-600 font-semibold hover:underline cursor-pointer"
                    >
                      Edit Vault
                    </button>
                  </div>

                  {vaultData ? (
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Candidate</span>
                        <span className="font-bold text-slate-900">{vaultData.full_name}</span>
                        <span className="text-slate-500 block text-[11px] truncate">{vaultData.headline}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Role &amp; Tenure</span>
                        <span className="text-slate-800 font-medium">
                          {vaultData.primary_role || 'Software Engineer'} • {vaultData.years_of_experience || 2} yrs exp
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Work Preferences</span>
                        <span className="text-slate-700">
                          {vaultData.desired_work_mode || 'Remote'} • Notice: {vaultData.notice_period || 'Immediate'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Skills Dossier</span>
                        <div className="flex flex-wrap gap-1 mt-1 max-h-20 overflow-y-auto">
                          {(vaultData.skills_with_years || []).slice(0, 8).map((s, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700"
                            >
                              {s.skill} ({s.years}y)
                            </span>
                          ))}
                          {(vaultData.skills_with_years || []).length > 8 && (
                            <span className="text-[10px] text-slate-400 self-center">
                              +{vaultData.skills_with_years.length - 8} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400">Loading vault profile...</div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200/70 text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Zero AI Plagiarism Guarantee</span>
                  </div>
                  <p>All form fields and essays are populated exclusively from your verified profile and authentic personal pitch.</p>
                </div>
              </div>
            </div>

            {/* Results Section */}
            {results.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>Execution Results ({results.length})</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                      Mode: {mode.toUpperCase()}
                    </span>
                  </h3>
                </div>

                <div className="space-y-3">
                  {results.map((res, idx) => {
                    const isExpanded = expandedLogId === res.run_id;
                    const isSuccess = res.status === 'submitted' || res.status === 'ready_for_review';
                    return (
                      <div
                        key={idx}
                        className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden transition-all"
                      >
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                                  isSuccess
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {res.status.replace('_', ' ').toUpperCase()}
                              </span>
                              <span className="text-xs font-bold text-slate-800 px-2 py-0.5 bg-slate-200/60 rounded-md">
                                {res.platform}
                              </span>
                              <span className="text-xs text-indigo-700 font-semibold">
                                {res.fields_count} fields mapped &amp; filled
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600 font-mono truncate max-w-md">
                                {res.url}
                              </span>
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-slate-600"
                                title="Open Link"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {res.screenshot_url && (
                              <button
                                onClick={() => setSelectedScreenshot(`http://127.0.0.1:8000${res.screenshot_url}`)}
                                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Proof Screenshot</span>
                              </button>
                            )}

                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : res.run_id)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Logs</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Fields filled tags */}
                        {res.fields_filled && res.fields_filled.length > 0 && (
                          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                            {res.fields_filled.map((f, fIdx) => (
                              <span
                                key={fIdx}
                                className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600 inline-flex items-center gap-1"
                              >
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                <span>{f}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Detailed Logs Accordion */}
                        {isExpanded && (
                          <div className="p-4 bg-slate-900 text-slate-200 text-xs font-mono border-t border-slate-800 space-y-1 max-h-48 overflow-y-auto">
                            {res.logs.map((l, lIdx) => (
                              <div key={lIdx}>{l}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: IIM Resume Preview & Theme Switcher */}
        {activeTab === 'resume' && (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-4 flex-1 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Indian Institute of Management (IIM) Resume Formats</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                    Strict 1-Page Benchmark
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Academic qualifications table, bolded impact metrics, and factual candidate credentials.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Theme Selector */}
                <select
                  value={theme}
                  onChange={(e) => {
                    setTheme(e.target.value as IimResumeTheme);
                    setIframeKey((k) => k + 1);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                >
                  <option value="classic">Theme: Classic IIM</option>
                  <option value="executive">Theme: Executive Modern</option>
                  <option value="tech">Theme: Technical Elite</option>
                </select>

                <button
                  onClick={() => setIframeKey((k) => k + 1)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Reload preview"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>

                <a
                  href={getIimPdfUrl(activeUserId, theme)}
                  download
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </a>

                <a
                  href={getIimDocxUrl(activeUserId)}
                  download
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Download DOCX</span>
                </a>
              </div>
            </div>

            {/* Resume Viewer Container */}
            <div className="flex-1 min-h-[500px] bg-slate-200/70 p-4 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-300">
              <div className="w-full max-w-[760px] h-[640px] bg-white rounded-lg shadow-xl overflow-hidden border border-slate-300">
                <iframe
                  key={`${iframeKey}-${theme}`}
                  src={getIimPreviewUrl(activeUserId, theme)}
                  title="IIM Resume Preview"
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Wellfound Candidate Vault */}
        {activeTab === 'vault' && (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-5 flex-1">
            {/* Vault Header Banner */}
            <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 text-xs text-indigo-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Wellfound (AngelList) Profile Dossier: </span>
                  <span>
                    The Auto Applier strictly injects these genuine parameters into job forms. Zero AI plagiarism or synthetic hallucinated claims are ever generated.
                  </span>
                </div>
              </div>

              <button
                onClick={handleSaveVault}
                disabled={isSavingVault || !vaultData}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isSavingVault ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : vaultSaveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>

            {/* Sub Tabs for Vault */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setVaultSubTab('identity')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  vaultSubTab === 'identity'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                1. Identity &amp; Links
              </button>

              <button
                type="button"
                onClick={() => setVaultSubTab('preferences')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  vaultSubTab === 'preferences'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                2. Work Preferences
              </button>

              <button
                type="button"
                onClick={() => setVaultSubTab('skills_pitch')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  vaultSubTab === 'skills_pitch'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                3. Skills &amp; Factual Pitch
              </button>

              <button
                type="button"
                onClick={() => setVaultSubTab('eeo')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  vaultSubTab === 'eeo'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                4. Compliance &amp; EEO
              </button>
            </div>

            {vaultData ? (
              <div className="space-y-4">
                {/* SubTab 1: Identity & Links */}
                {vaultSubTab === 'identity' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Full Name</label>
                      <input
                        type="text"
                        value={vaultData.full_name || ''}
                        onChange={(e) => setVaultData({ ...vaultData, full_name: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Current Location</label>
                      <input
                        type="text"
                        value={vaultData.location || ''}
                        onChange={(e) => setVaultData({ ...vaultData, location: e.target.value })}
                        placeholder="e.g. San Francisco, CA / Bengaluru, India"
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-slate-600 font-bold block mb-1">Professional Headline</label>
                      <input
                        type="text"
                        value={vaultData.headline || ''}
                        onChange={(e) => setVaultData({ ...vaultData, headline: e.target.value })}
                        placeholder="e.g. Senior Full Stack &amp; AI Systems Engineer"
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Email Address</label>
                      <input
                        type="email"
                        value={vaultData.email || ''}
                        onChange={(e) => setVaultData({ ...vaultData, email: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={vaultData.phone || ''}
                        onChange={(e) => setVaultData({ ...vaultData, phone: e.target.value })}
                        placeholder="+1 (555) 019-2834"
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">GitHub Profile URL</label>
                      <input
                        type="text"
                        value={vaultData.github_url || ''}
                        onChange={(e) => setVaultData({ ...vaultData, github_url: e.target.value })}
                        placeholder="https://github.com/..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">LinkedIn Profile URL</label>
                      <input
                        type="text"
                        value={vaultData.linkedin_url || ''}
                        onChange={(e) => setVaultData({ ...vaultData, linkedin_url: e.target.value })}
                        placeholder="https://linkedin.com/in/..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Wellfound (AngelList) URL</label>
                      <input
                        type="text"
                        value={vaultData.wellfound_url || ''}
                        onChange={(e) => setVaultData({ ...vaultData, wellfound_url: e.target.value })}
                        placeholder="https://wellfound.com/u/..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Twitter / X URL</label>
                      <input
                        type="text"
                        value={vaultData.twitter_url || ''}
                        onChange={(e) => setVaultData({ ...vaultData, twitter_url: e.target.value })}
                        placeholder="https://x.com/..."
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* SubTab 2: Work Preferences */}
                {vaultSubTab === 'preferences' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Primary Role</label>
                      <input
                        type="text"
                        value={vaultData.primary_role || ''}
                        onChange={(e) => setVaultData({ ...vaultData, primary_role: e.target.value })}
                        placeholder="e.g. Full Stack Engineer / AI Engineer"
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Total Years of Experience</label>
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={vaultData.years_of_experience ?? 2}
                        onChange={(e) =>
                          setVaultData({ ...vaultData, years_of_experience: Number(e.target.value) || 0 })
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Desired Work Mode</label>
                      <select
                        value={vaultData.desired_work_mode || 'Remote'}
                        onChange={(e) => setVaultData({ ...vaultData, desired_work_mode: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Remote">Remote Only</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="In-Office">In-Office</option>
                        <option value="Any">Flexible / Open to Any</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Notice Period</label>
                      <select
                        value={vaultData.notice_period || 'Immediate'}
                        onChange={(e) => setVaultData({ ...vaultData, notice_period: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Immediate">Immediate / Available Now</option>
                        <option value="1 week">1 Week</option>
                        <option value="2 weeks">2 Weeks</option>
                        <option value="1 month">1 Month</option>
                        <option value="2 months">2 Months</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Minimum Annual Base Salary ($ USD)</label>
                      <input
                        type="number"
                        step={5000}
                        value={vaultData.min_salary || 0}
                        onChange={(e) => setVaultData({ ...vaultData, min_salary: Number(e.target.value) || 0 })}
                        placeholder="e.g. 120000"
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Open to Relocation?</label>
                      <select
                        value={vaultData.relocation_open ? 'yes' : 'no'}
                        onChange={(e) => setVaultData({ ...vaultData, relocation_open: e.target.value === 'yes' })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="no">No (Prefer remote or current city)</option>
                        <option value="yes">Yes (Open to relocating for the right opportunity)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Legally Authorized to Work?</label>
                      <select
                        value={vaultData.work_authorization || 'yes'}
                        onChange={(e) => setVaultData({ ...vaultData, work_authorization: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="yes">Yes, legally authorized to work</option>
                        <option value="no">No</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Require Visa Sponsorship?</label>
                      <select
                        value={vaultData.require_sponsorship || 'no'}
                        onChange={(e) => setVaultData({ ...vaultData, require_sponsorship: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="no">No, will not require sponsorship now or in future</option>
                        <option value="yes">Yes, require sponsorship</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* SubTab 3: Skills & Authentic Personal Pitch */}
                {vaultSubTab === 'skills_pitch' && (
                  <div className="space-y-5 text-xs">
                    {/* Skills with Tenure */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="font-bold text-slate-800 uppercase tracking-wider block">
                            Skills with Exact Years of Experience
                          </label>
                          <span className="text-[11px] text-slate-500">
                            ATS forms frequently ask: "How many years of Python experience do you have?".
                          </span>
                        </div>
                      </div>

                      {/* Add Skill Form */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newSkillName}
                          onChange={(e) => setNewSkillName(e.target.value)}
                          placeholder="Skill (e.g. React, Python, PostgreSQL)"
                          className="p-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 text-xs font-medium flex-1 min-w-[140px]"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-slate-500 text-[11px]">Tenure:</span>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={newSkillYears}
                            onChange={(e) => setNewSkillYears(Number(e.target.value) || 1)}
                            className="w-16 p-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 text-xs font-medium text-center"
                          />
                          <span className="text-slate-500 text-[11px]">yrs</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddSkill}
                          className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Skill</span>
                        </button>
                      </div>

                      {/* Skills List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 max-h-56 overflow-y-auto">
                        {(vaultData.skills_with_years || []).map((s, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs"
                          >
                            <span className="font-semibold text-slate-800 truncate mr-2">{s.skill}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                min={1}
                                max={30}
                                value={s.years}
                                onChange={(e) => handleUpdateSkillYears(s.skill, Number(e.target.value) || 1)}
                                className="w-12 p-1 rounded-lg border border-slate-200 text-center text-xs font-bold text-indigo-700"
                              />
                              <span className="text-slate-400 text-[10px]">y</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSkill(s.skill)}
                                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                title="Remove skill"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Personal Pitch & Proudest Project */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-800 uppercase tracking-wider block">
                            Authentic Personal Pitch (Why should we hire you?)
                          </label>
                          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            Zero AI Plagiarism
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2">
                          Written in your genuine voice. Used by the Auto Applier when answering "Why are you interested in this role?" or custom cover letter prompts.
                        </p>
                        <textarea
                          rows={3}
                          value={vaultData.personal_pitch || ''}
                          onChange={(e) => setVaultData({ ...vaultData, personal_pitch: e.target.value })}
                          placeholder="Describe your core strengths, engineering approach, and what drives you..."
                          className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800 leading-relaxed font-normal"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-bold text-slate-800 uppercase tracking-wider block">
                            Proudest Technical Project / Achievement Highlight
                          </label>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-2">
                          Used to answer "Tell us about a challenging engineering problem you solved" without hallucinating.
                        </p>
                        <textarea
                          rows={3}
                          value={vaultData.proudest_project_highlight || ''}
                          onChange={(e) =>
                            setVaultData({ ...vaultData, proudest_project_highlight: e.target.value })
                          }
                          placeholder="Describe your proudest technical achievement with metrics (e.g. reduced latency by 60%, scaled to 100k requests)..."
                          className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800 leading-relaxed font-normal"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SubTab 4: Compliance & EEO */}
                {vaultSubTab === 'eeo' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="sm:col-span-2 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                      <strong>Equal Employment Opportunity (EEO) Form Filling: </strong>
                      These defaults are auto-selected on Greenhouse, Lever, and Workday compliance forms. You can set them to specific options or keep them as "Decline to self-identify".
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Gender Identity</label>
                      <select
                        value={vaultData.eeo_gender || 'Decline to self-identify'}
                        onChange={(e) => setVaultData({ ...vaultData, eeo_gender: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Decline to self-identify">Decline to self-identify</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Non-binary">Non-binary</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Race / Ethnicity</label>
                      <select
                        value={vaultData.eeo_race || 'Decline to self-identify'}
                        onChange={(e) => setVaultData({ ...vaultData, eeo_race: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="Decline to self-identify">Decline to self-identify</option>
                        <option value="Asian">Asian</option>
                        <option value="Black or African American">Black or African American</option>
                        <option value="Hispanic or Latino">Hispanic or Latino</option>
                        <option value="White">White</option>
                        <option value="Two or More Races">Two or More Races</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Veteran Status</label>
                      <select
                        value={vaultData.eeo_veteran || 'I am not a protected veteran'}
                        onChange={(e) => setVaultData({ ...vaultData, eeo_veteran: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="I am not a protected veteran">I am not a protected veteran</option>
                        <option value="I identify as one or more of the classifications of protected veteran">
                          I identify as a protected veteran
                        </option>
                        <option value="I decline to self-identify">Decline to self-identify</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Disability Status</label>
                      <select
                        value={vaultData.eeo_disability || 'No, I do not have a disability'}
                        onChange={(e) => setVaultData({ ...vaultData, eeo_disability: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="No, I do not have a disability">No, I do not have a disability</option>
                        <option value="Yes, I have a disability">Yes, I have a disability</option>
                        <option value="I do not wish to answer">Decline to self-identify</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">Loading vault records...</div>
            )}
          </div>
        )}

        {/* Screenshot Modal Viewer */}
        {selectedScreenshot && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                  <span>Proof of Application Screenshot</span>
                </span>
                <button
                  onClick={() => setSelectedScreenshot(null)}
                  className="w-7 h-7 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-slate-950">
                <img
                  src={selectedScreenshot}
                  alt="Application Screenshot"
                  className="rounded-xl border border-slate-800 max-w-full max-h-[75vh] object-contain"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
