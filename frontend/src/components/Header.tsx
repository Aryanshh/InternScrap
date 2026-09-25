import React, { useState, useRef, useEffect } from 'react';
import {
  Briefcase,
  RefreshCw,
  User,
  ChevronDown,
  Home,
  Compass,
  LogOut,
  FolderKanban,
  Send,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';
import { LoginProfileSummary } from '../types/job';

interface HeaderProps {
  activeView: 'home' | 'daily21' | 'google_forms' | 'listings' | 'tracker' | 'profile';
  trackedCount: number;
  activeUserId: string;
  loginProfiles: LoginProfileSummary[];
  isSyncing: boolean;
  onViewChange: (view: 'home' | 'daily21' | 'google_forms' | 'listings' | 'tracker' | 'profile') => void;
  onLogout: () => void;
  onSync: () => void;
  onOpenAutoApplier?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  trackedCount,
  activeUserId,
  loginProfiles,
  isSyncing,
  onViewChange,
  onLogout,
  onSync,
  onOpenAutoApplier,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentProfile = loginProfiles.find((p) => p.id === activeUserId);

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* 1. Logo & Brand Mark */}
          <div
            className="flex items-center space-x-2.5 shrink-0 cursor-pointer group select-none"
            onClick={() => onViewChange('home')}
            title="InternScrap Home"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs group-hover:bg-indigo-600 transition-colors duration-200">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                InternScrap
              </span>
              <span className="hidden md:inline-flex text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200/70">
                PRO
              </span>
            </div>
          </div>

          {/* 2. Streamlined Navigation Pill Switcher */}
          <nav className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 text-xs font-semibold shrink-0 shadow-2xs">
            <button
              onClick={() => onViewChange('home')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer interactive-button ${
                activeView === 'home'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => onViewChange('daily21')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer interactive-button ${
                activeView === 'daily21'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Daily 21</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold tabular-nums">
                21
              </span>
            </button>

            <button
              onClick={() => onViewChange('google_forms')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer interactive-button ${
                activeView === 'google_forms'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Google Forms</span>
            </button>

            <button
              onClick={() => onViewChange('listings')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer interactive-button ${
                activeView === 'listings'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Listings</span>
            </button>

            <button
              onClick={() => onViewChange('tracker')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer interactive-button ${
                activeView === 'tracker'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Tracker</span>
              {trackedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/80 text-slate-700 font-bold tabular-nums">
                  {trackedCount}
                </span>
              )}
            </button>
          </nav>

          {/* 3. Right Header Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Auto Applier Action Button */}
            {onOpenAutoApplier && (
              <button
                onClick={onOpenAutoApplier}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs hover:shadow-sm interactive-button whitespace-nowrap cursor-pointer"
                title="Launch Auto Applier & IIM Resume Engine"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-medium">Auto Applier</span>
              </button>
            )}

            {/* Sync APIs Action Button */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all shadow-2xs interactive-button disabled:opacity-60 whitespace-nowrap cursor-pointer"
              title="Sync latest jobs from all remote sources"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:mr-1.5 text-slate-500 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden md:inline">{isSyncing ? 'Syncing...' : 'Sync Feeds'}</span>
            </button>

            {/* User Profile Dropdown Menu */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition-all cursor-pointer shadow-2xs interactive-button"
                title="Account menu"
              >
                <div className="relative">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                    {currentProfile?.avatar || activeUserId.charAt(0).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
                <div className="text-left hidden lg:block">
                  <span className="text-xs font-bold text-slate-900 leading-tight block truncate max-w-[100px]">
                    {currentProfile?.id || activeUserId}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isProfileMenuOpen ? 'rotate-180 text-slate-600' : ''
                  }`}
                />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Active Account
                    </span>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {currentProfile?.full_name || activeUserId}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200/80 shrink-0">
                        @{activeUserId}
                      </span>
                    </div>
                  </div>

                  {/* Sub-view shortcuts */}
                  <div className="py-1.5 border-b border-slate-100">
                    <button
                      onClick={() => {
                        onViewChange('profile');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center space-x-2.5 transition-colors cursor-pointer"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Candidate Dossier &amp; Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        onViewChange('tracker');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-2.5">
                        <FolderKanban className="w-4 h-4 text-slate-400" />
                        <span>Application Tracker</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold tabular-nums">
                        {trackedCount}
                      </span>
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="pt-1.5">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
