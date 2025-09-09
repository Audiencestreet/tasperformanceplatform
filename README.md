# 360° Affiliate Tracking Platform with PX Direct Post Integration

## Project Overview
- **Name**: Comprehensive Affiliate Tracking Platform
- **Goal**: Complete affiliate marketing tracking solution with PX API Direct Post integration
- **Features**: Click tracking, lead management, postback integration, conversion tracking, PX Direct Post API

## ✅ Currently Completed Features

### Core Tracking System
- **✅ Tracking Link Generation**: Dynamic tracking links with unique click IDs
- **✅ Click Tracking**: Real-time click logging with IP, user agent, referrer data
- **✅ ADT Campaign Integration**: Special tracking format for ADT Home Security campaigns
- **✅ Campaign Management**: Full CRUD operations for campaigns with postback parameters
- **✅ Affiliate Management**: Complete affiliate management system with API keys

### PX Direct Post Integration (NEW)
- **✅ Direct Post API Client**: Updated PX API client using Direct Post endpoint
- **✅ Health & Solar Vertical Support**: Specialized methods for Health and Solar verticals
- **✅ SubId Strategy**: Updated SubId generation (≤20 total per account)
  - Email: EM01, EM02
  - Social: FB01, IG01, TT01, TW01  
  - Native/Search: TB01, OB01, GG01
- **✅ Environment Variables**: Production API token management
- **✅ Test Interface**: Comprehensive PX API test page with form validation
- **✅ API Endpoints**: 
  - `/api/px/direct-post` - Direct Post testing
  - `/api/px/subids` - SubId mappings
  - `/api/px/subid/generate` - SubId generation

### Dashboard & Analytics
- **✅ Real-time Dashboard**: Stats cards with lead counts, rates, revenue
- **✅ Campaign Analytics**: Performance metrics by campaign and affiliate
- **✅ Conversion Tracking**: Multi-platform conversion tracking (Google, Facebook, TikTok)
- **✅ Postback System**: Configurable postback URLs with custom parameters

## 🌍 Production URLs
- **Live Application**: https://3000-ij2h1e6pzy3g67a52hvcw-6532622b.e2b.dev
- **PX Test Interface**: https://3000-ij2h1e6pzy3g67a52hvcw-6532622b.e2b.dev/px-test
- **GitHub Repository**: [To be deployed]

## 🛠 Current Functional API Endpoints

### Tracking System
- **POST** `/api/tracking/generate` - Generate tracking links
  - Params: `campaign_id`, `sub_id`, `landing_url`
  - Returns: Tracking link with ADT detection
- **GET** `/track/click` - Click tracking redirect
  - Params: `c` (campaign), `s` (subId), `id` (clickId), `url` (landing)

### PX Direct Post API
- **POST** `/api/px/direct-post` - Test PX Direct Post
  - Body: `vertical`, `subId`, `contact`, `context`, `extras`
  - Returns: PX API response with success/error details
- **GET** `/api/px/subids` - Get all SubId mappings
- **POST** `/api/px/subid/generate` - Generate valid SubIds
  - Body: `trafficType`, `campaignNumber`

### Affiliate Management
- **POST** `/api/affiliates` - Create affiliate (auto-generates API key)
- **GET** `/api/affiliates` - List all affiliates
- **GET** `/api/affiliates/:id` - Get affiliate details
- **PUT** `/api/affiliates/:id` - Update affiliate

### Campaign Management  
- **POST** `/api/campaigns` - Create campaign
- **GET** `/api/campaigns` - List all campaigns
- **GET** `/api/campaigns/:id` - Get campaign details
- **POST** `/api/campaigns/:id/postback-params` - Add postback parameters

### Analytics & Reporting
- **GET** `/api/dashboard/stats` - Dashboard statistics
- **GET** `/api/dashboard/activity` - Recent activity
- **POST** `/api/leads` - Lead submission with PX processing

## 📊 Data Architecture

