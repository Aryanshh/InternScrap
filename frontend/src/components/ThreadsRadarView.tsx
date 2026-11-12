import React, { useEffect, useRef, useState } from 'react';
import {
  AtSign,
  Bell,
  BookmarkPlus,
  Briefcase,
  Check,
  ClipboardPaste,
  Cpu,
  ExternalLink,
  Globe,
  Loader2,
  Palette,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import {
  ThreadsOpportunitiesResponse,
  ThreadsOpportunityItem,
  ThreadsScannerConfig,
  ThreadsVertical,
  getThreadsOpportunities,
  parseThreadsPostUrl,
  triggerTestThreadsAlert,
  triggerThreadsScan,
  updateThreadsConfig,
} from '../api/client';

interface ThreadsRadarViewProps {
  trackedJobIds: Set<string>;
  onTrackJob: (job: ThreadsOpportunityItem) => void;
  onOpenAutoApplierModal: (url: string) => void;
  showToast: (msg: string) => void;
}

const VERTICAL_TABS: Array<{
  id: ThreadsVertical;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  { id: 'all', label: 'All Leads', icon: Radio },
  { id: 'graphic', label: 'Graphic Design', icon: Palette },
  { id: 'tech', label: 'Tech & Engineering', icon: Cpu },
  { id: 'project', label: 'Projects & Freelance', icon: Briefcase },
];

export const ThreadsRadarView: React.FC<ThreadsRadarViewProps> = ({
  trackedJobIds,
  onTrackJob,
  onOpenAutoApplierModal,
  showToast,
}) => {
  const [opportunities, setOpportunities] = useState<ThreadsOpportunityItem[]>([]);
  const [verticalCounts, setVerticalCounts] = useState<Record<ThreadsVertical, number>>({
    all: 0,
    graphic: 0,
    tech: 0,
    project: 0,
  });
  const [scannerStatus, setScannerStatus] = useState<ThreadsScannerConfig | null>(null);
  const [activeVertical, setActiveVertical] = useState<ThreadsVertical>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scanMode, setScanMode] = useState<'auto' | 'fediverse'>('auto');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [pastedUrl, setPastedUrl] = useState<string>('');
  const [isParsingUrl, setIsParsingUrl] = useState<boolean>(false);
  const [urlError, setUrlError] = useState<string>('');
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  // Native <dialog> state for Bot & Alert configuration
  const settingsDialogRef = useRef<HTMLDialogElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isTestingAlert, setIsTestingAlert] = useState<boolean>(false);

  // Form draft fields inside Settings <dialog>
  const [draftVerticals, setDraftVerticals] = useState<string[]>(['graphic', 'tech', 'project']);
  const [draftGraphicKeywords, setDraftGraphicKeywords] = useState<string>('');
  const [draftTechKeywords, setDraftTechKeywords] = useState<string>('');
  const [draftProjectKeywords, setDraftProjectKeywords] = useState<string>('');
  const [draftInterval, setDraftInterval] = useState<number>(30);
  const [draftAccessToken, setDraftAccessToken] = useState<string>('');
  const [draftApifyToken, setDraftApifyToken] = useState<string>('');
  const [draftWebhookUrl, setDraftWebhookUrl] = useState<string>('');
  const [draftTelegramToken, setDraftTelegramToken] = useState<string>('');
  const [draftTelegramChatId, setDraftTelegramChatId] = useState<string>('');

  const syncDraftFromConfig = (cfg: ThreadsScannerConfig) => {
    setDraftVerticals(cfg.enabled_verticals || ['graphic', 'tech', 'project']);
    setDraftGraphicKeywords((cfg.keywords?.graphic || []).join(', '));
    setDraftTechKeywords((cfg.keywords?.tech || []).join(', '));
    setDraftProjectKeywords((cfg.keywords?.project || []).join(', '));
    setDraftInterval(cfg.scan_interval_minutes || 30);
  };

  const loadOpportunities = async (
    targetVertical: ThreadsVertical = activeVertical,
    targetSearch: string = searchQuery
  ) => {
    try {
      setIsLoading(true);
      const res: ThreadsOpportunitiesResponse = await getThreadsOpportunities(targetVertical, targetSearch);
      setOpportunities(res.opportunities || []);
      setVerticalCounts(
        res.vertical_counts || { all: 0, graphic: 0, tech: 0, project: 0 }
      );
      if (res.scanner_status) {
        setScannerStatus(res.scanner_status);
        syncDraftFromConfig(res.scanner_status);
      }
      setLiveAnnouncement(`Showing ${res.count} Threads opportunities.`);
    } catch (err) {
      console.error('Failed to load Threads opportunities', err);
      showToast('Could not load Threads opportunities.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOpportunities(activeVertical, searchQuery);
  }, [activeVertical]);

  const handleScanNow = async () => {
    try {
      setIsScanning(true);
      const res = await triggerThreadsScan({
        mode: scanMode,
        send_alerts: true,
      });
      const msg = `Threads scan complete via ${res.scan_report?.active_adapter || scanMode}: ${res.total_scanned_opportunities} leads matched (${res.newly_added} new, ${res.scan_report?.self_promo_filtered_count || 0} self-promo filtered).`;
      showToast(msg);
      setLiveAnnouncement(msg);
      await loadOpportunities(activeVertical, searchQuery);
    } catch (err: any) {
      console.error('Threads scan failed', err);
      showToast(err.response?.data?.detail || 'Threads scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanUrl = pastedUrl.trim();
    if (!cleanUrl) {
      setUrlError('Enter a valid threads.net or threads.com post URL.');
      return;
    }
    if (!cleanUrl.includes('threads.net') && !cleanUrl.includes('threads.com')) {
      setUrlError('URL must belong to threads.net or threads.com.');
      return;
    }

    try {
      setUrlError('');
      setIsParsingUrl(true);
      const res = await parseThreadsPostUrl(cleanUrl);
      if (res.success && res.job) {
        const msg =
          res.action === 'already_exists'
            ? `Threads post already tracked: "${res.job.title}"`
            : `Imported Threads ${res.job.vertical} lead: "${res.job.title}"`;
        showToast(msg);
        setLiveAnnouncement(msg);
        setPastedUrl('');
        await loadOpportunities(activeVertical, searchQuery);
      }
    } catch (err: any) {
      console.error('Failed to parse Threads URL', err);
      const errMsg = err.response?.data?.detail || 'Could not inspect Threads post URL.';
      setUrlError(errMsg);
      showToast(errMsg);
    } finally {
      setIsParsingUrl(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await loadOpportunities(activeVertical, searchQuery);
  };

  const handleSelectTab = (vertical: ThreadsVertical) => {
    setActiveVertical(vertical);
    const tabEl = tabButtonRefs.current[vertical];
    if (tabEl) {
      tabEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIdx: number) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIdx = (currentIdx + 1) % VERTICAL_TABS.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (currentIdx - 1 + VERTICAL_TABS.length) % VERTICAL_TABS.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = VERTICAL_TABS.length - 1;
    }

    if (nextIdx !== null) {
      e.preventDefault();
      const targetTab = VERTICAL_TABS[nextIdx];
      handleSelectTab(targetTab.id);
      tabButtonRefs.current[targetTab.id]?.focus();
    }
  };

  const openSettingsDialog = () => {
    if (scannerStatus) {
      syncDraftFromConfig(scannerStatus);
    }
    settingsDialogRef.current?.showModal();
  };

  const closeSettingsDialog = () => {
    settingsDialogRef.current?.close();
  };

  const handleToggleDraftVertical = (verticalId: string) => {
    setDraftVerticals((prev) =>
      prev.includes(verticalId)
        ? prev.filter((item) => item !== verticalId)
        : [...prev, verticalId]
    );
  };

  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (draftVerticals.length === 0) {
      showToast('Select at least one opportunity vertical to scan.');
      return;
    }
    const splitCsv = (raw: string) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    try {
      setIsSavingConfig(true);
      const payload: Parameters<typeof updateThreadsConfig>[0] = {
        enabled_verticals: draftVerticals,
        keywords: {
          graphic: splitCsv(draftGraphicKeywords),
          tech: splitCsv(draftTechKeywords),
          project: splitCsv(draftProjectKeywords),
        },
        scan_interval_minutes: draftInterval,
      };
      if (draftAccessToken.trim()) payload.access_token = draftAccessToken.trim();
      if (draftApifyToken.trim()) payload.apify_token = draftApifyToken.trim();
      if (draftWebhookUrl.trim()) payload.webhook_url = draftWebhookUrl.trim();
      if (draftTelegramToken.trim()) payload.telegram_bot_token = draftTelegramToken.trim();
      if (draftTelegramChatId.trim()) payload.telegram_chat_id = draftTelegramChatId.trim();

      const res = await updateThreadsConfig(payload);
      setScannerStatus(res.config);
      setDraftAccessToken('');
      setDraftApifyToken('');
      setDraftWebhookUrl('');
      setDraftTelegramToken('');
      showToast('Threads Radar bot settings updated.');
      setLiveAnnouncement('Threads Radar bot settings updated.');
      closeSettingsDialog();
    } catch (err: any) {
      console.error('Failed to update Threads config', err);
      showToast(err.response?.data?.detail || 'Could not save Threads settings.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSendTestAlert = async () => {
    try {
      setIsTestingAlert(true);
      const res = await triggerTestThreadsAlert();
      const ch = res.delivery?.channels || {};
      const webhookState = ch.webhook?.success
        ? 'Webhook delivered'
        : 'Email preview saved (configure webhook URL for Discord/Slack)';
      showToast(`Test alert complete: ${webhookState}.`);
      await loadOpportunities(activeVertical, searchQuery);
    } catch (err) {
      console.error('Test alert failed', err);
      showToast('Failed to send test alert.');
    } finally {
      setIsTestingAlert(false);
    }
  };

  const providerBadgeLabel = scannerStatus?.providers.meta_api_configured
    ? 'Meta Threads API Active'
    : scannerStatus?.providers.apify_configured
      ? 'Apify Connector Active'
      : 'Fediverse + oEmbed Active (Add Token for Meta API)';

  const getVerticalBadgeStyle = (vertical: string) => {
    if (vertical === 'graphic') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (vertical === 'tech') {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (vertical === 'project') {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Centralized polite live region for screen-reader status updates */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* 1. Executive Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-br from-[#070b19] via-[#0d1633] to-[#1e1b4b] text-[#f8faff] p-7 sm:p-10 overflow-hidden border border-indigo-400/20">
        <div className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl oi-mesh-drift" aria-hidden="true" />
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#c7d2fe] text-[10px] font-mono uppercase tracking-[0.25em] font-medium border border-white/15">
              <AtSign className="w-3 h-3" aria-hidden="true" />
              <span>Threads Opportunity Radar</span>
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] bg-white/5 text-slate-300 border border-white/10">
              {providerBadgeLabel}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Keyword &amp; Hiring Filter
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight leading-[1.05] text-[#f6f8fe]">
            Threads <span className="italic text-[#7dd3fc]">Graphic, Tech &amp; Project</span> Scanner
          </h1>
          <p className="mt-3 text-slate-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            Monitors Meta Threads for genuine hiring, freelance design, engineering, and contract project posts while automatically filtering self-promotion noise.
          </p>

          {/* Metrics Grid */}
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/[0.04] p-3.5 rounded-2xl border border-white/10">
              <div className="text-white font-mono text-lg font-bold tabular-nums">{verticalCounts.all}</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Total Matched</div>
            </div>
            <div className="bg-white/[0.04] p-3.5 rounded-2xl border border-white/10">
              <div className="text-rose-300 font-mono text-lg font-bold tabular-nums">{verticalCounts.graphic}</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Graphic Design</div>
            </div>
            <div className="bg-white/[0.04] p-3.5 rounded-2xl border border-white/10">
              <div className="text-indigo-300 font-mono text-lg font-bold tabular-nums">{verticalCounts.tech}</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Tech Roles</div>
            </div>
            <div className="bg-white/[0.04] p-3.5 rounded-2xl border border-white/10">
              <div className="text-amber-300 font-mono text-lg font-bold tabular-nums">{verticalCounts.project}</div>
              <div className="text-slate-400 text-[11px] uppercase tracking-wider mt-0.5">Projects &amp; Gigs</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Scanner Control Center & Direct Thread URL Importer */}
      <div className="bg-white rounded-3xl border border-[#d4dcf0] p-6 sm:p-7 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          {/* Direct URL Form */}
          <form
            onSubmit={handleImportSubmit}
            aria-labelledby="threads-import-heading"
            className="flex-1 max-w-2xl"
          >
            <h2 id="threads-import-heading" className="sr-only">
              Import Specific Threads Post
            </h2>
            <label htmlFor="threads-post-url" className="block text-xs font-bold text-slate-700 mb-1.5">
              Inspect Public Threads Post URL (No Login Required via oEmbed)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <ClipboardPaste
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="threads-post-url"
                  name="threads_url"
                  type="url"
                  value={pastedUrl}
                  onChange={(e) => {
                    setPastedUrl(e.target.value);
                    if (urlError) setUrlError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                  }}
                  aria-describedby="threads-url-help"
                  aria-invalid={urlError ? 'true' : undefined}
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder="https://www.threads.net/@username/post/..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-full border border-[#d4dcf0] bg-[#f6f8fe] text-xs font-medium text-[#0f172a] placeholder-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] focus-visible:outline-offset-2"
                />
              </div>
              <button
                type="submit"
                disabled={isParsingUrl}
                className="px-5 py-2.5 rounded-full font-mono uppercase tracking-[0.2em] text-[10px] font-medium text-[#f6f8fe] bg-[#1e1b4b] hover:bg-[#4338ca] active:scale-[0.98] transition-all duration-300 ease-premium disabled:opacity-50 cursor-pointer interactive-button shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] focus-visible:outline-offset-2"
              >
                {isParsingUrl ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Inspecting...</span>
                  </span>
                ) : (
                  <span>Import &amp; Classify</span>
                )}
              </button>
            </div>
            <p id="threads-url-help" className={`mt-1.5 text-[11px] ${urlError ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
              {urlError || 'Supports threads.net and threads.com post links; automatically tags Graphic, Tech, or Project.'}
            </p>
          </form>

          {/* Scanner Execution Controls */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <div className="flex items-center bg-[#e8eefc] p-1 rounded-full border border-[#d4dcf0] font-medium text-xs">
              <button
                type="button"
                aria-pressed={scanMode === 'auto'}
                onClick={() => setScanMode('auto')}
                className={`px-3.5 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.18em] transition-all duration-300 cursor-pointer ${
                  scanMode === 'auto'
                    ? 'bg-[#1e1b4b] text-[#f6f8fe] font-medium'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Auto Scan
              </button>
              <button
                type="button"
                aria-pressed={scanMode === 'fediverse'}
                onClick={() => setScanMode('fediverse')}
                className={`px-3.5 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.18em] transition-all duration-300 cursor-pointer ${
                  scanMode === 'fediverse'
                    ? 'bg-[#1e1b4b] text-[#f6f8fe] font-medium'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fediverse Live
              </button>
            </div>

            <button
              type="button"
              onClick={handleScanNow}
              disabled={isScanning}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full font-mono uppercase tracking-[0.2em] text-[10px] font-medium text-[#f6f8fe] bg-[#4338ca] hover:bg-indigo-700 active:scale-[0.98] transition-all duration-300 ease-premium disabled:opacity-60 cursor-pointer interactive-button oi-btn-pulse"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isScanning ? 'Scanning Threads...' : 'Scan Threads Now'}</span>
            </button>

            <button
              type="button"
              onClick={openSettingsDialog}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full font-mono uppercase tracking-[0.2em] text-[10px] font-medium text-[#0f172a] bg-[#f6f8fe] hover:border-[#4f46e5] border border-[#d4dcf0] transition-colors cursor-pointer interactive-button"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
              <span>Bot &amp; Alerts</span>
            </button>
          </div>
        </div>

        {/* Last Scan Diagnostics Bar */}
        {scannerStatus?.last_scan_report && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span>Adapter: {scannerStatus.last_scan_report.active_adapter}</span>
              </span>
              <span>
                Inspected <strong className="text-slate-800">{scannerStatus.last_scan_report.raw_posts_inspected}</strong> posts
              </span>
              <span>
                Filtered <strong className="text-slate-800">{scannerStatus.last_scan_report.self_promo_filtered_count}</strong> self-promo noise
              </span>
            </div>
            <div>
              Auto-scan interval: <strong className="text-slate-700">{scannerStatus.scan_interval_minutes}m</strong>
              {scannerStatus.providers.webhook_configured && (
                <span className="ml-2 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                  Webhook Connected
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. Single-Row Accessible Category Tablist + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div
          role="tablist"
          aria-label="Opportunity categories"
          className="flex flex-nowrap items-center gap-1.5 overflow-x-auto bg-white p-1.5 rounded-full border border-[#d4dcf0]"
        >
          {VERTICAL_TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isSelected = activeVertical === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabButtonRefs.current[tab.id] = el;
                }}
                id={`threads-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => handleSelectTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`relative flex-none inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs transition-all duration-300 ease-premium whitespace-nowrap cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] focus-visible:outline-offset-1 ${
                  isSelected
                    ? 'bg-[#1e1b4b] text-[#f6f8fe] font-medium'
                    : 'bg-transparent text-slate-600 hover:text-[#0f172a] hover:bg-[#f6f8fe] font-medium'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden={true} />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {verticalCounts[tab.id] || 0}
                </span>
              </button>
            );
          })}
        </div>

        <search className="flex-1 max-w-md">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <label htmlFor="threads-search-input" className="sr-only">
              Search scanned Threads opportunities
            </label>
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
              <input
                id="threads-search-input"
                name="q"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Filter by designer, React, budget, handle..."
                className="w-full pl-9 pr-4 py-2 rounded-full border border-[#d4dcf0] bg-white text-xs font-medium text-[#0f172a] placeholder-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-full border border-[#d4dcf0] bg-white hover:border-[#4338ca] hover:text-[#4338ca] font-mono uppercase tracking-[0.2em] text-[10px] font-medium text-[#0f172a] transition-colors cursor-pointer"
            >
              Filter
            </button>
          </form>
        </search>
      </div>

      {/* 4. Opportunities Grid Panel */}
      <div
        role="tabpanel"
        aria-labelledby={`threads-tab-${activeVertical}`}
        tabIndex={opportunities.length === 0 ? 0 : undefined}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-[#d4dcf0]">
            <Loader2 className="w-8 h-8 text-[#4338ca] animate-spin mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-slate-700">Loading Threads Opportunity Radar...</p>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-[#d4dcf0]">
            <p className="text-sm font-medium text-slate-600 mb-3">
              No Threads opportunities matched your current filter.
            </p>
            <button
              type="button"
              onClick={handleScanNow}
              className="px-5 py-2.5 rounded-full font-mono uppercase tracking-[0.2em] text-[10px] font-medium text-[#f6f8fe] bg-[#4338ca] hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Run Threads Scan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.map((opp) => {
              const primaryUrl = opp.apply_urls?.[0] || '';
              const threadsPermalink =
                opp.apply_urls?.find((u) => u.includes('threads.net') || u.includes('threads.com')) || primaryUrl;
              const externalApplyUrl = opp.apply_urls?.find(
                (u) => u && !u.includes('threads.net') && !u.includes('threads.com') && u.startsWith('http')
              );
              const isTracked = trackedJobIds.has(opp.id);
              const cleanHandle = opp.company.replace('(Threads)', '').trim();
              const initial = cleanHandle.replace('@', '').charAt(0).toUpperCase() || 'T';

              return (
                <article
                  key={opp.id}
                  className="bg-white rounded-3xl border border-[#d4dcf0] p-6 oi-card-subtle hover:border-[#4338ca]/40 transition-all duration-500 ease-premium flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-2xl bg-[#f6f8fe] border border-[#d4dcf0] text-[#0f172a] font-serif italic font-bold text-sm flex items-center justify-center shrink-0 group-hover:border-[#4338ca] group-hover:text-[#4338ca] transition-colors">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 leading-tight truncate">
                            {cleanHandle}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium truncate">
                            {(opp.sources || []).filter((s) => !s.startsWith('Vertical:')).join(' • ')}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase border shrink-0 ${getVerticalBadgeStyle(
                          opp.vertical
                        )}`}
                      >
                        {opp.vertical}
                      </span>
                    </div>

                    <h3 className="font-serif text-base font-normal text-[#0f172a] group-hover:text-[#4338ca] transition-colors line-clamp-2 leading-snug mb-2">
                      {opp.title}
                    </h3>

                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-3 flex-wrap">
                      {opp.salary_range && (
                        <span className="font-mono text-emerald-700 bg-emerald-50/70 px-2 py-0.5 rounded-md border border-emerald-200/60 font-semibold">
                          {opp.salary_range}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <Globe className="w-3 h-3 text-slate-400" aria-hidden="true" />
                        <span>Remote</span>
                      </span>
                      {externalApplyUrl && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-semibold">
                          <Zap className="w-3 h-3" aria-hidden="true" />
                          <span>Direct Link</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed mb-4 whitespace-pre-line">
                      {opp.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#d4dcf0] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onTrackJob(opp)}
                      disabled={isTracked}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        isTracked
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-[#f6f8fe] text-[#0f172a] border-[#d4dcf0] hover:border-[#4f46e5]'
                      }`}
                    >
                      {isTracked ? (
                        <>
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Tracked</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Track</span>
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {threadsPermalink && (
                        <a
                          href={threadsPermalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open Threads post by ${cleanHandle} in new tab`}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        </a>
                      )}

                      {externalApplyUrl ? (
                        <button
                          type="button"
                          onClick={() => onOpenAutoApplierModal(externalApplyUrl)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 font-mono uppercase tracking-[0.18em] text-[10px] font-medium rounded-full text-[#f6f8fe] bg-[#4338ca] hover:bg-indigo-700 transition-colors cursor-pointer interactive-button"
                        >
                          <Send className="w-3 h-3" aria-hidden="true" />
                          <span>Auto-Apply</span>
                        </button>
                      ) : (
                        <a
                          href={primaryUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 font-mono uppercase tracking-[0.18em] text-[10px] font-medium rounded-full text-[#f6f8fe] bg-[#1e1b4b] hover:bg-[#4338ca] transition-colors"
                        >
                          <span>Respond</span>
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Native <dialog> for Bot Keywords, API Credentials & Alert Channels */}
      <dialog
        ref={settingsDialogRef}
        aria-labelledby="threads-settings-title"
        className="rounded-3xl border border-[#d4dcf0] p-0 max-w-2xl w-full shadow-2xl backdrop:bg-[#1e1b4b]/70 backdrop:backdrop-blur-xs bg-[#f6f8fe] text-[#0f172a] m-auto"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" aria-hidden="true" />
              <h2 id="threads-settings-title" className="text-base font-bold text-slate-900">
                Threads Radar Bot &amp; Alert Configuration
              </h2>
            </div>
            <button
              type="button"
              onClick={closeSettingsDialog}
              aria-label="Close bot configuration dialog"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="mt-4 space-y-5">
            {/* Verticals Selection */}
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold text-slate-700">
                Monitored Opportunity Verticals
              </legend>
              <div className="flex flex-wrap gap-4 pt-1">
                {(['graphic', 'tech', 'project'] as const).map((v) => {
                  const id = `vertical-checkbox-${v}`;
                  return (
                    <div key={v} className="flex items-center gap-2">
                      <input
                        id={id}
                        type="checkbox"
                        checked={draftVerticals.includes(v)}
                        onChange={() => handleToggleDraftVertical(v)}
                        className="w-4 h-4 accent-indigo-600 rounded border-slate-300"
                      />
                      <label htmlFor={id} className="text-xs font-semibold text-slate-700 capitalize">
                        {v === 'graphic' ? 'Graphic Design' : v === 'tech' ? 'Tech & Engineering' : 'Projects & Freelance'}
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {/* Keywords per Vertical */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="kw-graphic" className="block text-xs font-bold text-slate-700 mb-1">
                  Graphic Keywords (comma-separated)
                </label>
                <input
                  id="kw-graphic"
                  name="graphic_keywords"
                  type="text"
                  value={draftGraphicKeywords}
                  onChange={(e) => setDraftGraphicKeywords(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="kw-tech" className="block text-xs font-bold text-slate-700 mb-1">
                  Tech Keywords (comma-separated)
                </label>
                <input
                  id="kw-tech"
                  name="tech_keywords"
                  type="text"
                  value={draftTechKeywords}
                  onChange={(e) => setDraftTechKeywords(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="kw-project" className="block text-xs font-bold text-slate-700 mb-1">
                  Project Keywords (comma-separated)
                </label>
                <input
                  id="kw-project"
                  name="project_keywords"
                  type="text"
                  value={draftProjectKeywords}
                  onChange={(e) => setDraftProjectKeywords(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800"
                />
              </div>
            </div>

            {/* Interval & Adapters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label htmlFor="scan-interval" className="block text-xs font-bold text-slate-700 mb-1">
                  Auto-Scan Interval (minutes)
                </label>
                <input
                  id="scan-interval"
                  name="scan_interval_minutes"
                  type="text"
                  inputMode="numeric"
                  value={String(draftInterval)}
                  onChange={(e) => {
                    const num = parseInt(e.target.value.replace(/\D/g, ''), 10);
                    if (!Number.isNaN(num)) setDraftInterval(Math.max(5, Math.min(1440, num)));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="meta-access-token" className="block text-xs font-bold text-slate-700 mb-1">
                  Meta Threads API Token {scannerStatus?.providers.meta_api_configured ? `(${scannerStatus.providers.meta_api_token_preview})` : ''}
                </label>
                <input
                  id="meta-access-token"
                  name="access_token"
                  type="password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={draftAccessToken}
                  onChange={(e) => setDraftAccessToken(e.target.value)}
                  placeholder="Optional: threads_keyword_search OAuth token"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="apify-token" className="block text-xs font-bold text-slate-700 mb-1">
                  Apify Token (Optional Live Alternative)
                </label>
                <input
                  id="apify-token"
                  name="apify_token"
                  type="password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={draftApifyToken}
                  onChange={(e) => setDraftApifyToken(e.target.value)}
                  placeholder="Optional Apify API token"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="webhook-url" className="block text-xs font-bold text-slate-700 mb-1">
                  Discord / Slack Webhook URL {scannerStatus?.providers.webhook_configured ? '(Configured)' : ''}
                </label>
                <input
                  id="webhook-url"
                  name="webhook_url"
                  type="url"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={draftWebhookUrl}
                  onChange={(e) => setDraftWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="tg-token" className="block text-xs font-bold text-slate-700 mb-1">
                  Telegram Bot Token
                </label>
                <input
                  id="tg-token"
                  name="telegram_bot_token"
                  type="password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={draftTelegramToken}
                  onChange={(e) => setDraftTelegramToken(e.target.value)}
                  placeholder="Optional BotFather token"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="tg-chat" className="block text-xs font-bold text-slate-700 mb-1">
                  Telegram Chat ID
                </label>
                <input
                  id="tg-chat"
                  name="telegram_chat_id"
                  type="text"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={draftTelegramChatId}
                  onChange={(e) => setDraftTelegramChatId(e.target.value)}
                  placeholder="Numeric chat ID"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleSendTestAlert}
                disabled={isTestingAlert}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-mono uppercase tracking-[0.18em] text-[10px] font-medium text-[#4338ca] bg-indigo-50 hover:bg-indigo-100 border border-[#d4dcf0] cursor-pointer disabled:opacity-50"
              >
                <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{isTestingAlert ? 'Sending Test Alert...' : 'Send Test Alert'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeSettingsDialog}
                  className="px-4 py-2 rounded-full font-mono uppercase tracking-[0.18em] text-[10px] font-medium text-[#0f172a] bg-white border border-[#d4dcf0] hover:border-[#4f46e5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="px-5 py-2 rounded-full font-mono uppercase tracking-[0.18em] text-[10px] font-medium text-[#f6f8fe] bg-[#4338ca] hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingConfig ? 'Saving...' : 'Save Bot Settings'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
};
