import React, { useState, useEffect } from 'react';
import { getSchedulerStatus, triggerScheduler, getDigestHtmlUrl } from '../api/client';
import { SchedulerStatus } from '../types/job';
import { Mail, Clock, RefreshCw, CheckCircle2, Play, AlertCircle, X } from 'lucide-react';

interface EmailDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailDigestModal: React.FC<EmailDigestModalProps> = ({ isOpen, onClose }) => {
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState<number>(1);

  const fetchStatus = async () => {
    try {
      const status = await getSchedulerStatus();
      setSchedulerStatus(status);
    } catch (err) {
      console.error('Failed to fetch scheduler status:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const handleTriggerNow = async () => {
    setTriggering(true);
    setTriggerMessage(null);
    try {
      const res = await triggerScheduler();
      setTriggerMessage(
        `Cycle completed! Found ${res.stats?.high_matches_found || 0} high-match listings.`
      );
      setIframeKey((prev) => prev + 1); // Reload preview iframe
      fetchStatus();
    } catch (err: any) {
      setTriggerMessage(`Trigger failed: ${err.message || 'Unknown error'}`);
    } finally {
      setTriggering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Scheduled Email Digest & Background Daemon
              </h3>
              <p className="text-xs text-slate-500">
                APScheduler runs periodic discovery and delivers digests whenever listings match your resume &ge; 70%.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scheduler Status Bar */}
        <div className="px-6 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>APScheduler: {schedulerStatus?.is_running ? 'Active & Running' : 'Idle'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Interval: Every {schedulerStatus?.interval_hours || 4} hours</span>
            </div>
            {schedulerStatus?.next_run_time && (
              <div className="text-slate-400">
                Next run: {new Date(schedulerStatus.next_run_time).toLocaleTimeString()}
              </div>
            )}
          </div>

          <button
            onClick={handleTriggerNow}
            disabled={triggering}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-xs disabled:opacity-50"
          >
            {triggering ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{triggering ? 'Running Ingestion Cycle...' : 'Trigger Sync & Alert Cycle Now'}</span>
          </button>
        </div>

        {/* Status Message */}
        {triggerMessage && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{triggerMessage}</span>
          </div>
        )}

        {/* Email Preview Frame */}
        <div className="flex-1 bg-slate-100 p-4 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              Live Email Newsletter Preview
            </span>
            <span>Recipient: candidate@example.com</span>
          </div>

          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-inner overflow-hidden">
            <iframe
              key={iframeKey}
              src={getDigestHtmlUrl()}
              title="Email Digest Preview"
              className="w-full h-full border-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>SMTP alerts can be redirected to SendGrid / Mailgun via environment variables.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