### Database (Cloudflare D1)
- **Core Tables**: `affiliates`, `campaigns`, `leads` 
- **Tracking Tables**: `tracking_links`, `clicks`, `campaign_postback_params`
- **Analytics Tables**: `conversions`, `postback_logs`, `api_calls`
- **Migrations**: Located in `/migrations/` directory

### Storage Services
- **D1 Database**: SQLite-based for relational data
- **Local Development**: Uses `--local` flag for offline development
- **Production**: Cloudflare D1 globally distributed database

### PX API Integration
- **Endpoint**: https://leadapi.px.com/api/lead/directpost
- **Health Token**: F9F9B3CC-85D8-4142-9007-61F784C1F098
- **Solar Token**: B593425D-90C7-4CB8-8952-605D8A0CCEC0
- **Authentication**: API token in payload (ApiToken field)
- **Verticals**: Health, Solar, Home support

## 📋 Features Not Yet Implemented

### PX Integration Issues
- **⚠️ PX API Authentication**: Currently receiving "Input data is not a valid JSON" error
  - API returns 200 status but validation fails
  - May need different authentication method or payload structure
  - Requires further investigation with PX support

### Advanced Features (Future)
- **Multi-vertical Landing Pages**: Custom landing pages for Health/Solar
- **Real-time Analytics Dashboard**: Live charts and metrics
- **Advanced Postback Routing**: Conditional postback routing logic
- **A/B Testing Framework**: Campaign split testing capabilities
- **Fraud Detection**: Click fraud and lead quality scoring

## 🚀 Recommended Next Steps

### Immediate Priority (PX Integration)
1. **Debug PX API Authentication**:
   - Verify correct API token format and authentication method
   - Check if endpoint requires different payload structure
   - Test with PX support team if needed
   - Consider using curl directly against PX API for debugging

2. **Alternative Testing**:
   - Test with Health vertical using health token
   - Try different payload structures based on PX documentation
   - Implement retry logic and better error handling

### Development Enhancements
3. **Environment Setup**:
   - Deploy to Cloudflare Pages production
   - Configure production environment variables
   - Set up GitHub repository integration

4. **Testing & Validation**:
   - Create comprehensive test suite for PX integration
   - Add validation for all PX field mappings
   - Implement lead quality scoring

5. **UI/UX Improvements**:
   - Enhance PX test interface with better error handling
   - Add real-time success/failure indicators
   - Create campaign-specific landing page generators

## 🔧 Tech Stack & Deployment
- **Framework**: Hono + TypeScript (Cloudflare Workers)
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Database**: Cloudflare D1 (SQLite)
- **Deployment**: Cloudflare Pages
- **Development**: PM2 + Wrangler local development
- **Version Control**: Git (ready for GitHub integration)

## 🔗 User Guide

### For Affiliates
1. **Get Started**: Visit the main dashboard
2. **Create Campaigns**: Use campaign management to set up tracking
3. **Generate Links**: Use tracking link generator with your SubIds
4. **Monitor Performance**: View real-time analytics and conversion data
5. **Test PX API**: Use PX Test page to validate lead submissions

### For Administrators  
1. **Manage Affiliates**: Create and manage affiliate accounts
2. **Configure Postbacks**: Set up postback URLs with custom parameters
3. **Monitor System**: View dashboard for system-wide analytics
4. **Debug Issues**: Use PX Test interface for troubleshooting

## 📞 Support & Troubleshooting

### Common Issues
- **PX API Errors**: Check SubId format (≤20 chars, no special characters)
- **Tracking Links**: Ensure campaign exists and is active
- **Database Issues**: Check D1 connection and migrations

### Debug Tools
- **PX Test Page**: `/px-test` - Comprehensive API testing
- **Browser Console**: Check for JavaScript errors
- **PM2 Logs**: `pm2 logs --nostream` for server-side debugging

---

**Last Updated**: September 2025  
**Status**: ✅ Active Development - PX Integration Phase  
**Version**: 2.0 (Direct Post Integration)