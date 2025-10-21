import { useState, useEffect } from 'react';
import { FiEye, FiMousePointer, FiDollarSign, FiTrendingUp, FiActivity, FiClock, FiTarget, FiRefreshCw } from 'react-icons/fi';
import type { AdData, ApiResponse } from '../types';

export function LiveAds() {
  const [ads, setAds] = useState<AdData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchLiveAds = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/meta/ads?status=ACTIVE&limit=200');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ads: ${response.status}`);
      }
      
      const result: ApiResponse<AdData[]> = await response.json();
      
      if (result.success) {
        setAds(result.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to fetch ads');
      }
    } catch (err) {
      console.error('Error fetching live ads:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch ads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveAds();
    
    // Auto-refresh every 5 minutes to prevent rate limiting
    const interval = setInterval(fetchLiveAds, 300000); // 5 minutes instead of 2 minutes
    
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
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

  const getPerformanceLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Attention';
  };

  if (loading && ads.length === 0) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-center py-20">
          <div className="text-center flex flex-col items-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-white/10 rounded-full animate-spin border-t-blue-500"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-pulse border-t-purple-500"></div>
            </div>
            <p className="mt-6 text-white/80 font-medium text-lg text-center">Loading live ads...</p>
            <p className="mt-2 text-white/50 text-sm text-center">Fetching real-time performance data</p>
          </div>
        </div>
      </div>
    );
  }

    if (error) {
      return (
        <div className="mb-8">
          <div className="flex items-center justify-center py-20 p-6">
            <div className="bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-2xl p-8 max-w-md w-full">
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-white mb-4">Failed to Load Ads</h2>
                <p className="text-white/70 mb-6">{error}</p>
                <button
                  onClick={fetchLiveAds}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

  return (
    <div className="mb-8">
      {/* TikTok Analytics Background Pattern */}
      <div className="fixed inset-0 opacity-40 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/30 via-blue-900/30 to-indigo-900/30"></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
          {/* Header */}
          <div className="animate-fade-in-up mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center glass-card">
                  <FiActivity className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Live Ads</h1>
                  <p className="text-white/60">Real-time performance of your active campaigns</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <div className="text-right">
                    <p className="text-xs text-white/50">Last updated</p>
                    <p className="text-sm text-white/70">
                      {lastUpdated.toLocaleTimeString()}
                    </p>
                  </div>
                )}
                <button
                  onClick={fetchLiveAds}
                  disabled={loading}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                  title="Refresh data"
                >
                  <FiRefreshCw className={`w-4 h-4 text-white ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="animate-fade-in-up mb-8" style={{ animationDelay: '0.1s' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-card p-4 glass-card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">Total Active Ads</p>
                    <p className="text-2xl font-bold text-white">{ads.length}</p>
                  </div>
                  <FiTarget className="w-6 h-6 text-white/50" />
                </div>
              </div>
              
              <div className="glass-card p-4 glass-card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">Total Spend</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(ads.reduce((sum, ad) => sum + ad.metrics.spend, 0))}
                    </p>
                  </div>
                  <FiDollarSign className="w-6 h-6 text-white/50" />
                </div>
              </div>
              
              <div className="glass-card p-4 glass-card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">Total Impressions</p>
                    <p className="text-2xl font-bold text-white">
                      {formatNumber(ads.reduce((sum, ad) => sum + ad.metrics.impressions, 0))}
                    </p>
                  </div>
                  <FiEye className="w-6 h-6 text-white/50" />
                </div>
              </div>
              
              <div className="glass-card p-4 glass-card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">Avg CTR</p>
                    <p className="text-2xl font-bold text-white">
                      {ads.length > 0 
                        ? `${(ads.reduce((sum, ad) => sum + ad.metrics.ctr, 0) / ads.length).toFixed(2)}%`
                        : '0%'
                      }
                    </p>
                  </div>
                  <FiTrendingUp className="w-6 h-6 text-white/50" />
                </div>
              </div>
            </div>
          </div>

          {/* Ads Grid */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {ads.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiTarget className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Active Ads</h3>
                <p className="text-white/60">
                  You don't have any active ads running at the moment.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ads.map((ad) => (
                  <div key={ad.id} className="glass-card p-6 glass-card-hover">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-white line-clamp-2 mb-1">
                          {ad.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: ad.status_color }}
                          ></div>
                          <span className="text-xs text-white/60 capitalize">
                            {ad.effective_status.toLowerCase().replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${getPerformanceColor(ad.metrics.performance_score)}`}>
                          {ad.metrics.performance_score}/100
                        </div>
                        <div className="text-xs text-white/50">
                          {getPerformanceLabel(ad.metrics.performance_score)}
                        </div>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <FiEye className="w-3 h-3 text-blue-400" />
                          <span className="text-xs text-white/60">Impressions</span>
                        </div>
                        <p className="text-lg font-bold text-white">
                          {formatNumber(ad.metrics.impressions)}
                        </p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <FiMousePointer className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-white/60">Clicks</span>
                        </div>
                        <p className="text-lg font-bold text-white">
                          {formatNumber(ad.metrics.clicks)}
                        </p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <FiDollarSign className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs text-white/60">Spend</span>
                        </div>
                        <p className="text-lg font-bold text-white">
                          {formatCurrency(ad.metrics.spend)}
                        </p>
                      </div>
                      
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <FiTrendingUp className="w-3 h-3 text-purple-400" />
                          <span className="text-xs text-white/60">CTR</span>
                        </div>
                        <p className="text-lg font-bold text-white">
                          {ad.metrics.ctr.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className="border-t border-white/10 pt-4">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-white/50">CPM:</span>
                          <span className="text-white ml-1">{formatCurrency(ad.metrics.cpm)}</span>
                        </div>
                        <div>
                          <span className="text-white/50">CPC:</span>
                          <span className="text-white ml-1">{formatCurrency(ad.metrics.cpc)}</span>
                        </div>
                        <div>
                          <span className="text-white/50">Reach:</span>
                          <span className="text-white ml-1">{formatNumber(ad.metrics.reach)}</span>
                        </div>
                        <div>
                          <span className="text-white/50">Frequency:</span>
                          <span className="text-white ml-1">{ad.metrics.frequency.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {ad.metrics.actions.length > 0 && (
                      <div className="border-t border-white/10 pt-4 mt-4">
                        <div className="text-xs text-white/50 mb-2">Key Actions</div>
                        <div className="space-y-1">
                          {ad.metrics.actions.slice(0, 3).map((action, index) => (
                            <div key={index} className="flex justify-between text-xs">
                              <span className="text-white/70 capitalize">
                                {action.action_type.replace(/_/g, ' ')}
                              </span>
                              <span className="text-white font-medium">{action.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="border-t border-white/10 pt-4 mt-4 flex items-center justify-between text-xs text-white/50">
                      <div className="flex items-center gap-1">
                        <FiClock className="w-3 h-3" />
                        <span>Updated {new Date(ad.updated_time).toLocaleDateString()}</span>
                      </div>
                      <div className="text-white/30">ID: {ad.id.slice(-8)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
