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
} from 'lucide-react';
import { Job } from '../types/job';
import { verifyJobLink } from '../api/client';

interface JobCardProps {
  job: Job;
  onTailor?: (job: Job) => void;
  onTrack?: (job: Job) => void;
  onAutoApply?: (job: Job) => void;
  isTracked?: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onTailor, onTrack, onAutoApply, isTracked }) => {
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Remote
          </span>
        );
      case 'hybrid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            Hybrid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
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

  // Match score coloring
  const getMatchBadgeStyle = (score: number) => {
    if (score >= 75) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400';
    } else if (score >= 50) {
      return 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-400';
    } else {
      return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 p-5 mb-4">
      {/* Top Header: Title, Badges, Company */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 hover:text-indigo-600 transition-colors">
              {job.title}
            </h3>

            {/* Badges */}
            {getRemoteBadge(job.remote_type)}

            {job.is_internship && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                <GraduationCap className="w-3 h-3 mr-1" />
                Internship
              </span>
            )}

            {/* Multi-source Merged Indicator */}
            {isMerged && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                title={`Merged from ${job.sources.join(', ')} via fuzzy deduplication`}
              >
                <Layers className="w-3 h-3 mr-1 text-indigo-500" />
                Deduplicated ({job.sources.length} sources)
              </span>
            )}

            {/* Stale Link Indicator */}
            {linkStatus === false && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Dead/Expired Link
              </span>
            )}
            {linkStatus === true && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Verified Live
              </span>
            )}
          </div>

          {/* Company and Location row */}
          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-slate-600">
            <div className="flex items-center font-medium text-slate-800">
              <Building2 className="w-4 h-4 mr-1.5 text-slate-400" />
              <span>{job.company}</span>
            </div>
            <div className="flex items-center">
              <MapPin className="w-4 h-4 mr-1 text-slate-400" />
              <span>{job.location}</span>
            </div>
            {job.salary_range && (
              <div className="flex items-center font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                <DollarSign className="w-3.5 h-3.5 mr-0.5 text-emerald-600" />
                <span>{job.salary_range}</span>
              </div>
            )}
            {formattedDate && (
              <div className="flex items-center text-slate-400">
                <Calendar className="w-3.5 h-3.5 mr-1" />
                <span>{formattedDate}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Source Badges & Match Score Pill */}
        <div className="flex flex-wrap sm:flex-col sm:items-end gap-2">
          {/* Match Score Badge (if active resume matched) */}
          {job.match && (
            <div
              className={`inline-flex flex-col items-end px-3 py-1.5 rounded-xl border ${getMatchBadgeStyle(
                job.match.blended_score
              )} shadow-2xs`}
              title="Estimated match score based on keyword & semantic analysis (not a guarantee)"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <Target className="w-3.5 h-3.5" />
                <span>{job.match.blended_score}% Match</span>
              </div>
              <span className="text-[10px] opacity-80 font-normal">
                Semantic: {job.match.semantic_score}% • Keyword: {job.match.keyword_score}%
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {job.sources && job.sources.length > 0 ? (
              job.sources.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 text-[11px] uppercase tracking-wider font-semibold rounded bg-slate-100 text-slate-600 border border-slate-200"
                >
                  {s}
                </span>
              ))
            ) : (
              <span className="px-2 py-0.5 text-[11px] uppercase font-semibold rounded bg-slate-100 text-slate-600">
                {job.primary_source}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Factual Gap Analysis Panel */}
      {job.match && (
        <div className="mt-3 p-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <span>Factual Gap Analysis:</span>
            </div>
            <div className="flex items-center text-[10px] text-slate-400 gap-1">
              <HelpCircle className="w-3 h-3" />
              <span>Algorithmic estimate, not a guarantee</span>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {job.match.gap_list && job.match.gap_list.length > 0 ? (
              <>
                <span className="text-slate-500 font-medium">Missing from resume:</span>
                {job.match.gap_list.map((gap) => (
                  <span
                    key={gap}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-medium text-[11px]"
                  >
                    <AlertCircle className="w-3 h-3 mr-1 text-rose-500" />
                    {gap}
                  </span>
                ))}
              </>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                All technical keywords extracted from this JD match your resume profile!
              </span>
            )}
          </div>
        </div>
      )}

      {/* Description Snippet / Expanded */}
      <div className="mt-3 text-sm text-slate-600">
        {expanded ? (
          <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-100 prose prose-sm max-w-none text-slate-700">
            {job.description.includes('<') ? (
              <div dangerouslySetInnerHTML={{ __html: job.description }} />
            ) : (
              <p className="whitespace-pre-line">{job.description}</p>
            )}
          </div>
        ) : (
          <p className="line-clamp-2 leading-relaxed text-slate-600">
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
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors"
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
            className="inline-flex items-center text-slate-500 hover:text-slate-800 transition-colors"
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
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-xs ${
                isTracked
                  ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                  : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title={isTracked ? 'Saved to your application tracker' : 'Save to application tracker'}
            >
              <Bookmark className={`w-3.5 h-3.5 mr-1.5 ${isTracked ? 'fill-amber-500 text-amber-500' : 'text-slate-500'}`} />
              <span>{isTracked ? 'Tracked' : 'Track'}</span>
            </button>
          )}

          {onTailor && (
            <button
              onClick={() => onTailor(job)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-cyan-700 bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 transition-all shadow-xs"
              title="Tailor candidate resume specifically for this role"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5 text-cyan-600" />
              <span>Tailor Resume</span>
            </button>
          )}

          {onAutoApply && (
            <button
              onClick={() => onAutoApply(job)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-all shadow-xs cursor-pointer"
              title="Launch 1-Click Auto Applier with IIM Resume"
            >
              <Send className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              <span>Auto Apply</span>
            </button>
          )}

          {job.apply_urls && job.apply_urls.length > 0 ? (
            job.apply_urls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100"
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
