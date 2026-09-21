import React, { useState } from 'react';
import {
  ExternalLink,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  Layers,
  ShieldCheck,
  Target,
  AlertCircle,
  HelpCircle,
  FileText,
  Bookmark,
  Send,
  Plus,
} from 'lucide-react';
import { Job } from '../types/job';
import { verifyJobLink } from '../api/client';

interface JobCardProps {
  job: Job;
  onTailor?: (job: Job) => void;
  onTrack?: (job: Job) => void;
  onAutoApply?: (job: Job) => void;
  isTracked?: boolean;
  isQueued?: boolean;
  onToggleQueue?: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onTailor,
  onTrack,
  onAutoApply,
  isTracked,
  isQueued,
  onToggleQueue,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [linkStatus, setLinkStatus] = useState<boolean | null>(
    job.is_stale_link ? false : null
  );

  const handleVerifyLink = async () => {
    try {
      setVerifying(true);
      const res = await verifyJobLink(job.id);
      setLinkStatus(!res.is_stale);
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  const getRemoteBadge = (type: string) => {
    switch (type.toLowerCase()) {
      case 'remote':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            Remote
          </span>
        );
      case 'hybrid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-50 text-purple-800 border border-purple-200/80">
            Hybrid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
            On-site
          </span>
        );
    }
  };

  const formattedDate = job.posted_date
    ? new Date(job.posted_date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const cleanSnippet = job.description
    ? job.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : 'No description provided.';

  const isMerged = job.sources && job.sources.length > 1;
  const companyInitial = job.company ? job.company.charAt(0).toUpperCase() : 'C';

  // Match score coloring
  const getMatchBadgeStyle = (score: number) => {
    if (score >= 75) {
      return 'bg-emerald-50/90 text-emerald-900 border-emerald-200';
    } else if (score >= 50) {
      return 'bg-blue-50/90 text-blue-900 border-blue-200';
    } else {
      return 'bg-slate-100/90 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06),0_2px_6px_-2px_rgba(0,0,0,0.04)] transition-all duration-200 p-5 sm:p-6 mb-4 group">
      {/* Top Header: Monogram, Title, Badges, Company */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          {/* Company Monogram Avatar */}
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center font-bold text-sm text-slate-700 shrink-0 select-none shadow-2xs group-hover:border-slate-300 group-hover:bg-slate-50 transition-colors">
            {companyInitial}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <h3 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900 group-hover:text-slate-950 transition-colors">
                {job.title}
              </h3>

              {/* Badges */}
              {getRemoteBadge(job.remote_type)}

              {job.is_internship && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/80">
                  <GraduationCap className="w-3 h-3 mr-1 text-amber-600" />
                  Internship
                </span>
              )}

              {/* Multi-source Merged Indicator */}
              {isMerged && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80"
                  title={`Merged from ${job.sources.join(', ')} via fuzzy deduplication`}
                >
                  <Layers className="w-3 h-3 mr-1 text-slate-500" />
                  Deduplicated ({job.sources.length} sources)
                </span>
              )}

              {/* Stale Link Indicator */}
              {linkStatus === false && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
                  <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
                  Dead Link
                </span>
              )}
              {linkStatus === true && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                  Live Link
                </span>
              )}
            </div>

