export interface AdFilters {
  searchText: string;
  dateRange: {
    start: string;
    end: string;
  };
  performanceScore: {
    min: number;
    max: number;
  };
  spend: {
    min: number;
    max: number;
  };
  roas: {
    min: number;
    max: number;
  };
  ctr: {
    min: number;
    max: number;
  };
  clicks: {
    min: number;
    max: number;
  };
  conversions: {
    min: number;
    max: number;
  };
  sortBy: 'performance' | 'spend' | 'roas' | 'ctr' | 'clicks' | 'conversions' | 'name';
  sortOrder: 'asc' | 'desc';
  status: 'all' | 'active' | 'paused';
  showTopPerformers: boolean;
  showLowPerformers: boolean;
}

export const defaultFilters: AdFilters = {
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
};
