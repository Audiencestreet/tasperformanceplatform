# Database Schema Documentation

## Overview
The Affiliate Tracking System uses Cloudflare D1 (SQLite) for data persistence with a normalized relational schema optimized for lead attribution, campaign management, and conversion tracking.

## Core Tables

### affiliates
Stores affiliate partner information and API credentials.

```sql
CREATE TABLE affiliates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,              -- Affiliate company/person name
  email TEXT UNIQUE NOT NULL,      -- Primary contact email
  company TEXT,                    -- Company name
  phone TEXT,                      -- Contact phone
  api_key TEXT UNIQUE,            -- API authentication key
  status TEXT DEFAULT 'active',   -- active, inactive, suspended
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Key Relationships:**
- One-to-many with campaigns
- One-to-many with postback_urls
- One-to-many with leads (through campaigns)

### campaigns
Campaign configuration and payout settings.

```sql
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL,
  name TEXT NOT NULL,              -- Campaign display name
  description TEXT,                -- Campaign description
  offer_id TEXT NOT NULL,         -- External offer identifier (e.g., "122", "477")
  sub_id TEXT NOT NULL,           -- PX SubID (AF01, EM01, etc.)
  traffic_type TEXT NOT NULL,     -- Traffic source type
  payout_amount DECIMAL(10,2) NOT NULL, -- Commission per conversion
  status TEXT DEFAULT 'active',   -- active, paused, inactive
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);
```

**Campaign Types by Vertical:**
- **Solar (Offer ID: 122):** $25-30 payouts, AF01-AF02/FB01/GG01 SubIDs
- **ADT Home Security (Offer ID: 477):** $60 payout, EM01/AF03 SubIDs  
- **Health (Offer: HEALTH_*):** $35-40 payouts, HH01/EM02 SubIDs
- **Home Improvement (Offer: HOME_*/HVAC_*):** $20-45 payouts, AF04/GG02 SubIDs

### leads
Complete lead records with PX API responses and attribution data.

```sql
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  affiliate_id INTEGER NOT NULL,
  lead_uuid TEXT UNIQUE NOT NULL,  -- Unique lead identifier
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  
  -- Address information
  address TEXT,
  city TEXT,
  state TEXT,
  
  -- Solar-specific fields
  ownership TEXT,                  -- Own, Rent
  roof_shade TEXT,                -- No Shade, Little Shade, etc.
  electricity_bill TEXT,          -- $100-150, $150-200, etc.
  
  -- PX API status tracking
  ping_status TEXT DEFAULT 'pending',     -- pending, accepted, rejected, failed
  post_status TEXT DEFAULT 'pending',     -- pending, posted, failed
  ping_sent_at DATETIME,
  post_sent_at DATETIME,
  ping_response TEXT,              -- JSON response from PX ping
  post_response TEXT,              -- JSON response from PX post
  px_lead_id TEXT,                -- PX assigned lead ID
  
  -- Attribution data
  utm_source TEXT,
  utm_medium TEXT, 
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);
```

**Lead Flow States:**
1. **Created:** Initial lead record created
2. **Ping Sent:** Submitted to PX Direct Post API  
3. **Ping Accepted:** PX accepted lead, got Transaction ID
4. **Post Successful:** Lead successfully posted to buyer
5. **Converted:** Final conversion/sale completed

### conversions  
Tracks successful conversions and revenue attribution.

```sql
CREATE TABLE conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  affiliate_id INTEGER NOT NULL,
  conversion_type TEXT NOT NULL,   -- lead_qualified, conversion, chargeback
  conversion_value DECIMAL(10,2) DEFAULT 0.00,
  source_platform TEXT,           -- PX, ADT, Health, etc.
  click_id TEXT,                  -- Original click identifier
  conversion_data TEXT,           -- JSON metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);
```

**Conversion Types:**
- **lead_qualified:** PX accepted lead (initial payout)
- **conversion:** Final sale/enrollment completed
- **chargeback:** Conversion reversed (negative payout)
- **qualified_call:** Inbound call qualified (call tracking)

## Call Tracking Tables

### inbound_calls
Tracks inbound calls from Ringba and other call tracking platforms.

```sql
CREATE TABLE inbound_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT NOT NULL,      -- Caller's phone number
  campaign_id INTEGER,             -- Attribution to campaign
  affiliate_id INTEGER,            -- Attribution to affiliate
  call_duration INTEGER DEFAULT 0, -- Duration in seconds
  caller_name TEXT,               -- Caller identification
  caller_location TEXT,           -- Geographic location
  call_status TEXT,               -- answered, missed, busy
  recording_url TEXT,             -- Call recording URL
  call_timestamp DATETIME,        -- When call occurred
  tracking_number TEXT,           -- Number that was called
  source_number TEXT,             -- Original caller number
  ip_address TEXT,                -- IP if available
  user_agent TEXT,               -- User agent if available
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);
```

### call_tracking_numbers
Maps tracking phone numbers to campaigns for attribution.

```sql
CREATE TABLE call_tracking_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_number TEXT UNIQUE NOT NULL, -- Phone number
  campaign_id INTEGER,            -- Associated campaign
  affiliate_id INTEGER,           -- Associated affiliate
  provider TEXT DEFAULT 'ringba', -- ringba, callrail, marchex
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);
```

## Tracking & Attribution Tables

### click_tracking
Tracks click attribution and user behavior.

```sql
CREATE TABLE click_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  click_id TEXT UNIQUE NOT NULL,   -- UUID for click attribution
  campaign_id INTEGER NOT NULL,
  sub_id TEXT NOT NULL,           -- PX SubID
  landing_url TEXT NOT NULL,      -- Destination URL
  tracking_url TEXT,              -- Generated tracking URL
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  clicked_at DATETIME,            -- When click occurred
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

