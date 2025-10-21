const express = require('express');
const router = express.Router();
const analysisService = require('../services/analysisService');
const logger = require('../utils/logger');

// Analyze ads performance and get recommendations
router.post('/ads', async (req, res) => {
  try {
    const { adsData, analysisType = 'comprehensive' } = req.body;
    
    if (!adsData || !Array.isArray(adsData)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ads data provided'
      });
    }

    logger.info('Starting ads analysis', { 
      adCount: adsData.length, 
      analysisType 
    });
    
    const analysis = await analysisService.analyzeAdsPerformance(adsData, analysisType);
    
    res.json({
      success: true,
      data: analysis,
      meta: {
        analyzedAt: new Date().toISOString(),
        adCount: adsData.length,
        analysisType
      }
    });
  } catch (error) {
    logger.error('Error analyzing ads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze ads',
      message: error.message
    });
  }
});

// Get creative recommendations
router.post('/creative-recommendations', async (req, res) => {
  try {
    const { 
      topPerformingAds = [], 
      industry = 'general',
      budget = 'medium',
      audience = 'general'
    } = req.body;

    logger.info('Generating creative recommendations', { 
      topAdsCount: topPerformingAds.length,
      industry,
      budget,
      audience
    });
    
    const recommendations = await analysisService.generateCreativeRecommendations({
      topPerformingAds,
      industry,
      budget,
      audience
    });
    
    res.json({
      success: true,
      data: recommendations,
      meta: {
        generatedAt: new Date().toISOString(),
        industry,
        budget,
        audience
      }
    });
  } catch (error) {
    logger.error('Error generating creative recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate creative recommendations',
      message: error.message
    });
  }
});

// Get headline and description suggestions
router.post('/copy-suggestions', async (req, res) => {
  try {
    const { 
      topPerformingAds = [],
      productType = 'general',
      tone = 'professional',
      targetAudience = 'general'
    } = req.body;

    logger.info('Generating copy suggestions', { 
      topAdsCount: topPerformingAds.length,
      productType,
      tone,
      targetAudience
    });
    
    const suggestions = await analysisService.generateCopySuggestions({
      topPerformingAds,
      productType,
      tone,
      targetAudience
    });
    
    res.json({
      success: true,
      data: suggestions,
      meta: {
        generatedAt: new Date().toISOString(),
        productType,
        tone,
        targetAudience
      }
    });
  } catch (error) {
    logger.error('Error generating copy suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate copy suggestions',
      message: error.message
    });
  }
});

// Get testing recommendations
router.post('/testing-recommendations', async (req, res) => {
  try {
    const { 
      currentAds = [],
      campaignGoals = 'conversions',
      testingBudget = '10%'
    } = req.body;

    logger.info('Generating testing recommendations', { 
      currentAdsCount: currentAds.length,
      campaignGoals,
      testingBudget
    });
    
    const recommendations = await analysisService.generateTestingRecommendations({
      currentAds,
      campaignGoals,
      testingBudget
    });
    
    res.json({
      success: true,
      data: recommendations,
      meta: {
        generatedAt: new Date().toISOString(),
        campaignGoals,
        testingBudget
      }
    });
  } catch (error) {
    logger.error('Error generating testing recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate testing recommendations',
      message: error.message
    });
  }
});

module.exports = router;
