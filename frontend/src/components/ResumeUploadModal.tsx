import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Wrench, GraduationCap, Briefcase } from 'lucide-react';
import { uploadResume } from '../api/client';
import { ResumeData } from '../types/job';

interface ResumeUploadModalProps {
  isOpen: boolean;
  activeResume: ResumeData | null;
  onClose: () => void;
  onUploadSuccess: (resume: ResumeData) => void;
}

export const ResumeUploadModal: React.FC<ResumeUploadModalProps> = ({
  isOpen,
  activeResume,
  onClose,
  onUploadSuccess,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    const validExtensions = ['.pdf', '.docx', '.txt'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setError('Please upload a PDF (.pdf), Word document (.docx), or plain text (.txt) file.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      const res = await uploadResume(file);
      onUploadSuccess(res);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to parse resume. Please check file format.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Resume Parser & Matching Profile
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload your resume in PDF or DOCX to enable honest job matching and gap analysis
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 space-y-5 overflow-y-auto flex-1 pr-1">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-slate-200 hover:border-indigo-400 bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <UploadCloud className={`w-6 h-6 ${isUploading ? 'animate-bounce' : ''}`} />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {isUploading ? 'Parsing document structure...' : 'Click to browse or drag & drop your resume'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Supports PDF (.pdf) and Word (.docx)</p>
          </div>

          {/* Active Resume Structured Preview */}
          {activeResume && (
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{activeResume.filename}</h4>
                    <p className="text-[11px] text-slate-500">
                      Parsed on {activeResume.created_at ? new Date(activeResume.created_at).toLocaleDateString() : 'Just now'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  Active Profile
                </span>
              </div>

              {/* Extracted Skills */}
              {activeResume.parsed_json?.skills && activeResume.parsed_json.skills.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                    Detected Skills ({activeResume.parsed_json.skills.length})
                  </h5>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {activeResume.parsed_json.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 text-xs font-medium bg-white text-indigo-700 rounded-lg border border-indigo-200 shadow-2xs"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Experience Bullets */}
              {activeResume.parsed_json?.experience && activeResume.parsed_json.experience.length > 0 && (
                <div>
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                    Extracted Experience Highlights ({activeResume.parsed_json.experience.length})
                  </h5>
                  <ul className="space-y-1.5 text-xs text-slate-600 max-h-36 overflow-y-auto">
                    {activeResume.parsed_json.experience.slice(0, 4).map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-indigo-400 mt-1">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-100 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
