-- Postback URLs table for affiliate/campaign-specific postback configurations
CREATE TABLE IF NOT EXISTS postback_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL,
  campaign_id INTEGER,
  name TEXT NOT NULL,
  url_template TEXT NOT NULL, -- URL with {lead_id}, {status}, {payout} etc placeholders
  trigger_events TEXT NOT NULL, -- JSON array of events: ['ping_accepted', 'post_successful', 'conversion']
  http_method TEXT DEFAULT 'GET', -- GET, POST
  headers TEXT, -- JSON object for custom headers
  payload_template TEXT, -- JSON template for POST requests
  status TEXT DEFAULT 'active', -- active, paused, inactive
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Postback logs table for tracking all postback requests
CREATE TABLE IF NOT EXISTS postback_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  postback_url_id INTEGER NOT NULL,
  lead_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  request_url TEXT NOT NULL,
  request_method TEXT NOT NULL,
  request_headers TEXT, -- JSON
  request_payload TEXT, -- JSON for POST requests
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (postback_url_id) REFERENCES postback_urls(id),
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- Conversions table for tracking conversion events
CREATE TABLE IF NOT EXISTS conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  affiliate_id INTEGER NOT NULL,
  conversion_type TEXT NOT NULL, -- 'sale', 'signup', 'install', 'lead_qualified', etc.
  conversion_value DECIMAL(10,2) DEFAULT 0.00,
  currency TEXT DEFAULT 'USD',
  
  -- Conversion source tracking
  source_platform TEXT, -- 'google', 'facebook', 'tiktok', 'postback', 'pixel'
  click_id TEXT, -- gclid, fbclid, ttclid, etc.
  
  -- Google Ads specific
  google_conversion_id TEXT,
  google_conversion_label TEXT,
  google_order_id TEXT,
  
  -- Facebook specific  
  facebook_pixel_id TEXT,
  facebook_event_id TEXT,
  facebook_conversion_api_event_id TEXT,
  
  -- Attribution data
  attribution_window_hours INTEGER DEFAULT 168, -- 7 days default
  time_to_conversion_hours INTEGER,
  
  -- Conversion metadata
  conversion_data TEXT, -- JSON for custom conversion data
  user_agent TEXT,
  ip_address TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);

-- Conversion pixels table for tracking pixel configurations
CREATE TABLE IF NOT EXISTS conversion_pixels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  pixel_type TEXT NOT NULL, -- 'google', 'facebook', 'tiktok', 'custom'
  pixel_id TEXT NOT NULL, -- Google conversion ID, Facebook pixel ID, etc.
  conversion_label TEXT, -- Google conversion label
  event_name TEXT NOT NULL, -- 'purchase', 'lead', 'signup', etc.
  value_mapping TEXT, -- JSON for dynamic value mapping
  custom_parameters TEXT, -- JSON for platform-specific parameters
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Platform API tokens table for storing conversion API credentials
CREATE TABLE IF NOT EXISTS platform_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL, -- 'google_ads', 'facebook', 'tiktok'
  token_type TEXT NOT NULL, -- 'access_token', 'refresh_token', 'api_key'
  encrypted_token TEXT NOT NULL,
  account_id TEXT, -- Google Ads customer ID, Facebook ad account ID, etc.
  expires_at DATETIME,
  refresh_token TEXT,
  scope TEXT, -- Token permissions
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_postback_urls_affiliate_id ON postback_urls(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_postback_urls_campaign_id ON postback_urls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_postback_urls_status ON postback_urls(status);

CREATE INDEX IF NOT EXISTS idx_postback_logs_postback_url_id ON postback_logs(postback_url_id);
CREATE INDEX IF NOT EXISTS idx_postback_logs_lead_id ON postback_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_postback_logs_event_type ON postback_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_postback_logs_created_at ON postback_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_conversions_lead_id ON conversions(lead_id);
CREATE INDEX IF NOT EXISTS idx_conversions_campaign_id ON conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversions_affiliate_id ON conversions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_conversions_conversion_type ON conversions(conversion_type);
CREATE INDEX IF NOT EXISTS idx_conversions_source_platform ON conversions(source_platform);
CREATE INDEX IF NOT EXISTS idx_conversions_created_at ON conversions(created_at);
CREATE INDEX IF NOT EXISTS idx_conversions_click_id ON conversions(click_id);

CREATE INDEX IF NOT EXISTS idx_conversion_pixels_campaign_id ON conversion_pixels(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversion_pixels_pixel_type ON conversion_pixels(pixel_type);
CREATE INDEX IF NOT EXISTS idx_conversion_pixels_status ON conversion_pixels(status);

CREATE INDEX IF NOT EXISTS idx_platform_tokens_platform ON platform_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_platform_tokens_token_type ON platform_tokens(token_type);