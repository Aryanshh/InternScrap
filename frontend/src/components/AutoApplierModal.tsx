import React, { useState, useEffect } from 'react';
import {
  Zap,
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
} from 'lucide-react';
import {
  runAutoApply,
  getAutoApplyVault,
  getIimPreviewUrl,
  getIimPdfUrl,
  getIimDocxUrl,
  AutoApplyResult,
} from '../api/client';

interface AutoApplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUserId: string;
  initialUrl?: string;
  onApplicationApplied?: () => void;
}

export const AutoApplierModal: React.FC<AutoApplierModalProps> = ({
  isOpen,
  onClose,
  activeUserId,
  initialUrl,
  onApplicationApplied,
}) => {
  const [activeTab, setActiveTab] = useState<'applier' | 'resume' | 'vault'>('applier');
  const [urlInput, setUrlInput] = useState('');
  const [mode, setMode] = useState<'review' | 'submit'>('review');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<AutoApplyResult[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [vaultData, setVaultData] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (initialUrl && !urlInput.includes(initialUrl)) {
        setUrlInput((prev) => (prev ? `${initialUrl}\n${prev}` : initialUrl));
      }
      loadVault();
    }
  }, [isOpen, initialUrl]);

  const loadVault = async () => {
    try {
      const data = await getAutoApplyVault();
      setVaultData(data);
    } catch (e) {
      console.error('Failed to load vault', e);
    }
  };

  if (!isOpen) return null;

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
      const res = await runAutoApply(urls, mode);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Zap className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Auto Applier & IIM Resume Engine
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  Playwright AI
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Automated multi-link job applications with gold-standard 1-page IIM resume compilation
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
            <span>IIM Resume Preview (1-Page)</span>
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
            <span>Autofill Vault</span>
          </button>
        </div>

        {/* Tab 1: Auto Applier */}
        {activeTab === 'applier' && (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: URL Input & Config */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Target Job Application Links (One per line)
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Greenhouse, Lever, Ashby, Workday, etc.
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://boards.greenhouse.io/company/jobs/12345&#10;https://jobs.lever.co/company/abcde&#10;https://jobs.ashbyhq.com/company/xyz"
                    className="w-full p-3.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 leading-relaxed"
                  />
                </div>

                {/* Mode Selector */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Execution Mode:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start space-x-2.5 ${
                        mode === 'review'
                          ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-300 text-indigo-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="applyMode"
                        value="review"
                        checked={mode === 'review'}
                        onChange={() => setMode('review')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-xs font-bold block">Auto-Fill & Review (Recommended)</span>
                        <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                          Fills all fields, attaches IIM resume, takes verification screenshot, leaves ready for 1-click submit.
                        </span>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start space-x-2.5 ${
                        mode === 'submit'
                          ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-300 text-indigo-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="applyMode"
                        value="submit"
                        checked={mode === 'submit'}
                        onChange={() => setMode('submit')}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-xs font-bold block">Full Auto-Apply (Submit)</span>
                        <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                          Automates form filling, uploads IIM resume, clicks submit, and confirms application.
                        </span>
                      </div>
                    </label>
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
                      <span>Running Playwright Auto-Applier Engine...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      <span>
                        Run Auto-Applier ({urlInput.split('\n').filter((u) => u.trim()).length} Link
                        {urlInput.split('\n').filter((u) => u.trim()).length !== 1 ? 's' : ''})
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Right Col: Candidate Snapshot */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-4">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-3">
                    Autofill Profile Snapshot
                  </span>
                  {vaultData ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Candidate</span>
                        <span className="font-bold text-slate-900">{vaultData.full_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Email & Phone</span>
                        <span className="text-slate-700 font-mono text-[11px]">
                          {vaultData.email} • {vaultData.phone}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Attached Resume</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          <FileText className="w-3 h-3" />
                          <span>IIM 1-Page Gold Standard (PDF)</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Work Auth & Notice</span>
                        <span className="text-slate-700">
                          Authorized: Yes • Notice: {vaultData.notice_period || 'Immediate'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400">Loading vault...</div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200/70 text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Synchronized with Application Tracker</span>
                  </div>
                  <p>Applied jobs are logged automatically to your Kanban board with screenshots.</p>
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
                                {res.fields_count} fields mapped & filled
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
                                className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600"
                              >
                                ✓ {f}
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

        {/* Tab 2: IIM Resume Preview */}
        {activeTab === 'resume' && (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-4 flex-1 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Indian Institute of Management (IIM) Resume Format</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-300">
                    Strict 1-Page Benchmark
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Academic qualifications table, bolded impact metrics (+45%, sub-50ms), and zero-fabrication honest experience.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIframeKey((k) => k + 1)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Reload preview"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>

                <a
                  href={getIimPdfUrl(activeUserId)}
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
                  key={iframeKey}
                  src={getIimPreviewUrl(activeUserId)}
                  title="IIM Resume Preview"
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Autofill Vault */}
        {activeTab === 'vault' && (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1">
            <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Application Vault Integrity: </span>
                <span>
                  The Auto Applier strictly injects these genuine parameters into job forms. No fabricated titles or falsified credentials are ever submitted.
                </span>
              </div>
            </div>

            {vaultData ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="font-bold text-slate-800 uppercase tracking-wider block">
                    Contact & Identity
                  </span>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Full Name</span>
                    <span className="font-semibold text-slate-900">{vaultData.full_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Email Address</span>
                    <span className="font-semibold text-slate-900">{vaultData.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Phone Number</span>
                    <span className="font-semibold text-slate-900">{vaultData.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Location</span>
                    <span className="font-semibold text-slate-900">{vaultData.location}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="font-bold text-slate-800 uppercase tracking-wider block">
                    Socials & Work Auth
                  </span>
                  <div>
                    <span className="text-slate-400 block text-[10px]">LinkedIn</span>
                    <span className="font-mono text-slate-700 truncate block">{vaultData.linkedin_url || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">GitHub</span>
                    <span className="font-mono text-slate-700 truncate block">{vaultData.github_url || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Legally Authorized to Work?</span>
                    <span className="font-bold text-emerald-700">Yes (Auto-selected)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Visa Sponsorship Required?</span>
                    <span className="font-bold text-slate-800">No (Auto-selected)</span>
                  </div>
                </div>

                <div className="sm:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span className="font-bold text-slate-800 uppercase tracking-wider block">
                    Standard Question Answers
                  </span>
                  {vaultData.common_answers &&
                    Object.entries(vaultData.common_answers).map(([k, v]: any) => (
                      <div key={k} className="border-b border-slate-200/70 pb-2 last:border-0 last:pb-0">
                        <span className="text-slate-400 block text-[10px] uppercase">{k.replace('_', ' ')}</span>
                        <span className="text-slate-700">{v}</span>
                      </div>
                    ))}
                </div>
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
