const OpenAI = require('openai');
const logger = require('../utils/logger');

class AnalysisService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Analyze ads performance and provide insights
  async analyzeAdsPerformance(adsData, analysisType = 'comprehensive') {
    try {
      const topPerformers = this.getTopPerformers(adsData);
      const underPerformers = this.getUnderPerformers(adsData);
      const trends = this.analyzeTrends(adsData);
      
      const prompt = this.buildAnalysisPrompt(adsData, topPerformers, underPerformers, trends, analysisType);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an expert Meta/Facebook ads analyst with deep knowledge of digital advertising performance optimization. Provide actionable insights and recommendations based on the data provided."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const analysis = completion.choices[0].message.content;
      
      return {
        summary: this.generateSummary(topPerformers, underPerformers, trends),
        insights: JSON.parse(analysis),
        topPerformers: topPerformers.slice(0, 5),
        underPerformers: underPerformers.slice(0, 5),
        trends,
        recommendations: this.generateQuickRecommendations(topPerformers, underPerformers)
      };
    } catch (error) {
      logger.error('Error in ads performance analysis:', error);
      throw new Error('Failed to analyze ads performance');
    }
  }

  // Generate creative recommendations
  async generateCreativeRecommendations({ topPerformingAds, industry, budget, audience }) {
    try {
      const prompt = `
        Based on these top-performing Meta ads data, generate 5 creative concepts for ${industry} industry targeting ${audience} audience with ${budget} budget:
        
        Top performing ads data:
        ${JSON.stringify(topPerformingAds.slice(0, 3), null, 2)}
        
        Please provide:
        1. 5 creative concepts with visual style descriptions
        2. Recommended ad formats (image, video, carousel, etc.)
        3. Color scheme suggestions
        4. Visual elements that should be included
        5. Creative testing strategies
        
        Format as JSON with the following structure:
        {
          "concepts": [
            {
              "title": "Concept name",
              "description": "Detailed description",
              "visualStyle": "Visual style description",
              "format": "Recommended format",
              "colors": ["color1", "color2"],
              "elements": ["element1", "element2"],
              "rationale": "Why this should work"
            }
          ],
          "testingStrategy": "Testing approach",
          "budgetAllocation": "How to allocate budget across concepts"
        }
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a creative director specializing in Meta/Facebook ads. Provide innovative, data-driven creative recommendations that align with performance data and industry best practices."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating creative recommendations:', error);
      throw new Error('Failed to generate creative recommendations');
    }
  }

  // Generate copy suggestions (headlines and descriptions)
  async generateCopySuggestions({ topPerformingAds, productType, tone, targetAudience }) {
    try {
      const prompt = `
        Based on these top-performing ads, generate 10 headline and description combinations for ${productType} targeting ${targetAudience} with a ${tone} tone:
        
        Top performing ads data:
        ${JSON.stringify(topPerformingAds.slice(0, 3), null, 2)}
        
        Please provide:
        1. 10 headline/description pairs
        2. 5 A/B test variations
        3. Call-to-action suggestions
        4. Emotional triggers to use
        5. Copy length recommendations
        
        Format as JSON:
        {
          "copyVariations": [
            {
              "headline": "Headline text",
              "description": "Description text",
              "cta": "Call to action",
              "emotionalTrigger": "Emotion being targeted",
              "rationale": "Why this should work"
            }
          ],
          "abTestVariations": [
            {
              "testName": "Test description",
              "headlineA": "Headline A",
              "headlineB": "Headline B",
              "descriptionA": "Description A", 
              "descriptionB": "Description B"
            }
          ],
          "recommendations": {
            "emotionalTriggers": ["trigger1", "trigger2"],
            "copyLength": "Recommended length",
            "ctaSuggestions": ["cta1", "cta2"]
          }
        }
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a copywriter specializing in Meta/Facebook ads with expertise in conversion optimization and audience psychology."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating copy suggestions:', error);
      throw new Error('Failed to generate copy suggestions');
    }
  }

  // Generate testing recommendations
  async generateTestingRecommendations({ currentAds, campaignGoals, testingBudget }) {
    try {
      const prompt = `
        Based on these current ads performance and campaign goals (${campaignGoals}), recommend testing strategies with ${testingBudget} budget allocation:
        
        Current ads data:
        ${JSON.stringify(currentAds.slice(0, 5), null, 2)}
        
        Please provide:
        1. Top 5 testing opportunities
        2. Budget allocation recommendations
        3. Testing timeline
        4. Success metrics to track
        5. Risk mitigation strategies
        
        Format as JSON:
        {
          "testingOpportunities": [
            {
              "testName": "Test description",
              "hypothesis": "What we're testing",
              "method": "How to test it",
              "budgetAllocation": "Budget percentage",
              "duration": "Testing duration",
              "successMetric": "Primary metric to track",
              "expectedImpact": "Expected outcome"
            }
          ],
          "budgetBreakdown": {
            "creativeTesting": "percentage",
            "audienceTesting": "percentage", 
            "placementTesting": "percentage",
            "bidStrategyTesting": "percentage"
          },
          "timeline": {
            "week1": "What to test",
            "week2": "What to test",
            "week3": "What to test",
            "week4": "What to test"
          },
          "riskMitigation": ["strategy1", "strategy2"]
        }
      `;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a Meta/Facebook ads testing specialist with expertise in systematic testing methodologies and budget optimization."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 2000
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      logger.error('Error generating testing recommendations:', error);
      throw new Error('Failed to generate testing recommendations');
    }
  }

  // Helper methods
  getTopPerformers(adsData) {
    return adsData
      .filter(ad => ad.metrics && ad.metrics.impressions > 0)
      .sort((a, b) => b.metrics.performance_score - a.metrics.performance_score);
  }

  getUnderPerformers(adsData) {
    return adsData
      .filter(ad => ad.metrics && ad.metrics.impressions > 0)
      .sort((a, b) => a.metrics.performance_score - b.metrics.performance_score);
  }

  analyzeTrends(adsData) {
    const activeAds = adsData.filter(ad => ad.status === 'ACTIVE');
    const totalSpend = activeAds.reduce((sum, ad) => sum + (ad.metrics?.spend || 0), 0);
    const totalImpressions = activeAds.reduce((sum, ad) => sum + (ad.metrics?.impressions || 0), 0);
    const totalClicks = activeAds.reduce((sum, ad) => sum + (ad.metrics?.clicks || 0), 0);
    
    return {
      totalActiveAds: activeAds.length,
      totalSpend,
      averageCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      averageCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      averagePerformanceScore: activeAds.length > 0 
        ? activeAds.reduce((sum, ad) => sum + (ad.metrics?.performance_score || 0), 0) / activeAds.length 
        : 0
    };
  }

  buildAnalysisPrompt(adsData, topPerformers, underPerformers, trends, analysisType) {
    return `
      Analyze this Meta ads performance data and provide insights:
      
      Total ads: ${adsData.length}
      Active ads: ${trends.totalActiveAds}
      Total spend: $${trends.totalSpend.toFixed(2)}
      Average CPM: $${trends.averageCPM.toFixed(2)}
      Average CTR: ${trends.averageCTR.toFixed(2)}%
      Average Performance Score: ${trends.averagePerformanceScore.toFixed(1)}
      
      Top 3 performing ads:
      ${JSON.stringify(topPerformers.slice(0, 3), null, 2)}
      
      Bottom 3 performing ads:
      ${JSON.stringify(underPerformers.slice(0, 3), null, 2)}
      
      Please provide analysis in this JSON format:
      {
        "keyInsights": [
          {
            "insight": "Key finding",
            "impact": "High/Medium/Low",
            "action": "Recommended action"
          }
        ],
        "performancePatterns": [
          {
            "pattern": "Pattern description",
            "frequency": "How often it occurs",
            "implication": "What this means"
          }
        ],
        "optimizationOpportunities": [
          {
            "opportunity": "Optimization area",
            "potential": "Potential impact",
            "effort": "Low/Medium/High effort required"
          }
        ],
        "riskFactors": [
          {
            "risk": "Risk description",
            "severity": "High/Medium/Low",
            "mitigation": "How to address"
          }
        ]
      }
    `;
  }

  generateSummary(topPerformers, underPerformers, trends) {
    return {
      totalAds: topPerformers.length + underPerformers.length,
      topPerformersCount: topPerformers.length,
      underPerformersCount: underPerformers.length,
      averagePerformanceScore: trends.averagePerformanceScore,
      totalSpend: trends.totalSpend,
      averageCTR: trends.averageCTR
    };
  }

  generateQuickRecommendations(topPerformers, underPerformers) {
    const recommendations = [];
    
    if (topPerformers.length > 0) {
      recommendations.push({
        type: 'Scale',
        action: 'Increase budget for top performing ads',
        priority: 'High',
        expectedImpact: 'Increase overall performance'
      });
    }
    
    if (underPerformers.length > 0) {
      recommendations.push({
        type: 'Optimize',
        action: 'Pause or optimize underperforming ads',
        priority: 'Medium',
        expectedImpact: 'Improve efficiency and reduce wasted spend'
      });
    }
    
    recommendations.push({
      type: 'Test',
      action: 'Create variations of top performers',
      priority: 'High',
      expectedImpact: 'Find new winning combinations'
    });
    
    return recommendations;
  }
}

module.exports = new AnalysisService();
