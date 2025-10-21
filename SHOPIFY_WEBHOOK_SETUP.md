# Shopify Webhook Setup Guide

This guide will help you set up Shopify webhooks to automatically sync order data with your Meta Analytics dashboard.

## Prerequisites

- Shopify store with admin access
- Meta Analytics application running
- Webhook endpoint accessible from the internet

## Setup Steps

### 1. Create Webhook in Shopify Admin

1. Go to your Shopify Admin → Settings → Notifications
2. Scroll down to "Webhooks" section
3. Click "Create webhook"
4. Configure the webhook:
   - **Event**: Order creation
   - **Format**: JSON
   - **URL**: `https://your-domain.com/webhook/shopify/orders`
   - **API Version**: Latest stable version

### 2. Environment Variables
Add to your `.env` file:
```env
# Your existing Shopify tokens
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=your_shopify_admin_access_token_here

# Required for webhook verification
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_here
PORT=3002
```

### 3. Webhook Verification

The webhook handler automatically verifies incoming requests using HMAC-SHA256 signature verification to ensure they're coming from Shopify.

### 4. Testing

You can test the webhook by:
1. Creating a test order in your Shopify store
2. Checking the webhook logs in your application
3. Verifying the order data appears in your Meta Analytics dashboard

## Security Notes

- Always use HTTPS for webhook endpoints
- Keep your webhook secret secure
- Monitor webhook delivery status in Shopify Admin
- Implement rate limiting to prevent abuse

## Troubleshooting

### Common Issues

1. **Webhook not receiving data**
   - Check if the URL is accessible from the internet
   - Verify the webhook is enabled in Shopify Admin
   - Check application logs for errors

2. **Verification failures**
   - Ensure the webhook secret matches between Shopify and your application
   - Check that the request body is being read correctly

3. **Data not syncing**
   - Verify the webhook payload structure
   - Check if the order processing logic is working correctly

### Logs

Check the application logs for webhook-related messages:
```bash
# View webhook logs
tail -f logs/webhook.log
```

## Support

For issues with this setup, please check:
1. Shopify Webhook Documentation
2. Application logs
3. Network connectivity between Shopify and your server
