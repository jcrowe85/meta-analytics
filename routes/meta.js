const express = require('express');
const router = express.Router();
const metaService = require('../services/metaService');
const logger = require('../utils/logger');

// Get ads data from Meta account
router.get('/ads', async (req, res) => {
  try {
    const { 
      dateRange = '30d',
      limit = 50,
      status,
      fields,
      startDate,
      endDate,
      _t
    } = req.query;

    logger.info('Fetching ads data', { dateRange, limit, status });
    
    const adsData = await metaService.getAdsData({
      dateRange,
      limit: parseInt(limit),
      status,
      fields,
      startDate,
      endDate,
      _t
    });

    // Format currency values in ads data (Meta API returns values in cents)
    const formattedAdsData = adsData.map(ad => ({
      ...ad,
      metrics: ad.metrics ? {
        ...ad.metrics,
        spend: parseFloat((ad.metrics.spend / 100).toFixed(2)),
        cpm: parseFloat((ad.metrics.cpm / 100).toFixed(2)),
        cpc: parseFloat((ad.metrics.cpc / 100).toFixed(2))
      } : ad.metrics
    }));

    res.json({
      success: true,
      data: formattedAdsData,
      meta: {
        total: formattedAdsData.length,
        dateRange,
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching ads data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ads data',
      message: error.message
    });
  }
});

// Get ad insights directly (for date-specific conversion data)
router.get('/ad-insights', async (req, res) => {
  try {
    const { 
      dateRange = '30d',
      limit = 50,
      status = 'ACTIVE'
    } = req.query;

    logger.info('Fetching ad insights', { dateRange, limit, status });
    
    const adInsights = await metaService.getAdInsights({
      dateRange,
      limit: parseInt(limit),
      status
    });

    res.json({
      success: true,
      data: adInsights,
      meta: {
        dateRange,
        limit: parseInt(limit),
        status,
        count: adInsights.length,
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching ad insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ad insights',
      message: error.message
    });
  }
});

// Get ad account information
router.get('/account', async (req, res) => {
  try {
    logger.info('Fetching ad account information');
    
    const accountInfo = await metaService.getAccountInfo();
    
    // Format currency values (Meta API returns values in cents)
    const formattedAccountInfo = {
      ...accountInfo,
      amount_spent: (parseFloat(accountInfo.amount_spent) / 100).toFixed(2),
      balance: (parseFloat(accountInfo.balance) / 100).toFixed(2)
    };
    
    res.json({
      success: true,
      data: formattedAccountInfo
    });
  } catch (error) {
    logger.error('Error fetching account info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch account information',
      message: error.message
    });
  }
});

// Get today's spend data
router.get('/today-spend', async (req, res) => {
  try {
    const { dateRange, startDate, endDate } = req.query;
    logger.info('Fetching spend data', { dateRange, startDate, endDate });
    
    const todaySpendData = await metaService.getTodaySpendData({ dateRange, startDate, endDate });
    
    res.json({
      success: true,
      data: todaySpendData
    });
  } catch (error) {
    logger.error('Error fetching today\'s spend data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch today\'s spend data',
      message: error.message
    });
  }
});

// Get campaign-level insights to match Facebook Ads Manager view
router.get('/campaign-insights', async (req, res) => {
  try {
    const { 
      dateRange = '1d',
      limit = 50
    } = req.query;

    logger.info('Fetching campaign insights', { dateRange, limit });
    
    const campaignInsights = await metaService.getCampaignInsights({
      dateRange,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: campaignInsights,
      meta: {
        dateRange,
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching campaign insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign insights',
      message: error.message
    });
  }
});

// Get campaigns data
router.get('/campaigns', async (req, res) => {
  try {
    const { 
      dateRange = '30d',
      limit = 50,
      status = 'ACTIVE'
    } = req.query;

    logger.info('Fetching campaigns data', { dateRange, limit, status });
    
    const campaignsData = await metaService.getCampaignsData({
      dateRange,
      limit: parseInt(limit),
      status
    });

    res.json({
      success: true,
      data: campaignsData,
      meta: {
        total: campaignsData.length,
        dateRange,
        status,
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching campaigns data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns data',
      message: error.message
    });
  }
});

// Get ad sets data
router.get('/adsets', async (req, res) => {
  try {
    const { 
      dateRange = '30d',
      limit = 50,
      status = 'ACTIVE'
    } = req.query;

    logger.info('Fetching adsets data', { dateRange, limit, status });
    
    const adsetsData = await metaService.getAdsetsData({
      dateRange,
      limit: parseInt(limit),
      status
    });

    res.json({
      success: true,
      data: adsetsData,
      meta: {
        total: adsetsData.length,
        dateRange,
        status,
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching adsets data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch adsets data',
      message: error.message
    });
  }
});

// Get campaign insights direct
router.get('/campaign-insights-direct', async (req, res) => {
  try {
    const { 
      dateRange = '1d',
      limit = 50
    } = req.query;

    logger.info('Fetching campaign insights direct', { dateRange, limit });
    
    const campaignInsights = await metaService.getCampaignInsightsDirect({
      dateRange,
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: campaignInsights,
      meta: {
        dateRange,
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching campaign insights direct:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign insights direct',
      message: error.message
    });
  }
});

// Test conversion values with different approaches
router.get('/test-conversion-values', async (req, res) => {
  try {
    const { dateRange = '24h' } = req.query;
    logger.info('Testing conversion values approaches', { dateRange });
    
    const results = await metaService.testConversionValues({ dateRange });
    
    res.json({
      success: true,
      data: results,
      meta: {
        dateRange,
        testedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error testing conversion values:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test conversion values',
      message: error.message
    });
  }
});

// Get cache statistics
router.get('/cache-stats', async (req, res) => {
  try {
    const stats = metaService.getCacheStats();
    
    res.json({
      success: true,
      data: stats,
      meta: {
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache stats',
      message: error.message
    });
  }
});

// Clear cache (for testing/debugging)
router.post('/clear-cache', async (req, res) => {
  try {
    metaService.clearCache();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      meta: {
        clearedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

// Get detailed conversion data for debugging ROAS issues
router.get('/ads/:adId/conversion-debug', async (req, res) => {
  try {
    const { adId } = req.params;
    const { dateRange = 'today' } = req.query;
    
    logger.info('Fetching detailed conversion data', { adId, dateRange });
    
    const conversionData = await metaService.getDetailedConversionData(adId, dateRange);
    
    res.json({
      success: true,
      data: conversionData,
      meta: {
        adId,
        dateRange,
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching detailed conversion data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch detailed conversion data',
      message: error.message
    });
  }
});

// Debug endpoint for ad-specific insights
router.get('/ads/:adId/insights', async (req, res) => {
  try {
    const { adId } = req.params;
    const { dateRange = 'today', _t } = req.query;

    logger.info('Fetching individual ad insights for ad', { adId, dateRange });
    
    const insightsData = await metaService.getAdInsights(adId, dateRange, _t);

    res.json({
      success: true,
      data: insightsData,
      meta: {
        adId,
        dateRange,
        cached: !_t, // Indicate if data was served from cache
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching individual ad insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch individual ad insights',
      message: error.message
    });
  }
});

module.exports = router;
