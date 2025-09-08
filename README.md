# Affiliate Tracking Platform

## Project Overview
- **Name**: 360° Affiliate Tracking Platform
- **Goal**: Comprehensive lead tracking and management system with PX API integration
- **Features**: Real-time lead capture, automated ping/post workflows, analytics dashboard, campaign management

## URLs
- **Local Development**: https://3000-ij2h1e6pzy3g67a52hvcw-6532622b.e2b.dev
- **Dashboard**: https://3000-ij2h1e6pzy3g67a52hvcw-6532622b.e2b.dev/
- **Campaign Management**: https://3000-ij2h1e6pzy3g67a52hvcw-6532622b.e2b.dev/campaigns
- **API Health Check**: https://3000-ij2h1e6pzy3g67a52hvcw-6532622b.e2b.dev/api/dashboard/stats

## Data Architecture

### Data Models
- **Affiliates**: Partners who generate leads
- **Campaigns**: Traffic sources with specific configurations (SubId, OfferId, traffic type)
- **Leads**: Individual lead records with complete tracking data
- **Lead Events**: Lifecycle tracking (ping sent, accepted, posted, etc.)
- **Analytics**: Daily aggregated metrics and performance data
- **API Logs**: Complete audit trail of all PX API interactions

### Storage Services
- **Cloudflare D1 SQLite**: Primary relational database for all structured data
- **Local Development**: Uses `.wrangler/state/v3/d1` for local SQLite database
- **Production Ready**: Configured for Cloudflare D1 production deployment

### Data Flow
1. Lead captured via web form → Stored in leads table
2. Campaign and affiliate data retrieved → SubId validation
3. PX API ping sent → Response logged to api_logs
4. If accepted → PX API post sent within 15 seconds
5. All events tracked → lead_events table
6. Daily analytics aggregated → analytics table

## Current Features Implemented

### ✅ Core Functionality
- **Lead Capture Form**: Full solar-specific form with validation
- **PX API Integration**: Complete ping/post workflow implementation
- **Campaign Management**: View all campaigns, stats, and tracking links
- **Real-time Dashboard**: Live stats and recent activity feed
- **Database Schema**: Complete data model with relationships and indexes

### ✅ API Endpoints
- `POST /api/leads` - Submit new lead and process with PX API
- `GET /api/leads/:id` - Get specific lead details
- `GET /api/campaigns` - List all campaigns
- `GET /api/campaigns/:id` - Get specific campaign details
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/activity` - Recent activity feed
- `POST /api/test-px` - Test PX API connection

### ✅ PX API Features
- **Ping/Post Workflow**: Automated 15-second window handling
- **Error Handling**: Comprehensive error tracking and logging
- **SubId Validation**: Format checking per PX requirements
- **API Logging**: Complete request/response audit trail
- **Timeout Management**: Proper handling of API timeouts

### ✅ Dashboard Features
- **Live Statistics**: Total leads, acceptance rate, success rate, revenue
- **Activity Feed**: Real-time lead processing status
- **Campaign Selection**: Dynamic campaign dropdown
- **Form Validation**: Client and server-side validation
- **Responsive Design**: Mobile-friendly interface

## Features Not Yet Implemented

### 🔄 Advanced Analytics
- Revenue calculations based on successful posts
- Campaign performance comparisons
- Traffic source ROI analysis
- Custom date range filtering
- Export functionality

### 🔄 Admin Panel
- Affiliate management (create/edit/delete)
- Campaign configuration interface
- API token management
- User authentication system

### 🔄 Advanced PX Features
- Multiple offer support
- Dynamic SubId generation
- A/B testing for campaigns
- Webhook notifications

## User Guide

### For Affiliates
1. **Access Dashboard**: Visit the main URL to see overview stats
2. **Submit Leads**: Use the lead capture form with all required solar data
3. **Track Performance**: Monitor real-time status in the activity feed
4. **View Campaigns**: Navigate to `/campaigns` to see all available campaigns

### For Lead Submission
Required fields:
- **Contact Info**: First name, last name, phone, zip code
- **Solar Data**: Home ownership, roof shade, monthly electric bill
- **Campaign**: Select from active campaigns dropdown

The system automatically:
- Validates all input data
- Sends ping to PX API
- If accepted, sends post within 15 seconds
- Tracks all events and responses
- Updates dashboard statistics

### For Campaign Management
- **View Stats**: Click "Stats" button on any campaign card
- **Get Tracking Links**: Click "Tracking Link" to generate UTM-tagged URLs
- **Monitor Performance**: Real-time acceptance and success rates

## Technical Stack

### Backend
- **Framework**: Hono (lightweight, fast)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **API**: RESTful with JSON responses
- **Validation**: Server-side input validation

### Frontend
- **Styling**: TailwindCSS via CDN
- **Icons**: FontAwesome
- **HTTP**: Axios for API calls
- **UI**: Vanilla JavaScript with modern ES6+

### Development
- **Build Tool**: Vite
- **TypeScript**: Full type safety
- **Process Manager**: PM2 for development
- **Database Migrations**: Wrangler D1 migrations

## Deployment

### Platform
- **Platform**: Cloudflare Pages
- **Status**: ✅ Development Active
- **Tech Stack**: Hono + TypeScript + TailwindCSS + D1
- **Last Updated**: 2025-09-08

### Local Development Setup
```bash
# Install dependencies
npm install

