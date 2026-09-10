import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  User,
  ChevronDown,
  Home,
  Compass,
  LogOut,
  FolderKanban,
} from 'lucide-react';
import { LoginProfileSummary } from '../types/job';

interface HeaderProps {
  activeView: 'home' | 'listings' | 'tracker' | 'profile';
  trackedCount: number;
  activeUserId: string;
  loginProfiles: LoginProfileSummary[];
  isSyncing: boolean;
  onViewChange: (view: 'home' | 'listings' | 'tracker' | 'profile') => void;
  onLogout: () => void;
  onSync: () => void;
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
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* 1. Logo & Brand */}
          <div
            className="flex items-center space-x-3 shrink-0 cursor-pointer group select-none"
            onClick={() => onViewChange('home')}
            title="Go to Home Command Center"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 group-hover:shadow-indigo-300 transition-all duration-200 ring-1 ring-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="font-black text-xl sm:text-2xl tracking-tight text-slate-900 font-sans">
                  Intern<span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">Scrap</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 -mt-1 hidden sm:block">
                Career Intelligence
              </span>
            </div>
          </div>

          {/* 2. Streamlined Navigation: Home & Explore Listings */}
          <nav className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200/80 text-xs font-semibold shrink-0">
            <button
              onClick={() => onViewChange('home')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeView === 'home'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            <button
              onClick={() => onViewChange('listings')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeView === 'listings'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Explore Listings</span>
            </button>

            {/* Subtle indicator if currently inside full sub-views */}
            {activeView === 'tracker' && (
              <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 flex items-center gap-1 font-bold whitespace-nowrap">
                <FolderKanban className="w-3.5 h-3.5" />
                <span>Tracker ({trackedCount})</span>
              </span>
            )}
            {activeView === 'profile' && (
              <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 flex items-center gap-1 font-bold whitespace-nowrap">
                <User className="w-3.5 h-3.5" />
                <span>Candidate Profile</span>
              </span>
            )}
          </nav>

          {/* 3. Right Header Actions: User Profile Switcher & Sync APIs */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* User Profile Dropdown Menu */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-800 transition-all cursor-pointer shadow-2xs"
                title="Manage active candidate account or sign out"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  {currentProfile?.avatar || activeUserId.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-[10px] text-slate-500 font-medium block leading-none">Account</span>
                  <span className="text-xs font-bold text-slate-900 leading-tight block truncate max-w-[95px]">
                    {currentProfile?.id || activeUserId}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isProfileMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 animate-in fade-in">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Active Account
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-extrabold text-slate-900">
                        {currentProfile?.full_name || activeUserId}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                        {activeUserId}
                      </span>
                    </div>
                  </div>

                  {/* Sub-view shortcuts */}
                  <div className="py-1 border-b border-slate-100">
                    <button
                      onClick={() => {
                        onViewChange('profile');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center space-x-2"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Edit Candidate Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        onViewChange('tracker');
                        setIsProfileMenuOpen(false);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <FolderKanban className="w-4 h-4 text-slate-400" />
                        <span>Application Tracker</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 font-bold">
                        {trackedCount}
                      </span>
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sync APIs Action Button */}
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-xs shadow-indigo-100 whitespace-nowrap cursor-pointer"
              title="Sync latest jobs from all feeds"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync APIs'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
