# Meta Ads API Integration Setup Guide

This guide will walk you through setting up Meta (Facebook) API integration to pull ads data for your analytics application.

## Prerequisites

- A Meta Business Account
- A Facebook Page (if you don't have one, create one at facebook.com/pages/create)
- Admin access to your Meta Business Account
- A Meta Developer Account

## Step 1: Create a Meta App

1. **Go to Meta for Developers**
   - Visit [developers.facebook.com](https://developers.facebook.com)
   - Log in with your Facebook account

2. **Create a New App**
   - Click "My Apps" → "Create App"
   - Select "Business" as the app type
   - Click "Next"

3. **Configure Your App**
   - **App Name**: `Meta Analytics Dashboard` (or your preferred name)
   - **App Contact Email**: Your email address
   - **Business Account**: Select your business account
   - Click "Create App"

## Step 2: Configure App Permissions

1. **Add Products**
   - In your app dashboard, find "Add a Product"
   - Add the following products:
     - **Marketing API** (for ads data)
     - **Facebook Login** (for authentication, if needed)

2. **Set Up Marketing API**
   - Click on "Marketing API" in the left sidebar
   - Go to "Tools" → "Marketing API"
   - Note down your **App ID** and **App Secret** (you'll need these for your environment variables)

## Step 3: Get Access Token

### Option A: System User Token (Recommended for Server-to-Server)

1. **Create a System User**
   - Go to Business Settings in your Meta Business Account
   - Navigate to "Users" → "System Users"
   - Click "Add" → "Create New System User"
   - Give it a name like "Analytics System User"
   - Assign it to your app

2. **Generate Access Token**
   - In your app dashboard, go to "Tools" → "Marketing API" → "System User Token"
   - Select your system user
   - Generate a token with these permissions:
     - `ads_read`
     - `ads_management` (if you plan to make changes)
     - `business_management`

3. **Copy the Long-Lived Token**
   - The generated token will be long-lived (60 days)
   - Copy this token - this is your `META_ACCESS_TOKEN`

### Option B: User Access Token (For testing)

1. **Generate User Token**
   - Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   - Select your app
   - Add permissions: `ads_read`, `ads_management`
   - Generate User Access Token
   - Click "Generate Access Token"

2. **Extend Token**
   - Click "Extend Access Token" to make it long-lived

## Step 4: Get Ad Account ID

1. **Find Your Ad Account ID**
   - Go to [Facebook Ads Manager](https://business.facebook.com/adsmanager)
   - Look at the URL or account settings
   - Your account ID will be in format: `act_XXXXXXXXXX`
   - This is your `META_AD_ACCOUNT_ID`

## Step 5: Configure Environment Variables

1. **Create .env file**
   ```bash
   cp env.example .env
   ```

2. **Fill in your values**
   ```env
   META_APP_ID=your_app_id_here
   META_APP_SECRET=your_app_secret_here
   META_ACCESS_TOKEN=your_long_lived_access_token_here
   META_AD_ACCOUNT_ID=act_your_ad_account_id_here
   ```

## Step 6: Test Your Integration

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start the server**
   ```bash
   npm run dev
   ```

3. **Test the API**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/api/meta/account
   ```

## Step 7: App Review (For Production)

If you plan to use this in production or share with others:

1. **Submit for Review**
   - Go to your app dashboard
   - Navigate to "App Review" → "Permissions and Features"
   - Request review for the permissions you need
   - Meta will review your app and approve the permissions

2. **Required Permissions for Review**
   - `ads_read` - Read ads data
   - `ads_management` - Manage ads (if making changes)
   - `business_management` - Access business account data

## Troubleshooting

### Common Issues

1. **"Invalid Access Token" Error**
   - Check if your token has expired
   - Verify the token has the correct permissions
   - Ensure you're using a long-lived token

2. **"Insufficient Permissions" Error**
   - Verify your app has the required permissions
   - Check if your system user has the correct role
   - Ensure the token was generated with the right scopes

3. **"Ad Account Not Found" Error**
   - Verify your ad account ID is correct
   - Ensure your app has access to the ad account
   - Check if the ad account is active

4. **Rate Limiting**
   - Meta API has rate limits
   - Implement proper error handling and retry logic
   - Consider caching frequently accessed data

### API Limits

- **Rate Limits**: 200 calls per hour per user
- **Data Retention**: Ads data is available for up to 2 years
- **Token Expiry**: User tokens expire in 60 days (system user tokens are long-lived)

## Security Best Practices

1. **Never commit your .env file**
2. **Use environment variables for all sensitive data**
3. **Implement proper error handling**
4. **Log API calls for monitoring**
5. **Use HTTPS in production**
6. **Implement rate limiting on your API**

## Next Steps

Once your Meta integration is working:

1. Test the `/api/meta/ads` endpoint to pull ads data
2. Test the `/api/analysis/ads` endpoint for LLM analysis
3. Set up your OpenAI API key for the analysis features
4. Build your frontend to visualize the data

## Support

- [Meta Marketing API Documentation](https://developers.facebook.com/docs/marketing-api/)
- [Meta Business Help Center](https://www.facebook.com/business/help)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)

## API Endpoints Reference

Your server will provide these endpoints:

- `GET /api/meta/account` - Get ad account information
- `GET /api/meta/ads` - Get ads data with metrics
- `GET /api/meta/campaigns` - Get campaigns data
- `GET /api/meta/adsets` - Get ad sets data
- `POST /api/analysis/ads` - Analyze ads performance
- `POST /api/analysis/creative-recommendations` - Get creative recommendations
- `POST /api/analysis/copy-suggestions` - Get copy suggestions
- `POST /api/analysis/testing-recommendations` - Get testing recommendations
