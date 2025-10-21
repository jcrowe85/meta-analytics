import React from 'react';
import { FiSearch, FiTrendingUp, FiTrendingDown, FiX, FiFilter } from 'react-icons/fi';
import type { AdFilters } from '../types/filters';

interface FiltersProps {
  filters: AdFilters;
  setFilters: React.Dispatch<React.SetStateAction<AdFilters>>;
  setShowFilters: (show: boolean) => void;
  totalAds: number;
  filteredCount: number;
}

function Filters({ filters, setFilters, setShowFilters, totalAds, filteredCount }: FiltersProps) {
  const updateFilter = (key: keyof AdFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const updateRangeFilter = (key: keyof AdFilters, rangeKey: 'min' | 'max', value: number) => {
    setFilters(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] as any),
        [rangeKey]: value
      }
    }));
  };

  const resetFilters = () => {
    setFilters({
      searchText: '',
      dateRange: { start: '', end: '' },
      performanceScore: { min: 0, max: 100 },
      spend: { min: 0, max: 100000 },
      roas: { min: 0, max: 100 },
      ctr: { min: 0, max: 100 },
      clicks: { min: 0, max: 100000 },
      conversions: { min: 0, max: 10000 },
      sortBy: 'performance',
      sortOrder: 'desc',
      status: 'all',
      showTopPerformers: false,
      showLowPerformers: false,
    });
  };

  const hasActiveFilters = 
    filters.searchText ||
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.performanceScore.min > 0 ||
    filters.performanceScore.max < 100 ||
    filters.spend.min > 0 ||
    filters.spend.max < 100000 ||
    filters.roas.min > 0 ||
    filters.roas.max < 100 ||
    filters.ctr.min > 0 ||
    filters.ctr.max < 100 ||
    filters.clicks.min > 0 ||
    filters.clicks.max < 100000 ||
    filters.conversions.min > 0 ||
    filters.conversions.max < 10000 ||
    filters.status !== 'all' ||
    filters.showTopPerformers ||
    filters.showLowPerformers;

  const modernInputClass = "px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 transition-all text-sm font-medium focus:border-white/20 focus:bg-white/10";

  const RangeSlider = ({ 
    label, 
    value, 
    min, 
    max, 
    step = 1, 
    format = (v: number) => v.toString(),
    onChange 
  }: {
    label: string;
    value: { min: number; max: number };
    min: number;
    max: number;
    step?: number;
    format?: (value: number) => string;
    onChange: (range: { min: number; max: number }) => void;
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-white/80">{label}</label>
        <span className="text-sm text-white/60">
          {format(value.min)} - {format(value.max)}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value.min}
          onChange={(e) => onChange({ min: Number(e.target.value), max: value.max })}
          className="absolute w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((value.min - min) / (max - min)) * 100}%, #374151 ${((value.min - min) / (max - min)) * 100}%, #374151 100%)`
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value.max}
          onChange={(e) => onChange({ min: value.min, max: Number(e.target.value) })}
          className="absolute w-full h-2 bg-transparent rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, transparent 0%, transparent ${((value.max - min) / (max - min)) * 100}%, #3b82f6 ${((value.max - min) / (max - min)) * 100}%, #3b82f6 100%)`
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-white/50">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );

  return (
    <div className="mb-6">
      <div className="bg-white/5 rounded-xl p-6 border border-white/10 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FiFilter className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Filter Ads</h3>
            <span className="text-sm text-white/60">
              {filteredCount} of {totalAds} ads
            </span>
          </div>
          <button
            onClick={() => setShowFilters(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-all"
            title="Close filters"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Search */}
          <div className="lg:col-span-2 xl:col-span-3">
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                value={filters.searchText}
                onChange={(e) => updateFilter('searchText', e.target.value)}
                placeholder="Search ads by name, campaign, or creative..."
                className={`${modernInputClass} pl-12 w-full`}
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80">Date Range</label>
            <div className="flex gap-3">
              <input
                type="date"
                value={filters.dateRange.start}
                onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, start: e.target.value })}
                className={`${modernInputClass} flex-1`}
              />
              <span className="text-white/40 text-sm font-medium self-center">to</span>
              <input
                type="date"
                value={filters.dateRange.end}
                onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, end: e.target.value })}
                className={`${modernInputClass} flex-1`}
              />
            </div>
          </div>

          {/* Sort By */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80">Sort By</label>
            <div className="flex gap-2">
              <select
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className={`${modernInputClass} flex-1`}
              >
                <option value="performance">Performance Score</option>
                <option value="spend">Spend</option>
                <option value="roas">ROAS</option>
                <option value="ctr">CTR</option>
                <option value="clicks">Clicks</option>
                <option value="conversions">Conversions</option>
                <option value="name">Name</option>
              </select>
              <button
                onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-3 bg-white/5 border border-white/10 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
                title={`Sort ${filters.sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {filters.sortOrder === 'asc' ? <FiTrendingUp className="w-4 h-4" /> : <FiTrendingDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white/80">Status</label>
            <select
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
              className={`${modernInputClass} w-full`}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          {/* Performance Score Range */}
          <RangeSlider
            label="Performance Score"
            value={filters.performanceScore}
            min={0}
            max={100}
            format={(v) => `${v}%`}
            onChange={(range) => updateFilter('performanceScore', range)}
          />

          {/* Spend Range */}
          <RangeSlider
            label="Spend"
            value={filters.spend}
            min={0}
            max={100000}
            step={100}
            format={(v) => `$${v.toLocaleString()}`}
            onChange={(range) => updateFilter('spend', range)}
          />

          {/* ROAS Range */}
          <RangeSlider
            label="ROAS"
            value={filters.roas}
            min={0}
            max={100}
            step={1}
            format={(v) => `${v.toFixed(1)}x`}
            onChange={(range) => updateFilter('roas', range)}
          />

          {/* CTR Range */}
          <RangeSlider
            label="CTR"
            value={filters.ctr}
            min={0}
            max={100}
            step={1}
            format={(v) => `${v.toFixed(1)}%`}
            onChange={(range) => updateFilter('ctr', range)}
          />

          {/* Clicks Range */}
          <RangeSlider
            label="Clicks"
            value={filters.clicks}
            min={0}
            max={100000}
            step={100}
            format={(v) => v.toLocaleString()}
            onChange={(range) => updateFilter('clicks', range)}
          />

          {/* Conversions Range */}
          <RangeSlider
            label="Conversions"
            value={filters.conversions}
            min={0}
            max={10000}
            step={10}
            format={(v) => v.toLocaleString()}
            onChange={(range) => updateFilter('conversions', range)}
          />

          {/* Quick Filters */}
          <div className="lg:col-span-2 xl:col-span-3 space-y-3">
            <label className="text-sm font-medium text-white/80">Quick Filters</label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/10 rounded-lg px-4 py-3 transition-all hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={filters.showTopPerformers}
                  onChange={(e) => updateFilter('showTopPerformers', e.target.checked)}
                  className="w-4 h-4 text-blue-500 bg-white/10 border-white/20 rounded focus:ring-blue-500/30"
                />
                <span className="text-sm text-white font-medium flex items-center gap-2">
                  <FiTrendingUp className="w-4 h-4" />
                  Top Performers (80%+)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer bg-white/5 border border-white/10 rounded-lg px-4 py-3 transition-all hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={filters.showLowPerformers}
                  onChange={(e) => updateFilter('showLowPerformers', e.target.checked)}
                  className="w-4 h-4 text-red-500 bg-white/10 border-white/20 rounded focus:ring-red-500/30"
                />
                <span className="text-sm text-white font-medium flex items-center gap-2">
                  <FiTrendingDown className="w-4 h-4" />
                  Low Performers (&lt;40%)
                </span>
              </label>
            </div>
          </div>

          {/* Clear All */}
          {hasActiveFilters && (
            <div className="lg:col-span-2 xl:col-span-3 flex justify-end">
              <button
                onClick={resetFilters}
                className="flex items-center justify-center gap-2 text-sm text-white/70 hover:text-white transition-all px-4 py-3 rounded-lg hover:bg-white/5 border border-white/10 hover:border-white/20"
                title="Clear all filters"
              >
                <FiX className="w-4 h-4" />
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Filters;
