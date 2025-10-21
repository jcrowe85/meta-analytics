import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiInfo } from 'react-icons/fi';
import type { AdData } from '../types';

interface InfiniteAdsListProps {
  ads: AdData[];
  dateRange: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

const InfiniteAdsList: React.FC<InfiniteAdsListProps> = ({
  ads,
  dateRange,
  onLoadMore,
  hasMore = false,
  loading = false
}) => {
  const [loadedInsights, setLoadedInsights] = useState<Map<string, any>>(new Map());
  const [loadingInsights, setLoadingInsights] = useState<Set<string>>(new Set());
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [insightsQueue, setInsightsQueue] = useState<string[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);

  // Reset insights when date range changes
  useEffect(() => {
    setLoadedInsights(new Map());
    setLoadingInsights(new Set());
    setInsightsQueue([]);
    setIsProcessingQueue(false);
  }, [dateRange]);

  // Process insights queue with throttling
  useEffect(() => {
    if (insightsQueue.length > 0 && !isProcessingQueue) {
      processInsightsQueue();
    }
  }, [insightsQueue, isProcessingQueue]);

  const processInsightsQueue = async () => {
    if (isProcessingQueue || insightsQueue.length === 0) return;
    
    setIsProcessingQueue(true);
    
    // Process up to 3 ads in parallel
    const batchSize = 3;
    const batches = [];
    
    for (let i = 0; i < insightsQueue.length; i += batchSize) {
      batches.push(insightsQueue.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      // Process batch in parallel
      const promises = batch.map(async (adId, index) => {
        if (adId && !loadedInsights.has(adId) && !loadingInsights.has(adId)) {
          // Small stagger within batch
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, index * 25)); // 25ms stagger
          }
          await loadAdInsights(adId);
        }
      });
      
      await Promise.all(promises);
      
      // Small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms between batches
      }
    }
    
    // Clear the queue
    setInsightsQueue([]);
    setIsProcessingQueue(false);
  };
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);

  // Performance tooltips
  const performanceTooltips = {
    ctr: 'CTR Quality: Click-through rate percentage. Higher is better.',
    clicks: 'Click Performance: Based on click rate and volume. Combines quality and scale.',
    cpm: 'CPM Efficiency: Cost per 1000 impressions. Lower is better.',
    cpc: 'CPC Efficiency: Cost per click. Lower is better.',
    roas: 'ROAS Performance: Return on ad spend. Higher is better.',
    scores: 'Performance Scores: Individual metrics scored 0-100 based on industry benchmarks. CTR: 0-3%, Clicks: 0-100, CPM: $0-50, CPC: $0-5.'
  };

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          onLoadMore?.();
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, onLoadMore]);

  // Load insights for visible ads
  const loadAdInsights = useCallback(async (adId: string) => {
    if (loadedInsights.has(adId) || loadingInsights.has(adId)) {
      return;
    }

    setLoadingInsights(prev => new Set(prev).add(adId));

    try {
      const cacheBuster = `_t=${Date.now()}`;
      const response = await fetch(`/api/meta/ads/${adId}/insights?dateRange=${dateRange}&${cacheBuster}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setLoadedInsights(prev => new Map(prev).set(adId, data.data));
        }
      }
    } catch (error) {
      console.error(`Failed to load insights for ad ${adId}:`, error);
    } finally {
      setLoadingInsights(prev => {
        const newSet = new Set(prev);
        newSet.delete(adId);
        return newSet;
      });
    }
  }, [dateRange, loadedInsights, loadingInsights]);

  // Intersection Observer for lazy loading insights
  const adRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const adId = entry.target.getAttribute('data-ad-id');
            if (adId && !loadedInsights.has(adId) && !loadingInsights.has(adId)) {
              // Add to queue instead of loading immediately
              setInsightsQueue(prev => [...prev, adId]);
            }
          }
        });
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    adRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
    };
  }, [loadAdInsights]);

  const setAdRef = useCallback((adId: string) => (element: HTMLDivElement | null) => {
    if (element) {
      adRefs.current.set(adId, element);
    } else {
      adRefs.current.delete(adId);
    }
  }, []);

  // Calculate ROAS
  const calculateROAS = (insights: any) => {
    const spend = parseFloat(insights.spend || 0);
    if (spend === 0) return 0;

    const actionValues = insights.action_values || [];
    let totalConversionValue = 0;

    // First, try to get conversion values from action_values
    // Filter for purchase actions and get unique values to avoid double counting
    const purchaseActionValues = actionValues.filter((action: any) => {
      const actionType = action.action_type.toLowerCase();
      return (actionType.includes('purchase') ||
              actionType === 'conversion' ||
              actionType.includes('sale') ||
              actionType.includes('order')) &&
             !actionType.includes('view_content') && 
             !actionType.includes('add_to_cart') && 
             !actionType.includes('initiate_checkout') &&
             !actionType.includes('checkout');
    });

    if (purchaseActionValues.length > 0) {
      // Get unique conversion values to avoid double counting the same conversion
      const uniqueValues = [...new Set(purchaseActionValues.map((action: any) => parseFloat(action.value || 0)))];
      
      // Use the highest value (most likely the real conversion value)
      // Meta API often reports the same conversion multiple times with different action types
      totalConversionValue = Math.max(...uniqueValues);
    }

    // If no conversion values found but we have results, use default value
    if (totalConversionValue === 0) {
      const results = calculateResults(insights);
      if (results > 0) {
        // Use default conversion value of $50 per purchase
        totalConversionValue = results * 50;
      }
    }

    return spend > 0 ? totalConversionValue / spend : 0;
  };

  // Calculate true CTR based on link clicks
  const calculateTrueCTR = (insights: any) => {
    const impressions = parseFloat(insights.impressions || 0);
    const linkClicks = parseFloat(insights.clicks || 0); // This is already link clicks from the backend
    
    if (impressions === 0) return 0;
    return (linkClicks / impressions) * 100;
  };

  // Helper functions to check if we have sufficient data for meaningful scores
  const hasSufficientDataForCTR = (metrics: any) => {
    return metrics.impressions > 0 && metrics.clicks > 0;
  };

  const hasSufficientDataForCPM = (metrics: any) => {
    return metrics.impressions > 0 && metrics.spend > 0 && metrics.cpm > 0;
  };

  const hasSufficientDataForCPC = (metrics: any) => {
    return metrics.clicks > 0 && metrics.spend > 0 && metrics.cpc > 0;
  };

  const hasSufficientDataForROAS = (metrics: any) => {
    if (metrics.spend <= 0) return false;
    
    // Check if we have action_values with purchase data
    if (metrics.action_values && 
        metrics.action_values.some((av: any) => 
          av.action_type && av.action_type.includes('purchase')
        )) {
      return true;
    }
    
    // Check if we have results (purchase actions) even without action_values
    const results = calculateResults(metrics);
    return results > 0;
  };

  const hasSufficientDataForClickPerformance = (metrics: any) => {
    return metrics.clicks > 0;
  };

  // Calculate Cost Per Result
  const calculateCostPerResult = (insights: any) => {
    const spend = parseFloat(insights.spend || 0);
    const results = calculateResults(insights);
    return results > 0 ? spend / results : 0;
  };

  // Calculate total conversion value in dollars
  const calculateConversionValue = (insights: any) => {
    const actionValues = insights.action_values || [];
    let totalConversionValue = 0;
    let hasRealConversionValues = false;

    // First, try to get conversion values from action_values
    // Filter for purchase actions and get unique values to avoid double counting
    const purchaseActionValues = actionValues.filter((action: any) => {
      const actionType = action.action_type.toLowerCase();
      return (actionType.includes('purchase') ||
              actionType === 'conversion' ||
              actionType.includes('sale') ||
              actionType.includes('order')) &&
             !actionType.includes('view_content') && 
             !actionType.includes('add_to_cart') && 
             !actionType.includes('initiate_checkout') &&
             !actionType.includes('checkout');
    });

    if (purchaseActionValues.length > 0) {
      hasRealConversionValues = true;
      
      // Get unique conversion values to avoid double counting the same conversion
      const uniqueValues = [...new Set(purchaseActionValues.map((action: any) => parseFloat(action.value || 0)))];
      
      // Use the highest value (most likely the real conversion value)
      // Meta API often reports the same conversion multiple times with different action types
      totalConversionValue = Math.max(...uniqueValues);
    }

    // If no conversion values found but we have results, use default value
    if (totalConversionValue === 0) {
      const results = calculateResults(insights);
      if (results > 0) {
        // Use default conversion value of $50 per purchase
        totalConversionValue = results * 50;
      }
    }

    return { value: totalConversionValue, isEstimated: !hasRealConversionValues };
  };

  // Calculate results (purchases) - only count primary purchase types to avoid double counting
  const calculateResults = (insights: any) => {
    const actions = insights.actions || [];
    
    // Priority order for purchase action types (most reliable first)
    const primaryPurchaseTypes = [
      'purchase',
      'onsite_web_purchase', 
      'onsite_web_app_purchase',
      'omni_purchase'
    ];
    
    // Find the first primary purchase type that has a value > 0
    for (const actionType of primaryPurchaseTypes) {
      const action = actions.find((a: any) => a.action_type === actionType);
      if (action && parseInt(action.value || 0) > 0) {
        return parseInt(action.value || 0);
      }
    }
    
    // Fallback: if no primary types found, use the first purchase action with value > 0
    const purchaseActions = actions.filter((action: any) => 
      action.action_type && action.action_type.includes('purchase') && parseInt(action.value || 0) > 0
    );
    
    return purchaseActions.length > 0 ? parseInt(purchaseActions[0].value || 0) : 0;
  };

  // Calculate performance score from metrics
  const calculatePerformanceScore = (metrics: any) => {
    if (!metrics) return 0;
    
    const { impressions, clicks, spend, cpm, cpc, ctr, actions, action_values } = metrics;
    
    // Check if we have sufficient data to calculate meaningful scores
    const hasImpressions = impressions > 0;
    const hasClicks = clicks > 0;
    const hasSpend = spend > 0;
    
    // CTR Quality (0-40 points) - only if we have impressions and clicks
    const trueCTR = calculateTrueCTR(metrics);
    const ctrScore = (hasImpressions && hasClicks) ? Math.min(40, Math.max(0, (trueCTR - 0.5) * 20)) : 0;
    
    // Click Performance (0-25 points) - only if we have clicks
    const clickScore = hasClicks ? Math.min(25, Math.max(0, (clicks / 10) * 10 + (trueCTR - 1) * 5)) : 0;
    
    // CPM Efficiency (0-15 points) - only if we have impressions and spend
    const cpmScore = (hasImpressions && hasSpend && cpm > 0) ? Math.min(15, Math.max(0, 15 - (cpm / 10))) : 0;
    
    // CPC Efficiency (0-15 points) - only if we have clicks and spend
    const cpcScore = (hasClicks && hasSpend && cpc > 0) ? Math.min(15, Math.max(0, 15 - (cpc / 2))) : 0;
    
    // ROAS Performance (0-30 points)
    let roasScore = 0;
    if (spend > 0 && action_values) {
      const purchaseValue = action_values.find((av: any) => 
        av.action_type && av.action_type.includes('purchase')
      );
      if (purchaseValue) {
        const roas = parseFloat(purchaseValue.value) / spend;
        roasScore = Math.min(30, Math.max(0, roas * 3));
      }
    }
    
    return Math.round(ctrScore + clickScore + cpmScore + cpcScore + roasScore);
  };

  // Get performance score
  const getPerformanceScore = (ad: AdData) => {
    const insights = loadedInsights.get(ad.id);
    if (insights?.performance_score) {
      return insights.performance_score;
    }
    
    // Calculate performance score from main ads data
    const metrics = getMetrics(ad);
    if (metrics) {
      return calculatePerformanceScore(metrics);
    }
    
    return ad.performance_score || 0;
  };

  // Get metrics
  const getMetrics = (ad: AdData) => {
    const insights = loadedInsights.get(ad.id);
    if (insights?.metrics) {
      return insights.metrics;
    }
    
    // Return null if no individual insights loaded yet (will show loading state)
    return null;
  };

  // Get creative image URL
  const getCreativeImageUrl = (ad: AdData) => {
    if (!ad.creative) return null;
    return ad.creative.image_url || ad.creative.thumbnail_url || null;
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format number
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  return (
    <div className="space-y-4">
      {/* Ads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {ads.map((ad) => {
          const metrics = getMetrics(ad);
          const performanceScore = getPerformanceScore(ad);
          const isLoadingInsights = loadingInsights.has(ad.id);
          const hasInsights = loadedInsights.has(ad.id);

          return (
            <div
              key={ad.id}
              ref={setAdRef(ad.id)}
              data-ad-id={ad.id}
              className="glass-card p-3 glass-card-hover rounded-xl"
            >
              {/* Header with Performance Badge */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: ad.status_color }}></div>
                    <span className="text-xs font-medium text-white/80 uppercase tracking-wide">
                      {ad.effective_status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="bg-white/10 rounded-full px-2 py-1">
                      <span className="text-xs font-semibold text-white">
                        {performanceScore}/100
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Performance Progress Bar */}
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${performanceScore}%` }}
                  ></div>
                </div>
              </div>

              {/* Ad Image */}
              <div className="aspect-square bg-white/5 flex items-center justify-center mb-3 rounded-lg overflow-hidden">
                {getCreativeImageUrl(ad) ? (
                  <img
                    src={getCreativeImageUrl(ad)!}
                    alt={ad.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="text-gray-400 text-center">
                    <FiEye className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">No Image</p>
                  </div>
                )}
              </div>

              {/* Ad Content */}
              <div>
                <h3 className="font-semibold text-white text-sm mb-3 line-clamp-2 leading-relaxed">
                  {ad.name}
                </h3>

                {/* Loading State or Metrics */}
                {isLoadingInsights || !hasInsights ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-sm text-white/80">Loading insights...</span>
                  </div>
                ) : metrics ? (
                  <div className="space-y-4">
                    {/* Primary Metrics - Most Important */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-center">
                          <div className="text-xs text-white/60 mb-1">Spend</div>
                          <div className="text-lg font-bold text-white">{formatCurrency(metrics.spend)}</div>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-center">
                          <div className="text-xs text-white/60 mb-1">ROAS</div>
                          <div className="text-lg font-bold text-white">{calculateROAS(metrics).toFixed(2)}x</div>
                        </div>
                      </div>
                    </div>

                    {/* Secondary Metrics - High Importance */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/5 rounded-lg p-2.5">
                        <div className="text-center">
                          <div className="text-xs text-white/60 mb-1">Clicks</div>
                          <div className="text-base font-semibold text-white">{formatNumber(metrics.clicks)}</div>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2.5">
                        <div className="text-center">
                          <div className="text-xs text-white/60 mb-1">CTR</div>
                          <div className="text-base font-semibold text-white">{calculateTrueCTR(metrics).toFixed(2)}%</div>
                        </div>
                      </div>
                    </div>

                    {/* Additional Metrics - Medium Importance */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/5 rounded-lg p-2">
                        <div className="text-center">
                          <div className="text-xs text-white/60 mb-1">CPM</div>
                          <div className="text-sm font-medium text-white">${metrics.cpm.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <div className="text-center">
                          <div className="text-xs text-white/60 mb-1">CPC</div>
                          <div className="text-sm font-medium text-white">${metrics.cpc.toFixed(2)}</div>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-2">
                        <div className="text-center">
                          <div className="text-xs text-white/60 mb-1">Cost/Res</div>
                          <div className="text-sm font-medium text-white">${calculateCostPerResult(metrics).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Sales - High Importance */}
                    <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-lg p-2.5 border border-emerald-500/20">
                      <div className="text-center">
                        <div className="text-xs text-emerald-300 mb-1">Sales Revenue</div>
                        <div className="text-base font-bold text-white">
                          {(() => {
                            const conversionData = calculateConversionValue(metrics);
                            return conversionData.isEstimated ? 'N/A' : `$${conversionData.value.toFixed(2)}`;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Performance Scores - Compact */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-1">
                        <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                          Scores
                        </h4>
                        <FiInfo
                          className="w-3 h-3 text-gray-400 cursor-help"
                          onMouseEnter={(e) => {
                            setTooltipPosition({ x: e.clientX, y: e.clientY });
                            setHoveredTooltip('scores');
                          }}
                          onMouseLeave={() => setHoveredTooltip(null)}
                        />
                      </div>
                      
                      <div className="grid grid-cols-4 gap-1.5">
                        {/* CTR Quality */}
                        <div className="bg-white/5 rounded-lg p-2">
                          <div className="text-center">
                            <div className="text-xs text-white/60 mb-1">CTR</div>
                            <div className="text-sm font-semibold text-white">
                              {hasSufficientDataForCTR(metrics) ? Math.min(Math.round((calculateTrueCTR(metrics) / 3) * 100), 100) : 'N/A'}
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1 mt-1">
                              <div
                                className="bg-blue-500 h-1 rounded-full"
                                style={{ width: hasSufficientDataForCTR(metrics) ? `${Math.min((calculateTrueCTR(metrics) / 3) * 100, 100)}%` : '0%' }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Click Performance */}
                        <div className="bg-white/5 rounded-lg p-2">
                          <div className="text-center">
                            <div className="text-xs text-white/60 mb-1">Clicks</div>
                            <div className="text-sm font-semibold text-white">
                              {hasSufficientDataForClickPerformance(metrics) ? Math.min(Math.round((metrics.clicks / 100) * 100), 100) : 'N/A'}
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1 mt-1">
                              <div
                                className="bg-purple-500 h-1 rounded-full"
                                style={{ width: hasSufficientDataForClickPerformance(metrics) ? `${Math.min((metrics.clicks / 100) * 100, 100)}%` : '0%' }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* CPM Efficiency */}
                        <div className="bg-white/5 rounded-lg p-2">
                          <div className="text-center">
                            <div className="text-xs text-white/60 mb-1">CPM</div>
                            <div className="text-sm font-semibold text-white">
                              {hasSufficientDataForCPM(metrics) ? Math.max(100 - Math.round((metrics.cpm / 50) * 100), 0) : 'N/A'}
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1 mt-1">
                              <div
                                className="bg-green-500 h-1 rounded-full"
                                style={{ width: hasSufficientDataForCPM(metrics) ? `${Math.max(100 - (metrics.cpm / 50) * 100, 0)}%` : '0%' }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* CPC Efficiency */}
                        <div className="bg-white/5 rounded-lg p-2">
                          <div className="text-center">
                            <div className="text-xs text-white/60 mb-1">CPC</div>
                            <div className="text-sm font-semibold text-white">
                              {hasSufficientDataForCPC(metrics) ? Math.max(100 - Math.round((metrics.cpc / 5) * 100), 0) : 'N/A'}
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-1 mt-1">
                              <div
                                className="bg-orange-500 h-1 rounded-full"
                                style={{ width: hasSufficientDataForCPC(metrics) ? `${Math.max(100 - (metrics.cpc / 5) * 100, 0)}%` : '0%' }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Results - Most Important */}
                    <div className="bg-gradient-to-r from-green-500/15 to-emerald-500/15 rounded-lg p-3 border border-green-500/30">
                      <div className="text-center">
                        <div className="text-sm text-green-300 mb-1">Conversions</div>
                        <div className="text-xl font-bold text-white">{calculateResults(metrics)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-white/60">Failed to load insights</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading Indicator for Infinite Scroll */}
      {hasMore && (
        <div ref={loadingRef} className="flex justify-center py-8">
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600">Loading more ads...</span>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Scroll to load more</div>
          )}
        </div>
      )}

      {/* Tooltip */}
      {hoveredTooltip && (
        <div 
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 max-w-xs shadow-lg border border-gray-700"
          style={{
            left: `${tooltipPosition.x + 10}px`,
            top: `${tooltipPosition.y - 30}px`,
            pointerEvents: 'none'
          }}
        >
          {performanceTooltips[hoveredTooltip as keyof typeof performanceTooltips]}
        </div>
      )}
    </div>
  );
};

export default InfiniteAdsList;
