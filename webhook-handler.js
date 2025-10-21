// Shopify Webhook Handler for Conversion Data
// This captures the actual data Shopify sends to Meta

const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.raw({ type: 'application/json' }));

// Store conversion data
const conversions = [];

// Shopify API configuration
const SHOPIFY_SHOP = process.env.SHOPIFY_STORE_DOMAIN; // 163bfa-5f.myshopify.com
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

// Fetch historical orders from Shopify
const fetchHistoricalOrders = async (startDate, endDate) => {
  try {
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();
    
    const response = await fetch(
      `https://${SHOPIFY_SHOP}/admin/api/2025-10/orders.json?created_at_min=${startDateStr}&created_at_max=${endDateStr}&financial_status=paid&limit=250&fields=id,order_number,total_price,currency,customer,created_at,landing_site,referring_site,source_name`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.orders || [];
  } catch (error) {
    console.error('Error fetching historical orders:', error);
    return [];
  }
};

// Load historical data on startup
const loadHistoricalData = async () => {
  console.log('Loading historical conversion data...');
  
  // Load last 30 days of data
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const historicalOrders = await fetchHistoricalOrders(startDate, endDate);
  
  // Convert to conversion data format
  historicalOrders.forEach(order => {
        // Check if this is a Meta-attributed conversion
        const isMetaConversion = order.landing_site && order.landing_site.includes('fbclid=');
        
        const conversionData = {
          orderId: order.id,
          orderNumber: order.order_number,
          totalPrice: parseFloat(order.total_price),
          currency: order.currency,
          customerEmail: order.customer?.email,
          customerId: order.customer?.id,
          timestamp: new Date(order.created_at),
          source: 'historical',
          isMetaConversion: isMetaConversion,
          landingSite: order.landing_site,
          referringSite: order.referring_site,
          sourceName: order.source_name,
          lineItems: order.line_items ? order.line_items.map(item => ({
            productId: item.product_id,
            variantId: item.variant_id,
            quantity: item.quantity,
            price: parseFloat(item.price)
          })) : []
        };
    
    conversions.push(conversionData);
  });
  
  console.log(`Loaded ${historicalOrders.length} historical conversions`);
};

// Verify Shopify webhook
const verifyShopifyWebhook = (data, signature, secret) => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data, 'utf8');
  const hash = hmac.digest('base64');
  return hash === signature;
};

// Webhook endpoint for order payments
app.post('/webhook/orders/paid', (req, res) => {
  const signature = req.get('X-Shopify-Hmac-Sha256');
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  
  if (!verifyShopifyWebhook(req.body, signature, secret)) {
    return res.status(401).send('Unauthorized');
  }
  
  const order = JSON.parse(req.body);
  
  // Extract conversion data (same data Shopify sends to Meta)
  const conversionData = {
    orderId: order.id,
    orderNumber: order.order_number,
    totalPrice: parseFloat(order.total_price),
    currency: order.currency,
    customerEmail: order.customer?.email,
    customerId: order.customer?.id,
    timestamp: new Date(order.created_at),
    lineItems: order.line_items.map(item => ({
      productId: item.product_id,
      variantId: item.variant_id,
      quantity: item.quantity,
      price: parseFloat(item.price)
    })),
    // This is the data Shopify sends to Meta via Conversion API
    metaConversionData: {
      eventName: 'Purchase',
      value: parseFloat(order.total_price),
      currency: order.currency,
      eventTime: Math.floor(new Date(order.created_at).getTime() / 1000)
    }
  };
  
  // Store conversion data
  conversions.push(conversionData);
  
  console.log('Conversion captured:', conversionData);
  
  // Calculate ROAS if we have Meta spend data
  calculateROAS(conversionData);
  
  res.status(200).send('OK');
});

// Calculate ROAS using Meta spend data
const calculateROAS = async (conversionData) => {
  try {
    // Get Meta spend data for the same time period
    const response = await fetch(`http://localhost:3001/api/meta/today-spend?dateRange=24h`);
    const metaData = await response.json();
    
    if (metaData.success) {
      const spend = metaData.data.spend;
      const revenue = conversionData.totalPrice;
      const roas = revenue / spend;
      
      console.log('ROAS Calculation:', {
        spend: spend,
        revenue: revenue,
        roas: roas.toFixed(2)
      });
    }
  } catch (error) {
    console.error('Error calculating ROAS:', error);
  }
};

// Get conversion data endpoint
app.get('/api/conversions', (req, res) => {
  res.json({
    success: true,
    data: conversions,
    total: conversions.length,
    totalRevenue: conversions.reduce((sum, conv) => sum + conv.totalPrice, 0)
  });
});

