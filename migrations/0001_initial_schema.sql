-- Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, inactive
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  offer_id TEXT NOT NULL, -- PX Offer ID
  sub_id TEXT NOT NULL, -- PX SubId format
  traffic_type TEXT NOT NULL, -- Search, Social, Google, Facebook, etc.
  payout_amount DECIMAL(10,2) DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, completed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  affiliate_id INTEGER NOT NULL,
  
  -- Lead identification
  lead_uuid TEXT UNIQUE NOT NULL, -- Internal tracking UUID
  px_lead_id TEXT, -- PX system lead ID (from response)
  
  -- Contact information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone_number TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  
  -- Solar-specific data (as per PX requirements)
  ownership TEXT, -- Own, Rent
  roof_shade TEXT, -- No Shade, Little Shade, Moderate Shade, Heavy Shade
  electricity_bill TEXT, -- Monthly bill amount range
  
  -- Tracking data
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  
  -- PX Integration status
  ping_status TEXT DEFAULT 'pending', -- pending, accepted, rejected
  post_status TEXT DEFAULT 'pending', -- pending, posted, failed
  ping_response TEXT, -- JSON response from ping
  post_response TEXT, -- JSON response from post
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ping_sent_at DATETIME,
  post_sent_at DATETIME,
  
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);

-- Lead events table (for tracking lead lifecycle)
CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- ping_sent, ping_accepted, ping_rejected, post_sent, post_success, post_failed
  event_data TEXT, -- JSON data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Analytics table (daily aggregates)
CREATE TABLE IF NOT EXISTS analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  affiliate_id INTEGER NOT NULL,
  campaign_id INTEGER,
  
  -- Metrics
  leads_generated INTEGER DEFAULT 0,
  pings_sent INTEGER DEFAULT 0,
  pings_accepted INTEGER DEFAULT 0,
  posts_sent INTEGER DEFAULT 0,
  posts_successful INTEGER DEFAULT 0,
  total_payout DECIMAL(10,2) DEFAULT 0.00,
  
  -- Traffic source breakdown
  traffic_type TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- API logs table (for debugging and monitoring)
CREATE TABLE IF NOT EXISTS api_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  request_type TEXT NOT NULL, -- ping, post
  endpoint TEXT NOT NULL,
  request_data TEXT, -- JSON request
  response_data TEXT, -- JSON response
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_affiliate_id ON leads(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_ping_status ON leads(ping_status);
CREATE INDEX IF NOT EXISTS idx_leads_post_status ON leads(post_status);

CREATE INDEX IF NOT EXISTS idx_campaigns_affiliate_id ON campaigns(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_event_type ON lead_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lead_events_created_at ON lead_events(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(date);
CREATE INDEX IF NOT EXISTS idx_analytics_affiliate_id ON analytics(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_analytics_campaign_id ON analytics(campaign_id);

CREATE INDEX IF NOT EXISTS idx_api_logs_lead_id ON api_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_request_type ON api_logs(request_type);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_affiliates_api_key ON affiliates(api_key);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);