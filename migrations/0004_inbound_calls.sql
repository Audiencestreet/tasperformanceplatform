-- Inbound Call Tracking Tables
-- Migration: 0004_inbound_calls.sql

-- Create inbound_calls table for tracking phone calls from affiliates
CREATE TABLE IF NOT EXISTS inbound_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT NOT NULL,
  campaign_id INTEGER NOT NULL,
  affiliate_id INTEGER NOT NULL,
  call_duration INTEGER DEFAULT 0, -- Duration in seconds
  caller_name TEXT,
  caller_location TEXT,
  call_status TEXT DEFAULT 'answered', -- answered, missed, busy, failed
  recording_url TEXT,
  call_timestamp DATETIME,
  tracking_number TEXT, -- The number the caller dialed
  source_number TEXT,   -- The caller's actual number
  call_value DECIMAL(10,2) DEFAULT 0.00,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inbound_calls_phone ON inbound_calls(phone_number);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_campaign ON inbound_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_affiliate ON inbound_calls(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_timestamp ON inbound_calls(call_timestamp);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_status ON inbound_calls(call_status);

-- Create call_tracking_numbers table for managing dynamic number pools
CREATE TABLE IF NOT EXISTS call_tracking_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_number TEXT UNIQUE NOT NULL,
  campaign_id INTEGER NOT NULL,
  affiliate_id INTEGER,
  is_active BOOLEAN DEFAULT 1,
  calls_received INTEGER DEFAULT 0,
  provider TEXT DEFAULT 'ringba', -- ringba, twilio, callrail, etc.
  provider_id TEXT, -- External ID from call tracking provider
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
);

-- Create indexes for call tracking numbers
CREATE INDEX IF NOT EXISTS idx_tracking_numbers_campaign ON call_tracking_numbers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tracking_numbers_affiliate ON call_tracking_numbers(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_tracking_numbers_active ON call_tracking_numbers(is_active);

-- Create ringba_webhooks table for Ringba integration
CREATE TABLE IF NOT EXISTS ringba_webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_type TEXT NOT NULL, -- 'call_start', 'call_end', 'call_answered', etc.
  call_id TEXT UNIQUE,
  tracking_number TEXT,
  caller_number TEXT,
  duration INTEGER,
  status TEXT,
  recording_url TEXT,
  webhook_data TEXT, -- JSON payload from Ringba
  processed BOOLEAN DEFAULT 0,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

-- Create index for webhook processing
CREATE INDEX IF NOT EXISTS idx_ringba_webhooks_processed ON ringba_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_ringba_webhooks_call_id ON ringba_webhooks(call_id);