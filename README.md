# Meta Analytics Dashboard

A comprehensive Meta (Facebook) ads data pull and LLM analyzer that helps visualize ads performance and provides AI-powered insights and recommendations.

## Features

- **Meta Ads Data Integration**: Pull ads data directly from your Meta ad account
- **Performance Analytics**: Analyze ads performance with key metrics and trends
- **LLM-Powered Insights**: Get AI-generated insights and recommendations
- **Creative Recommendations**: AI-generated creative concepts and visual suggestions
- **Copy Suggestions**: Generate headlines, descriptions, and copy variations
- **Testing Recommendations**: Get systematic testing strategies and budget allocation advice
- **Card-Based Visualization**: Clean, card-like layout for easy data consumption

## Tech Stack

- **Backend**: Node.js, Express.js
- **API Integration**: Meta Marketing API
- **AI Analysis**: OpenAI GPT-4
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate Limiting

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd meta-analytics
npm install
```

### 2. Set Up Environment Variables

```bash
cp env.example .env
```

Fill in your environment variables in `.env`:

```env
# Meta/Facebook API Configuration
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=your_meta_access_token
META_AD_ACCOUNT_ID=act_your_ad_account_id

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Server Configuration
PORT=3001
NODE_ENV=development
```

### 3. Meta API Setup

Follow the detailed setup guide in [META_SETUP_GUIDE.md](./META_SETUP_GUIDE.md) to:
- Create a Meta app
- Get API credentials
- Set up permissions
- Generate access tokens

### 4. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

The server will start on `http://localhost:3001`

## API Endpoints

### Meta Data Endpoints

- `GET /api/meta/account` - Get ad account information
- `GET /api/meta/ads` - Get ads data with metrics
- `GET /api/meta/campaigns` - Get campaigns data  
- `GET /api/meta/adsets` - Get ad sets data

### Analysis Endpoints

- `POST /api/analysis/ads` - Analyze ads performance
- `POST /api/analysis/creative-recommendations` - Get creative recommendations
- `POST /api/analysis/copy-suggestions` - Get copy suggestions
- `POST /api/analysis/testing-recommendations` - Get testing recommendations

### Example Usage

```bash
# Get ads data
curl "http://localhost:3001/api/meta/ads?dateRange=30d&limit=10"

# Analyze ads performance
curl -X POST "http://localhost:3001/api/analysis/ads" \
  -H "Content-Type: application/json" \
  -d '{"adsData": [...], "analysisType": "comprehensive"}'

# Get creative recommendations
curl -X POST "http://localhost:3001/api/analysis/creative-recommendations" \
  -H "Content-Type: application/json" \
  -d '{"topPerformingAds": [...], "industry": "ecommerce", "budget": "medium"}'
```

## Project Structure

```
meta-analytics/
├── routes/
│   ├── meta.js              # Meta API routes
│   └── analysis.js          # LLM analysis routes
├── services/
│   ├── metaService.js       # Meta API integration
│   └── analysisService.js   # LLM analysis service
├── utils/
│   └── logger.js            # Logging utility
├── logs/                    # Log files
├── server.js                # Main server file
├── package.json
├── env.example              # Environment variables template
├── META_SETUP_GUIDE.md      # Meta API setup instructions
└── README.md
```

## Key Features Explained

### Ads Data Processing

The system automatically:
- Calculates performance scores based on CTR, clicks, and efficiency
- Enriches raw Meta data with computed metrics
- Provides status color coding for UI
- Handles date range filtering and pagination

### LLM Analysis

Powered by OpenAI GPT-4, the analysis includes:
- **Performance Insights**: Key findings and patterns
- **Optimization Opportunities**: Areas for improvement
- **Risk Assessment**: Potential issues and mitigation strategies
- **Quick Recommendations**: Actionable next steps

### Creative Recommendations

AI-generated suggestions for:
- Visual concepts and styles
- Ad format recommendations
- Color scheme suggestions
- Creative testing strategies
- Budget allocation advice

### Copy Generation

Generate:
- Headlines and descriptions
- A/B test variations
- Call-to-action suggestions
- Emotional trigger recommendations
- Copy length guidelines

## Security & Best Practices

- Rate limiting on all endpoints
- CORS protection
- Helmet security headers
- Environment variable protection
- Comprehensive error handling
- Request logging and monitoring

## Development

### Available Scripts

```bash
npm run dev      # Start development server with nodemon
npm start        # Start production server
npm test         # Run tests
```

### Logging

Logs are written to:
- Console (development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

## Troubleshooting

### Common Issues

1. **Meta API Errors**
   - Check your access token validity
   - Verify app permissions
   - Ensure ad account access

2. **OpenAI API Errors**
   - Verify your API key
   - Check rate limits
   - Ensure sufficient credits

3. **Server Issues**
   - Check environment variables
   - Review logs in `logs/` directory
   - Verify port availability

## Next Steps

1. **Frontend Development**: Build a React/Vue.js frontend to visualize the data
2. **Database Integration**: Add persistent storage for historical data
3. **Real-time Updates**: Implement WebSocket for live data updates
4. **Advanced Analytics**: Add more sophisticated analysis algorithms
5. **Multi-account Support**: Support multiple Meta ad accounts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the [Meta Setup Guide](./META_SETUP_GUIDE.md)
- Review the troubleshooting section
- Create an issue in the repository
