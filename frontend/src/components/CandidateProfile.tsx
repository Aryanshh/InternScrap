import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Github,
  Linkedin,
  DollarSign,
  Briefcase,
  GraduationCap,
  Plus,
  Trash2,
  CheckCircle2,
  Download,
  RefreshCw,
  Sparkles,
  Sliders,
  X,
  Building,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';
import { UserProfile, WorkExperienceItem, EducationItem, LoginProfileSummary } from '../types/job';
import { getProfile, updateProfile, syncProfileFromResume, getProfileDocxUrl } from '../api/client';

const MODERN_REMOTE_PLATFORMS = [
  { id: 'Wellfound', name: 'Wellfound (AngelList)', tag: 'Top Tech Startups', color: 'border-red-200 bg-red-50 text-red-700' },
  { id: 'Outlier', name: 'Outlier AI', tag: '$40 - $100/hr AI Training', color: 'border-blue-200 bg-blue-50 text-blue-700' },
  { id: 'Mercor', name: 'Mercor', tag: 'Vetted AI & Dev Contracts', color: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { id: 'Alignerr', name: 'Alignerr', tag: 'LLM Alignment & Code', color: 'border-purple-200 bg-purple-50 text-purple-700' },
  { id: 'Mindrift', name: 'Mindrift', tag: 'GenAI & Domain Expert', color: 'border-amber-200 bg-amber-50 text-amber-700' },
  { id: 'Turing', name: 'Turing', tag: 'Global Tech Roles', color: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
];

const SUGGESTED_SKILLS = [
  'Python', 'FastAPI', 'React', 'TypeScript', 'Node.js', 'PostgreSQL',
  'PyTorch', 'LangChain', 'Vector DB', 'Prompt Engineering', 'Tailwind CSS',
  'Docker', 'AWS', 'REST APIs', 'Git', 'Data Structures', 'LLM Evaluation'
];

interface CandidateProfileProps {
  activeUserId: string;
  loginProfiles: LoginProfileSummary[];
  onSwitchProfile: (userId: string) => void;
  onNavigateToListingsWithSource?: (source: string) => void;
}

export const CandidateProfile: React.FC<CandidateProfileProps> = ({
  activeUserId,
  loginProfiles,
  onSwitchProfile,
  onNavigateToListingsWithSource,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newSkillInput, setNewSkillInput] = useState('');
  
  // New Experience State Modal
  const [showAddExp, setShowAddExp] = useState(false);
  const [newExp, setNewExp] = useState<WorkExperienceItem>({
    company: '',
    role: '',
    location: 'Remote',
    start_date: '',
    end_date: 'Present',
    bullets: [''],
  });

  // New Education State Modal
  const [showAddEdu, setShowAddEdu] = useState(false);
  const [newEdu, setNewEdu] = useState<EducationItem>({
    institution: '',
    degree: '',
    grad_year: '2025',
    gpa: '',
  });

  useEffect(() => {
    fetchProfileData();
  }, [activeUserId]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const data = await getProfile(activeUserId);
      setProfile(data);
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setStatusMessage({ type: 'error', text: `Failed to load profile for ${activeUserId}.` });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      await updateProfile(profile, activeUserId);
      setStatusMessage({ type: 'success', text: `Profile updated for ${profile.full_name} (${activeUserId})!` });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Save failed:', err);
      setStatusMessage({ type: 'error', text: 'Failed to save profile changes.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncResume = async () => {
    try {
      setSyncing(true);
      const res = await syncProfileFromResume(activeUserId);
      setStatusMessage({ type: 'success', text: res.message || 'Synced skills and profile from active resume!' });
      await fetchProfileData();
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      console.error('Sync error:', err);
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to sync. Please ensure a resume is uploaded first.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const togglePlatform = (platformId: string) => {
    if (!profile) return;
    const current = profile.target_platforms || [];
    const updated = current.includes(platformId)
      ? current.filter((p) => p !== platformId)
      : [...current, platformId];
    setProfile({ ...profile, target_platforms: updated });
  };

  const addSkill = (skill: string) => {
    if (!profile) return;
    const clean = skill.trim();
    if (!clean) return;
    if (profile.skills.includes(clean)) return;
    setProfile({ ...profile, skills: [...profile.skills, clean] });
    setNewSkillInput('');
  };

  const removeSkill = (skillToRemove: string) => {
    if (!profile) return;
    setProfile({ ...profile, skills: profile.skills.filter((s) => s !== skillToRemove) });
  };

  const addExperience = () => {
    if (!profile) return;
    if (!newExp.company || !newExp.role) return;
    const filteredBullets = newExp.bullets.map((b) => b.trim()).filter(Boolean);
    const expItem: WorkExperienceItem = { ...newExp, bullets: filteredBullets };
    setProfile({ ...profile, experience: [expItem, ...profile.experience] });
    setNewExp({ company: '', role: '', location: 'Remote', start_date: '', end_date: 'Present', bullets: [''] });
    setShowAddExp(false);
  };

  const removeExperience = (index: number) => {
    if (!profile) return;
    const updated = [...profile.experience];
    updated.splice(index, 1);
    setProfile({ ...profile, experience: updated });
  };

  const addEducation = () => {
    if (!profile) return;
    if (!newEdu.institution || !newEdu.degree) return;
    setProfile({ ...profile, education: [...profile.education, { ...newEdu }] });
    setNewEdu({ institution: '', degree: '', grad_year: '2025', gpa: '' });
    setShowAddEdu(false);
  };

  const removeEducation = (index: number) => {
    if (!profile) return;
    const updated = [...profile.education];
    updated.splice(index, 1);
    setProfile({ ...profile, education: updated });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-slate-600 font-medium">Loading Candidate Profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Profile could not be loaded.</p>
        <button
          onClick={fetchProfileData}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Toast Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm shadow-sm transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <X className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Login Profiles Switcher Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <User className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block leading-none">
              Candidate Login Profiles
            </span>
            <span className="text-[11px] text-slate-500">
              Select one of the 3 profiles to switch account & view
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {loginProfiles.map((p) => {
            const isActive = p.id === activeUserId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSwitchProfile(p.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {p.avatar}
                </div>
                <span>{p.full_name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {p.role_tag}
                </span>
                {isActive && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-2xl shadow-md shadow-indigo-100 shrink-0">
              {profile.full_name ? profile.full_name.charAt(0) : 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {profile.full_name || 'Candidate Profile'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Active Candidate
                </span>
                {profile.active_resume && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Synced with {profile.active_resume.filename}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-slate-600 mt-1">
                {profile.headline || 'Software Engineer & AI Evaluator'}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
                {profile.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {profile.location}
                  </span>
                )}
                {profile.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {profile.email}
                  </span>
                )}
                {profile.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {profile.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto justify-end">
            <button
              onClick={handleSyncResume}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all shadow-xs disabled:opacity-50"
              title="Extract latest skills & experience from active uploaded resume"
            >
              <Sparkles className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync from Resume'}</span>
            </button>

            <a
              href={getProfileDocxUrl(activeUserId)}
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all shadow-xs"
              title="Download compiled profile resume formatted for ATS scanners"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Export ATS DOCX</span>
            </a>

            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal Info, Links & Alert Preferences (1 Col) */}
        <div className="space-y-6">
          {/* Contact Details Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base pb-2 border-b border-slate-100">
              <User className="w-4 h-4 text-indigo-600" />
              <span>Personal Details</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Full Name</label>
              <input
                type="text"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="e.g. Alex Johnson"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Headline / Role</label>
              <input
                type="text"
                value={profile.headline || ''}
                onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                placeholder="e.g. Full-Stack Engineer & AI Specialist"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
              <input
                type="email"
                value={profile.email || ''}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="you@domain.com"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number</label>
              <input
                type="text"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="+1 (555) 019-2834"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Primary Location</label>
              <input
                type="text"
                value={profile.location || ''}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                placeholder="City, State / Remote"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Bio / Summary</label>
              <textarea
                rows={3}
                value={profile.bio || ''}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder="Brief professional summary highlight..."
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
              />
            </div>
          </div>

          {/* Social Links Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base pb-2 border-b border-slate-100">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>Online Profiles & Links</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">GitHub Profile</label>
              <div className="relative">
                <Github className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="url"
                  value={profile.github_url || ''}
                  onChange={(e) => setProfile({ ...profile, github_url: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">LinkedIn Profile</label>
              <div className="relative">
                <Linkedin className="w-4 h-4 absolute left-3 top-2.5 text-blue-600" />
                <input
                  type="url"
                  value={profile.linkedin_url || ''}
                  onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Portfolio / Personal Site</label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3 top-2.5 text-emerald-600" />
                <input
                  type="url"
                  value={profile.portfolio_url || ''}
                  onChange={(e) => setProfile({ ...profile, portfolio_url: e.target.value })}
                  placeholder="https://myportfolio.dev"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Email Digest & Alert Preferences */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base pb-2 border-b border-slate-100">
              <Mail className="w-4 h-4 text-indigo-600" />
              <span>Automated Digest Preferences</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-800">Email Digest Alerts</span>
                <p className="text-xs text-slate-500">Send high match jobs automatically</p>
              </div>
              <input
                type="checkbox"
                checked={profile.digest_enabled}
                onChange={(e) => setProfile({ ...profile, digest_enabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Frequency</label>
              <select
                value={profile.digest_frequency}
                onChange={(e) => setProfile({ ...profile, digest_frequency: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="4h">Every 4 Hours</option>
                <option value="12h">Every 12 Hours</option>
                <option value="daily">Daily Digest (Once a day)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-1">
                <span>Minimum Match Score Cutoff</span>
                <span className="text-indigo-600 font-bold">{Math.round((profile.digest_min_score || 0.65) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.3"
                max="0.9"
                step="0.05"
                value={profile.digest_min_score || 0.65}
                onChange={(e) => setProfile({ ...profile, digest_min_score: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Middle & Right Column: Work Preferences, Platforms, Skills & Experience (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Target Work Preferences & Modern Platforms */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base pb-2 border-b border-slate-100">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              <span>Work Mode & Modern Remote Platforms</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Desired Work Mode</label>
                <select
                  value={profile.desired_work_mode}
                  onChange={(e) => setProfile({ ...profile, desired_work_mode: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="remote">Remote Only</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="on-site">On-site</option>
                  <option value="any">Flexible (Any)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Min Hourly Rate ($/hr)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    min="10"
                    max="300"
                    value={profile.min_hourly_rate || ''}
                    onChange={(e) => setProfile({ ...profile, min_hourly_rate: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g. 50"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Min Annual Base ($/yr)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    step="5000"
                    value={profile.min_salary || ''}
                    onChange={(e) => setProfile({ ...profile, min_salary: parseInt(e.target.value) || 0 })}
                    placeholder="e.g. 90000"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Target Remote Platforms Toggle Badges */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Remote Talent Platforms (Select Platforms of Interest)
                </label>
                <span className="text-xs text-slate-400">
                  {profile.target_platforms.length} selected
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {MODERN_REMOTE_PLATFORMS.map((platform) => {
                  const isSelected = profile.target_platforms.includes(platform.id);
                  return (
                    <div
                      key={platform.id}
                      onClick={() => togglePlatform(platform.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? `${platform.color} ring-2 ring-indigo-400 shadow-xs font-semibold`
                          : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{platform.name}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] opacity-80">{platform.tag}</span>
                        {onNavigateToListingsWithSource && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToListingsWithSource(platform.id);
                            }}
                            className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-0.5"
                            title={`Filter listings by ${platform.name}`}
                          >
                            <span>View</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Skills Taxonomy Manager */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Skills & Competency Taxonomy</span>
                <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {profile.skills.length} Skills
                </span>
              </div>
            </div>

            {/* Current Skills Chips */}
            <div className="flex flex-wrap gap-2 min-h-[44px] p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              {profile.skills.length === 0 ? (
                <span className="text-xs text-slate-400 italic py-1">
                  No skills listed yet. Add manually or sync from your resume above.
                </span>
              ) : (
                profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white text-indigo-800 border border-indigo-200 shadow-2xs group"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                      title={`Remove ${skill}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add Custom Skill Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill(newSkillInput);
                  }
                }}
                placeholder="Type a skill (e.g. PyTorch, Docker, LangChain) and press Enter..."
                className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => addSkill(newSkillInput)}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>

            {/* Suggested Skills Pill Cloud */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Quick-Add Trending & Evaluator Skills
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_SKILLS.filter((s) => !profile.skills.includes(s)).map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => addSkill(skill)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-transparent text-slate-600 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-slate-400" />
                    <span>{skill}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Work Experience Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <span>Work Experience</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {profile.experience.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddExp(!showAddExp)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Position</span>
              </button>
            </div>

            {/* Add Experience Inline Form */}
            {showAddExp && (
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-indigo-900 uppercase">New Position</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Company / Organization</label>
                    <input
                      type="text"
                      value={newExp.company}
                      onChange={(e) => setNewExp({ ...newExp, company: e.target.value })}
                      placeholder="e.g. Outlier AI / Stealth Startup"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Role Title</label>
                    <input
                      type="text"
                      value={newExp.role}
                      onChange={(e) => setNewExp({ ...newExp, role: e.target.value })}
                      placeholder="e.g. AI Evaluator & Software Engineer"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
                    <input
                      type="text"
                      value={newExp.start_date}
                      onChange={(e) => setNewExp({ ...newExp, start_date: e.target.value })}
                      placeholder="e.g. Jun 2023"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
                    <input
                      type="text"
                      value={newExp.end_date}
                      onChange={(e) => setNewExp({ ...newExp, end_date: e.target.value })}
                      placeholder="e.g. Present"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Bullet Point 1</label>
                  <input
                    type="text"
                    value={newExp.bullets[0] || ''}
                    onChange={(e) => setNewExp({ ...newExp, bullets: [e.target.value] })}
                    placeholder="e.g. Designed distributed microservices processing 50k requests/sec."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddExp(false)}
                    className="px-3 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addExperience}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Add Position
                  </button>
                </div>
              </div>
            )}

            {/* Experience List */}
            <div className="space-y-3">
              {profile.experience.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No work experience entries yet.</p>
              ) : (
                profile.experience.map((exp, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{exp.role}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                          <span className="font-semibold text-indigo-700">{exp.company}</span>
                          <span>•</span>
                          <span>{exp.start_date} – {exp.end_date}</span>
                          {exp.location && (
                            <>
                              <span>•</span>
                              <span>{exp.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExperience(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Delete position"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {exp.bullets && exp.bullets.length > 0 && (
                      <ul className="list-disc list-outside pl-4 text-xs text-slate-700 space-y-1 pt-1">
                        {exp.bullets.map((b, bIdx) => (
                          <li key={bIdx}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Education Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                <span>Education & Credentials</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {profile.education.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEdu(!showAddEdu)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Degree</span>
              </button>
            </div>

            {/* Add Education Inline Form */}
            {showAddEdu && (
              <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-indigo-900 uppercase">New Education</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">University / College</label>
                    <input
                      type="text"
                      value={newEdu.institution}
                      onChange={(e) => setNewEdu({ ...newEdu, institution: e.target.value })}
                      placeholder="e.g. Stanford University"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Degree & Major</label>
                    <input
                      type="text"
                      value={newEdu.degree}
                      onChange={(e) => setNewEdu({ ...newEdu, degree: e.target.value })}
                      placeholder="e.g. B.S. Computer Science"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Graduation Year</label>
                    <input
                      type="text"
                      value={newEdu.grad_year}
                      onChange={(e) => setNewEdu({ ...newEdu, grad_year: e.target.value })}
                      placeholder="e.g. 2025"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">GPA (Optional)</label>
                    <input
                      type="text"
                      value={newEdu.gpa || ''}
                      onChange={(e) => setNewEdu({ ...newEdu, gpa: e.target.value })}
                      placeholder="e.g. 3.9/4.0"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddEdu(false)}
                    className="px-3 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={addEducation}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Add Education
                  </button>
                </div>
              </div>
            )}

            {/* Education List */}
            <div className="space-y-3">
              {profile.education.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No education records listed.</p>
              ) : (
                profile.education.map((edu, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{edu.degree}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                        <span className="font-semibold text-indigo-700">{edu.institution}</span>
                        <span>•</span>
                        <span>Graduating {edu.grad_year}</span>
                        {edu.gpa && <span>(GPA: {edu.gpa})</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEducation(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      title="Delete entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
