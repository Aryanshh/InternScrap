import React from 'react';
import { Search, X, GraduationCap, Target } from 'lucide-react';
import { FilterState } from '../types/job';

interface FilterBarProps {
  filters: FilterState;
  categories: string[];
  sources: string[];
  hasActiveResume: boolean;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onReset: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  categories,
  sources,
  hasActiveResume,
  onFilterChange,
  onReset,
}) => {
  const remoteTypes = [
    { label: 'All', value: 'all' },
    { label: 'Remote', value: 'remote' },
    { label: 'Hybrid', value: 'hybrid' },
    { label: 'On-site', value: 'on-site' },
  ];

  const hasActiveFilters =
    filters.search !== '' ||
    filters.remote_type !== 'all' ||
    filters.category !== 'all' ||
    filters.source !== 'all' ||
    filters.is_internship === true ||
    (filters.min_match_score !== undefined && filters.min_match_score > 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-4 sm:p-5 mb-6">
      {/* Top row: Search input & Internships toggle */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mb-4">
        {/* Search Box */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            placeholder="Search roles, skills, companies, or locations..."
            className="w-full pl-10 pr-16 py-2.5 bg-slate-50/70 border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white transition-all text-slate-800 placeholder-slate-400 font-normal"
          />
          {filters.search ? (
            <button
              onClick={() => onFilterChange({ search: '', page: 1 })}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="absolute inset-y-0 right-0 pr-3 hidden sm:flex items-center pointer-events-none">
              <span className="text-[10px] font-mono font-medium text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">
                Ctrl K
              </span>
            </div>
          )}
        </div>

        {/* Internship Toggle Button & Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onFilterChange({
                is_internship: filters.is_internship ? null : true,
                page: 1,
              })
            }
            className={`interactive-button inline-flex items-center px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer ${
              filters.is_internship
                ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-300'
                : 'bg-amber-50/80 text-amber-900 hover:bg-amber-100/80 border border-amber-200/80'
            }`}
          >
            <GraduationCap className="w-4 h-4 mr-1.5 text-amber-600" />
            <span>Internships Only</span>
          </button>

          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="interactive-button inline-flex items-center px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60 transition-colors cursor-pointer"
              title="Reset all filters"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Remote Platform Quick Filter Badges */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-2 text-xs scrollbar-none">
        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] shrink-0 mr-1.5 select-none">
          Platform:
        </span>
        {[
          { label: 'All Platforms', value: 'all' },
          { label: 'Wellfound', value: 'wellfound' },
          { label: 'Outlier AI', value: 'outlier' },
          { label: 'Mercor', value: 'mercor' },
          { label: 'Alignerr', value: 'alignerr' },
          { label: 'Mindrift', value: 'mindrift' },
          { label: 'Remotive', value: 'remotive' },
          { label: 'Arbeitnow', value: 'arbeitnow' },
        ].map((p) => {
          const active = filters.source.toLowerCase() === p.value.toLowerCase();
          return (
            <button
              key={p.value}
              onClick={() => onFilterChange({ source: p.value, page: 1 })}
              className={`interactive-button px-2.5 py-1 rounded-lg text-xs transition-all shrink-0 cursor-pointer ${
                active
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'bg-slate-100/80 hover:bg-slate-200/70 text-slate-600 font-medium border border-slate-200/50'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Bottom row: Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
        {/* Remote Type Pills */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Work Mode
          </label>
          <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/50">
            {remoteTypes.map((t) => {
              const active = filters.remote_type === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => onFilterChange({ remote_type: t.value, page: 1 })}
                  className={`interactive-button flex-1 text-xs py-1.5 font-medium rounded-lg transition-all cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Dropdown */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => onFilterChange({ category: e.target.value, page: 1 })}
            className="w-full py-2 px-3 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white transition-colors cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Source Dropdown */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Source Platform
          </label>
          <select
            value={filters.source}
            onChange={(e) => onFilterChange({ source: e.target.value, page: 1 })}
            className="w-full py-2 px-3 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white transition-colors cursor-pointer"
          >
            <option value="all">All Sources</option>
            {Array.from(
              new Set([
                ...sources,
                'outlier',
                'mercor',
                'wellfound',
                'alignerr',
                'mindrift',
                'remotive',
                'arbeitnow',
              ])
            ).map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Match Score Threshold Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Match Score
          </label>
          <select
            disabled={!hasActiveResume}
            value={filters.min_match_score || 'all'}
            onChange={(e) =>
              onFilterChange({
                min_match_score: e.target.value === 'all' ? undefined : Number(e.target.value),
                page: 1,
              })
            }
            className="w-full py-2 px-3 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <option value="all">{hasActiveResume ? 'All Scores' : 'Upload Resume First'}</option>
            <option value="70">High Match (70%+)</option>
            <option value="50">Moderate Match (50%+)</option>
            <option value="30">Any Relevance (30%+)</option>
          </select>
        </div>

        {/* Sort Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Sort Order
          </label>
          <select
            value={filters.sort_by}
            onChange={(e) => onFilterChange({ sort_by: e.target.value, page: 1 })}
            className="w-full py-2 px-3 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 focus:bg-white transition-colors cursor-pointer"
          >
            {hasActiveResume && <option value="match_score_desc">Match Score (Highest First)</option>}
            <option value="posted_date_desc">Newest First</option>
            <option value="posted_date_asc">Oldest First</option>
            <option value="title_asc">Role Title (A-Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
