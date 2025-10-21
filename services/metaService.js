const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class MetaService {
  constructor() {
    this.baseURL = 'https://graph.facebook.com/v18.0';
    this.accessToken = process.env.META_ACCESS_TOKEN;
    this.appId = process.env.META_APP_ID;
    this.appSecret = process.env.META_APP_SECRET;
    this.adAccountId = process.env.META_AD_ACCOUNT_ID;
    
    // In-memory cache for API responses
    this.cache = new Map();
    this.cacheExpiry = new Map();
    
    // Request throttling
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.maxConcurrentRequests = 5; // Increased concurrent requests
    this.requestDelay = 25; // Reduced delay between requests
    this.lastRequestTime = 0;
    
    // Cache file path for persistence
    this.cacheFile = path.join(__dirname, '..', 'cache', 'meta-cache.json');
    
    // Extended cache duration for ad insights (10 minutes)
    this.cacheDurations = {
      'default': 120000, // 2 minutes
      'ad_insights': 600000, // 10 minutes for ad insights
      'account': 300000, // 5 minutes for account data
      'ads_list': 300000 // 5 minutes for ads list
    };
    
    // Load cache from file on startup
    this.loadCacheFromFile();
    
    // Save cache on process exit
    process.on('exit', () => {
      this.saveCacheToFile();
    });
    
    process.on('SIGINT', () => {
      this.saveCacheToFile();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      this.saveCacheToFile();
      process.exit(0);
    });
    
    // Cache duration in milliseconds (10 minutes for most data, 2 minutes for today's data)
    this.cacheDurations = {
      account: 10 * 60 * 1000,     // 10 minutes
      ads: 10 * 60 * 1000,         // 10 minutes
      campaigns: 10 * 60 * 1000,   // 10 minutes
      adsets: 10 * 60 * 1000,      // 10 minutes
      todaySpend: 2 * 60 * 1000,   // 2 minutes (more frequent updates)
      campaignInsights: 5 * 60 * 1000, // 5 minutes
      creatives: 30 * 60 * 1000    // 30 minutes (creative data changes less frequently)
    };
    
    if (!this.accessToken) {
      throw new Error('META_ACCESS_TOKEN is required');
    }
    if (!this.adAccountId) {
      throw new Error('META_AD_ACCOUNT_ID is required');
    }
  }

  // Cache helper methods
  getCacheKey(endpoint, params = {}) {
    // Create a unique cache key based on endpoint and params
    const paramString = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
    return `${endpoint}?${paramString}`;
  }

  getFromCache(cacheKey) {
    const expiry = this.cacheExpiry.get(cacheKey);
    if (expiry && Date.now() < expiry) {
      logger.info(`Cache hit for: ${cacheKey}`);
      return this.cache.get(cacheKey);
    }
    
    // Remove expired cache entry
    if (expiry && Date.now() >= expiry) {
      this.cache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
    }
    
    return null;
  }

  setCache(cacheKey, data, cacheType = 'default') {
    const duration = this.cacheDurations[cacheType] || this.cacheDurations.default;
    const expiry = Date.now() + duration;
    
    this.cache.set(cacheKey, data);
    this.cacheExpiry.set(cacheKey, expiry);
    
    // Save to file periodically (every 5 cache writes)
    if (this.cache.size % 5 === 0) {
      this.saveCacheToFile();
    }
    
    logger.info(`Cached response for: ${cacheKey} (expires in ${duration/1000}s)`);
  }

  // Load cache from file
  loadCacheFromFile() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf8');
        const cacheData = JSON.parse(data);
        
        // Restore cache and expiry
        this.cache = new Map(Object.entries(cacheData.cache || {}));
        this.cacheExpiry = new Map(Object.entries(cacheData.expiry || {}));
        
        // Clean up expired entries
        this.cleanExpiredCache();
        
        logger.info(`Loaded ${this.cache.size} cache entries from file`);
      }
    } catch (error) {
      logger.warn('Failed to load cache from file:', error.message);
    }
  }

  // Save cache to file
  saveCacheToFile() {
    try {
      // Ensure cache directory exists
      const cacheDir = path.dirname(this.cacheFile);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      
      const cacheData = {
        cache: Object.fromEntries(this.cache),
        expiry: Object.fromEntries(this.cacheExpiry),
        lastSaved: new Date().toISOString()
      };
      
      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      logger.warn('Failed to save cache to file:', error.message);
    }
  }

  // Clean expired cache entries
  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (expiry <= now) {
        this.cache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  // Clear cache (useful for testing or manual refresh)
  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
    
    // Also remove cache file
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
    } catch (error) {
      logger.warn('Failed to remove cache file:', error.message);
    }
    
    logger.info('Cache cleared');
  }

  // Get cache stats for monitoring
  getCacheStats() {
    const now = Date.now();
    const activeEntries = Array.from(this.cacheExpiry.entries()).filter(([key, expiry]) => expiry > now);
    
    return {
      totalEntries: this.cache.size,
      activeEntries: activeEntries.length,
      expiredEntries: this.cache.size - activeEntries.length,
      entries: activeEntries.map(([key, expiry]) => ({
        key,
        expiresIn: Math.round((expiry - now) / 1000)
      }))
    };
  }

  // Make authenticated request to Meta Graph API with caching
  async makeRequest(endpoint, params = {}, cacheType = 'default') {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        endpoint,
        params,
        cacheType,
        resolve,
        reject
      });
      
      this.processRequestQueue();
    });
  }

  async processRequestQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      
      try {
        // Throttle requests
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < this.requestDelay) {
          await new Promise(resolve => setTimeout(resolve, this.requestDelay - timeSinceLastRequest));
        }
        
        const result = await this.executeRequest(request.endpoint, request.params, request.cacheType);
        request.resolve(result);
        this.lastRequestTime = Date.now();
        
      } catch (error) {
        // Handle rate limiting with exponential backoff
        if (error.response && error.response.status === 429) {
          logger.warn('Rate limited, retrying with backoff...');
          await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second backoff
          this.requestQueue.unshift(request); // Put request back at front of queue
        } else {
          request.reject(error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  async executeRequest(endpoint, params = {}, cacheType = 'default') {
    try {
      // Check cache first, but bypass cache if _t parameter is present (cache busting)
      const cacheKey = this.getCacheKey(endpoint, params);
      if (!params._t) {
        const cachedData = this.getFromCache(cacheKey);
        if (cachedData) {
          return cachedData;
        }
      }

      const url = `${this.baseURL}/${endpoint}`;
      const requestParams = {
        access_token: this.accessToken,
        ...params
      };

      logger.info(`Making request to Meta API: ${endpoint}`);
      
      const response = await axios.get(url, {
        params: requestParams,
        timeout: 30000
      });

      // Cache the response
      this.setCache(cacheKey, response.data, cacheType);

      return response.data;
    } catch (error) {
      logger.error(`Meta API request failed for ${endpoint}:`, error.response?.data || error.message);
      throw new Error(`Meta API request failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  // Get ad account information
  async getAccountInfo() {
    const endpoint = this.adAccountId;
    const fields = 'id,name,account_status,currency,timezone_name,amount_spent,balance';
    
    return await this.makeRequest(endpoint, { fields }, 'account');
  }

  // Get today's spend data
  async getTodaySpendData({ dateRange, startDate, endDate, _t } = {}) {
    const endpoint = `${this.adAccountId}/insights`;
    
    // Handle different date ranges
    let timeRange;
    if (dateRange === 'custom' && startDate && endDate) {
      timeRange = {
        since: startDate,
        until: endDate
      };
    } else {
      // Use the getDateRange method to get proper date ranges
      const range = this.getDateRange(dateRange || '24h');
      timeRange = {
        since: range.since,
        until: range.until
      };
    }
    
        const requestParams = {
          fields: 'spend,impressions,clicks,cpm,cpc,ctr,frequency,reach,actions,action_values,cost_per_action_type',
          time_range: JSON.stringify(timeRange),
          level: 'account'
        };

        // Add cache busting parameter if provided
        if (_t) {
          requestParams._t = _t;
        }

    const response = await this.makeRequest(endpoint, requestParams, 'todaySpend');
    
    // For single-day ranges (24h), also get yesterday's data for comparison
    let yesterdayData = {};
    let primaryDate = timeRange.until;
    
    if (dateRange === '24h' || dateRange === 'yesterday' || !dateRange) {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
          const yesterdayParams = {
            fields: 'spend,impressions,clicks,cpm,cpc,ctr,frequency,reach,actions,action_values,cost_per_action_type',
            time_range: JSON.stringify({
              since: yesterdayStr,
              until: yesterdayStr
            }),
            level: 'account',
            _cache_buster: 'yesterday'
          };
      
      const yesterdayResponse = await this.makeRequest(endpoint, yesterdayParams, 'yesterdaySpend');
      yesterdayData = yesterdayResponse.data && yesterdayResponse.data[0] ? yesterdayResponse.data[0] : {};
    }
    
    // Process the data
    const todayData = response.data && response.data[0] ? response.data[0] : {};
    
    // For single-day ranges, use the most recent day with data (prefer today, fallback to yesterday if today is empty)
    // For multi-day ranges, use the aggregated data directly
    let primaryData;
    if (dateRange === '24h' || !dateRange) {
      primaryData = (todayData.spend && parseFloat(todayData.spend) > 0) ? todayData : yesterdayData;
      if (!(todayData.spend && parseFloat(todayData.spend) > 0)) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        primaryDate = yesterday.toISOString().split('T')[0];
      }
    } else if (dateRange === 'yesterday') {
      // For yesterday, use yesterday's data directly
      primaryData = yesterdayData;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      primaryDate = yesterday.toISOString().split('T')[0];
    } else {
      // For multi-day ranges, use the aggregated data
      primaryData = todayData;
    }
    
    // Extract link clicks from actions array
    const getLinkClicks = (data) => {
      if (!data.actions || !Array.isArray(data.actions)) return 0;
      const linkClickAction = data.actions.find(action => action.action_type === 'link_click');
      return linkClickAction ? parseInt(linkClickAction.value || 0) : 0;
    };
    
    const primaryLinkClicks = getLinkClicks(primaryData);
    const yesterdayLinkClicks = getLinkClicks(yesterdayData);
    
    // Calculate link CTR (link clicks / impressions * 100)
    const calculateLinkCTR = (linkClicks, impressions) => {
      if (!impressions || impressions === 0) return 0;
      return (linkClicks / impressions) * 100;
    };
    
    const primaryLinkCTR = calculateLinkCTR(primaryLinkClicks, primaryData.impressions);
    const yesterdayLinkCTR = calculateLinkCTR(yesterdayLinkClicks, yesterdayData.impressions);
    
    // Calculate link CPC (spend / link clicks)
    const calculateLinkCPC = (spend, linkClicks) => {
      if (!linkClicks || linkClicks === 0) return 0;
      return spend / linkClicks;
    };
    
    const primaryLinkCPC = calculateLinkCPC(primaryData.spend, primaryLinkClicks);
    const yesterdayLinkCPC = calculateLinkCPC(yesterdayData.spend, yesterdayLinkClicks);
    
    // Extract Results (purchases) and Cost of Results from actions
    const getResultsData = (data) => {
      if (!data.actions || !Array.isArray(data.actions)) {
        return { results: 0, costOfResults: 0 };
      }

      // Find purchase actions - prioritize the most reliable ones
      const purchaseActions = data.actions.filter(action => 
        action.action_type === 'purchase' || 
        action.action_type === 'onsite_web_purchase' ||
        action.action_type === 'onsite_web_app_purchase' ||
        action.action_type === 'omni_purchase' ||
        action.action_type === 'web_in_store_purchase'
      );

      // Get the highest purchase count (different action types might have different counts)
      const results = Math.max(...purchaseActions.map(action => parseInt(action.value || 0)), 0);
      
      // Calculate cost per result (cost of results)
      const costOfResults = results > 0 ? parseFloat(data.spend || 0) / results : 0;

      return { results, costOfResults };
    };

    const { results, costOfResults } = getResultsData(primaryData);
    
    // ROAS will be calculated from Shopify webhook data, not Meta conversion values
    
    return {
      // Primary data (most recent with activity)
      spend: parseFloat((parseFloat(primaryData.spend || 0)).toFixed(2)), // Account insights spend is already in dollars
      impressions: parseInt(primaryData.impressions || 0),
      clicks: primaryLinkClicks, // Link clicks instead of total clicks
      total_clicks: parseInt(primaryData.clicks || 0), // Keep total clicks for reference
      cpm: parseFloat(primaryData.cpm || 0), // CPM is already in correct format from Insights API
      cpc: parseFloat(primaryLinkCPC.toFixed(4)), // Link CPC instead of total CPC
      total_cpc: parseFloat(primaryData.cpc || 0), // Keep total CPC for reference
      ctr: parseFloat(primaryLinkCTR.toFixed(4)), // Link CTR instead of total CTR
      total_ctr: parseFloat(primaryData.ctr || 0), // Keep total CTR for reference
      frequency: parseFloat(primaryData.frequency || 0),
      reach: parseInt(primaryData.reach || 0),
      actions: primaryData.actions || [],
      results: results, // Number of purchases
      costOfResults: parseFloat(costOfResults.toFixed(2)), // Cost per purchase
      date: primaryDate,
      
      // Yesterday's data for comparison (only for single-day ranges)
      ...(dateRange === '24h' || !dateRange ? {
        yesterday: {
          spend: parseFloat((parseFloat(yesterdayData.spend || 0)).toFixed(2)),
          impressions: parseInt(yesterdayData.impressions || 0),
          clicks: yesterdayLinkClicks, // Link clicks instead of total clicks
          total_clicks: parseInt(yesterdayData.clicks || 0), // Keep total clicks for reference
          cpm: parseFloat(yesterdayData.cpm || 0),
          cpc: parseFloat(yesterdayLinkCPC.toFixed(4)), // Link CPC instead of total CPC
          total_cpc: parseFloat(yesterdayData.cpc || 0), // Keep total CPC for reference
          ctr: parseFloat(yesterdayLinkCTR.toFixed(4)), // Link CTR instead of total CTR
          total_ctr: parseFloat(yesterdayData.ctr || 0), // Keep total CTR for reference
          frequency: parseFloat(yesterdayData.frequency || 0),
          reach: parseInt(yesterdayData.reach || 0),
          actions: yesterdayData.actions || [],
          date: (new Date(Date.now() - 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
        }
      } : {})
    };
  }


  // Get campaign-level insights to match Facebook Ads Manager view
  async getCampaignInsights({ dateRange = '1d', limit = 50 }) {
    const endpoint = `${this.adAccountId}/campaigns`;
    
    const requestParams = {
      fields: 'id,name,status,effective_status,insights{spend,impressions,clicks,cpm,cpc,ctr,frequency,reach,actions,action_values,cost_per_action_type}',
      limit,
      time_range: JSON.stringify(this.getDateRange(dateRange)),
      attribution_window: '1d_click'
    };

    const response = await this.makeRequest(endpoint, requestParams, 'campaignInsights');
    
    // Process campaign data with insights
    const campaigns = response.data || [];
    
    return campaigns.map(campaign => {
      const insights = campaign.insights?.data?.[0] || {};
      
      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        effective_status: campaign.effective_status,
        spend: parseFloat((parseFloat(insights.spend || 0) / 100).toFixed(2)), // Campaign insights spend is in cents
        impressions: parseInt(insights.impressions || 0),
        clicks: parseInt(insights.clicks || 0),
        cpm: parseFloat(insights.cpm || 0), // Campaign insights CPM is already in dollars
        cpc: parseFloat(insights.cpc || 0), // Campaign insights CPC is already in dollars
        ctr: parseFloat(insights.ctr || 0),
        frequency: parseFloat(insights.frequency || 0),
        reach: parseInt(insights.reach || 0),
        actions: insights.actions || [],
        action_values: insights.action_values || [],
        cost_per_action_type: insights.cost_per_action_type || []
      };
    });
  }

  // Get campaign-level insights with direct insights endpoint
  async getCampaignInsightsDirect({ dateRange = '1d', limit = 50 }) {
    const endpoint = `${this.adAccountId}/insights`;
    
    const requestParams = {
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,cpm,cpc,ctr,frequency,reach,actions,action_values,cost_per_action_type',
      limit,
      time_range: JSON.stringify(this.getDateRange(dateRange)),
      level: 'campaign',
      breakdowns: 'action_type'
    };

    const response = await this.makeRequest(endpoint, requestParams, 'campaignInsightsDirect');
    
    // Process campaign data with insights
    const campaigns = response.data || [];
    
    return campaigns.map(campaign => {
      return {
        id: campaign.campaign_id,
        name: campaign.campaign_name,
        spend: parseFloat((parseFloat(campaign.spend || 0) / 100).toFixed(2)), // Campaign insights spend is in cents
        impressions: parseInt(campaign.impressions || 0),
        clicks: parseInt(campaign.clicks || 0),
        cpm: parseFloat(campaign.cpm || 0), // Campaign insights CPM is already in dollars
        cpc: parseFloat(campaign.cpc || 0), // Campaign insights CPC is already in dollars
        ctr: parseFloat(campaign.ctr || 0),
        frequency: parseFloat(campaign.frequency || 0),
        reach: parseInt(campaign.reach || 0),
        actions: campaign.actions || [],
        action_values: campaign.action_values || [],
        cost_per_action_type: campaign.cost_per_action_type || []
      };
    });
  }

  // Test different approaches to get conversion values
  async testConversionValues({ dateRange = '24h' }) {
    const results = {};
    const timeRange = this.getDateRange(dateRange);
    
    // Test 1: Account insights with different fields
    try {
      const endpoint1 = `${this.adAccountId}/insights`;
      const params1 = {
        fields: 'actions,action_values,cost_per_action_type',
        time_range: JSON.stringify(timeRange),
        level: 'account'
      };
      const response1 = await this.makeRequest(endpoint1, params1, 'testConversion1');
      results.account_insights = response1.data?.[0] || null;
    } catch (error) {
      results.account_insights = { error: error.message };
    }

    // Test 2: Account insights with breakdowns
    try {
      const endpoint2 = `${this.adAccountId}/insights`;
      const params2 = {
        fields: 'actions,action_values,cost_per_action_type',
        time_range: JSON.stringify(timeRange),
        level: 'account',
        breakdowns: 'action_type'
      };
      const response2 = await this.makeRequest(endpoint2, params2, 'testConversion2');
      results.account_insights_breakdowns = response2.data || null;
    } catch (error) {
      results.account_insights_breakdowns = { error: error.message };
    }

    // Test 3: Campaign insights with different attribution windows
    try {
      const endpoint3 = `${this.adAccountId}/campaigns`;
      const params3 = {
        fields: 'id,name,insights{actions,action_values,cost_per_action_type}',
        time_range: JSON.stringify(timeRange),
        attribution_window: '1d_click'
      };
      const response3 = await this.makeRequest(endpoint3, params3, 'testConversion3');
      results.campaign_insights_1d_click = response3.data || null;
    } catch (error) {
      results.campaign_insights_1d_click = { error: error.message };
    }

    // Test 4: Campaign insights with 7d attribution
    try {
      const endpoint4 = `${this.adAccountId}/campaigns`;
      const params4 = {
        fields: 'id,name,insights{actions,action_values,cost_per_action_type}',
        time_range: JSON.stringify(timeRange),
        attribution_window: '7d_click'
      };
      const response4 = await this.makeRequest(endpoint4, params4, 'testConversion4');
      results.campaign_insights_7d_click = response4.data || null;
    } catch (error) {
      results.campaign_insights_7d_click = { error: error.message };
    }

    // Test 5: Direct insights endpoint with campaign level
    try {
      const endpoint5 = `${this.adAccountId}/insights`;
      const params5 = {
        fields: 'campaign_id,campaign_name,actions,action_values,cost_per_action_type',
        time_range: JSON.stringify(timeRange),
        level: 'campaign'
      };
      const response5 = await this.makeRequest(endpoint5, params5, 'testConversion5');
      results.insights_campaign_level = response5.data || null;
    } catch (error) {
      results.insights_campaign_level = { error: error.message };
    }

    // Test 6: Account insights with different date range (yesterday only)
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const endpoint6 = `${this.adAccountId}/insights`;
      const params6 = {
        fields: 'spend,actions,action_values,cost_per_action_type',
        time_range: JSON.stringify({
          since: yesterdayStr,
          until: yesterdayStr
        }),
        level: 'account'
      };
      const response6 = await this.makeRequest(endpoint6, params6, 'testConversion6');
      results.account_insights_yesterday = response6.data?.[0] || null;
    } catch (error) {
      results.account_insights_yesterday = { error: error.message };
    }

    // Test 7: Campaign insights with yesterday only
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const endpoint7 = `${this.adAccountId}/campaigns`;
      const params7 = {
        fields: 'id,name,insights{actions,action_values,cost_per_action_type}',
        time_range: JSON.stringify({
          since: yesterdayStr,
          until: yesterdayStr
        })
      };
      const response7 = await this.makeRequest(endpoint7, params7, 'testConversion7');
      results.campaign_insights_yesterday = response7.data || null;
    } catch (error) {
      results.campaign_insights_yesterday = { error: error.message };
    }

    return results;
  }

  // Get ad insights using the insights endpoint with level=ad
  async getAdInsights({ dateRange = '30d', limit = 50, status, startDate, endDate }) {
    const endpoint = `${this.adAccountId}/insights`;
    
    // Get date range for insights
    let timeRange;
    if (dateRange === 'custom' && startDate && endDate) {
      timeRange = {
        since: startDate,
        until: endDate
      };
    } else {
      timeRange = {
        since: this.getDateRange(dateRange).since,
        until: this.getDateRange(dateRange).until
      };
    }

    // Try different approaches to get date-specific ad-level data
    const approaches = [
      // Approach 1: Direct insights with level=ad and 7d_click attribution
      {
        name: 'direct_insights',
        params: {
          fields: 'ad_id,ad_name,impressions,clicks,spend,cpm,cpc,ctr,frequency,reach,actions,action_values,cost_per_action_type,date_start,date_stop',
          level: 'ad',
          limit,
          time_range: JSON.stringify(timeRange),
          attribution_window: '7d_click'
        }
      },
      // Approach 2: Direct insights with 1d_view attribution
      {
        name: 'direct_insights_1d_view',
        params: {
          fields: 'ad_id,ad_name,impressions,clicks,spend,cpm,cpc,ctr,frequency,reach,actions,action_values,cost_per_action_type,date_start,date_stop',
          level: 'ad',
          limit,
          time_range: JSON.stringify(timeRange),
          attribution_window: '1d_view'
        }
      },
      // Approach 3: Direct insights with 7d_view attribution
      {
        name: 'direct_insights_7d_view',
        params: {
          fields: 'ad_id,ad_name,impressions,clicks,spend,cpm,cpc,ctr,frequency,reach,actions,action_values,cost_per_action_type,date_start,date_stop',
          level: 'ad',
          limit,
          time_range: JSON.stringify(timeRange),
          attribution_window: '7d_view'
        }
      },
      // Approach 4: Direct insights with date_preset
      {
        name: 'direct_insights_preset',
        params: {
          fields: 'ad_id,ad_name,impressions,clicks,spend,cpm,cpc,ctr,frequency,reach,actions,action_values,cost_per_action_type,date_start,date_stop',
          level: 'ad',
          limit,
          date_preset: dateRange === 'today' ? 'today' : dateRange === 'yesterday' ? 'yesterday' : dateRange === '7d' ? 'last_7d' : 'last_30d',
          attribution_window: '1d_click'
        }
      }
    ];

    // Try each approach until we get data with proper date ranges
    for (const approach of approaches) {
      try {
        logger.info(`Trying approach: ${approach.name}`, { params: approach.params });
        
        const response = await this.makeRequest(endpoint, approach.params, `ad_insights_${approach.name}`);
        
        if (response.data && response.data.length > 0) {
          // Check if we got date-specific data
          const firstAd = response.data[0];
          const hasDateSpecificData = firstAd.date_start && firstAd.date_stop && 
            firstAd.date_start === firstAd.date_stop && 
            firstAd.date_start === timeRange.since;

          logger.info(`Approach ${approach.name} returned data`, { 
            count: response.data.length,
            firstAdDate: firstAd.date_start,
            expectedDate: timeRange.since,
            hasDateSpecificData
          });

          if (hasDateSpecificData) {
            const processedData = this.processAdInsightsData(response.data);
            
            // Check if we have purchase conversion values, if not, add default ones
            return processedData.map(ad => {
              const hasPurchaseConversionValues = ad.metrics.action_values && 
                ad.metrics.action_values.some(action => 
                  action.action_type && action.action_type.includes('purchase') && parseFloat(action.value || 0) > 0
                );
              
              if (!hasPurchaseConversionValues) {
                // Calculate default conversion values
                const adConversions = ad.metrics.actions.filter(action => 
                  action.action_type && action.action_type.includes('purchase')
                );
                const adConversionCount = adConversions.reduce((sum, conv) => sum + parseInt(conv.value || 0), 0);
                const defaultConversionValuePerPurchase = 50; // Default $50 per purchase
                const conversionValue = adConversionCount * defaultConversionValuePerPurchase;
                
                const defaultActionValues = [];
                if (conversionValue > 0) {
                  defaultActionValues.push({
                    action_type: 'purchase',
                    value: conversionValue.toFixed(2)
                  });
                }
                
                return {
                  ...ad,
                  metrics: {
                    ...ad.metrics,
                    action_values: defaultActionValues
                  }
                };
              }
              
              return ad;
            });
          }
        }
      } catch (error) {
        logger.warn(`Approach ${approach.name} failed:`, error.message);
      }
    }

    // If all approaches fail, fall back to getAdsData with proportional conversion values
    logger.warn('All direct insights approaches failed, falling back to getAdsData with proportional conversion values');
    const adsData = await this.getAdsData({ dateRange, limit, status, startDate, endDate });
    
    if (!Array.isArray(adsData) || adsData.length === 0) {
      return [];
    }

    // Get account-level conversion data to distribute proportionally
    const accountInsights = await this.getTodaySpendData({ dateRange });
    const totalAccountConversionValue = accountInsights.action_values ? 
      accountInsights.action_values
        .filter(action => action.action_type && action.action_type.includes('purchase'))
        .reduce((sum, action) => sum + parseFloat(action.value || 0), 0) : 0;

    // If we don't have conversion values from Meta API, use a default value per purchase
    const defaultConversionValuePerPurchase = 50; // Default $50 per purchase

    // Calculate total conversions across all ads
    const totalAdConversions = adsData.reduce((sum, ad) => {
      const conversions = ad.metrics.actions.filter(action => 
        action.action_type && action.action_type.includes('purchase')
      );
      return sum + conversions.reduce((adSum, conv) => adSum + parseInt(conv.value || 0), 0);
    }, 0);

    // Distribute conversion values proportionally
    return adsData.map(ad => {
      const adConversions = ad.metrics.actions.filter(action => 
        action.action_type && action.action_type.includes('purchase')
      );
      const adConversionCount = adConversions.reduce((sum, conv) => sum + parseInt(conv.value || 0), 0);
      
      // Calculate conversion value - use Meta API data if available, otherwise use default
      let conversionValue = 0;
      if (totalAccountConversionValue > 0) {
        // Use proportional distribution from Meta API data
        conversionValue = totalAdConversions > 0 && adConversionCount > 0 ? 
          (adConversionCount / totalAdConversions) * totalAccountConversionValue : 0;
      } else {
        // Use default value per purchase
        conversionValue = adConversionCount * defaultConversionValuePerPurchase;
      }

      // Create proportional action_values
      const proportionalActionValues = [];
      if (conversionValue > 0) {
        proportionalActionValues.push({
          action_type: 'purchase',
          value: conversionValue.toFixed(2)
        });
      }

      return {
        ...ad,
        metrics: {
          ...ad.metrics,
          action_values: proportionalActionValues
        }
      };
    });
  }

  // Get basic ads data without insights (for hybrid approach)
  async getAdsData({ dateRange = '30d', limit = 50, status, fields, startDate, endDate, _t }) {
    const endpoint = `${this.adAccountId}/ads`;
    
        // Don't include insights in the main request - get them individually for date-specific data
        const defaultFields = [
          'id',
          'name', 
          'status',
          'effective_status',
          'created_time',
          'updated_time',
          'creative{id,thumbnail_url,image_url,object_story_spec{link_data{image_hash},photo_data{image_hash}},body,title,object_type,image_hash,effective_object_story_id}'
        ];

    // Handle custom date range
    let timeRange;
    if (dateRange === 'custom' && startDate && endDate) {
      timeRange = {
        since: startDate,
        until: endDate
      };
    } else {
      timeRange = {
        since: this.getDateRange(dateRange).since,
        until: this.getDateRange(dateRange).until
      };
    }

        const requestParams = {
          fields: fields || defaultFields.join(','),
          limit
        };

    // Add cache busting parameter if provided
    if (_t) {
      requestParams._t = _t;
    }

    // Add status filter if provided
    if (status) {
      requestParams.effective_status = JSON.stringify([status]);
    }

        logger.info('Fetching basic ads data', { dateRange, limit, status });
        
        const response = await this.makeRequest(endpoint, requestParams, 'ads');
        
        // Process basic ad data without insights
        return this.processBasicAdsData(response.data || []);
  }

  // Process basic ad data without insights
  processBasicAdsData(ads) {
    // Filter out adsets - adsets typically have different naming patterns or structure
    const actualAds = ads.filter(ad => {
      // Filter out adsets by checking for common adset indicators
      const name = ad.name?.toLowerCase() || '';
      
      // Skip if it looks like an adset (contains common adset indicators)
      if (name.includes('| static |') || 
          name.includes('| dynamic |') || 
          name.includes('| video |') ||
          name.includes('adset') ||
          name.includes('campaign') ||
          // Skip if the name is too generic or looks like an adset
          (name.length < 10 && !name.includes('ad'))) {
        logger.info(`Filtering out potential adset: ${ad.name}`);
        return false;
      }
      
      return true;
    });

    logger.info(`Filtered ${ads.length} items down to ${actualAds.length} actual ads`);
    
    return actualAds.map(ad => {
      // Get image URL from creative
      let imageUrl = null;
      let imageSource = 'none';
      
      if (ad.creative) {
        // Try different image sources in order of preference
        if (ad.creative.thumbnail_url) {
          imageUrl = ad.creative.thumbnail_url;
          imageSource = 'thumbnail_url';
        } else if (ad.creative.image_url) {
          imageUrl = ad.creative.image_url;
          imageSource = 'image_url';
        } else if (ad.creative.object_story_spec?.link_data?.image_hash) {
          imageUrl = `https://scontent.xx.fbcdn.net/v/t39.30808-1/${ad.creative.object_story_spec.link_data.image_hash}_n.jpg`;
          imageSource = 'link_data_image_hash';
        } else if (ad.creative.object_story_spec?.photo_data?.image_hash) {
          imageUrl = `https://scontent.xx.fbcdn.net/v/t39.30808-1/${ad.creative.object_story_spec.photo_data.image_hash}_n.jpg`;
          imageSource = 'photo_data_image_hash';
        } else if (ad.creative.image_hash) {
          imageUrl = `https://scontent.xx.fbcdn.net/v/t39.30808-1/${ad.creative.image_hash}_n.jpg`;
          imageSource = 'image_hash';
        }
      }

      return {
        ...ad,
        creative: ad.creative ? {
          ...ad.creative,
          image_url: imageUrl,
          thumbnail_url: imageUrl,
          image_source: imageSource // Track where the image came from
        } : null,
        // No insights data - will be loaded separately
        insights: null,
        metrics: null,
        performance_score: null,
        status_color: this.getStatusColor(ad.effective_status)
      };
    });
  }

  // Get individual ad insights with caching
  async getAdInsights(adId, dateRange = 'today', _t) {
    try {
      const cacheKey = `ad_insights_${adId}_${dateRange}`;
      
      // Check cache first, but bypass cache if _t parameter is present (cache busting)
      if (!_t) {
        const cachedData = this.getFromCache(cacheKey);
        if (cachedData) {
          logger.info(`Cache hit for ad insights: ${adId}`, { cachedData });
          return cachedData;
        }
      }

      const endpoint = `${adId}/insights`;
      const timeRange = this.getDateRange(dateRange);
      
      const approaches = [
        {
          name: 'date_preset_today_1d_click',
          params: {
            fields: 'actions,action_values,spend,date_start,date_stop,impressions,clicks,cpm,cpc,ctr,frequency,reach,cost_per_action_type',
            date_preset: dateRange === 'today' ? 'today' : dateRange === 'yesterday' ? 'yesterday' : dateRange === '7d' ? 'last_7d' : dateRange === '30d' ? 'last_30d' : 'last_7d',
            attribution_window: '1d_click'
          }
        },
        {
          name: 'date_preset_today_7d_click',
          params: {
            fields: 'actions,action_values,spend,date_start,date_stop,impressions,clicks,cpm,cpc,ctr,frequency,reach,cost_per_action_type',
            date_preset: dateRange === 'today' ? 'today' : dateRange === 'yesterday' ? 'yesterday' : dateRange === '7d' ? 'last_7d' : dateRange === '30d' ? 'last_30d' : 'last_7d',
            attribution_window: '7d_click'
          }
        },
        {
          name: 'date_preset_today_1d_view',
          params: {
            fields: 'actions,action_values,spend,date_start,date_stop,impressions,clicks,cpm,cpc,ctr,frequency,reach,cost_per_action_type',
            date_preset: dateRange === 'today' ? 'today' : dateRange === 'yesterday' ? 'yesterday' : dateRange === '7d' ? 'last_7d' : dateRange === '30d' ? 'last_30d' : 'last_7d',
            attribution_window: '1d_view'
          }
        }
      ];
      
      for (const approach of approaches) {
        try {
          logger.info(`Trying ad insights approach: ${approach.name} for ad ${adId}`);
          
          // Add cache busting parameter if provided
          const params = { ...approach.params };
          if (_t) {
            params._t = _t;
          }
          
              const response = await this.makeRequest(endpoint, params, 'ad_insights');
              
              if (response.data) {
                const data = response.data[0] || {};
                // Removed detailed logging for performance
            
            // Check if we got any useful data (very lenient)
            const isDateSpecific = data.date_start && data.date_stop && 
              (data.date_start === timeRange.since || 
               data.date_start === data.date_stop ||
               (data.spend && parseFloat(data.spend) >= 0) ||
               (data.actions && data.actions.length > 0) ||
               (data.impressions && parseInt(data.impressions) >= 0) ||
               (data.clicks && parseInt(data.clicks) >= 0));
            
            logger.info(`Ad insights result for ${approach.name}:`, {
              date_start: data.date_start,
              date_stop: data.date_stop,
              expected_date: timeRange.since,
              isDateSpecific,
              spend: data.spend,
              purchase_actions: data.actions?.filter(a => a.action_type.includes('purchase')),
              purchase_values: data.action_values?.filter(a => a.action_type.includes('purchase'))
            });
            
            // Accept any response that has the basic structure, even if values are 0 or empty
            if (data && typeof data === 'object') {
              // Process the insights data
              const processedData = this.processAdInsightsData(data);
              
              // Cache the result
              this.setCache(cacheKey, processedData, 300); // Cache for 5 minutes
              
              return processedData;
            }
          }
        } catch (error) {
          logger.warn(`Failed to get ad insights with ${approach.name}:`, error.message);
        }
      }
      
      // If all approaches fail, return null
      logger.warn(`All ad insights approaches failed for ad ${adId}`);
      return null;
      
    } catch (error) {
      logger.error(`Error fetching ad insights for ${adId}:`, error);
      return null;
    }
  }

  // Helper method to process individual ad insights data
  processAdInsightsData(insightData) {
    // Extract link clicks from actions array
    const actions = insightData.actions || [];
    const linkClickAction = actions.find(action => action.action_type === 'link_click');
    const linkClicks = linkClickAction ? parseInt(linkClickAction.value || 0) : 0;
    
    const metrics = {
      impressions: parseInt(insightData.impressions || 0),
      clicks: linkClicks, // Use link clicks from actions instead of total clicks
      spend: parseFloat(insightData.spend || 0),
      cpm: parseFloat(insightData.cpm || 0),
      cpc: parseFloat(insightData.cpc || 0),
      ctr: parseFloat(insightData.ctr || 0),
      frequency: parseFloat(insightData.frequency || 0),
      reach: parseInt(insightData.reach || 0),
      actions: actions,
      action_values: insightData.action_values || [],
      cost_per_action_type: insightData.cost_per_action_type || []
    };

    const performanceScore = this.calculatePerformanceScore(metrics);

    return {
      metrics: metrics,
      performance_score: performanceScore,
      date_start: insightData.date_start,
      date_stop: insightData.date_stop
    };
  }

  // Process ad insights data from the insights endpoint (bulk processing)
  processBulkAdInsightsData(insightsData) {
    // Filter out adsets - adsets typically have different naming patterns or structure
    const actualAds = insightsData.filter(insight => {
      // Filter out adsets by checking for common adset naming patterns
      const name = insight.ad_name?.toLowerCase() || '';
      
      // Skip if it looks like an adset (contains common adset indicators)
      if (name.includes('| static |') || 
          name.includes('| dynamic |') || 
          name.includes('| video |') ||
          name.includes('adset') ||
          name.includes('campaign') ||
          // Skip if the name is too generic or looks like an adset
          (name.length < 10 && !name.includes('ad'))) {
        logger.info(`Filtering out potential adset from insights: ${insight.ad_name}`);
        return false;
      }
      
      return true;
    });

    logger.info(`Filtered ${insightsData.length} insights down to ${actualAds.length} actual ads`);
    
    return actualAds.map(insight => {
      // Extract link clicks from actions array
      const actions = insight.actions || [];
      const linkClickAction = actions.find(action => action.action_type === 'link_click');
      const linkClicks = linkClickAction ? parseInt(linkClickAction.value || 0) : 0;
      
      const metrics = {
        impressions: parseInt(insight.impressions || 0),
        clicks: linkClicks, // Use link clicks from actions instead of total clicks
        spend: parseFloat(insight.spend || 0),
        cpm: parseFloat(insight.cpm || 0),
        cpc: parseFloat(insight.cpc || 0),
        ctr: parseFloat(insight.ctr || 0),
        frequency: parseFloat(insight.frequency || 0),
        reach: parseInt(insight.reach || 0),
        actions: actions,
        action_values: insight.action_values || [],
        cost_per_action_type: insight.cost_per_action_type || []
      };

      // Calculate performance score
      const performanceScore = this.calculatePerformanceScore(metrics);

      return {
        id: insight.ad_id,
        name: insight.ad_name,
        status: 'ACTIVE', // Insights endpoint doesn't return status
        effective_status: 'ACTIVE',
        created_time: null, // Insights endpoint doesn't return creation time
        updated_time: null, // Insights endpoint doesn't return update time
        creative: null, // Insights endpoint doesn't return creative data
        insights: {
          data: [{
            ...metrics,
            date_start: insight.date_start,
            date_stop: insight.date_stop
          }]
        },
        metrics,
        performance_score: performanceScore
      };
    });
  }


  // Get campaigns data
  async getCampaignsData({ dateRange = '30d', limit = 50, status = 'ACTIVE' }) {
    const endpoint = `${this.adAccountId}/campaigns`;
    
    const fields = [
      'id',
      'name',
      'status',
      'effective_status', 
      'created_time',
      'updated_time',
      'insights{impressions,clicks,spend,cpm,cpc,ctr,frequency,reach,actions,cost_per_action_type}'
    ];

    const requestParams = {
      fields: fields.join(','),
      limit,
      effective_status: status,
      time_range: JSON.stringify({
        since: this.getDateRange(dateRange).since,
        until: this.getDateRange(dateRange).until
      })
    };

    const response = await this.makeRequest(endpoint, requestParams, 'campaigns');
    
    return response.data || [];
  }

  // Get ad sets data
  async getAdsetsData({ dateRange = '30d', limit = 50, status = 'ACTIVE' }) {
    const endpoint = `${this.adAccountId}/adsets`;
    
    const fields = [
      'id',
      'name',
      'status',
      'effective_status',
      'created_time', 
      'updated_time',
      'targeting',
      'optimization_goal',
      'billing_event',
      'bid_strategy',
      'insights{impressions,clicks,spend,cpm,cpc,ctr,frequency,reach,actions,cost_per_action_type}'
    ];

    const requestParams = {
      fields: fields.join(','),
      limit,
      effective_status: status,
      time_range: JSON.stringify({
        since: this.getDateRange(dateRange).since,
        until: this.getDateRange(dateRange).until
      })
    };

    const response = await this.makeRequest(endpoint, requestParams, 'adsets');
    
    return response.data || [];
  }

  // Process and enrich ads data
  async processAdsData(ads, accountConversionData = null) {
    // Filter out adsets - adsets typically have different naming patterns or structure
    const actualAds = ads.filter(ad => {
      // Filter out adsets by checking for common adset naming patterns
      const name = ad.name?.toLowerCase() || '';
      
      // Skip if it looks like an adset (contains common adset indicators)
      if (name.includes('| static |') || 
          name.includes('| dynamic |') || 
          name.includes('| video |') ||
          name.includes('adset') ||
          name.includes('campaign') ||
          // Skip if the name is too generic or looks like an adset
          (name.length < 10 && !name.includes('ad'))) {
        logger.info(`Filtering out potential adset: ${ad.name}`);
        return false;
      }
      
      return true;
    });

    logger.info(`Filtered ${ads.length} items down to ${actualAds.length} actual ads`);
    
    // If we have account-level conversion data, distribute it proportionally to ads
    let totalAdSpend = 0;
    let totalAccountConversions = 0;
    let totalAccountConversionValue = 0;
    
    if (accountConversionData) {
      // Calculate total ad spend
      totalAdSpend = actualAds.reduce((sum, ad) => {
        const insights = ad.insights?.data?.[0] || {};
        return sum + parseFloat(insights.spend || 0);
      }, 0);
      
      // Get total account conversions and conversion value
      if (accountConversionData.actions) {
        const purchaseActions = accountConversionData.actions.filter(action => 
          action.action_type && action.action_type.includes('purchase')
        );
        totalAccountConversions = purchaseActions.reduce((sum, action) => 
          sum + parseInt(action.value || 0), 0
        );
      }
      
      if (accountConversionData.action_values) {
        const purchaseValues = accountConversionData.action_values.filter(action => 
          action.action_type && action.action_type.includes('purchase')
        );
        
        // Get unique conversion values to avoid double counting the same conversion
        const uniqueValues = [...new Set(purchaseValues.map(action => parseFloat(action.value || 0)))];
        
        // Use the highest value (most likely the real conversion value)
        // Meta API often reports the same conversion multiple times with different action types
        totalAccountConversionValue = uniqueValues.length > 0 ? Math.max(...uniqueValues) : 0;
      }
      
      // If no conversion values from Meta API, use a default value per purchase
      if (totalAccountConversionValue === 0 && totalAccountConversions > 0) {
        const defaultConversionValuePerPurchase = 50; // Default $50 per purchase
        totalAccountConversionValue = totalAccountConversions * defaultConversionValuePerPurchase;
      }
      
      logger.info(`Account conversion data: ${totalAccountConversions} conversions, $${totalAccountConversionValue} value, $${totalAdSpend} total ad spend`);
    }
    
    return actualAds.map(ad => {
      const insights = ad.insights?.data?.[0] || {};
      
      // Extract and normalize image URL from creative data
      let imageUrl = null;
      let imageSource = 'none';
      
      if (ad.creative) {
        // Determine ad type for appropriate image sizing
        const isVideoAd = ad.creative.object_story_spec?.video_data != null;
        const adType = isVideoAd ? 'video' : 'static';
        
        // Prioritize high-quality images from object_story_spec first
        if (ad.creative.object_story_spec) {
          const spec = ad.creative.object_story_spec;
          
          // Check for video data (for video ads) - this usually has the best quality
          if (spec.video_data && spec.video_data.image_url) {
            imageUrl = this.getHighQualityImageUrl(spec.video_data.image_url, 'video', spec.video_data.image_hash);
            imageSource = 'video_thumbnail';
          }
          
          // Check for photo data
          if (!imageUrl && spec.photo_data && spec.photo_data.url) {
            imageUrl = this.getHighQualityImageUrl(spec.photo_data.url, 'static');
            imageSource = 'photo_data';
          }
          
          // Check for link data (for link ads with images)
          if (!imageUrl && spec.link_data && spec.link_data.picture) {
            imageUrl = this.getHighQualityImageUrl(spec.link_data.picture, 'static');
            imageSource = 'link_data';
          }
        }
        
        // Fall back to direct image fields
        if (!imageUrl) {
          // For static ads, prioritize image_url over thumbnail_url as it often has better quality
          if (ad.creative.image_url) {
            imageUrl = this.getHighQualityImageUrl(ad.creative.image_url, adType, ad.creative.image_hash);
            imageSource = 'image_url';
          } else if (ad.creative.thumbnail_url) {
            imageUrl = this.getHighQualityImageUrl(ad.creative.thumbnail_url, adType, ad.creative.image_hash);
            imageSource = 'thumbnail_url';
          }
        }
      }
      
      // Calculate proportional conversion data for this ad
      // Start with insights actions but REMOVE all purchase-related actions (they are lifetime data)
      let proportionalActions = (insights.actions || []).filter(action => 
        !action.action_type.includes('purchase') && 
        !action.action_type.includes('omni_purchase')
      );
      let proportionalActionValues = (insights.action_values || []).filter(action => 
        !action.action_type.includes('purchase') && 
        !action.action_type.includes('omni_purchase')
      );
      
      if (accountConversionData && totalAdSpend > 0 && insights.spend > 0) {
        const adSpend = parseFloat(insights.spend || 0);
        const adSpendRatio = adSpend / totalAdSpend;
        
        // Calculate proportional conversions for this ad
        const adConversions = Math.round(totalAccountConversions * adSpendRatio);
        const adConversionValue = totalAccountConversionValue * adSpendRatio;
        
        // Add proportional purchase actions
        if (adConversions > 0) {
          proportionalActions.push({
            action_type: 'purchase',
            value: adConversions.toString()
          });
          
          // Add proportional action values
          if (adConversionValue > 0) {
            proportionalActionValues.push({
              action_type: 'purchase',
              value: adConversionValue.toFixed(2)
            });
          }
        }
        
        logger.info(`Ad "${ad.name}": $${adSpend} spend (${(adSpendRatio * 100).toFixed(1)}%), ${adConversions} conversions, $${adConversionValue.toFixed(2)} value`);
      }
      
      return {
        ...ad,
        creative: ad.creative ? {
          ...ad.creative,
          image_url: imageUrl,
          thumbnail_url: imageUrl,
          image_source: imageSource // Track where the image came from
        } : null,
        metrics: {
          impressions: parseInt(insights.impressions || 0),
          clicks: parseInt(insights.clicks || 0), // Keep total clicks for proportional distribution
          spend: parseFloat(insights.spend || 0),
          cpm: parseFloat(insights.cpm || 0),
          cpc: parseFloat(insights.cpc || 0),
          ctr: parseFloat(insights.ctr || 0),
          frequency: parseFloat(insights.frequency || 0),
          reach: parseInt(insights.reach || 0),
          actions: proportionalActions,
          action_values: proportionalActionValues,
          cost_per_action_type: insights.cost_per_action_type || []
        },
        performance_score: this.calculatePerformanceScore(insights),
        status_color: this.getStatusColor(ad.effective_status)
      };
    });
  }

  // Get creative details including images
  async getCreativeDetails(creativeId) {
    const endpoint = creativeId;
    const fields = 'id,thumbnail_url,image_url,object_story_spec,body,title,object_type';
    
    try {
      const creativeData = await this.makeRequest(endpoint, { fields });
      
      // Extract image URL from various possible locations
      let imageUrl = null;
      
      // Try direct image fields first
      if (creativeData.thumbnail_url) {
        imageUrl = creativeData.thumbnail_url;
      } else if (creativeData.image_url) {
        imageUrl = creativeData.image_url;
      }
      
      // Try to extract from object_story_spec
      if (!imageUrl && creativeData.object_story_spec) {
        const spec = creativeData.object_story_spec;
        
        // Check for photo data
        if (spec.photo_data && spec.photo_data.url) {
          imageUrl = spec.photo_data.url;
        } else if (spec.photo_data && spec.photo_data.image_hash) {
          // Try to get image URL from image hash
          imageUrl = await this.getImageUrlFromHash(spec.photo_data.image_hash);
        }
        
        // Check for link data (for link ads with images)
        if (!imageUrl && spec.link_data && spec.link_data.picture) {
          imageUrl = spec.link_data.picture;
        }
        
        // Check for video data (for video ads)
        if (!imageUrl && spec.video_data && spec.video_data.image_url) {
          imageUrl = spec.video_data.image_url;
        }
      }
      
      return {
        ...creativeData,
        image_url: imageUrl,
        thumbnail_url: imageUrl // Use same URL for both
      };
    } catch (error) {
      logger.error(`Failed to fetch creative details for ${creativeId}:`, error.message);
      return null;
    }
  }

  // Get image URL from image hash
  async getImageUrlFromHash(imageHash) {
    try {
      const endpoint = `${this.adAccountId}/adimages`;
      const params = {
        fields: 'permalink_url',
        hashes: JSON.stringify([imageHash])
      };
      
      const response = await this.makeRequest(endpoint, params);
      
      if (response.data && response.data.length > 0) {
        return response.data[0].permalink_url;
      }
      
      return null;
    } catch (error) {
      logger.warn(`Failed to get image URL for hash ${imageHash}:`, error.message);
      return null;
    }
  }

  // Get high quality image URL - prioritize best available source
  getHighQualityImageUrl(originalUrl, adType = 'static', imageHash = null) {
    if (!originalUrl) return null;
    
    // For now, return the original URL as-is
    // The Image Hash API (/adimages) is only for tech providers accessing client data
    // For your own ad account, we use the /ads endpoint with creative fields
    
    return originalUrl;
  }

  // Optimize image URL parameters for better quality
  optimizeImageUrl(url) {
    if (!url || !url.includes('scontent')) return url;
    
    try {
      // Remove low-quality parameters and add high-quality ones
      let optimizedUrl = url
        .replace(/p64x64[^&]*/g, '') // Remove p64x64 parameter
        .replace(/q75[^&]*/g, '') // Remove q75 parameter
        .replace(/tt6[^&]*/g, '') // Remove tt6 parameter
        .replace(/&+/g, '&') // Clean up multiple ampersands
        .replace(/[?&]$/, ''); // Remove trailing ? or &
      
      // Add high-quality parameters
      if (optimizedUrl.includes('?')) {
        optimizedUrl += '&w=1080&h=1080&q=100';
      } else {
        optimizedUrl += '?w=1080&h=1080&q=100';
      }
      
      return optimizedUrl;
    } catch (error) {
      logger.warn(`Error optimizing URL:`, error.message);
      return url;
    }
  }


  // Calculate a performance score based on key metrics
  calculatePerformanceScore(insights) {
    const spend = parseFloat(insights.spend || 0);
    const impressions = parseInt(insights.impressions || 0);
    const clicks = parseInt(insights.clicks || 0);
    const ctr = parseFloat(insights.ctr || 0);
    const cpm = parseFloat(insights.cpm || 0);
    const cpc = parseFloat(insights.cpc || 0);
    
    if (spend === 0 || impressions === 0) return 0;
    
    // Calculate individual metric scores (0-100 each)
    const scores = {
      roas: this.calculateROASScore(insights, spend),
      ctr: this.calculateCTRScore(ctr),
      clicks: this.calculateClickScore(clicks, impressions),
      cpm: this.calculateCPMScore(cpm),
      cpc: this.calculateCPCScore(cpc, clicks)
    };
    
    // Weighted average based on business importance
    // ROAS is most important (40%), CTR is important (25%), Clicks show engagement (20%), CPM/CPC are efficiency metrics (15% combined)
    const weights = {
      roas: 0.40,    // Most important - direct revenue impact
      ctr: 0.25,     // Important - engagement quality
      clicks: 0.20,  // Important - engagement volume
      cpm: 0.08,     // Efficiency metric
      cpc: 0.07      // Efficiency metric
    };
    
    // Calculate weighted score
    const weightedScore = 
      (scores.roas * weights.roas) +
      (scores.ctr * weights.ctr) +
      (scores.clicks * weights.clicks) +
      (scores.cpm * weights.cpm) +
      (scores.cpc * weights.cpc);
    
    return Math.round(Math.min(weightedScore, 100));
  }

  // Individual metric scoring functions (0-100 scale)
  calculateROASScore(insights, spend) {
    if (spend === 0) return 0;
    
    const actionValues = insights.action_values || [];
    let totalConversionValue = 0;
    
    // Filter for purchase actions and get unique values to avoid double counting
    const purchaseActionValues = actionValues.filter((action) => {
      const actionType = action.action_type.toLowerCase();
      return (actionType.includes('purchase') || 
              actionType === 'conversion' ||
              actionType.includes('sale') ||
              actionType.includes('order') ||
              actionType.includes('checkout')) &&
             !actionType.includes('view_content') && 
             !actionType.includes('add_to_cart') && 
             !actionType.includes('initiate_checkout');
    });
    
    if (purchaseActionValues.length > 0) {
      // Get unique conversion values to avoid double counting the same conversion
      const uniqueValues = [...new Set(purchaseActionValues.map((action) => parseFloat(action.value || 0)))];
      
      // Use the highest value (most likely the real conversion value)
      // Meta API often reports the same conversion multiple times with different action types
      totalConversionValue = Math.max(...uniqueValues);
    }
    
    const roas = totalConversionValue / spend;
    
    // ROAS scoring: 0-100 scale
    if (roas >= 4.0) return 100;      // Excellent (4x+)
    else if (roas >= 3.0) return 90;  // Very good (3x+)
    else if (roas >= 2.5) return 80;  // Good (2.5x+)
    else if (roas >= 2.0) return 70;  // Decent (2x+)
    else if (roas >= 1.5) return 60;  // Break-even+ (1.5x+)
    else if (roas >= 1.0) return 50;  // Break-even (1x+)
    else if (roas >= 0.5) return 30;  // Poor (0.5x+)
    else if (roas > 0) return 10;     // Very poor (some return)
    else return 0;                    // No return
  }

  calculateCTRScore(ctr) {
    // CTR scoring: 0-100 scale
    if (ctr >= 3.0) return 100;      // Excellent (3%+)
    else if (ctr >= 2.0) return 90;  // Very good (2%+)
    else if (ctr >= 1.5) return 80;  // Good (1.5%+)
    else if (ctr >= 1.0) return 70;  // Decent (1%+)
    else if (ctr >= 0.5) return 60;  // Average (0.5%+)
    else if (ctr >= 0.3) return 50;  // Below average (0.3%+)
    else if (ctr >= 0.1) return 30;  // Poor (0.1%+)
    else if (ctr > 0) return 10;     // Very poor (some clicks)
    else return 0;                   // No clicks
  }

  calculateClickScore(clicks, impressions) {
    if (impressions === 0) return 0;
    
    const clickRate = (clicks / impressions) * 100;
    
    // Click volume scoring: 0-100 scale (combines rate and volume)
    let volumeScore = 0;
    if (clicks >= 1000) volumeScore = 100;
    else if (clicks >= 500) volumeScore = 90;
    else if (clicks >= 200) volumeScore = 80;
    else if (clicks >= 100) volumeScore = 70;
    else if (clicks >= 50) volumeScore = 60;
    else if (clicks >= 20) volumeScore = 50;
    else if (clicks >= 10) volumeScore = 40;
    else if (clicks >= 5) volumeScore = 30;
    else if (clicks >= 1) volumeScore = 20;
    else return 0;
    
    // Combine click rate and volume (70% rate, 30% volume)
    const rateScore = Math.min(clickRate * 20, 100); // Scale CTR to 0-100
    return Math.round((rateScore * 0.7) + (volumeScore * 0.3));
  }

  calculateCPMScore(cpm) {
    // CPM scoring: 0-100 scale (lower is better)
    if (cpm <= 5) return 100;       // Excellent ($5 or less)
    else if (cpm <= 10) return 90;  // Very good ($10 or less)
    else if (cpm <= 15) return 80;  // Good ($15 or less)
    else if (cpm <= 20) return 70;  // Decent ($20 or less)
    else if (cpm <= 30) return 60;  // Average ($30 or less)
    else if (cpm <= 50) return 50;  // Below average ($50 or less)
    else if (cpm <= 75) return 30;  // Poor ($75 or less)
    else if (cpm <= 100) return 10; // Very poor ($100 or less)
    else return 0;                  // Extremely poor ($100+)
  }

  calculateCPCScore(cpc, clicks) {
    if (clicks === 0) return 0; // No clicks = no CPC score
    
    // CPC scoring: 0-100 scale (lower is better)
    if (cpc <= 0.5) return 100;     // Excellent ($0.50 or less)
    else if (cpc <= 1.0) return 90; // Very good ($1.00 or less)
    else if (cpc <= 1.5) return 80; // Good ($1.50 or less)
    else if (cpc <= 2.0) return 70; // Decent ($2.00 or less)
    else if (cpc <= 3.0) return 60; // Average ($3.00 or less)
    else if (cpc <= 5.0) return 50; // Below average ($5.00 or less)
    else if (cpc <= 8.0) return 30; // Poor ($8.00 or less)
    else if (cpc <= 12.0) return 10; // Very poor ($12.00 or less)
    else return 0;                  // Extremely poor ($12.00+)
  }

  // Get status color for UI
  getStatusColor(status) {
    const statusColors = {
      'ACTIVE': '#22c55e',
      'PAUSED': '#f59e0b', 
      'DELETED': '#ef4444',
      'PENDING_REVIEW': '#3b82f6',
      'DISAPPROVED': '#ef4444',
      'PREAPPROVED': '#10b981',
      'PENDING_BILLING_INFO': '#f59e0b',
      'CAMPAIGN_PAUSED': '#6b7280',
      'ADGROUP_PAUSED': '#6b7280'
    };
    
    return statusColors[status] || '#6b7280';
  }

  // Get detailed conversion data for debugging ROAS issues
  async getDetailedConversionData(adId, dateRange = 'today') {
    const endpoint = `${adId}/insights`;
    const timeRange = this.getDateRange(dateRange);
    
    // Try multiple attribution windows to get comprehensive conversion data
    const attributionWindows = ['1d_click', '7d_click', '1d_view', '7d_view'];
    const results = {};
    
    for (const window of attributionWindows) {
      try {
        const params = {
          fields: 'actions,action_values,cost_per_action_type,spend,date_start,date_stop',
          time_range: JSON.stringify(timeRange),
          attribution_window: window
        };
        
        const response = await this.makeRequest(endpoint, params, `conversion_${window}`);
        results[window] = response.data && response.data[0] ? response.data[0] : null;
        
        // Log the results for debugging
        if (results[window]) {
          logger.info(`Conversion data for ad ${adId} with ${window}:`, {
            date_start: results[window].date_start,
            date_stop: results[window].date_stop,
            spend: results[window].spend,
            actions: results[window].actions?.filter(a => a.action_type.includes('purchase')),
            action_values: results[window].action_values?.filter(a => a.action_type.includes('purchase'))
          });
        }
      } catch (error) {
        logger.warn(`Failed to get conversion data for window ${window}:`, error.message);
        results[window] = null;
      }
    }
    
    return results;
  }

  // Get date-specific insights for a specific ad
  async getAdSpecificInsights(adId, dateRange = 'today') {
    const endpoint = `${adId}/insights`;
    const timeRange = this.getDateRange(dateRange);
    
    // Try multiple approaches to get date-specific data
    const approaches = [
      {
        name: 'time_range_1d_click',
        params: {
          fields: 'actions,action_values,spend,date_start,date_stop',
          time_range: JSON.stringify(timeRange),
          attribution_window: '1d_click'
        }
      },
      {
        name: 'time_range_7d_click',
        params: {
          fields: 'actions,action_values,spend,date_start,date_stop',
          time_range: JSON.stringify(timeRange),
          attribution_window: '7d_click'
        }
      },
      {
        name: 'date_preset_today',
        params: {
          fields: 'actions,action_values,spend,date_start,date_stop',
          date_preset: dateRange === 'today' ? 'today' : dateRange === 'yesterday' ? 'yesterday' : 'last_7d',
          attribution_window: '1d_click'
        }
      }
    ];
    
    for (const approach of approaches) {
      try {
        logger.info(`Trying ad-specific insights approach: ${approach.name} for ad ${adId}`);
        
        const response = await this.makeRequest(endpoint, approach.params, `ad_specific_${approach.name}_${adId}`);
        
        if (response.data && response.data[0]) {
          const data = response.data[0];
          
          // Check if we got date-specific data
          const isDateSpecific = data.date_start && data.date_stop && 
            data.date_start === data.date_stop && 
            data.date_start === timeRange.since;
          
          logger.info(`Ad-specific insights result for ${approach.name}:`, {
            date_start: data.date_start,
            date_stop: data.date_stop,
            expected_date: timeRange.since,
            isDateSpecific,
            spend: data.spend,
            purchase_actions: data.actions?.filter(a => a.action_type.includes('purchase')),
            purchase_values: data.action_values?.filter(a => a.action_type.includes('purchase'))
          });
          
          if (isDateSpecific) {
            return data;
          }
        }
      } catch (error) {
        logger.warn(`Failed to get ad-specific insights with ${approach.name}:`, error.message);
      }
    }
    
    return null;
  }

  // Get date range for API requests
  getDateRange(range) {
    const now = new Date();
    
    // Use local timezone instead of UTC to match user's local date
    const getLocalDateString = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const until = getLocalDateString(now);
    
    let since;
    switch (range) {
      case 'today':
      case '24h':
      case '1d':
        // Today only
        since = until;
        break;
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        const yStr = getLocalDateString(y);
        return { since: yStr, until: yStr };
      }
      case '7d':
        since = getLocalDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
        break;
      case '30d':
        since = getLocalDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
        break;
      case '90d':
        since = getLocalDateString(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));
        break;
      default:
        since = getLocalDateString(now); // Default to today
    }
    
    return { since, until };
  }
}

module.exports = new MetaService();
