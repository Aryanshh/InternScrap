import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { Job, TailoredResumeResult } from '../types/job';
import { generateTailoredResume, checkTailoredResume, getResumeDownloadUrl } from '../api/client';

interface TailorResumeModalProps {
  job: Job;
  isOpen: boolean;
  onClose: () => void;
}

export const TailorResumeModal: React.FC<TailorResumeModalProps> = ({ job, isOpen, onClose }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tailoredData, setTailoredData] = useState<TailoredResumeResult | null>(null);
  const [activeTab, setActiveTab] = useState<'diff' | 'preview'>('diff');

  useEffect(() => {
    if (!isOpen) return;

    const fetchOrGenerate = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try checking existing first or generate directly
        const result = await generateTailoredResume(job.id);
        setTailoredData(result);
      } catch (err: any) {
        console.error('Tailoring error:', err);
        setError(err.response?.data?.detail || 'Failed to generate tailored resume.');
      } finally {
        setLoading(false);
      }
    };

    fetchOrGenerate();
  }, [job.id, isOpen]);

  if (!isOpen) return null;

  const downloadUrl = tailoredData ? getResumeDownloadUrl(tailoredData.id) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl shadow-cyan-950/20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                ATS Resume Tailoring
              </span>
              {job.match && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {job.match.blended_score}% Honest Match
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{job.title}</h2>
            <p className="text-sm text-slate-400">{job.company} • {job.location || 'Remote'}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Guarantee Banner */}
        <div className="bg-emerald-950/30 border-b border-emerald-800/40 px-6 py-2.5 flex items-center gap-3 text-xs text-emerald-300">
          <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <span className="font-semibold text-emerald-200">Zero-Fabrication Guarantee:</span> Only your verified experience and real skills are reordered & highlighted. Unmatched job requirements are strictly omitted from the resume.
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 bg-slate-900/90 flex gap-6">
          <button
            onClick={() => setActiveTab('diff')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'diff'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Strategic Diff & Audit
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'preview'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            ATS Resume Preview
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-white font-medium">Analyzing Job Description & Tailoring Experience...</p>
                <p className="text-sm text-slate-400 mt-1">Reordering candidate achievements, prioritizing matching skills, and compiling ATS DOCX.</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              <p className="font-semibold mb-1">Tailoring Failed</p>
              <p>{error}</p>
            </div>
          ) : tailoredData ? (
            activeTab === 'diff' ? (
              <div className="space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5">
                    <p className="text-xs text-slate-400 font-medium">Skills Promoted</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                      {tailoredData.diff_summary.stats.skills_promoted}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Matched with JD</p>
                  </div>
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5">
                    <p className="text-xs text-slate-400 font-medium">Bullets Reordered</p>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">
                      {tailoredData.diff_summary.stats.bullets_reordered}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Relevance prioritized</p>
                  </div>
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5">
                    <p className="text-xs text-slate-400 font-medium">Omitted Requirements</p>
                    <p className="text-2xl font-bold text-rose-400 mt-1">
                      {tailoredData.diff_summary.stats.unmatched_jd_requirements}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Unmatched (Omitted)</p>
                  </div>
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3.5">
                    <p className="text-xs text-slate-400 font-medium">Fabricated Skills</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">0</p>
                    <p className="text-[11px] text-emerald-500 font-medium mt-0.5">Strict Zero-Fabrication</p>
                  </div>
                </div>

                {/* Skills Section */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center justify-between">
                    <span>1. Skill Alignment & Keyword Reordering</span>
                    <span className="text-xs text-slate-400 font-normal">Matching skills moved to top of resume</span>
                  </h3>

                  <div>
                    <p className="text-xs text-emerald-400 font-medium mb-1.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Core & Matched Technologies (Promoted to Primary Skills Group):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tailoredData.diff_summary.promoted_skills.length > 0 ? (
                        tailoredData.diff_summary.promoted_skills.map((s, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1.5"
                          >
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>{s}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500 italic">No exact JD technical keywords found in candidate skills.</span>
                      )}
                    </div>
                  </div>

                  {tailoredData.diff_summary.unmatched_jd_requirements.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/40">
                      <p className="text-xs text-rose-400 font-medium mb-1.5 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        Unmatched JD Requirements (Intentionally Omitted to Preserve Truthfulness):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {tailoredData.diff_summary.unmatched_jd_requirements.map((s, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 inline-flex items-center gap-1.5"
                            title="Candidate does not list this skill; omitted to avoid falsifying qualifications."
                          >
                            <X className="w-3 h-3 text-rose-400" />
                            <span>{s}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-700/40">
                    <p className="text-xs text-slate-400 font-medium mb-1.5">
                      Additional Verified Proficiencies Kept on Resume:
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {tailoredData.diff_summary.additional_skills.map((s, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Experience Bullets Reordering */}
                <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center justify-between">
                    <span>2. Experience Accomplishments Reordering</span>
                    <span className="text-xs text-slate-400 font-normal">Most relevant bullets lead each position</span>
                  </h3>

                  <div className="space-y-2.5">
                    {tailoredData.diff_summary.reordered_bullets.map((b, idx) => {
                      const isPromoted = b.new_rank < b.original_rank;
                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 flex items-start gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex flex-col items-center shrink-0 w-16 text-center">
                            <span className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              #{b.new_rank}
                            </span>
                            <span className={`text-[10px] mt-1 font-medium ${isPromoted ? 'text-emerald-400' : 'text-slate-500'}`}>
                              {isPromoted ? `Promoted from #${b.original_rank}` : `was #${b.original_rank}`}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-300 leading-relaxed">{b.text}</p>
                            {b.matched_keywords && b.matched_keywords.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[10px] text-slate-500 font-medium">Matched JD Keywords:</span>
                                {b.matched_keywords.map((kw, ki) => (
                                  <span key={ki} className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* ATS Resume Preview Tab */
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 sm:p-8 font-sans space-y-6 text-slate-300 max-w-3xl mx-auto shadow-inner">
                {/* Header */}
                <div className="text-center pb-4 border-b border-slate-800">
                  <h1 className="text-2xl font-bold text-white tracking-wide">
                    {tailoredData.tailored_json.header.name}
                  </h1>
                  <p className="text-sm font-semibold text-cyan-400 mt-0.5">
                    {tailoredData.tailored_json.header.headline}
                  </p>
                  {tailoredData.tailored_json.header.contact && (
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      {tailoredData.tailored_json.header.contact}
                    </p>
                  )}
                </div>

                {/* Summary */}
                {tailoredData.tailored_json.header.summary && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-2">
                      Professional Summary
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {tailoredData.tailored_json.header.summary}
                    </p>
                  </div>
                )}

                {/* Skills */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-2">
                    Technical Skills
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    {tailoredData.tailored_json.skills.core_matched.length > 0 && (
                      <p>
                        <strong className="text-emerald-400 font-semibold">Core & Matched Technologies: </strong>
                        <span className="text-white font-medium">
                          {tailoredData.tailored_json.skills.core_matched.join(', ')}
                        </span>
                      </p>
                    )}
                    {tailoredData.tailored_json.skills.additional.length > 0 && (
                      <p>
                        <strong className="text-slate-400 font-semibold">Additional Proficiencies: </strong>
                        <span className="text-slate-300">
                          {tailoredData.tailored_json.skills.additional.join(', ')}
                        </span>
                      </p>
                    )}
                    {tailoredData.tailored_json.skills.tools.length > 0 && (
                      <p>
                        <strong className="text-slate-400 font-semibold">Tools & Platforms: </strong>
                        <span className="text-slate-300">
                          {tailoredData.tailored_json.skills.tools.join(', ')}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Experience */}
                {tailoredData.tailored_json.experience.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-3">
                      Professional Experience
                    </h3>
                    <div className="space-y-4">
                      {tailoredData.tailored_json.experience.map((job, ji) => (
                        <div key={ji} className="space-y-1.5">
                          <div className="flex justify-between items-baseline flex-wrap">
                            <span className="text-xs font-bold text-white">{job.title}</span>
                            <span className="text-xs text-slate-400 italic">{job.company_date}</span>
                          </div>
                          <ul className="list-disc list-outside pl-4 space-y-1 text-xs text-slate-300">
                            {job.bullets.map((b, bi) => (
                              <li key={bi} className="leading-relaxed">{b}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Projects */}
                {tailoredData.tailored_json.projects.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-3">
                      Selected Projects
                    </h3>
                    <div className="space-y-3">
                      {tailoredData.tailored_json.projects.map((proj, pi) => (
                        <div key={pi} className="space-y-1">
                          <p className="text-xs font-bold text-white">{proj.title}</p>
                          <ul className="list-disc list-outside pl-4 space-y-1 text-xs text-slate-300">
                            {proj.bullets.map((b, bi) => (
                              <li key={bi} className="leading-relaxed">{b}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {tailoredData.tailored_json.education.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-2">
                      Education
                    </h3>
                    <div className="space-y-1 text-xs">
                      {tailoredData.tailored_json.education.map((edu, ei) => (
                        <p key={ei} className="text-slate-300">{edu}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Close
          </button>

          {tailoredData && (
            <a
              href={downloadUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-900/30 transition-all hover:scale-[1.02]"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
              </svg>
              Download ATS DOCX
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