# Apply database migrations
npm run db:migrate:local

# Seed with sample data
npm run db:seed

# Build the application
npm run build

# Start development server
pm2 start ecosystem.config.cjs

# View logs
pm2 logs affiliate-tracker --nostream
```

### Production Deployment
```bash
# Create production D1 database
wrangler d1 create webapp-production

# Apply migrations to production
npm run db:migrate:prod

# Build and deploy
npm run deploy:prod
```

## Environment Configuration

### Required Environment Variables
- `PX_API_TOKEN`: Production PX API token (stored in Cloudflare secrets)
- `PX_OFFER_ID`: Production offer ID (default: 122 for testing)
- `PX_DID`: Production DID number (default: +18576880648 for testing)

### PX API Configuration
- **Ping URL**: https://leadapi.px.com/api/call/ping
- **Post URL**: https://leadapi.px.com/api/call/post
- **Test Offer ID**: 122
- **Test DID**: +18576880648

## Database Schema

### Key Tables
- `affiliates` - Partner information and API keys
- `campaigns` - Campaign configurations with PX mapping
- `leads` - Complete lead records with tracking data
- `lead_events` - Event timeline for each lead
- `analytics` - Daily aggregated performance metrics
- `api_logs` - Complete API interaction audit trail

### Sample Data Included
- 3 sample affiliates
- 4 active campaigns (Facebook, Google, Social, Search)
- 5 test leads with various statuses
- Historical analytics data

## API Documentation

### Lead Submission
```javascript
POST /api/leads
Content-Type: application/json

{
  "first_name": "John",
  "last_name": "Doe", 
  "email": "john@example.com",
  "phone_number": "+15551234567",
  "zip_code": "90210",
  "ownership": "Own",
  "roof_shade": "No Shade",
  "electricity_bill": "$150-200",
  "campaign_id": "1"
}
```

### Response Format
```javascript
{
  "success": true,
  "data": {
    "lead_id": 123,
    "lead_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "ping_status": "accepted",
    "post_status": "posted", 
    "px_result": {
      "ping_accepted": true,
      "post_successful": true,
      "errors": []
    }
  },
  "message": "Lead submitted successfully"
}
```

## Security & Compliance

### Data Protection
- All PII encrypted in transit
- API tokens stored securely in Cloudflare secrets
- Input validation and sanitization
- SQL injection protection via prepared statements

### PX API Compliance
- Follows exact ping/post workflow requirements
- 15-second window enforcement
- Required solar data fields included
- SubId format validation per specifications

## Monitoring & Analytics

### Real-time Metrics
- Total leads processed
- Ping acceptance rate  
- Post success rate
- Revenue tracking (when configured)

### Logging
- Complete API request/response logging
- Error tracking with stack traces
- Performance monitoring
- Lead lifecycle events

## Support & Maintenance

### Troubleshooting
- Check PM2 logs: `pm2 logs affiliate-tracker --nostream`
- Verify database: `npm run db:console:local`
- Test API health: `curl /api/dashboard/stats`

### Common Issues
- **Port conflicts**: Use `npm run clean-port`
- **Database issues**: Reset with `npm run db:reset`
- **Build errors**: Clear and rebuild with `rm -rf dist && npm run build`

This platform provides a complete 360° affiliate tracking solution with robust PX API integration, real-time analytics, and comprehensive lead management capabilities.