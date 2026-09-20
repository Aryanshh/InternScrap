import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileText,
  Layers,
  Globe,
  Check,
} from 'lucide-react';
import { login, register, getAuthPresets } from '../api/client';
import { AuthUser, UserPreset } from '../types/job';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

const COMMON_ROLES = [
  'Full-Stack Software Engineer',
  'Frontend Engineer (React/TypeScript)',
  'Backend Engineer (Python/FastAPI/Go)',
  'AI & Machine Learning Engineer',
  'Data Scientist & Analytics',
  'Mobile Developer (iOS/Android)',
  'DevOps & Cloud Infrastructure',
  'Product Manager',
  'Other (Custom Role)',
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [primaryRole, setPrimaryRole] = useState(COMMON_ROLES[0]);
  const [customRole, setCustomRole] = useState('');
  const [desiredWorkMode, setDesiredWorkMode] = useState('Remote');
  const [yearsOfExperience, setYearsOfExperience] = useState(2);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [presets, setPresets] = useState<UserPreset[]>([
    { id: 'demo', name: 'Demo Candidate', role: 'Full mock profile for testing', preset_pwd: 'demo123' },
    { id: 'Aryanshh', name: 'Aryanshh Srivastava', role: 'Blank profile (Setup your own)', preset_pwd: 'Aryanshh123' },
    { id: 'Nishtha', name: 'Nishtha Maheshwari', role: 'Blank profile (Setup your own)', preset_pwd: 'Nishtha123' },
  ]);

  useEffect(() => {
    getAuthPresets()
      .then((data) => {
        if (data && data.length > 0) setPresets(data);
      })
      .catch(() => {});
  }, []);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200', text: 'text-slate-400' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-600' };
    if (score <= 3) return { score: 2, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-600' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-600' };
  };

  const strength = getPasswordStrength(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handlePresetSelect = async (preset: UserPreset) => {
    setUsername(preset.id);
    setPassword(preset.preset_pwd);
    setErrorMsg(null);
    try {
      setIsLoading(true);
      const res = await login(preset.id, preset.preset_pwd);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to sign in with preset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername) {
      setErrorMsg('Please enter your login ID or username.');
      return;
    }
    if (!cleanPassword) {
      setErrorMsg('Please enter your password.');
      return;
    }

    if (isRegister) {
      if (!fullName.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (!email.trim() || !/\S+@\S+\.\S+/.test(email.trim())) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }
      if (cleanUsername.length < 3) {
        setErrorMsg('Username must be at least 3 characters long.');
        return;
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        setErrorMsg('Username can only contain letters, numbers, hyphens, periods, and underscores.');
        return;
      }
      if (cleanPassword.length < 6) {
        setErrorMsg('Password must be at least 6 characters long.');
        return;
      }
      if (cleanPassword !== confirmPassword.trim()) {
        setErrorMsg('Passwords do not match. Please verify both password fields.');
        return;
      }
      if (primaryRole === 'Other (Custom Role)' && !customRole.trim()) {
        setErrorMsg('Please enter your custom role title.');
        return;
      }
    }

    try {
      setIsLoading(true);
      if (isRegister) {
        const finalRole = primaryRole === 'Other (Custom Role)' ? customRole.trim() : primaryRole;
        const res = await register({
          username: cleanUsername,
          password: cleanPassword,
          full_name: fullName.trim(),
          email: email.trim(),
          primary_role: finalRole,
          desired_work_mode: desiredWorkMode,
          years_of_experience: Number(yearsOfExperience) || 0,
        });
        if (res.success && res.user) {
          onLoginSuccess(res.user);
        }
      } else {
        const res = await login(cleanUsername, cleanPassword);
        if (res.success && res.user) {
          onLoginSuccess(res.user);
        }
      }
    } catch (err: any) {
      console.error('Auth error', err);
      const detail = err.response?.data?.detail || 'Authentication failed. Please check your credentials.';
      setErrorMsg(detail);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-10 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Dynamic background decoration */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className={`sm:mx-auto sm:w-full relative z-10 px-4 transition-all duration-300 ${isRegister ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-3 transform hover:scale-105 transition-transform duration-300">
            <Briefcase className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
            InternScrap
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-sm font-medium">
            Factual Remote Job Scraping, 1-Page IIM Resumes &amp; Wellfound Auto-Applier
          </p>
        </div>

        {/* Auth Card */}
        <div className="mt-7 bg-white/95 backdrop-blur-md py-8 px-6 sm:px-8 rounded-3xl shadow-2xl border border-white/20">
          {/* Mode Switch Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/80 mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                !isRegister
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
                isRegister
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Registration Alert: </span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister ? (
              /* Create Account Multi-Section Form */
              <div className="space-y-5">
                {/* Section 1: Account Credentials */}
                <div>
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mb-2">
                    1. Account Credentials
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Full Name
                      </label>
                      <div className="relative rounded-xl shadow-2xs">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Aryanshh Srivastava"
                          className="block w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Email Address
                      </label>
                      <div className="relative rounded-xl shadow-2xs">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Mail className="w-4 h-4" />
                        </div>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="aryan@example.com"
                          className="block w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 font-mono"
                        />
                      </div>
                    </div>

                    {/* Username */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Username / Login ID
                        </label>
                        <span className="text-[10px] text-slate-400">
                          Letters, numbers, underscores (min 3 chars)
                        </span>
                      </div>
                      <div className="relative rounded-xl shadow-2xs">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="e.g. aryanshh"
                          className="block w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Password
                      </label>
                      <div className="relative rounded-xl shadow-2xs">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="block w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Live Password Strength Meter */}
                      {password && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                            <div className={`h-full flex-1 ${strength.score >= 1 ? strength.color : 'bg-slate-200'}`} />
                            <div className={`h-full flex-1 ${strength.score >= 2 ? strength.color : 'bg-slate-200'}`} />
                            <div className={`h-full flex-1 ${strength.score >= 3 ? strength.color : 'bg-slate-200'}`} />
                          </div>
                          <span className={`text-[10px] font-bold ${strength.text}`}>{strength.label}</span>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Confirm Password
                      </label>
                      <div className="relative rounded-xl shadow-2xs">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className={`block w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 border rounded-xl focus:ring-2 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 ${
                            confirmPassword && !passwordsMatch
                              ? 'border-rose-300 focus:ring-rose-500'
                              : confirmPassword && passwordsMatch
                              ? 'border-emerald-300 focus:ring-emerald-500'
                              : 'border-slate-200 focus:ring-indigo-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {confirmPassword && (
                        <div className="mt-1 text-[10px]">
                          {passwordsMatch ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Passwords match</span>
                            </span>
                          ) : (
                            <span className="text-rose-600 font-semibold">Passwords do not match</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2: Career & Auto-Applier Profile Defaults */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mb-2">
                    2. Career &amp; Auto-Applier Dossier
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Primary Role */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Primary Target Role
                      </label>
                      <select
                        value={primaryRole}
                        onChange={(e) => setPrimaryRole(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      >
                        {COMMON_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      {primaryRole === 'Other (Custom Role)' && (
                        <input
                          type="text"
                          required
                          value={customRole}
                          onChange={(e) => setCustomRole(e.target.value)}
                          placeholder="e.g. Distributed Systems & Core Infra Engineer"
                          className="mt-2 w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </div>

                    {/* Desired Work Mode */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Desired Work Mode
                      </label>
                      <select
                        value={desiredWorkMode}
                        onChange={(e) => setDesiredWorkMode(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      >
                        <option value="Remote">Remote Only</option>
                        <option value="Hybrid">Hybrid</option>
                        <option value="In-Office">In-Office</option>
                        <option value="Any">Flexible / Open to Any</option>
                      </select>
                    </div>

                    {/* Years of Experience */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Experience Level
                      </label>
                      <select
                        value={yearsOfExperience}
                        onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      >
                        <option value={0}>Entry-Level / Graduate (0-1 yrs)</option>
                        <option value={2}>Junior to Mid-Level (1-3 yrs)</option>
                        <option value={4}>Mid to Senior-Level (3-5 yrs)</option>
                        <option value={6}>Senior / Lead (5+ yrs)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Trust Guarantee Highlights */}
                <div className="p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-indigo-900">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="font-semibold">Zero AI Plagiarism</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="font-semibold">1-Page IIM Resumes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="font-semibold">Wellfound ATS Sync</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Sign In Form */
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Login ID, Username, or Email
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username or email address"
                      className="block w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative rounded-xl shadow-2xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="block w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Submit Button */}
            <button
              type="submit"
              disabled={isLoading || (isRegister && Boolean(confirmPassword && !passwordsMatch))}
              className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-md shadow-indigo-200 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isRegister ? 'Creating Account & Setting Dossier...' : 'Signing In...'}</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? 'Create Account & Launch Dashboard' : 'Sign In to Dashboard'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Profiles (Available on Sign In) */}
          {!isRegister && presets.length > 0 && (
            <div className="mt-6 pt-5 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
                Or Sign In with Demo Account
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetSelect(p)}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 transition-all text-left cursor-pointer group"
                  >
                    <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 block truncate">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      @{p.id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Toggle between Sign In / Create Account */}
          <div className="mt-5 text-center text-xs text-slate-500">
            {isRegister ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrorMsg(null);
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrorMsg(null);
                  }}
                  className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                >
                  Create Account
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
