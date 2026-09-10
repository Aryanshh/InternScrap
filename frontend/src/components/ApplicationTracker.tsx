import React, { useState, useEffect, useMemo } from 'react';
import { ApplicationItem, Job } from '../types/job';
import { getApplications, updateApplication, deleteApplication } from '../api/client';
import {
  Bookmark,
  Send,
  Calendar,
  Award,
  XCircle,
  Clock,
  Trash2,
  FileText,
  Building2,
  MapPin,
  ExternalLink,
  Target,
  Edit3,
  Check,
  Search,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';

interface ApplicationTrackerProps {
  onTailorJob: (job: Job) => void;
  onBackToHome?: () => void;
}

const STATUS_COLUMNS = [
  { id: 'saved', label: 'Saved for Later', icon: Bookmark, color: 'border-slate-300 text-slate-700 bg-slate-100', badge: 'bg-slate-200 text-slate-800' },
  { id: 'applied', label: 'Applied', icon: Send, color: 'border-blue-300 text-blue-700 bg-blue-50', badge: 'bg-blue-100 text-blue-800' },
  { id: 'interviewing', label: 'Interviewing', icon: Calendar, color: 'border-purple-300 text-purple-700 bg-purple-50', badge: 'bg-purple-100 text-purple-800' },
  { id: 'offer', label: 'Offer Received', icon: Award, color: 'border-emerald-300 text-emerald-700 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-800' },
  { id: 'rejected', label: 'Archived / Rejected', icon: XCircle, color: 'border-rose-200 text-rose-700 bg-rose-50', badge: 'bg-rose-100 text-rose-800' },
] as const;

export const ApplicationTracker: React.FC<ApplicationTrackerProps> = ({ onTailorJob, onBackToHome }) => {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>('');

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const data = await getApplications();
      setApplications(data);
    } catch (err) {
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleStatusChange = async (appId: string, newStatus: string) => {
    try {
      const updated = await updateApplication(appId, { status: newStatus });
      setApplications((prev) => prev.map((a) => (a.id === appId ? updated : a)));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleDelete = async (appId: string) => {
    if (!confirm('Remove this application from tracking?')) return;
    try {
      await deleteApplication(appId);
      setApplications((prev) => prev.filter((a) => a.id !== appId));
    } catch (err) {
      console.error('Failed to delete application:', err);
    }
  };

  const handleSaveNotes = async (appId: string) => {
    try {
      const updated = await updateApplication(appId, { notes: notesDraft });
      setApplications((prev) => prev.map((a) => (a.id === appId ? updated : a)));
      setEditingNotesId(null);
    } catch (err) {
      console.error('Failed to save notes:', err);
    }
  };

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return applications;
    const q = searchQuery.toLowerCase();
    return applications.filter(
      (a) =>
        a.job?.title.toLowerCase().includes(q) ||
        a.job?.company.toLowerCase().includes(q) ||
        a.notes.toLowerCase().includes(q)
    );
  }, [applications, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Back to Home Button */}
      {onBackToHome && (
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>
      )}

      {/* Top Controls & Metrics */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Application Tracker</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Organize your job search pipeline, track interview stages, and access role-specific tailored resumes.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tracked roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <button
            onClick={fetchApplications}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh application status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STATUS_COLUMNS.map((col) => {
          const colApps = filteredApps.filter((a) => a.status === col.id);
          const Icon = col.icon;

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-2xl bg-slate-50/80 border border-slate-200/80 p-3 min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-2 mb-3 border-b border-slate-200/60">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700">
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span>{col.label}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.badge}`}>
                  {colApps.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1 overflow-y-auto">
                {colApps.length === 0 ? (
                  <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    No roles in {col.label}
                  </div>
                ) : (
                  colApps.map((app) => (
                    <div
                      key={app.id}
                      className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-shadow space-y-2.5"
                    >
                      {/* Job Title & Company */}
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                            {app.job?.title || 'Job Listing'}
                          </h4>
                          <button
                            onClick={() => handleDelete(app.id)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-0.5 rounded"
                            title="Untrack this application"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center text-[11px] text-slate-600 font-medium mt-1">
                          <Building2 className="w-3 h-3 mr-1 text-slate-400" />
                          <span className="truncate">{app.job?.company || 'Company'}</span>
                        </div>
                      </div>

                      {/* Match Score & Badges */}
                      <div className="flex flex-wrap items-center gap-1">
                        {app.match && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Target className="w-2.5 h-2.5 mr-1" />
                            {app.match.blended_score}% Match
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-medium capitalize">
                          {app.job?.remote_type || 'remote'}
                        </span>
                        {app.job?.location && (
                          <span className="flex items-center text-[10px] text-slate-400 truncate max-w-[110px]">
                            <MapPin className="w-2.5 h-2.5 mr-0.5" />
                            {app.job.location}
                          </span>
                        )}
                      </div>

                      {/* Tailored Resume Action */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        {app.tailored_resume ? (
                          <a
                            href={`http://127.0.0.1:8000${app.tailored_resume.download_url}`}
                            download
                            className="inline-flex items-center text-cyan-700 hover:text-cyan-900 font-semibold gap-1"
                            title="Download tailored DOCX resume"
                          >
                            <FileText className="w-3 h-3 text-cyan-600" />
                            <span>Tailored DOCX</span>
                          </a>
                        ) : app.job ? (
                          <button
                            onClick={() => onTailorJob(app.job!)}
                            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-semibold gap-1"
                          >
                            <FileText className="w-3 h-3 text-indigo-500" />
                            <span>Tailor Resume</span>
                          </button>
                        ) : null}

                        {app.job?.apply_urls?.[0] && (
                          <a
                            href={app.job.apply_urls[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title="Open direct job application URL"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      {/* Notes Section */}
                      <div className="pt-1.5 text-[11px]">
                        {editingNotesId === app.id ? (
                          <div className="space-y-1.5">
                            <textarea
                              value={notesDraft}
                              onChange={(e) => setNotesDraft(e.target.value)}
                              rows={2}
                              className="w-full p-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Interview dates, recruiter contacts..."
                            />
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="px-2 py-0.5 rounded text-[10px] text-slate-500 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveNotes(app.id)}
                                className="px-2 py-0.5 rounded text-[10px] bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingNotesId(app.id);
                              setNotesDraft(app.notes);
                            }}
                            className="cursor-pointer group flex items-start justify-between p-1 rounded bg-slate-50 hover:bg-slate-100 transition-colors text-slate-600"
                            title="Click to edit notes"
                          >
                            <p className="line-clamp-2 italic text-[11px] text-slate-500 flex-1">
                              {app.notes || 'Add notes (interviews, contacts)...'}
                            </p>
                            <Edit3 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 ml-1 shrink-0" />
                          </div>
                        )}
                      </div>

                      {/* Stage Selector */}
                      <div className="pt-1.5 border-t border-slate-100">
                        <select
                          value={app.status}
                          onChange={(e) => handleStatusChange(app.id, e.target.value)}
                          className="w-full text-[11px] font-medium py-1 px-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="saved">Move to: Saved</option>
                          <option value="applied">Move to: Applied</option>
                          <option value="interviewing">Move to: Interviewing</option>
                          <option value="offer">Move to: Offer Received</option>
                          <option value="rejected">Move to: Archived/Rejected</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
