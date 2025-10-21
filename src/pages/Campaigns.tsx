import { useState, useEffect } from 'react';
import { FiTarget, FiRefreshCw, FiEye, FiMousePointer, FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import type { CampaignData, ApiResponse } from '../types';

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/meta/campaigns?limit=20');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch campaigns: ${response.status}`);
      }
      
      const result: ApiResponse<CampaignData[]> = await response.json();
      
      if (result.success) {
        setCampaigns(result.data);
        setError(null);
      } else {
        throw new Error(result.error || 'Failed to fetch campaigns');
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'deleted':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <div className="fixed inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-indigo-900/20"></div>
        </div>
        <div className="text-center relative z-10 flex flex-col items-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-white/10 rounded-full animate-spin border-t-blue-500"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-pulse border-t-purple-500"></div>
          </div>
          <p className="mt-6 text-white/80 font-medium text-lg text-center">Loading campaigns...</p>
          <p className="mt-2 text-white/50 text-sm text-center">Fetching campaign data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-6">
        <div className="fixed inset-0 opacity-30">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-indigo-900/20"></div>
        </div>
        <div className="relative z-10 bg-red-500/10 backdrop-blur-sm border border-red-500/30 rounded-2xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-white mb-4">Failed to Load Campaigns</h2>
            <p className="text-white/70 mb-6">{error}</p>
            <button
              onClick={fetchCampaigns}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Modern Background Pattern */}
             <div className="fixed inset-0 opacity-40 pointer-events-none">
               <div className="absolute inset-0 bg-gradient-to-br from-slate-900/30 via-blue-900/30 to-indigo-900/30"></div>
               <div className="absolute inset-0" style={{
                 backgroundImage: `radial-gradient(circle at 25% 25%, rgba(10, 26, 58, 0.25) 0%, transparent 50%),
                                  radial-gradient(circle at 75% 75%, rgba(26, 35, 126, 0.25) 0%, transparent 50%)`
               }}></div>
             </div>
      
      {/* Content */}
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12">
          {/* Header */}
          <div className="animate-fade-in-up mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center glass-card">
                  <FiTarget className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Campaigns</h1>
                  <p className="text-white/60">Manage and monitor your Meta ad campaigns</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchCampaigns}
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
                    <p className="text-sm text-white/70">Total Campaigns</p>
                    <p className="text-2xl font-bold text-white">{campaigns.length}</p>
                  </div>
                  <FiTarget className="w-6 h-6 text-white/50" />
                </div>
              </div>
              
              <div className="glass-card p-4 glass-card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">Active</p>
                    <p className="text-2xl font-bold text-white">
                      {campaigns.filter(c => c.effective_status === 'ACTIVE').length}
                    </p>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                </div>
              </div>
              
              <div className="glass-card p-4 glass-card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">Paused</p>
                    <p className="text-2xl font-bold text-white">
                      {campaigns.filter(c => c.effective_status === 'PAUSED').length}
                    </p>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                </div>
              </div>
              
              <div className="glass-card p-4 glass-card-hover">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">Total Spend</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(campaigns.reduce((sum, c) => {
                        const spend = c.insights?.data?.[0]?.spend ? parseFloat(c.insights.data[0].spend) : 0;
                        return sum + spend;
                      }, 0))}
                    </p>
                  </div>
                  <FiDollarSign className="w-6 h-6 text-white/50" />
                </div>
              </div>
            </div>
          </div>

          {/* Campaigns Grid */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            {campaigns.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiTarget className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Campaigns Found</h3>
                <p className="text-white/60">
                  You don't have any campaigns in your account yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map((campaign) => {
                  const insights = campaign.insights?.data?.[0];
                  const spend = insights ? parseFloat(insights.spend) : 0;
                  const impressions = insights ? parseInt(insights.impressions) : 0;
                  const clicks = insights ? parseInt(insights.clicks) : 0;
                  const ctr = insights ? parseFloat(insights.ctr) : 0;
                  const cpm = insights ? parseFloat(insights.cpm) : 0;

                  return (
                    <div key={campaign.id} className="glass-card p-6 glass-card-hover">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white line-clamp-2 mb-2">
                            {campaign.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(campaign.effective_status)}`}></div>
                            <span className="text-xs text-white/60 capitalize">
                              {campaign.effective_status.toLowerCase()}
                            </span>
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
                            {formatNumber(impressions)}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <FiMousePointer className="w-3 h-3 text-green-400" />
                            <span className="text-xs text-white/60">Clicks</span>
                          </div>
                          <p className="text-lg font-bold text-white">
                            {formatNumber(clicks)}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <FiDollarSign className="w-3 h-3 text-yellow-400" />
                            <span className="text-xs text-white/60">Spend</span>
                          </div>
                          <p className="text-lg font-bold text-white">
                            {formatCurrency(spend)}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <FiTrendingUp className="w-3 h-3 text-purple-400" />
                            <span className="text-xs text-white/60">CTR</span>
                          </div>
                          <p className="text-lg font-bold text-white">
                            {ctr.toFixed(2)}%
                          </p>
                        </div>
                      </div>

                      {/* Additional Metrics */}
                      <div className="border-t border-white/10 pt-4">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-white/50">CPM:</span>
                            <span className="text-white ml-1">{formatCurrency(cpm)}</span>
                          </div>
                          <div>
                            <span className="text-white/50">Created:</span>
                            <span className="text-white ml-1">
                              {new Date(campaign.created_time).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="border-t border-white/10 pt-4 mt-4">
                        <button
                          onClick={() => navigate('/campaigns/live')}
                          className="w-full px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg transition-colors text-sm font-medium"
                        >
                          View Live Ads
                        </button>
                      </div>

                      {/* Footer */}
                      <div className="border-t border-white/10 pt-4 mt-4 flex items-center justify-between text-xs text-white/50">
                        <div>
                          <span>Updated {new Date(campaign.updated_time).toLocaleDateString()}</span>
                        </div>
                        <div className="text-white/30">ID: {campaign.id.slice(-8)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
