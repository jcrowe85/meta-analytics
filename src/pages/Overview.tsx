import React, { useState, useEffect } from 'react';
import { FiEye, FiMousePointer, FiDollarSign, FiTrendingUp, FiTarget, FiActivity, FiRefreshCw, FiBarChart, FiCalendar, FiClock, FiInfo, FiFilter } from 'react-icons/fi';
import type { AdData, AccountInfo, ApiResponse, SpendData } from '../types';
import type { AdFilters, defaultFilters } from '../types/filters';
import InfiniteAdsList from '../components/InfiniteAdsList';
import Filters from '../components/Filters';

export function Overview() {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [adsSummary, setAdsSummary] = useState({
    totalAds: 0,
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    averageCTR: 0,
    averageCPM: 0
  });
  const [todaySpend, setTodaySpend] = useState<SpendData>({
    spend: 0,
    impressions: 0,
    clicks: 0,
    cpm: 0,
    cpc: 0,
    ctr: 0,
    date: '',
    results: 0,
    costOfResults: 0,
    roas: 0,
    conversionValue: 0,
    conversions: {
      linkClicks: 0,
      landingPageViews: 0,
      contentViews: 0,
      postSaves: 0,
      leads: 0,
      videoViews: 0,
      postEngagements: 0,
      pageEngagements: 0
    }
  });
  const [liveAds, setLiveAds] = useState<AdData[]>([]);
  const [allAds, setAllAds] = useState<AdData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreAds, setHasMoreAds] = useState(true);
  const [loadingMoreAds, setLoadingMoreAds] = useState(false);
  
  // Individual loading states for streaming ingestion
  const [loadingStates, setLoadingStates] = useState({
    account: true,
    ads: true,
    spend: true,
    liveAds: true,
    roas: true
  });
  
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('today');
  const [showCalendarPopup, setShowCalendarPopup] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  
  // Track if any data has loaded to show the page
  const [hasLoadedData, setHasLoadedData] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState<AdFilters>({
    searchText: '',
    dateRange: { start: '', end: '' },
    performanceScore: { min: 0, max: 100 },
    spend: { min: 0, max: 100000 }, // Increased max spend
    roas: { min: 0, max: 100 }, // Increased max ROAS
    ctr: { min: 0, max: 100 }, // Increased max CTR
    clicks: { min: 0, max: 100000 }, // Increased max clicks
    conversions: { min: 0, max: 10000 }, // Increased max conversions
    sortBy: 'performance',
    sortOrder: 'desc',
    status: 'all',
    showTopPerformers: false,
    showLowPerformers: false,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort ads based on current filters
  const getFilteredAndSortedAds = (ads: AdData[]) => {
    console.log('Filtering ads:', { totalAds: ads.length, filters });
    let filtered = ads.filter((ad) => {
      // Search text filter
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const matchesName = ad.name?.toLowerCase().includes(searchLower);
        const matchesTitle = ad.creative?.title?.toLowerCase().includes(searchLower);
        const matchesBody = ad.creative?.body?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesTitle && !matchesBody) return false;
      }

      // Date range filter (if using custom date range)
      if (filters.dateRange.start && ad.created_time) {
        const adDate = new Date(parseInt(ad.created_time) * 1000).toISOString().split('T')[0];
        if (adDate < filters.dateRange.start) return false;
      }
      if (filters.dateRange.end && ad.created_time) {
        const adDate = new Date(parseInt(ad.created_time) * 1000).toISOString().split('T')[0];
        if (adDate > filters.dateRange.end) return false;
      }

      // Status filter
      if (filters.status !== 'all') {
        if (filters.status === 'active' && ad.effective_status !== 'ACTIVE') return false;
        if (filters.status === 'paused' && ad.effective_status !== 'PAUSED') return false;
      }

      // Performance score filter (only if performance_score exists)
      if (ad.performance_score !== undefined && ad.performance_score !== null) {
        if (ad.performance_score < filters.performanceScore.min || ad.performance_score > filters.performanceScore.max) return false;
      }

      // Spend filter (only if spend data exists)
      if (ad.insights?.data?.[0]?.spend !== undefined && ad.insights.data[0].spend !== null) {
        const spend = parseFloat(ad.insights.data[0].spend);
        if (!isNaN(spend) && (spend < filters.spend.min || spend > filters.spend.max)) return false;
      }

      // ROAS filter (calculated from spend and action_values) - only if both exist
      if (ad.insights?.data?.[0]?.spend !== undefined && ad.insights.data[0].spend !== null) {
        const spend = parseFloat(ad.insights.data[0].spend);
        if (!isNaN(spend) && spend > 0) {
          const actionValues = ad.insights.data[0].action_values || [];
          const purchaseValues = actionValues.filter(action => 
            action.action_type.toLowerCase().includes('purchase')
          );
          const totalConversionValue = purchaseValues.reduce((sum, action) => 
            sum + parseFloat(action.value || '0'), 0
          );
          const roas = totalConversionValue / spend;
          if (!isNaN(roas) && (roas < filters.roas.min || roas > filters.roas.max)) return false;
        }
      }

      // CTR filter (only if CTR data exists)
      if (ad.insights?.data?.[0]?.ctr !== undefined && ad.insights.data[0].ctr !== null) {
        const ctr = parseFloat(ad.insights.data[0].ctr);
        if (!isNaN(ctr) && (ctr < filters.ctr.min || ctr > filters.ctr.max)) return false;
      }

      // Clicks filter (only if clicks data exists)
      if (ad.insights?.data?.[0]?.clicks !== undefined && ad.insights.data[0].clicks !== null) {
        const clicks = parseInt(ad.insights.data[0].clicks);
        if (!isNaN(clicks) && (clicks < filters.clicks.min || clicks > filters.clicks.max)) return false;
      }

      // Conversions filter (from actions) - only if actions exist
      if (ad.insights?.data?.[0]?.actions !== undefined && ad.insights.data[0].actions !== null) {
        const actions = ad.insights.data[0].actions || [];
        const purchaseActions = actions.filter(action => 
          action.action_type.toLowerCase().includes('purchase')
        );
        const conversions = purchaseActions.reduce((sum, action) => 
          sum + parseInt(action.value || '0'), 0
        );
        if (!isNaN(conversions) && (conversions < filters.conversions.min || conversions > filters.conversions.max)) return false;
      }

      // Quick filters
      if (filters.showTopPerformers && ad.performance_score !== undefined && ad.performance_score < 80) return false;
      if (filters.showLowPerformers && ad.performance_score !== undefined && ad.performance_score >= 40) return false;

      return true;
    });

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (filters.sortBy) {
        case 'performance':
          aValue = a.performance_score || 0;
          bValue = b.performance_score || 0;
          break;
        case 'spend':
          aValue = parseFloat(a.insights?.data?.[0]?.spend || '0');
          bValue = parseFloat(b.insights?.data?.[0]?.spend || '0');
          break;
        case 'roas':
          const aSpend = parseFloat(a.insights?.data?.[0]?.spend || '0');
          const bSpend = parseFloat(b.insights?.data?.[0]?.spend || '0');
          const aActionValues = a.insights?.data?.[0]?.action_values || [];
          const bActionValues = b.insights?.data?.[0]?.action_values || [];
          const aPurchaseValues = aActionValues.filter(action => 
            action.action_type.toLowerCase().includes('purchase')
          );
          const bPurchaseValues = bActionValues.filter(action => 
            action.action_type.toLowerCase().includes('purchase')
          );
          const aConversionValue = aPurchaseValues.reduce((sum, action) => 
            sum + parseFloat(action.value || '0'), 0
          );
          const bConversionValue = bPurchaseValues.reduce((sum, action) => 
            sum + parseFloat(action.value || '0'), 0
          );
          aValue = aSpend > 0 ? aConversionValue / aSpend : 0;
          bValue = bSpend > 0 ? bConversionValue / bSpend : 0;
          break;
        case 'ctr':
          aValue = parseFloat(a.insights?.data?.[0]?.ctr || '0');
          bValue = parseFloat(b.insights?.data?.[0]?.ctr || '0');
          break;
        case 'clicks':
          aValue = parseInt(a.insights?.data?.[0]?.clicks || '0');
          bValue = parseInt(b.insights?.data?.[0]?.clicks || '0');
          break;
        case 'conversions':
          const aActions = a.insights?.data?.[0]?.actions || [];
          const bActions = b.insights?.data?.[0]?.actions || [];
          const aPurchaseActions = aActions.filter(action => 
            action.action_type.toLowerCase().includes('purchase')
          );
          const bPurchaseActions = bActions.filter(action => 
            action.action_type.toLowerCase().includes('purchase')
          );
          aValue = aPurchaseActions.reduce((sum, action) => 
            sum + parseInt(action.value || '0'), 0
          );
          bValue = bPurchaseActions.reduce((sum, action) => 
            sum + parseInt(action.value || '0'), 0
          );
          break;
        case 'name':
          aValue = a.name || '';
          bValue = b.name || '';
          break;
        default:
          aValue = a.performance_score || 0;
          bValue = b.performance_score || 0;
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    console.log('Filtered result:', { filteredCount: filtered.length });
    return filtered;
  };

  const filteredAds = getFilteredAndSortedAds(allAds);

  // Helper function to get date range based on selection
  const getDateRange = (range: string) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (range === 'custom') {
      return { start: customDateRange.startDate, end: customDateRange.endDate };
    } else if (range === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return { start: yesterdayStr, end: yesterdayStr };
    } else if (range === '7d') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      return { start: weekAgoStr, end: todayStr };
    } else if (range === '30d') {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthAgoStr = monthAgo.toISOString().split('T')[0];
      return { start: monthAgoStr, end: todayStr };
    } else {
      // Default to today
      return { start: todayStr, end: todayStr };
    }
  };

  // Handle time range selection with non-blocking loading
  const handleTimeRangeChange = async (range: string) => {
    if (range === selectedTimeRange) return; // Prevent unnecessary calls
    
    setSelectedTimeRange(range);
    
    // Don't clear existing data - keep it visible while loading new data
    // Just set loading states to show that new data is being fetched
    setLoadingStates({
      account: true,
      ads: true,
      spend: true,
      liveAds: true,
      roas: true
    });
    
    if (range !== 'custom') {
      setShowCalendarPopup(false);
    }
    
    // Trigger immediate data fetch for new time range (non-blocking)
    fetchDataForTimeRange(range);
  };

  // Handle custom date range selection
  const handleCustomDateRange = () => {
    if (customDateRange.startDate && customDateRange.endDate) {
      setSelectedTimeRange('custom');
      setShowCalendarPopup(false);
      // Trigger data refresh with custom range
      fetchDataForTimeRange('custom');
    }
  };

  // New streaming data fetch function with fail-proof mechanism
  const fetchDataForTimeRange = async (timeRange: string) => {
    try {
      // Get the date range based on selection
      const dateRange = getDateRange(timeRange);
      const dateRangeParam = timeRange === 'custom' 
        ? `dateRange=custom&startDate=${dateRange.start}&endDate=${dateRange.end}`
        : `dateRange=${timeRange}`;
      
      console.log(`Fetching data for time range: ${timeRange}`, { dateRange, dateRangeParam });
      
      // Add cache-busting timestamp to ensure fresh data
      const timestamp = Date.now();
      const cacheBuster = `&_t=${timestamp}`;
      
      // Start all API calls in parallel but handle them individually
      const apiCalls = [
        { key: 'account', url: `/api/meta/account?${cacheBuster}`, handler: handleAccountData },
        { key: 'ads', url: `/api/meta/ads?limit=50&${dateRangeParam}${cacheBuster}`, handler: handleAdsData },
        { key: 'spend', url: `/api/meta/today-spend?${dateRangeParam}${cacheBuster}`, handler: handleSpendData },
        { key: 'liveAds', url: `/api/meta/ads?status=ACTIVE&limit=50&${dateRangeParam}${cacheBuster}`, handler: handleLiveAdsData },
        { key: 'roas', url: `/api/roas?${dateRangeParam}${cacheBuster}`, handler: handleRoasData }
      ];
      
          // Execute API calls in parallel with minimal stagger to avoid rate limiting
          const executeApiCall = async (apiCall: any, index: number) => {
            const { key, url, handler } = apiCall;
            
            // Minimal stagger to avoid hitting rate limits simultaneously
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, index * 10)); // 10ms stagger
            }
            
            try {
              setLoadingStates(prev => ({ ...prev, [key]: true }));
              const response = await fetch(url);
              
              if (response.ok) {
                const result = await response.json();
                await handler(result, timeRange);
                setHasLoadedData(true);
              } else {
                console.warn(`Failed to fetch ${key}:`, response.status, response.statusText);
                // Don't set error for individual failures, just log them
              }
            } catch (error) {
              console.error(`Error fetching ${key}:`, error);
              // Don't set error for individual failures, just log them
            } finally {
              setLoadingStates(prev => ({ ...prev, [key]: false }));
            }
          };
          
          // Execute all API calls in parallel
          await Promise.all(apiCalls.map((apiCall, index) => executeApiCall(apiCall, index)));
      
    } catch (error) {
      console.error('Error in fetchDataForTimeRange:', error);
      setError('Failed to load data');
    }
  };

  // Individual data handlers for streaming ingestion
  const handleAccountData = async (result: ApiResponse<AccountInfo>, timeRange: string) => {
    if (result.success) {
      setAccountInfo(result.data);
    }
  };

  const handleAdsData = async (result: ApiResponse<AdData[]>, timeRange: string) => {
    if (result.success) {
      const ads = result.data;
      const totalSpend = ads.reduce((sum, ad) => sum + (ad.metrics?.spend || 0), 0);
      const totalImpressions = ads.reduce((sum, ad) => sum + (ad.metrics?.impressions || 0), 0);
      const totalClicks = ads.reduce((sum, ad) => sum + (ad.metrics?.clicks || 0), 0);
      const totalCTR = ads.reduce((sum, ad) => sum + (ad.metrics?.ctr || 0), 0);
      const totalCPM = ads.reduce((sum, ad) => sum + (ad.metrics?.cpm || 0), 0);

      setAdsSummary(prev => ({
        ...prev,
        totalSpend,
        totalImpressions,
        totalClicks,
        averageCTR: ads.length > 0 ? totalCTR / ads.length : 0,
        averageCPM: ads.length > 0 ? totalCPM / ads.length : 0
      }));
    }
  };

  const handleSpendData = async (result: ApiResponse<any>, timeRange: string) => {
    if (result.success) {
      const data = result.data;
      
      // Extract conversion data from actions array
      const extractConversionData = (actions: any[]) => {
        if (!actions || !Array.isArray(actions)) {
          return {
            linkClicks: 0,
            landingPageViews: 0,
            contentViews: 0,
            postSaves: 0,
            leads: 0,
            videoViews: 0,
            postEngagements: 0,
            pageEngagements: 0
          };
        }

        const conversions = {
          linkClicks: 0,
          landingPageViews: 0,
          contentViews: 0,
          postSaves: 0,
          leads: 0,
          videoViews: 0,
          postEngagements: 0,
          pageEngagements: 0
        };

        actions.forEach(action => {
          switch (action.action_type) {
            case 'link_click':
              conversions.linkClicks = parseInt(action.value) || 0;
              break;
            case 'landing_page_view':
              conversions.landingPageViews = parseInt(action.value) || 0;
              break;
            case 'content_view':
              conversions.contentViews = parseInt(action.value) || 0;
              break;
            case 'post_save':
              conversions.postSaves = parseInt(action.value) || 0;
              break;
            case 'lead':
              conversions.leads = parseInt(action.value) || 0;
              break;
            case 'video_view':
              conversions.videoViews = parseInt(action.value) || 0;
              break;
            case 'post_engagement':
              conversions.postEngagements = parseInt(action.value) || 0;
              break;
            case 'page_engagement':
              conversions.pageEngagements = parseInt(action.value) || 0;
              break;
          }
        });

        return conversions;
      };

      // Extract Results (purchases) and Cost of Results from actions
      const extractResultsData = (actions: any[], spend: number) => {
        if (!actions || !Array.isArray(actions)) {
          return { results: 0, costOfResults: 0 };
        }

        // Find purchase actions - prioritize the most reliable ones
        const purchaseActions = actions.filter(action => 
          action.action_type === 'purchase' || 
          action.action_type === 'onsite_web_purchase' ||
          action.action_type === 'onsite_web_app_purchase' ||
          action.action_type === 'omni_purchase' ||
          action.action_type === 'web_in_store_purchase'
        );

        // Get the highest purchase count (different action types might have different counts)
        const results = Math.max(...purchaseActions.map(action => parseInt(action.value) || 0), 0);
        
        // Calculate cost per result (cost of results)
        const costOfResults = results > 0 ? spend / results : 0;

        return { results, costOfResults };
      };

      const { results, costOfResults } = extractResultsData(data.actions || [], data.spend || 0);

      setTodaySpend(prev => ({
        ...prev,
        ...data,
        results: results,
        costOfResults: costOfResults,
        conversions: extractConversionData(data.actions || [])
      }));
    }
  };

  const handleLiveAdsData = async (result: ApiResponse<AdData[]>, timeRange: string) => {
    if (result.success) {
      setLiveAds(result.data);
      setAllAds(result.data);
      setCurrentPage(1);
      setHasMoreAds(result.data.length >= 200); // Assuming 200 is the limit
      
      // Update ads count in summary
      setAdsSummary(prev => ({
        ...prev,
        totalAds: result.data.length
      }));
    }
  };

  // Load more ads for infinite scroll
  const loadMoreAds = async () => {
    if (loadingMoreAds || !hasMoreAds) return;

    setLoadingMoreAds(true);
    try {
      const nextPage = currentPage + 1;
      const dateRange = getDateRange(selectedTimeRange);
      const dateRangeParam = selectedTimeRange === 'custom' 
        ? `dateRange=custom&startDate=${dateRange.start}&endDate=${dateRange.end}`
        : `dateRange=${selectedTimeRange}`;
      
      const cacheBuster = `&_t=${Date.now()}`;
      const response = await fetch(`/api/meta/ads?status=ACTIVE&limit=200&offset=${(nextPage - 1) * 200}&${dateRangeParam}${cacheBuster}`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.length > 0) {
          setAllAds(prev => [...prev, ...result.data]);
          setCurrentPage(nextPage);
          setHasMoreAds(result.data.length >= 200);
        } else {
          setHasMoreAds(false);
        }
      } else {
        setHasMoreAds(false);
      }
    } catch (error) {
      console.error('Error loading more ads:', error);
      setHasMoreAds(false);
    } finally {
      setLoadingMoreAds(false);
    }
  };

  const handleRoasData = async (result: ApiResponse<any>, timeRange: string) => {
    if (result.success) {
      setTodaySpend(prev => ({
        ...prev,
        roas: result.data.roas || 0,
        conversionValue: result.data.revenue || 0
      }));
    }
  };

  // Legacy function for backward compatibility
  const fetchOverviewData = async () => {
    await fetchDataForTimeRange(selectedTimeRange);
  };

  useEffect(() => {
    fetchOverviewData();
  }, [selectedTimeRange, customDateRange.startDate, customDateRange.endDate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  // Tooltips for performance metrics
  const performanceTooltips: Record<string, string> = {
    'CTR Quality': 'Click-through rate performance. >2% = 40pts, >1% = 30pts, >0.5% = 20pts, >0.1% = 10pts',
    'Click Performance': 'Combines click rate (0-20pts) + volume bonus (0-10pts). Rewards both engagement quality and sufficient data volume.',
    'CPM Efficiency': 'Cost per 1000 impressions. <$5 = 15pts, <$10 = 10pts, <$20 = 5pts, <$50 = 2pts',
    'CPC Efficiency': 'Cost per click. <$0.50 = 15pts, <$1.00 = 12pts, <$2.00 = 10pts, <$3.00 = 7pts, <$5.00 = 5pts',
    'ROAS Performance': 'Return on Ad Spend. >4.0x = 30pts, >3.0x = 25pts, >2.5x = 20pts, >2.0x = 15pts, >1.5x = 10pts, >1.0x = 5pts'
  };

  // Helper function to get time range labels
  const getTimeRangeLabel = (range: string, metric: string) => {
    switch (range) {
      case 'today':
        return `Today's ${metric}`;
      case 'yesterday':
        return `Yesterday's ${metric}`;
      case '7d':
        return `Last 7 Days ${metric}`;
      case '30d':
        return `Last 30 Days ${metric}`;
      case 'custom':
        return `Custom Range ${metric}`;
      default:
        return `${metric}`;
    }
  };

  // Show loading spinner only if no data has loaded yet
  if (!hasLoadedData && Object.values(loadingStates).every(state => state)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">Loading Meta Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
              My Ads
            </h1>
            <p className="text-white/60 text-sm">
              Connected to tryfleur meta ads
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/10 transition-colors">
              {adsSummary.totalAds} ads
            </button>
          </div>
        </div>

        {/* Performance Overview Section with Time Range Selector */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center glass-card">
              <FiBarChart className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Performance Overview</h2>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <FiClock className="w-4 h-4 text-white/50" />
            <div className="flex bg-black/20 backdrop-blur-sm rounded-lg p-1 border border-white/10">
              {['today', 'yesterday', '7d', '30d'].map((range) => (
                <button
                  key={range}
                  onClick={() => handleTimeRangeChange(range)}
                  disabled={loadingStates.spend || loadingStates.ads || loadingStates.roas}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all disabled:opacity-50 ${
                    selectedTimeRange === range
                      ? 'bg-white/20 text-white'
                      : 'text-white/60 hover:text-white/80 hover:bg-white/10'
                  }`}
                >
                  {loadingStates.spend && selectedTimeRange === range ? (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      {range === 'today' ? 'Today' : range === 'yesterday' ? 'Yesterday' : range}
                    </div>
                  ) : (
                    range === 'today' ? 'Today' : range === 'yesterday' ? 'Yesterday' : range
                  )}
                </button>
              ))}
              
              {/* Custom Date Range Button */}
              <button
                onClick={() => setShowCalendarPopup(true)}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${
                  selectedTimeRange === 'custom'
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/10'
                }`}
                title="Custom date range"
              >
                <FiCalendar className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 mb-8">
          {/* Spend */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FiDollarSign className="w-5 h-5 text-green-400" />
                <span className="text-white/60 text-sm">{getTimeRangeLabel(selectedTimeRange, 'Spend')}</span>
              </div>
              {loadingStates.spend && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">
              {loadingStates.spend ? '...' : formatCurrency(todaySpend.spend)}
            </p>
          </div>

          {/* Impressions */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FiEye className="w-5 h-5 text-blue-400" />
                <span className="text-white/60 text-sm">{getTimeRangeLabel(selectedTimeRange, 'Impressions')}</span>
              </div>
              {loadingStates.spend && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">
              {loadingStates.spend ? '...' : formatNumber(todaySpend.impressions)}
            </p>
          </div>

          {/* Clicks */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FiMousePointer className="w-5 h-5 text-purple-400" />
                <span className="text-white/60 text-sm">{getTimeRangeLabel(selectedTimeRange, 'Clicks')}</span>
              </div>
              {loadingStates.spend && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">
              {loadingStates.spend ? '...' : formatNumber(todaySpend.clicks)}
            </p>
          </div>

          {/* CTR */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FiTarget className="w-5 h-5 text-yellow-400" />
                <span className="text-white/60 text-sm">Click-through rate</span>
              </div>
              {loadingStates.spend && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">
              {loadingStates.spend ? '...' : `${todaySpend.ctr.toFixed(2)}%`}
            </p>
          </div>

          {/* CPM */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FiTrendingUp className="w-5 h-5 text-orange-400" />
                <span className="text-white/60 text-sm">Cost per 1K impressions</span>
              </div>
              {loadingStates.spend && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">
              {loadingStates.spend ? '...' : formatCurrency(todaySpend.cpm)}
            </p>
          </div>

          {/* CPC */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FiMousePointer className="w-5 h-5 text-cyan-400" />
                <span className="text-white/60 text-sm">Cost per click</span>
              </div>
              {loadingStates.spend && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">
              {loadingStates.spend ? '...' : formatCurrency(todaySpend.cpc)}
            </p>
          </div>

          {/* Results */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FiTarget className="w-5 h-5 text-green-400" />
                <span className="text-white/60 text-sm">{getTimeRangeLabel(selectedTimeRange, 'Results')}</span>
              </div>
              {loadingStates.spend && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">
              {loadingStates.spend ? '...' : formatNumber(todaySpend.results)}
            </p>
          </div>

          {/* Cost of Results */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FiDollarSign className="w-5 h-5 text-red-400" />
                <span className="text-white/60 text-sm">Cost of results</span>
              </div>
              {loadingStates.spend && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">
              {loadingStates.spend ? '...' : formatCurrency(todaySpend.costOfResults)}
            </p>
          </div>

          {/* ROAS */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FiTrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-white/60 text-sm">Return on ad spend</span>
              </div>
              {loadingStates.roas && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">
              {loadingStates.roas ? '...' : todaySpend.roas.toFixed(2)}
            </p>
          </div>

          {/* Total Conversion Value */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FiDollarSign className="w-5 h-5 text-pink-400" />
                <span className="text-white/60 text-sm">{getTimeRangeLabel(selectedTimeRange, 'Conversion Value')}</span>
              </div>
              {loadingStates.roas && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            <p className="text-2xl font-bold text-white">
              {loadingStates.roas ? '...' : formatCurrency(todaySpend.conversionValue || 0)}
            </p>
          </div>
        </div>

        {/* Live Ads Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center glass-card">
                <FiActivity className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Live Ads</h2>
              {loadingStates.liveAds && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              )}
            </div>
            
            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                showFilters 
                  ? 'bg-blue-500/20 border-blue-400/50 text-blue-300' 
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <FiFilter className="w-4 h-4" />
              <span className="text-sm font-medium">Filters</span>
              {filteredAds.length !== allAds.length && (
                <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  {filteredAds.length}
                </span>
              )}
            </button>
          </div>
          
          {/* Filters Component */}
          {showFilters && (
            <Filters
              filters={filters}
              setFilters={setFilters}
              setShowFilters={setShowFilters}
              totalAds={allAds.length}
              filteredCount={filteredAds.length}
            />
          )}
          
          {loadingStates.liveAds ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-card p-4 animate-pulse">
                  <div className="w-full h-32 bg-white/10 rounded-lg mb-4"></div>
                  <div className="h-4 bg-white/10 rounded mb-2"></div>
                  <div className="h-3 bg-white/10 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : allAds.length > 0 ? (
            <InfiniteAdsList
              ads={filteredAds}
              dateRange={selectedTimeRange}
              onLoadMore={loadMoreAds}
              hasMore={hasMoreAds}
              loading={loadingMoreAds}
            />
          ) : (
            <div className="glass-card p-8 text-center">
              <FiActivity className="w-12 h-12 text-white/40 mx-auto mb-4" />
              <p className="text-white/60">No active ads found</p>
            </div>
          )}
        </div>

        {/* Last 30 Days Performance Section */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full flex items-center justify-center glass-card">
              <FiBarChart className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Last 30 Days Performance</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <FiDollarSign className="w-5 h-5 text-green-400" />
                <span className="text-white/60 text-sm">Total Spend</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(adsSummary.totalSpend)}</p>
            </div>
            
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <FiEye className="w-5 h-5 text-blue-400" />
                <span className="text-white/60 text-sm">Total Impressions</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatNumber(adsSummary.totalImpressions)}</p>
            </div>
            
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <FiMousePointer className="w-5 h-5 text-purple-400" />
                <span className="text-white/60 text-sm">Total Clicks</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatNumber(adsSummary.totalClicks)}</p>
            </div>
            
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <FiTarget className="w-5 h-5 text-yellow-400" />
                <span className="text-white/60 text-sm">Average CTR</span>
              </div>
              <p className="text-2xl font-bold text-white">{adsSummary.averageCTR.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}