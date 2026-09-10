import React, { useState } from 'react';
import { X, Sparkles, Check, PlusCircle } from 'lucide-react';
import { createManualJob } from '../api/client';
import { Job } from '../types/job';

interface ManualJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobAdded: (job: Job) => void;
}

export const ManualJobModal: React.FC<ManualJobModalProps> = ({
  isOpen,
  onClose,
  onJobAdded,
}) => {
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [remoteType, setRemoteType] = useState('remote');
  const [category, setCategory] = useState('Software Engineering');
  const [isInternship, setIsInternship] = useState(false);
  const [applyUrl, setApplyUrl] = useState('');
  const [salaryRange, setSalaryRange] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !company.trim() || !description.trim()) {
      setError('Please fill in Job Title, Company, and Job Description.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const newJob = await createManualJob({
        title,
        company,
        location: location || 'Remote / Worldwide',
        remote_type: remoteType,
        category,
        is_internship: isInternship,
        description,
        apply_url: applyUrl || undefined,
        salary_range: salaryRange || undefined,
      });

      onJobAdded(newJob);
      onClose();
      // Reset form
      setTitle('');
      setCompany('');
      setLocation('');
      setDescription('');
      setApplyUrl('');
      setSalaryRange('');
      setIsInternship(false);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to save job. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-600" />
              Manual Job Intake
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste listings from LinkedIn, Indeed, Internshala, or Unstop for tailoring
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Manual Intake Info Banner */}
        <div className="mt-4 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-start gap-2.5 text-xs text-indigo-900">
          <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Private Manual Intake:</strong> Add external listings from LinkedIn, Indeed, or Unstop to privately match, evaluate skills, and tailor your resume against those roles.
          </div>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frontend Engineer / Summer Intern"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Stripe, Acme Corp"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Work Mode
              </label>
              <select
                value={remoteType}
                onChange={(e) => setRemoteType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on-site">On-site</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA / Remote"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Software, Data, Design"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Apply / Posting URL
              </label>
              <input
                type="url"
                value={applyUrl}
                onChange={(e) => setApplyUrl(e.target.value)}
                placeholder="https://linkedin.com/jobs/view/..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Salary Range (Optional)
              </label>
              <input
                type="text"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                placeholder="e.g. $80k - $110k or $30/hr"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Internship Checkbox */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="internship-check"
              checked={isInternship}
              onChange={(e) => setIsInternship(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <label htmlFor="internship-check" className="text-xs font-semibold text-slate-700 cursor-pointer">
              This is an Internship / Co-op / Fellowship listing
            </label>
          </div>

          {/* Job Description Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Job Description *
            </label>
            <textarea
              required
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the full job description, requirements, responsibilities, and required tech stack here..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-y"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-100 disabled:opacity-60 transition-all"
            >
              {isSubmitting ? 'Saving...' : 'Add Job Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
