-- Tracking Links table (for link generation and management)
CREATE TABLE IF NOT EXISTS tracking_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  click_id TEXT UNIQUE NOT NULL,
  campaign_id INTEGER NOT NULL,
  sub_id TEXT NOT NULL,
  landing_url TEXT NOT NULL,
  tracking_url TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Clicks table (for click tracking)
CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  click_id TEXT NOT NULL,
  campaign_id INTEGER NOT NULL,
  sub_id TEXT NOT NULL,
  landing_url TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Campaign Postback Parameters (for affiliate-specific postback configurations)
CREATE TABLE IF NOT EXISTS campaign_postback_params (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  parameter_name TEXT NOT NULL,
  parameter_value TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tracking_links_click_id ON tracking_links(click_id);
CREATE INDEX IF NOT EXISTS idx_tracking_links_campaign_id ON tracking_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tracking_links_created_at ON tracking_links(created_at);

CREATE INDEX IF NOT EXISTS idx_clicks_click_id ON clicks(click_id);
CREATE INDEX IF NOT EXISTS idx_clicks_campaign_id ON clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON clicks(clicked_at);

CREATE INDEX IF NOT EXISTS idx_campaign_postback_params_campaign_id ON campaign_postback_params(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_postback_params_name ON campaign_postback_params(parameter_name);