            {/* Company and Location row */}
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3.5 text-xs text-slate-600">
              <div className="flex items-center font-medium text-slate-900">
                <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span>{job.company}</span>
              </div>
              <div className="flex items-center text-slate-500">
                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                <span>{job.location}</span>
              </div>
              {job.salary_range && (
                <div className="flex items-center font-mono font-medium text-emerald-800 bg-emerald-50/80 border border-emerald-200/70 px-2 py-0.5 rounded-md text-xs">
                  <DollarSign className="w-3 h-3 mr-0.5 text-emerald-600" />
                  <span>{job.salary_range}</span>
                </div>
              )}
              {formattedDate && (
                <div className="flex items-center text-slate-400 text-[11px]">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>{formattedDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Source Badges & Match Score Pill */}
        <div className="flex flex-wrap sm:flex-col sm:items-end gap-2 shrink-0">
          {/* Match Score Badge (if active resume matched) */}
          {job.match && (
            <div
              className={`inline-flex flex-col items-end px-3 py-1.5 rounded-xl border ${getMatchBadgeStyle(
                job.match.blended_score
              )} shadow-2xs`}
              title="Estimated match score based on keyword & semantic analysis (honest estimate)"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Target className="w-3.5 h-3.5 text-slate-700" />
                <span>{job.match.blended_score}% Match</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 font-normal">
                Sem {job.match.semantic_score}% • Key {job.match.keyword_score}%
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {job.sources && job.sources.length > 0 ? (
              job.sources.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 text-[10px] uppercase font-mono font-semibold rounded-md bg-slate-100/90 text-slate-600 border border-slate-200/80"
                >
                  {s}
                </span>
              ))
            ) : (
              <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-semibold rounded-md bg-slate-100/90 text-slate-600 border border-slate-200/80">
                {job.primary_source}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Factual Gap Analysis Panel */}
      {job.match && (
        <div className="mt-3.5 p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <span>Factual Gap Analysis</span>
            </div>
            <div className="flex items-center text-[10px] text-slate-400 gap-1">
              <HelpCircle className="w-3 h-3" />
              <span>Algorithmic estimate, not a guarantee</span>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {job.match.gap_list && job.match.gap_list.length > 0 ? (
              <>
                <span className="text-slate-500 font-medium text-[11px]">Missing from resume:</span>
                {job.match.gap_list.map((gap) => (
                  <span
                    key={gap}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200/80 font-medium text-[11px]"
                  >
                    <AlertCircle className="w-3 h-3 mr-1 text-rose-600" />
                    {gap}
                  </span>
                ))}
              </>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                All technical keywords extracted from this JD match your candidate profile!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Description Snippet / Expanded */}
      <div className="mt-3 text-sm text-slate-600">
        {expanded ? (
          <div className="mt-3 p-4 bg-slate-50/80 rounded-xl border border-slate-200/60 prose prose-sm max-w-none text-slate-700 leading-relaxed">
            {job.description.includes('<') ? (
              <div dangerouslySetInnerHTML={{ __html: job.description }} />
            ) : (
              <p className="whitespace-pre-line">{job.description}</p>
            )}
          </div>
        ) : (
          <p className="line-clamp-2 leading-relaxed text-slate-600 text-xs sm:text-sm">
            {cleanSnippet}
          </p>
        )}
      </div>

      {/* Actions Footer */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        {/* Left Action: Expand description & verify link */}
        <div className="flex items-center space-x-3 text-xs font-medium">
          <button
            onClick={() => setExpanded(!expanded)}
            className="interactive-button inline-flex items-center text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 mr-1" />
                <span>Show Less</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 mr-1" />
                <span>Show Full Description</span>
              </>
            )}
          </button>

          <button
            onClick={handleVerifyLink}
            disabled={verifying}
            className="interactive-button inline-flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            title="Check if destination apply URLs are still active and reachable"
          >
            <ShieldCheck className={`w-3.5 h-3.5 mr-1 ${verifying ? 'animate-spin' : ''}`} />
            <span>{verifying ? 'Checking...' : 'Check Link Vitality'}</span>
          </button>
        </div>

        {/* Right Action: Track, Tailor Resume & Apply Links */}
        <div className="flex items-center space-x-2">
          {onTrack && (
            <button
              onClick={() => onTrack(job)}
              className={`interactive-button inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-2xs cursor-pointer ${
                isTracked
                  ? 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title={isTracked ? 'Saved to your application tracker' : 'Save to application tracker'}
            >
              <Bookmark className={`w-3.5 h-3.5 mr-1.5 ${isTracked ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
              <span>{isTracked ? 'Tracked' : 'Track'}</span>
            </button>
          )}

          {onTailor && (
            <button
              onClick={() => onTailor(job)}
              className="interactive-button inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
              title="Tailor candidate resume specifically for this role"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              <span>Tailor Resume</span>
            </button>
          )}

          {onAutoApply && (
            <button
              onClick={() => onAutoApply(job)}
              className="interactive-button inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 transition-all shadow-2xs cursor-pointer"
              title="Launch 1-Click Auto Applier with IIM Resume"
            >
              <Send className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              <span>Auto Apply</span>
            </button>
          )}

          {onToggleQueue && (
            <button
              onClick={() => onToggleQueue(job)}
              className={`interactive-button inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
                isQueued
                  ? 'bg-slate-900 text-white border border-slate-800 hover:bg-slate-800'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
              title={isQueued ? 'Remove from Auto-Apply queue' : 'Add to 1-Click Auto-Apply queue'}
            >
              {isQueued ? (
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              ) : (
                <Plus className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              )}
              <span>{isQueued ? 'Queued' : '+ Queue'}</span>
            </button>
          )}

          {job.apply_urls && job.apply_urls.length > 0 ? (
            job.apply_urls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="interactive-button inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-2xs cursor-pointer"
              >
                <span>
                  {job.apply_urls.length > 1
                    ? `Apply Link ${idx + 1}`
                    : 'Apply Directly'}
                </span>
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </a>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">
              No apply link provided
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