// Get ROAS data
app.get('/api/roas', async (req, res) => {
  try {
    const { dateRange = '24h' } = req.query;
    
    // Get Meta spend data with error handling
    let metaData = null;
    try {
      const metaResponse = await fetch(`http://localhost:3001/api/meta/today-spend?dateRange=${dateRange}`);
      if (metaResponse.ok) {
        metaData = await metaResponse.json();
      } else {
        console.warn(`Meta API returned ${metaResponse.status} for spend data`);
        // Return cached/default data instead of failing
        metaData = { success: true, data: { spend: 0, impressions: 0, clicks: 0 } };
      }
    } catch (error) {
      console.warn('Failed to fetch Meta spend data:', error.message);
      // Return cached/default data instead of failing
      metaData = { success: true, data: { spend: 0, impressions: 0, clicks: 0 } };
    }
    
    if (!metaData.success) {
      return res.status(500).json({ error: 'Failed to get Meta spend data' });
    }
    
    // Get conversions for the same period
    const startDate = new Date();
    const endDate = new Date();
    
    switch (dateRange) {
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
    }
    
    const periodConversions = conversions.filter(conv => 
      conv.timestamp >= startDate && conv.timestamp <= endDate
    );
    
    console.log(`Date range for ${dateRange}:`, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalConversions: conversions.length,
      periodConversions: periodConversions.length
    });
    
    // Get account-level conversion values from Meta API for the correct date range
    let metaConversionValue = 0;
    try {
      const testResponse = await fetch(`http://localhost:3001/api/meta/test-conversion-values?dateRange=${dateRange}`);
      if (testResponse.ok) {
        const testData = await testResponse.json();
        if (testData.success) {
          // Use the appropriate data source based on date range
          let accountData = null;
          if (dateRange === 'today') {
            accountData = testData.data.account_insights; // Today's data
          } else if (dateRange === 'yesterday') {
            accountData = testData.data.account_insights_yesterday; // Yesterday's data
          } else if (dateRange === '7d') {
            accountData = testData.data.account_insights; // 7-day aggregated data
          } else if (dateRange === '30d') {
            accountData = testData.data.account_insights; // 30-day aggregated data
          }
          
          if (accountData && accountData.action_values) {
            // Find the first purchase action value (avoid duplicates)
            const purchaseActionValue = accountData.action_values.find(actionValue => 
              (actionValue.action_type === 'purchase' || 
               actionValue.action_type.includes('purchase')) && 
              !actionValue.action_type.includes('add_to_cart') &&
              !actionValue.action_type.includes('initiate_checkout')
            );
            if (purchaseActionValue) {
              metaConversionValue = parseFloat(purchaseActionValue.value || 0);
              console.log(`Found purchase action value for ${dateRange}:`, purchaseActionValue);
            } else {
              console.log(`No purchase actions found for ${dateRange}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching account conversion values:', error);
    }
    
    // Use Shopify revenue as the primary source (more accurate than Meta's conversion values)
    const metaConversions = periodConversions.filter(conv => conv.isMetaConversion);
    const shopifyMetaRevenue = metaConversions.reduce((sum, conv) => sum + conv.totalPrice, 0);
    const totalShopifyRevenue = periodConversions.reduce((sum, conv) => sum + conv.totalPrice, 0);
    
    console.log(`ROAS Debug for ${dateRange}:`, {
      totalConversions: periodConversions.length,
      metaConversions: metaConversions.length,
      shopifyMetaRevenue,
      totalShopifyRevenue,
      metaConversionValue,
      periodConversions: periodConversions.map(conv => ({
        date: conv.timestamp,
        totalPrice: conv.totalPrice,
        isMetaConversion: conv.isMetaConversion,
        landingSite: conv.landingSite
      }))
    });
    
    // Use Meta's conversion values as the primary source (Facebook conversion value)
    // This is the correct approach for ROAS calculation
    if (metaConversionValue === 0) {
      // Fallback to Shopify attribution only if no Meta conversion values
      metaConversionValue = metaConversions.reduce((sum, conv) => sum + conv.totalPrice, 0);
    }
    
    // Get Meta conversion count from account-level actions
    let metaConversionCount = 0;
    try {
      const testResponse = await fetch(`http://localhost:3001/api/meta/test-conversion-values?dateRange=${dateRange}`);
      if (testResponse.ok) {
        const testData = await testResponse.json();
        if (testData.success) {
          // Use the appropriate data source based on date range
          let accountData = null;
          if (dateRange === 'today') {
            accountData = testData.data.account_insights; // Today's data
          } else if (dateRange === 'yesterday') {
            accountData = testData.data.account_insights_yesterday; // Yesterday's data
          } else if (dateRange === '7d') {
            accountData = testData.data.account_insights; // 7-day aggregated data
          } else if (dateRange === '30d') {
            accountData = testData.data.account_insights; // 30-day aggregated data
          }
          
          if (accountData && accountData.actions) {
            const purchaseActions = accountData.actions.filter(action => 
              (action.action_type === 'purchase' || 
               action.action_type.includes('purchase')) && 
              !action.action_type.includes('add_to_cart') &&
              !action.action_type.includes('initiate_checkout')
            );
            // Use the highest purchase count (different action types might have different counts)
            metaConversionCount = Math.max(...purchaseActions.map(action => parseInt(action.value || 0)), 0);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching conversion count:', error);
      // Fallback to original method
      const metaActions = metaData.data.actions || [];
      const purchaseActions = metaActions.filter(action => 
        action.action_type.includes('purchase') && 
        !action.action_type.includes('add_to_cart') &&
        !action.action_type.includes('initiate_checkout')
      );
      metaConversionCount = Math.max(...purchaseActions.map(action => parseInt(action.value || 0)), 0);
    }
    
    // totalShopifyRevenue already calculated above
    
    // Use spend from the dashboard's daily source (already accurate)
    const spend = metaData.data.spend;
    const roas = spend > 0 ? metaConversionValue / spend : 0;
    
    res.json({
      success: true,
      data: {
        spend: spend,
        revenue: metaConversionValue,
        roas: roas,
        conversions: metaConversionCount,
        metaConversionCount: metaConversionCount,
        totalShopifyRevenue: totalShopifyRevenue,
        shopifyMetaRevenue: metaConversions.reduce((sum, conv) => sum + conv.totalPrice, 0),
        period: dateRange
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.WEBHOOK_PORT || 3002;

// Start server and load historical data
const startServer = async () => {
  // Load historical data first
  await loadHistoricalData();
  
  // Start the server
  app.listen(PORT, () => {
    console.log(`Webhook handler running on port ${PORT}`);
    console.log(`Total conversions loaded: ${conversions.length}`);
  });
};

startServer();

module.exports = app;
