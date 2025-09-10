# 🚀 Affiliate Tracking System

A comprehensive affiliate tracking and lead management system built for Cloudflare Pages with Hono framework, featuring PX API integration, call tracking, and real-time postback processing.

## 📋 Table of Contents
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Integrations](#-integrations)
- [Campaign Structure](#-campaign-structure)
- [SubID Rules](#-subid-rules)
- [API Endpoints](#-api-endpoints)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Known Issues](#-known-issues)
- [Contributing](#-contributing)

## ✨ Features

### Lead Management
- **PX Direct Post API Integration** - Real-time lead submission for Solar, Health, and Home verticals
- **Campaign Attribution** - Complete click-to-conversion tracking with unique identifiers
- **Multi-Vertical Support** - Solar (Offer ID 122), Health, Home, and ADT Home Security (Offer ID 477)
- **Lead Qualification** - Automated lead validation and scoring

### Tracking & Attribution
- **Dynamic Tracking Links** - Generate unique tracking URLs for each campaign and traffic source
- **Click Tracking** - Comprehensive click logging with IP, User-Agent, and referrer data
- **SubID Management** - Automated SubID generation and validation (AF01-AF04, EM01-EM02, etc.)
- **Cross-Device Attribution** - Track users across multiple touchpoints

### Call Tracking
- **Ringba Integration** - Inbound call tracking with webhook processing
- **Call Attribution** - Link calls back to original campaigns and traffic sources
- **Call Qualification** - Track call duration and quality metrics
- **Real-time Processing** - Instant call event processing and postback triggers

### Postback System
- **Real-time Postbacks** - Instant conversion notifications to affiliate networks
- **Multiple Trigger Events** - Click tracking, lead acceptance, call qualification, conversions
- **Template System** - Flexible postback URL templates with variable substitution
- **Retry Logic** - Automatic retry for failed postback deliveries

### Analytics & Reporting
- **Real-time Dashboard** - Live campaign performance metrics
- **Conversion Analytics** - Detailed conversion funnel analysis
- **Revenue Tracking** - Payout and commission tracking
- **Export Capabilities** - CSV export for external analysis

## 🛠 Tech Stack

### Backend
- **[Hono](https://hono.dev/)** - Lightweight web framework for Cloudflare Workers
- **TypeScript** - Type-safe development
- **Cloudflare D1** - Globally distributed SQLite database
- **Cloudflare Workers** - Edge computing platform

### Frontend
- **Vanilla JavaScript** - Lightweight frontend with no framework overhead
- **TailwindCSS** - Utility-first CSS framework
- **Chart.js** - Data visualization
- **Axios** - HTTP client

### Infrastructure
- **Cloudflare Pages** - Static site hosting with Functions
- **Cloudflare Workers** - Serverless compute
- **PM2** - Process management for development

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Cloudflare account (for deployment)
- PX API tokens (from account manager)

### Local Development

1. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd webapp
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with your API keys and tokens
   nano .env
   ```

3. **Database Setup**
   ```bash
   # Apply database migrations
   npm run db:migrate:local
   
   # Seed with test data
   npm run db:seed
   ```

4. **Start Development Server**
   ```bash
   # Build the application
   npm run build
   
   # Start with PM2 (recommended)
   npm run clean-port
   pm2 start ecosystem.config.cjs
   
   # Or start with wrangler directly
   npm run dev:sandbox
   ```

5. **Verify Installation**
   ```bash
   # Test the API
   curl http://localhost:3000/api/campaigns
   
   # Check logs
   pm2 logs --nostream
   ```

### Production Deployment

1. **Setup Cloudflare CLI**
   ```bash
   # Install wrangler globally
   npm install -g wrangler
   
   # Login to Cloudflare
   wrangler login
   ```

2. **Create Production Database**
   ```bash
   # Create D1 database
   wrangler d1 create webapp-production
   
   # Update wrangler.jsonc with database ID
   ```

3. **Configure Secrets**
   ```bash
   # Add API tokens as secrets
   wrangler secret put PX_API_TOKEN_SOLAR
   wrangler secret put PX_API_TOKEN_HEALTH
   wrangler secret put MARKETCALL_API_KEY
   wrangler secret put RINGBA_API_KEY
   ```

4. **Deploy Application**
   ```bash
   # Apply migrations to production
   npm run db:migrate:prod
   
   # Build and deploy
   npm run deploy
   ```

## 🔗 Integrations

### PX API Integration
**Status:** ✅ **Active** | **Verticals:** Solar, Health, Home

- **Direct Post API** - Real-time lead submission
- **XML Format** - Proper PX-compliant payload structure
- **Transaction Tracking** - Complete request/response logging
- **Error Handling** - Comprehensive error parsing and retry logic

**Solar Lead Requirements:**
- All contact information (Name, Email, Phone, Address)
- Solar-specific fields (Ownership, Roof Shade, Electricity Bill)
- Required compliance fields (TCPA, Session Length, IP Address)

**API Endpoints:**
- `POST /api/px/direct-post` - Test PX Direct Post API
- `GET /api/px/subids` - Get available SubIDs for traffic type
- `POST /api/px/subid/generate` - Generate new SubID

### MarketCall Integration
**Status:** 🚧 **In Development** | **Purpose:** Lead Distribution

- **Lead Routing** - Distribute leads to multiple buyers
- **Real-time Bidding** - Dynamic payout optimization
- **Backup Routes** - Fallback lead distribution

### Ringba Call Tracking
**Status:** ✅ **Active** | **Features:** Inbound Call Attribution

- **Webhook Integration** - `GET /api/webhooks/ringba`
- **Call Attribution** - Link calls to original campaigns
- **Duration Tracking** - Qualify calls based on length (>30 seconds)
- **Recording URLs** - Store call recordings for quality assurance

**Webhook Parameters:**
```
GET /api/webhooks/ringba?
  event=Completed&
  call_id=12345&
  tracking_number=+18001234567&
  caller_number=+15551234567&
  duration=120&
  status=answered&
  recording_url=https://recordings.ringba.com/...
```

### Optizmo Integration
**Status:** 📋 **Planned** | **Purpose:** Compliance & Data Enhancement

- **Data Validation** - Enhanced lead verification
- **Compliance Checking** - TCPA and regulatory compliance
- **Data Enrichment** - Additional demographic data

## 🏗 Campaign Structure

### Campaign Types

#### Solar Campaigns (Offer ID: 122)
```javascript
{
  "id": 1,
  "name": "Facebook Solar Campaign",
  "offer_id": "122",
  "sub_id": "FB01",
  "traffic_type": "Facebook",
  "payout_amount": 25.00,
  "vertical": "Solar"
}
```

#### ADT Home Security (Offer ID: 477)
```javascript
{
  "id": 5,
  "name": "ADT Home Security Email Campaign", 
  "offer_id": "477",
  "sub_id": "EM01",
  "traffic_type": "Email",
  "payout_amount": 60.00,
  "vertical": "Home"
}
```

#### Health Campaigns (Offer ID: TBD)
```javascript
{
  "id": 6,
  "name": "Health Insurance Campaign",
  "offer_id": "HEALTH_001",
  "sub_id": "HH01",
  "traffic_type": "Search",
  "payout_amount": 35.00,
  "vertical": "Health"
}
```

### Campaign Management API
- `GET /api/campaigns` - List all campaigns
- `POST /api/campaigns` - Create new campaign
- `PUT /api/campaigns/:id` - Update campaign
- `GET /api/campaigns/:id` - Get campaign details

## 🏷 SubID Rules

### SubID Strategy (≤20 total per PX account)

#### Affiliate Traffic (AF01-AF04)
- `AF01` - Primary affiliate traffic
- `AF02` - Secondary affiliate networks
- `AF03` - Tier 2 affiliates
- `AF04` - Testing and backup affiliates

#### Email Traffic (EM01-EM02)
- `EM01` - Primary email campaigns
- `EM02` - Secondary email campaigns / A/B testing

#### Social Media Traffic
- `FB01` - Facebook campaigns
- `IG01` - Instagram campaigns
- `TT01` - TikTok campaigns
- `TW01` - Twitter campaigns

#### Search Traffic
- `GG01` - Google Ads campaigns
- `TB01` - Taboola native campaigns
- `OB01` - Outbrain native campaigns

### SubID Validation Rules
- Maximum 20 characters
- No special characters: `;`, `\\`, `/`, `'`, `"`, `,`
- Alphanumeric and underscores only
- Case sensitive

### SubID Management API
- `GET /api/px/subids?traffic_type=Affiliates` - Get available SubIDs
- `POST /api/px/subid/generate` - Generate new SubID
- Automatic validation on campaign creation

## 🛡 API Endpoints

### Lead Management
```bash
# Submit new lead
POST /api/leads
Content-Type: application/json
{
  "first_name": "John",
  "last_name": "Doe", 
  "email": "john@example.com",
  "phone_number": "+15551234567",
  "zip_code": "90210",
  "campaign_id": "1"
}

# Get lead details
GET /api/leads/:id
```

### Tracking Links
```bash
# Generate tracking link
POST /api/tracking/generate
{
  "campaign_id": "5",
  "sub_id": "EM01", 
  "landing_url": "https://www.adt.com/"
}

# Response - ADT Campaign
{
  "tracking_link": "https://homesafety.adt.com/aff_ad?campaign_id=477&aff_id=15441&hostNameId=23326&aff_sub=EM01&aff_sub2=uuid"
}

# Click tracking (automatic)
GET /track/click?c=1&s=AF01&id=uuid&url=encoded_url
```

### PX API Testing
```bash
# Test PX Direct Post
POST /api/px/direct-post
{
  "vertical": "Solar",
  "subId": "AF01",
  "contact": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com", 
    "phone": "+15551234567",
    "zipCode": "90210"
  },
  "extras": {
    "Ownership": "Own",
    "Roofshade": "No Shade",
    "ElectricityBill": "$150-200"
  }
}
```

### Webhooks & Postbacks
```bash
# Ringba webhook (GET)
GET /api/webhooks/ringba?event=Completed&call_id=12345...

# PX postback receiver (GET)  
GET /api/postback/px?transaction_id=abc&campaign_id=1&payout=25.00

# General postback endpoint (POST)
POST /webhooks/postback/:affiliateId
```

### Analytics & Reporting
```bash
# Dashboard stats
GET /api/dashboard/stats?affiliate_id=1&campaign_id=5

# Recent activity
GET /api/dashboard/activity?limit=50

# Conversion analytics
GET /api/conversions/analytics?start_date=2024-01-01&end_date=2024-01-31
```

## 🌐 Deployment

### Cloudflare Pages Deployment

1. **Build Configuration**
   ```json
   // package.json
   {
     "scripts": {
       "build": "vite build",
       "deploy": "npm run build && wrangler pages deploy dist",
       "deploy:prod": "npm run build && wrangler pages deploy dist --project-name webapp"
     }
   }
   ```

2. **Wrangler Configuration**
   ```jsonc
   // wrangler.jsonc
   {
     "name": "webapp",
     "compatibility_date": "2024-01-01", 
     "pages_build_output_dir": "./dist",
     "d1_databases": [
       {
         "binding": "DB",
         "database_name": "webapp-production",
         "database_id": "your-database-id"
       }
     ]
   }
   ```

3. **Environment Variables**
   ```bash
   # Set production secrets
   wrangler secret put PX_API_TOKEN_SOLAR
   wrangler secret put PX_API_TOKEN_HEALTH
   wrangler secret put RINGBA_API_KEY
   wrangler secret put JWT_SECRET
   ```

### Custom Domain Setup
```bash
# Add custom domain
wrangler pages domain add your-domain.com --project-name webapp

# Configure DNS
# Add CNAME record: your-domain.com -> webapp.pages.dev
```

## 🧪 Testing

### Test Scripts

Run the included test scripts to verify all integrations:

```bash
# Test all campaign types
npm run test:campaigns

# Test PX API integration
npm run test:px

# Test tracking links
npm run test:tracking

# Test webhook processing
npm run test:webhooks
```

### Manual Testing

1. **PX Solar Lead Test**
   ```bash
   curl -X POST http://localhost:3000/api/px/direct-post \
     -H "Content-Type: application/json" \
     -d @test/fixtures/solar-lead.json
   ```

2. **ADT Tracking Link Test**
   ```bash
   curl -X POST http://localhost:3000/api/tracking/generate \
     -H "Content-Type: application/json" \
     -d '{"campaign_id": "5", "sub_id": "EM01", "landing_url": "https://www.adt.com/"}'
   ```

3. **Ringba Webhook Test**
   ```bash
   curl "http://localhost:3000/api/webhooks/ringba?event=Completed&call_id=test123&duration=45"
   ```

### Seed Data
```bash
# Load test campaigns and affiliates
npm run db:seed

# Reset database with fresh test data  
npm run db:reset
```

## 🐛 Known Issues & TODOs

### Current Issues

1. **PX API Validation** 
   - Some Solar leads fail validation due to missing required fields
   - **Fix:** Enhanced field mapping in production XML payload
   - **Status:** 🔄 In Progress

2. **Call Attribution**
   - Ringba webhooks need tracking number to campaign mapping
   - **Fix:** Implement call_tracking_numbers table management
   - **Status:** 📋 TODO

3. **Rate Limiting**
   - No rate limiting implemented for public APIs
   - **Fix:** Add Cloudflare rate limiting or middleware
   - **Status:** 📋 TODO

### Planned Enhancements

#### High Priority
- [ ] **MarketCall Integration** - Complete lead distribution system
- [ ] **Enhanced Error Handling** - Better PX API error recovery
- [ ] **Rate Limiting** - API protection and abuse prevention
- [ ] **Admin Dashboard** - Web UI for campaign management

#### Medium Priority  
- [ ] **Optizmo Integration** - Compliance and data enhancement
- [ ] **A/B Testing** - Built-in split testing for landing pages
- [ ] **Real-time Notifications** - Slack/Discord integration for alerts
- [ ] **Enhanced Analytics** - Advanced reporting and insights

#### Low Priority
- [ ] **Mobile App** - React Native app for affiliates
- [ ] **White Label** - Branded solution for enterprise clients
- [ ] **Machine Learning** - Predictive lead scoring
- [ ] **API Rate Limiting** - Advanced throttling strategies

### Performance Optimizations

#### Database
- [ ] **Query Optimization** - Add proper indexes for common queries
- [ ] **Connection Pooling** - Optimize D1 connection management
- [ ] **Data Archival** - Archive old leads and events

#### API Performance
- [ ] **Response Caching** - Cache static campaign and affiliate data
- [ ] **Async Processing** - Move heavy operations to background workers
- [ ] **CDN Optimization** - Better static asset delivery

## 🤝 Contributing

### Development Guidelines

1. **Code Style**
   - TypeScript with strict mode
   - ESLint + Prettier formatting
   - Comprehensive JSDoc comments

2. **Testing Requirements**
   - Unit tests for all API endpoints
   - Integration tests for external APIs
   - E2E tests for critical user flows

3. **Pull Request Process**
   - Feature branch naming: `feature/description`
   - Comprehensive PR descriptions
   - All tests must pass

### Getting Help

- **Documentation:** Check this README and inline code comments
- **Issues:** Use GitHub Issues for bug reports and feature requests
- **Discussions:** GitHub Discussions for general questions

## 📊 Current URLs & Status

### Production URLs
- **Production:** `https://webapp.pages.dev`
- **API Base:** `https://webapp.pages.dev/api`
- **Admin Dashboard:** `https://webapp.pages.dev/admin`

### Integration Status
- ✅ **PX API** - Active (Solar, Health verticals)
- ✅ **Ringba** - Active (Call tracking webhooks)
- ✅ **ADT Tracking** - Active (Offer ID 477)
- 🚧 **MarketCall** - In Development
- 📋 **Optizmo** - Planned

### Data Architecture
- **Primary Storage:** Cloudflare D1 SQLite
- **Lead Attribution:** UUID-based click tracking
- **Campaign Attribution:** SubID + Campaign ID mapping
- **Call Attribution:** Tracking number → Campaign mapping

---

## 📈 Quick Stats

| Metric | Status |
|--------|--------|
| **API Endpoints** | 25+ implemented |
| **Integrations** | 3 active, 2 planned |
| **Supported Verticals** | Solar, Health, Home, ADT |
| **SubID Strategy** | 20 total (PX limit) |
| **Deployment Platform** | Cloudflare Pages |
| **Database** | D1 SQLite (globally distributed) |

---

**Last Updated:** 2025-01-10  
**Version:** 1.0.0  
**Deployment Status:** ✅ Production Ready