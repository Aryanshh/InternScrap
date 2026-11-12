import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  FolderKanban,
  LogOut,
  RefreshCw,
  Send,
  User,
} from 'lucide-react';
import { LoginProfileSummary } from '../types/job';

interface HeaderProps {
  activeView: 'home' | 'daily21' | 'threads' | 'google_forms' | 'listings' | 'tracker' | 'profile';
  trackedCount: number;
  activeUserId: string;
  loginProfiles: LoginProfileSummary[];
  isSyncing: boolean;
  onViewChange: (view: 'home' | 'daily21' | 'threads' | 'google_forms' | 'listings' | 'tracker' | 'profile') => void;
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentProfile = loginProfiles.find((p) => p.id === activeUserId);

  const navItems: Array<{
    id: HeaderProps['activeView'];
    label: string;
    badge?: string | number;
  }> = [
    { id: 'home', label: 'Home' },
    { id: 'daily21', label: 'Daily 21', badge: 21 },
    { id: 'google_forms', label: 'Forms' },
    { id: 'listings', label: 'Listings' },
    { id: 'tracker', label: 'Tracker', badge: trackedCount > 0 ? trackedCount : undefined },
    { id: 'threads', label: 'Threads' },
  ];

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 h-20 mix-blend-difference text-white">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* 1. Far Left: Italic Serif Brand Logo */}
          <button
            type="button"
            onClick={() => onViewChange('home')}
            className="flex items-baseline gap-2.5 shrink-0 cursor-pointer group focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4"
            title="InternScrap Home"
          >
            <span className="font-serif italic font-bold text-xl sm:text-2xl tracking-tight text-white">
              InternScrap
            </span>
          </button>

          {/* 2. Center: Monospace Navigation Links with 1px Growing Underline */}
          <nav
            aria-label="Primary"
            className="flex flex-nowrap items-center gap-3 sm:gap-5 overflow-x-auto scrollbar-none py-1 shrink min-w-0"
          >
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onViewChange(item.id)}
                  data-active={isActive ? 'true' : 'false'}
                  className={`oi-link-underline flex-none font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.16em] whitespace-nowrap cursor-pointer transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4 ${
                    isActive ? 'opacity-100 font-bold' : 'opacity-70 hover:opacity-100 font-medium'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-1.5 text-[10px] opacity-80 tabular-nums">
                      [{item.badge}]
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* 3. Right: Pill CTA ('System Online') + Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {onOpenAutoApplier && (
              <button
                type="button"
                onClick={onOpenAutoApplier}
                className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/40 hover:border-white text-white font-mono text-[10px] uppercase tracking-[0.22em] transition-all duration-300 ease-premium cursor-pointer"
                title="Launch Auto Applier & IIM Resume Engine"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
                <span>Auto-Apply</span>
                <Send className="w-3 h-3 ml-1 opacity-80" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              aria-label={isSyncing ? 'Syncing remote job feeds' : 'Sync remote job feeds'}
              className="inline-flex items-center p-2 rounded-full border border-white/30 hover:border-white text-white transition-all duration-300 ease-premium disabled:opacity-50 cursor-pointer"
              title="Sync latest jobs from all remote sources"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>

            <button
              ref={triggerRef}
              type="button"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              aria-expanded={isProfileMenuOpen}
              aria-label="Account menu"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-white/35 hover:border-white font-mono text-[10px] uppercase tracking-[0.2em] text-white transition-all duration-300 ease-premium cursor-pointer"
            >
              <span className="font-bold">
                {(currentProfile?.id || activeUserId).slice(0, 10)}
              </span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-300 ease-premium ${
                  isProfileMenuOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </header>

      {/* Account Dropdown Popover rendered outside mix-blend-difference layer for crisp legibility */}
      {isProfileMenuOpen && (
        <div
          ref={menuRef}
          className="fixed top-20 right-4 sm:right-8 z-50 w-72 bg-[#f6f8fe] text-[#0f172a] rounded-2xl border border-[#d4dcf0] shadow-[0_20px_50px_rgba(67,56,202,0.12)] py-2 animate-in fade-in"
        >
          <div className="px-4 py-3 border-b border-[#d4dcf0]">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500 block">
              Active Account
            </span>
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="font-serif italic text-base font-bold text-[#0f172a] truncate">
                {currentProfile?.full_name || activeUserId}
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-[#4338ca] border border-indigo-200/70 shrink-0">
                @{activeUserId}
              </span>
            </div>
          </div>

          <div className="py-1.5 border-b border-[#d4dcf0]">
            {onOpenAutoApplier && (
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  onOpenAutoApplier();
                }}
                className="w-full px-4 py-2 text-left text-xs font-medium text-[#0f172a] hover:bg-indigo-50/70 flex items-center space-x-2.5 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4 text-[#4338ca]" aria-hidden="true" />
                <span>Auto Applier &amp; IIM Resume</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onViewChange('profile');
                setIsProfileMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-xs font-medium text-[#0f172a] hover:bg-indigo-50/70 flex items-center space-x-2.5 transition-colors cursor-pointer"
            >
              <User className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span>Candidate Profile</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onViewChange('tracker');
                setIsProfileMenuOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-xs font-medium text-[#0f172a] hover:bg-indigo-50/70 flex items-center justify-between transition-colors cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <FolderKanban className="w-4 h-4 text-slate-500" aria-hidden="true" />
                <span>Application Tracker</span>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-[#0f172a] font-bold tabular-nums">
                {trackedCount}
              </span>
            </button>
          </div>

          <div className="pt-1.5">
            <button
              type="button"
              onClick={() => {
                setIsProfileMenuOpen(false);
                onLogout();
              }}
              className="w-full px-4 py-2 text-left text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-600" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
