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
import { login, register } from '../api/client';
import { AuthUser } from '../types/job';

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
    <div className="min-h-screen bg-gradient-to-br from-[#070b19] via-[#0d1633] to-[#1e1b4b] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-[#4f46e5] selection:text-white">
      {/* Dynamic background decoration */}
      <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-indigo-500/25 rounded-full blur-3xl pointer-events-none oi-mesh-drift" aria-hidden="true" />
      <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] bg-sky-500/20 rounded-full blur-3xl pointer-events-none oi-mesh-drift" aria-hidden="true" />

      <div className={`sm:mx-auto sm:w-full relative z-10 px-4 transition-all duration-300 ${isRegister ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-[#f6f8fe] mb-4 transform hover:scale-105 transition-transform duration-500 ease-premium">
            <Briefcase className="w-7 h-7 text-white" />
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal tracking-tight text-[#f6f8fe] mb-2">
            Intern<span className="italic text-[#7dd3fc]">Scrap</span>
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-md leading-relaxed">
            Factual Remote Job Scraping, 1-Page IIM Resumes &amp; Wellfound Auto-Applier
          </p>
        </div>

        {/* Auth Card */}
        <div className="mt-8 bg-[#f6f8fe] py-8 px-6 sm:px-9 rounded-3xl border border-[#dbe2f3] oi-reveal">
          {/* Mode Switch Tabs */}
          <div className="flex bg-[#edf1fc] p-1 rounded-full border border-[#dbe2f3] mb-6 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 rounded-full font-mono text-[11px] uppercase tracking-[0.2em] transition-all duration-300 ease-premium cursor-pointer ${
                !isRegister
                  ? 'bg-[#4f46e5] text-white shadow-sm shadow-indigo-500/25'
                  : 'text-slate-500 hover:text-[#0f172a]'
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
              className={`flex-1 py-2 rounded-full font-mono text-[11px] uppercase tracking-[0.2em] transition-all duration-300 ease-premium cursor-pointer ${
                isRegister
                  ? 'bg-[#4f46e5] text-white shadow-sm shadow-indigo-500/25'
                  : 'text-slate-500 hover:text-[#0f172a]'
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
                    2. Career &amp; Auto-Applier Profile
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
                    <span className="font-semibold">Profile-Only Resume</span>
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
              className="w-full mt-3 py-3.5 px-5 rounded-full bg-[#4338ca] hover:bg-indigo-700 text-[#f6f8fe] font-mono uppercase tracking-[0.25em] text-xs font-medium transition-all duration-500 ease-premium flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer oi-btn-pulse"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isRegister ? 'Creating Account & Saving Profile...' : 'Signing In...'}</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? 'Create Account & Launch Dashboard' : 'Sign In to Dashboard'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

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
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#4338ca] hover:text-indigo-800 hover:underline cursor-pointer"
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
                  className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#4338ca] hover:text-indigo-800 hover:underline cursor-pointer"
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
