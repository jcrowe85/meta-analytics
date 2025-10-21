# Meta Analytics Frontend

A modern React dashboard for Meta Ads analytics with glass morphism design and real-time data visualization.

## Features

- **Glass Morphism Design**: Beautiful modern UI with backdrop blur effects
- **Real-time Data**: Live updates every 30 seconds for active ads
- **Card-based Layout**: Clean, organized display of ads performance
- **Responsive Design**: Works on desktop and mobile devices
- **Navigation Structure**: Campaign > Live hierarchy as requested
- **Performance Metrics**: Comprehensive ads analytics with visual indicators

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Router** for navigation
- **React Icons** for consistent iconography

## Development

### Prerequisites

- Node.js 16+ 
- Backend server running on port 3001

### Start Development Server

```bash
# Install dependencies (if not already done)
npm install

# Start frontend development server
npm run dev:frontend

# In another terminal, start backend server
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## Navigation Structure

The app follows the requested navigation structure:

- **Overview**: Account summary and performance metrics
- **Campaigns**: Campaign management and overview
  - **Live**: Real-time view of active ads only

## Pages

### Overview (`/overview`)
- Account information display
- Performance summary cards
- Quick action buttons
- Auto-refresh capability

### Campaigns (`/campaigns`)
- Campaign listing with status indicators
- Performance metrics per campaign
- Quick navigation to live ads

### Live Ads (`/campaigns/live`)
- Real-time display of active ads only
- Card-based layout with performance metrics
- Auto-refresh every 30 seconds
- Performance scoring and status indicators

## Components

### Navigation
- Responsive sidebar with collapsible functionality
- Mobile-friendly overlay navigation
- Hierarchical menu structure (Campaign > Live)

### Cards
- Glass morphism design with hover effects
- Performance indicators with color coding
- Real-time data updates
- Responsive grid layout

## API Integration

The frontend connects to the backend API endpoints:

- `GET /api/meta/account` - Account information
- `GET /api/meta/ads` - Ads data with filtering
- `GET /api/meta/campaigns` - Campaign data

## Styling

The app uses a consistent design system:

- **Colors**: Blue/purple gradient theme
- **Typography**: Inter font family
- **Spacing**: Consistent padding and margins
- **Animations**: Smooth transitions and hover effects
- **Glass Effects**: Backdrop blur with transparency

## Performance

- Auto-refresh for real-time data
- Loading states and error handling
- Responsive design for all screen sizes
- Optimized bundle size with Vite

## Next Steps

1. **LLM Integration**: Add AI analysis and recommendations
2. **Advanced Filtering**: Date ranges, status filters
3. **Export Features**: CSV/PDF reports
4. **Real-time Notifications**: Performance alerts
5. **Advanced Analytics**: Charts and graphs