### ringba_webhooks
Stores Ringba webhook data for processing and debugging.

```sql
CREATE TABLE ringba_webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_type TEXT,              -- Completed, Missed, etc.
  call_id TEXT,                   -- Ringba call identifier
  tracking_number TEXT,
  caller_number TEXT,
  duration INTEGER DEFAULT 0,
  status TEXT,                    -- answered, missed, busy
  recording_url TEXT,
  webhook_data TEXT,              -- Full JSON payload
  processed BOOLEAN DEFAULT 0,    -- Processing status
  error_message TEXT,             -- Error details if failed
  processed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Postback & Integration Tables

### postback_urls
Configures affiliate postback URLs for conversion notifications.

```sql
CREATE TABLE postback_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL,
  campaign_id INTEGER,            -- NULL = global postback
  name TEXT NOT NULL,             -- Descriptive name
  url_template TEXT NOT NULL,     -- URL with variable placeholders
  trigger_events TEXT NOT NULL,   -- JSON array of events
  http_method TEXT DEFAULT 'GET', -- GET, POST
  headers TEXT,                   -- JSON headers for POST
  payload_template TEXT,          -- POST body template
  status TEXT DEFAULT 'active',   -- active, inactive
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

**Postback URL Templates:**
```
# Affiliate conversion tracking
https://affiliate-system.com/postback?click_id={click_id}&payout={payout}&status={event_type}

# ADT conversion tracking  
https://adt-tracking.com/pixel?aff_sub={sub_id}&aff_sub2={click_id}&commission={conversion_value}

# Health insurance enrollment
https://health-api.com/enroll?lead_id={lead_id}&value={conversion_value}&source={traffic_type}
```

### campaign_postback_params
Custom parameters for campaign-specific postbacks.

```sql
CREATE TABLE campaign_postback_params (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  parameter_name TEXT NOT NULL,   -- Custom parameter name
  parameter_value TEXT NOT NULL,  -- Parameter value
  description TEXT,               -- Parameter description
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

## Logging & Analytics Tables

### lead_events
Event log for lead lifecycle tracking.

```sql
CREATE TABLE lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,       -- lead_created, ping_sent, etc.
  event_data TEXT,               -- JSON event metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

### api_calls
API call logging for performance monitoring and debugging.

```sql
CREATE TABLE api_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  api_type TEXT NOT NULL,         -- direct_post, ping_post, etc.
  endpoint TEXT NOT NULL,         -- API endpoint URL
  request_data TEXT,              -- JSON request payload
  response_data TEXT,             -- JSON response data
  status_code INTEGER,            -- HTTP status code
  response_time_ms INTEGER,       -- Response time in milliseconds
  error_message TEXT,             -- Error details if failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

### postback_logs
Tracks postback delivery attempts and responses.

```sql
CREATE TABLE postback_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  postback_url_id INTEGER,
  event_type TEXT NOT NULL,
  postback_url TEXT NOT NULL,
  request_method TEXT,
  request_headers TEXT,
  request_body TEXT,
  response_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (postback_url_id) REFERENCES postback_urls(id)
);
```

## Indexes for Performance

```sql
-- Lead lookups
CREATE INDEX idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX idx_leads_affiliate_id ON leads(affiliate_id);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_px_lead_id ON leads(px_lead_id);

-- Click attribution  
CREATE INDEX idx_click_tracking_click_id ON click_tracking(click_id);
CREATE INDEX idx_click_tracking_campaign_id ON click_tracking(campaign_id);

-- Call tracking
CREATE INDEX idx_inbound_calls_tracking_number ON inbound_calls(tracking_number);
CREATE INDEX idx_inbound_calls_campaign_id ON inbound_calls(campaign_id);
CREATE INDEX idx_call_tracking_numbers_tracking_number ON call_tracking_numbers(tracking_number);

-- Conversions
CREATE INDEX idx_conversions_lead_id ON conversions(lead_id);
CREATE INDEX idx_conversions_campaign_id ON conversions(campaign_id);
CREATE INDEX idx_conversions_created_at ON conversions(created_at);

-- Events and logs
CREATE INDEX idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX idx_lead_events_event_type ON lead_events(event_type);
CREATE INDEX idx_api_calls_created_at ON api_calls(created_at);
CREATE INDEX idx_postback_logs_created_at ON postback_logs(created_at);
```

## Data Relationships

```
affiliates (1) ←→ (M) campaigns ←→ (M) leads ←→ (M) conversions
           ↓                    ↓           ↓
    postback_urls        click_tracking  lead_events
                              ↓             ↓  
                         inbound_calls  api_calls
                              ↓
                       call_tracking_numbers
```

## Migration Strategy

1. **Initial Setup:** Run migrations in order (01_create_tables.sql, 02_indexes.sql)
2. **Seed Data:** Load test data with seed.sql
3. **Production Migration:** Use `wrangler d1 migrations apply` for zero-downtime updates
4. **Backup Strategy:** Regular exports via `wrangler d1 export` for disaster recovery

## Performance Considerations

- **Query Optimization:** All foreign keys indexed for fast joins
- **Date Partitioning:** Consider archiving old data (>1 year) for performance
- **Connection Pooling:** D1 handles connection management automatically
- **Read Replicas:** Consider D1 read replicas for analytics queries
- **Caching Strategy:** Cache campaign and affiliate data in Workers KV for faster lookups