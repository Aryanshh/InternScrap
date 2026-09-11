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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-6">
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
            placeholder="Search by role, company, skills, or location..."
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '', page: 1 })}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Internship Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onFilterChange({
                is_internship: filters.is_internship ? null : true,
                page: 1,
              })
            }
            className={`inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm ${
              filters.is_internship
                ? 'bg-amber-500 text-white shadow-amber-200 ring-2 ring-amber-300'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <GraduationCap className="w-4 h-4 mr-1.5" />
            <span>Internships Only</span>
          </button>

          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="inline-flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Reset all filters"
            >
              <X className="w-4 h-4 mr-1" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Modern Remote Platform Quick Filter Badges */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-2 text-xs scrollbar-none">
        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] shrink-0 mr-1">
          Platforms:
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
              className={`px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                active
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold ring-2 ring-indigo-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
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
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Work Mode
          </label>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {remoteTypes.map((t) => {
              const active = filters.remote_type === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => onFilterChange({ remote_type: t.value, page: 1 })}
                  className={`flex-1 text-xs py-1.5 font-medium rounded-lg transition-all ${
                    active
                      ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
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
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => onFilterChange({ category: e.target.value, page: 1 })}
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Source Platform
          </label>
          <select
            value={filters.source}
            onChange={(e) => onFilterChange({ source: e.target.value, page: 1 })}
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
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
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="all">{hasActiveResume ? 'All Scores' : 'Upload Resume First'}</option>
            <option value="70">High Match (70%+)</option>
            <option value="50">Moderate Match (50%+)</option>
            <option value="30">Any Relevance (30%+)</option>
          </select>
        </div>

        {/* Sort Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Sort Order
          </label>
          <select
            value={filters.sort_by}
            onChange={(e) => onFilterChange({ sort_by: e.target.value, page: 1 })}
            className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
