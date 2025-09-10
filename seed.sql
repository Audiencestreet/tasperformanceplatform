-- =============================================================================
-- AFFILIATE TRACKING SYSTEM - SEED DATA
-- =============================================================================
-- Test data for development and testing environments
-- Run with: npm run db:seed

-- =============================================================================
-- AFFILIATES - Test affiliate accounts
-- =============================================================================
INSERT OR IGNORE INTO affiliates (id, name, email, company, phone, api_key, status, created_at) VALUES 
(1, 'Solar Power Marketing', 'admin@solarpowermarketing.com', 'Solar Power Marketing LLC', '+15551234567', 'spmarket_api_key_2024', 'active', '2024-01-01 00:00:00'),
(2, 'Green Energy Leads', 'contact@greenenergyleads.com', 'Green Energy Solutions Inc', '+15552345678', 'greenergy_api_key_2024', 'active', '2024-01-01 00:00:00'),  
(3, 'Renewable Solutions', 'info@renewablesolutions.com', 'Renewable Solutions Group', '+15553456789', 'renewable_api_key_2024', 'active', '2024-01-01 00:00:00'),
(4, 'Health Insurance Pro', 'support@healthinsurancepro.com', 'Health Insurance Professionals', '+15554567890', 'healthpro_api_key_2024', 'active', '2024-01-01 00:00:00'),
(5, 'Home Security Leads', 'leads@homesecurityleads.com', 'Home Security Marketing', '+15555678901', 'homesec_api_key_2024', 'active', '2024-01-01 00:00:00');

-- =============================================================================
-- CAMPAIGNS - Test campaigns for all verticals
-- =============================================================================

-- SOLAR CAMPAIGNS (Offer ID: 122)
INSERT OR IGNORE INTO campaigns (id, affiliate_id, name, description, offer_id, sub_id, traffic_type, payout_amount, status, created_at) VALUES 
(1, 1, 'Facebook Solar Campaign', 'Facebook targeted solar leads campaign with homeowner qualification', '122', 'FB01', 'Facebook', 25.00, 'active', '2024-01-01 00:00:00'),
(2, 1, 'Google Ads Solar', 'Google Search solar keywords campaign targeting high-intent searches', '122', 'GG01', 'Google', 30.00, 'active', '2024-01-01 00:00:00'),
(3, 2, 'Social Media Solar', 'Multi-platform social media solar campaign with A/B testing', '122', 'AF01', 'Social', 22.50, 'active', '2024-01-01 00:00:00'),
(4, 3, 'Search Engine Marketing Solar', 'Broad search engine marketing for solar installations', '122', 'AF02', 'Search', 27.50, 'active', '2024-01-01 00:00:00'),

-- ADT HOME SECURITY CAMPAIGNS (Offer ID: 477)  
(5, 5, 'ADT Home Security Email Campaign', 'ADT Home Security campaign targeting email subscribers', '477', 'EM01', 'Email', 60.00, 'active', '2024-01-01 00:00:00'),
(6, 5, 'ADT Home Security Affiliates', 'ADT campaign for affiliate network traffic', '477', 'AF03', 'Affiliates', 55.00, 'active', '2024-01-01 00:00:00'),

-- HEALTH INSURANCE CAMPAIGNS
(7, 4, 'Health Insurance Search Campaign', 'Health insurance search campaign targeting ACA enrollment', 'HEALTH_001', 'HH01', 'Search', 35.00, 'active', '2024-01-01 00:00:00'),
(8, 4, 'Health Insurance Email', 'Email marketing for health insurance during open enrollment', 'HEALTH_001', 'EM02', 'Email', 40.00, 'active', '2024-01-01 00:00:00'),

-- HOME IMPROVEMENT CAMPAIGNS
(9, 3, 'Home Improvement Leads', 'General home improvement and renovation leads', 'HOME_001', 'AF04', 'Search', 20.00, 'active', '2024-01-01 00:00:00'),
(10, 2, 'HVAC Replacement Campaign', 'HVAC replacement and repair campaign', 'HVAC_001', 'GG02', 'Google', 45.00, 'active', '2024-01-01 00:00:00');

-- =============================================================================
-- POSTBACK URLS - Test postback configurations
-- =============================================================================
INSERT OR IGNORE INTO postback_urls (id, affiliate_id, campaign_id, name, url_template, trigger_events, http_method, status, created_at) VALUES 
(1, 1, 1, 'Solar Lead Accepted', 'https://affiliate-system.com/postback?click_id={click_id}&payout={payout}&status={event_type}', '["ping_accepted", "post_successful"]', 'GET', 'active', '2024-01-01 00:00:00'),
(2, 1, NULL, 'Universal Conversion Postback', 'https://tracking.solarpowermarketing.com/pixel?aff_sub={sub_id}&aff_sub2={click_id}&payout={conversion_value}', '["conversion", "qualified_call"]', 'GET', 'active', '2024-01-01 00:00:00'),
(3, 5, 5, 'ADT Conversion Tracking', 'https://adt-affiliate-system.com/track?campaign={campaign_id}&sub_id={sub_id}&click_id={click_id}&commission={payout}', '["conversion", "inbound_call"]', 'GET', 'active', '2024-01-01 00:00:00'),
(4, 2, NULL, 'Green Energy Global Postback', 'https://api.greenenergyleads.com/conversions', '["post_successful", "qualified_call", "conversion"]', 'POST', 'active', '2024-01-01 00:00:00'),
(5, 4, 7, 'Health Insurance Enrollment', 'https://healthtracking.com/enroll?lead_id={lead_id}&value={conversion_value}&source={traffic_type}', '["conversion"]', 'GET', 'active', '2024-01-01 00:00:00');

-- =============================================================================
-- CAMPAIGN POSTBACK PARAMETERS - Custom parameters per campaign
-- =============================================================================
INSERT OR IGNORE INTO campaign_postback_params (campaign_id, parameter_name, parameter_value, description, created_at) VALUES 
(1, 'source_platform', 'facebook', 'Facebook campaign identifier', '2024-01-01 00:00:00'),
(1, 'campaign_type', 'solar_residential', 'Solar residential campaign type', '2024-01-01 00:00:00'),
(5, 'security_package', 'basic', 'ADT basic security package', '2024-01-01 00:00:00'),
(5, 'promotion_code', 'ADT2024Q1', 'Q1 2024 ADT promotion', '2024-01-01 00:00:00'),
(7, 'insurance_type', 'individual_aca', 'Individual ACA marketplace insurance', '2024-01-01 00:00:00'),
(7, 'enrollment_period', 'open_enrollment', 'Open enrollment period indicator', '2024-01-01 00:00:00');

-- =============================================================================
-- CALL TRACKING NUMBERS - Ringba integration test data  
-- =============================================================================
INSERT OR IGNORE INTO call_tracking_numbers (tracking_number, campaign_id, affiliate_id, provider, created_at) VALUES 
('+18001234567', 1, 1, 'ringba', '2024-01-01 00:00:00'),  -- Solar Facebook
('+18002345678', 2, 1, 'ringba', '2024-01-01 00:00:00'),  -- Solar Google
('+18003456789', 5, 5, 'ringba', '2024-01-01 00:00:00'),  -- ADT Email
('+18004567890', 7, 4, 'ringba', '2024-01-01 00:00:00'),  -- Health Insurance
('+18005678901', 9, 3, 'ringba', '2024-01-01 00:00:00');  -- Home Improvement

-- =============================================================================
-- SAMPLE LEADS - Test lead data for development
-- =============================================================================
INSERT OR IGNORE INTO leads (id, campaign_id, affiliate_id, lead_uuid, first_name, last_name, email, phone_number, zip_code, ownership, roof_shade, electricity_bill, ping_status, post_status, utm_source, utm_medium, utm_campaign, ip_address, user_agent, created_at) VALUES 
(1, 1, 1, 'solar_lead_001', 'John', 'Smith', 'john.smith@example.com', '+15551111111', '90210', 'Own', 'No Shade', '$150-200', 'accepted', 'posted', 'facebook', 'social', 'solar_q1_2024', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '2024-01-15 10:30:00'),
(2, 2, 1, 'solar_lead_002', 'Sarah', 'Johnson', 'sarah.johnson@example.com', '+15552222222', '10001', 'Own', 'Little Shade', '$200+', 'accepted', 'posted', 'google', 'search', 'solar_google_ads', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', '2024-01-16 14:45:00'),
(3, 5, 5, 'adt_lead_001', 'Michael', 'Brown', 'michael.brown@example.com', '+15553333333', '77001', 'Own', NULL, NULL, 'accepted', 'posted', 'email_newsletter', 'email', 'adt_security_q1', '192.168.1.102', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', '2024-01-17 09:15:00'),
(4, 7, 4, 'health_lead_001', 'Emily', 'Davis', 'emily.davis@example.com', '+15554444444', '30301', NULL, NULL, NULL, 'accepted', 'posted', 'google_search', 'search', 'health_insurance_aca', '192.168.1.103', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101', '2024-01-18 16:20:00'),
(5, 3, 2, 'solar_lead_003', 'David', 'Wilson', 'david.wilson@example.com', '+15555555555', '94102', 'Own', 'Moderate Shade', '$100-150', 'pending', 'pending', 'instagram', 'social', 'solar_instagram_ads', '192.168.1.104', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', '2024-01-19 11:00:00');

-- =============================================================================
-- SAMPLE CONVERSIONS - Test conversion data
-- =============================================================================
INSERT OR IGNORE INTO conversions (id, lead_id, campaign_id, affiliate_id, conversion_type, conversion_value, source_platform, click_id, conversion_data, created_at) VALUES 
(1, 1, 1, 1, 'lead_qualified', 25.00, 'PX', 'solar_lead_001', '{"px_transaction_id": "abc123", "buyer_name": "Solar Company A"}', '2024-01-15 10:35:00'),
(2, 2, 2, 1, 'lead_qualified', 30.00, 'PX', 'solar_lead_002', '{"px_transaction_id": "def456", "buyer_name": "Solar Company B"}', '2024-01-16 14:50:00'),
(3, 3, 5, 5, 'conversion', 60.00, 'ADT', 'adt_lead_001', '{"conversion_type": "security_system_installed", "package": "basic"}', '2024-01-20 15:30:00'),
(4, 4, 7, 4, 'enrollment_complete', 40.00, 'Health', 'health_lead_001', '{"policy_type": "individual_aca", "monthly_premium": 350}', '2024-01-25 10:15:00');

-- =============================================================================
-- SAMPLE INBOUND CALLS - Test call tracking data
-- =============================================================================
INSERT OR IGNORE INTO inbound_calls (id, phone_number, campaign_id, affiliate_id, call_duration, caller_name, call_status, tracking_number, source_number, created_at) VALUES 
(1, '+15551111111', 1, 1, 120, 'John Smith', 'answered', '+18001234567', '+15551111111', '2024-01-15 11:00:00'),
(2, '+15552222222', 2, 1, 45, 'Sarah Johnson', 'answered', '+18002345678', '+15552222222', '2024-01-16 15:15:00'),
(3, '+15553333333', 5, 5, 300, 'Michael Brown', 'answered', '+18003456789', '+15553333333', '2024-01-17 10:30:00'),
(4, '+15554444444', 7, 4, 25, 'Emily Davis', 'answered', '+18004567890', '+15554444444', '2024-01-18 16:45:00'),
(5, '+15559999999', 1, 1, 15, 'Unknown Caller', 'answered', '+18001234567', '+15559999999', '2024-01-20 09:30:00');

-- =============================================================================
-- SAMPLE RINGBA WEBHOOKS - Test webhook processing data
-- =============================================================================
INSERT OR IGNORE INTO ringba_webhooks (id, webhook_type, call_id, tracking_number, caller_number, duration, status, webhook_data, processed, created_at) VALUES 
(1, 'Completed', 'RB_001', '+18001234567', '+15551111111', 120, 'answered', '{"event": "Completed", "quality_score": 85}', 1, '2024-01-15 11:00:00'),
(2, 'Completed', 'RB_002', '+18002345678', '+15552222222', 45, 'answered', '{"event": "Completed", "quality_score": 70}', 1, '2024-01-16 15:15:00'),
(3, 'Completed', 'RB_003', '+18003456789', '+15553333333', 300, 'answered', '{"event": "Completed", "quality_score": 95}', 1, '2024-01-17 10:30:00'),
(4, 'Completed', 'RB_004', '+18004567890', '+15554444444', 25, 'answered', '{"event": "Completed", "quality_score": 40}', 1, '2024-01-18 16:45:00'),
(5, 'Missed', 'RB_005', '+18001234567', '+15558888888', 0, 'missed', '{"event": "Missed", "reason": "no_answer"}', 1, '2024-01-19 12:00:00');

-- =============================================================================
-- SAMPLE LEAD EVENTS - Test event tracking
-- =============================================================================
INSERT OR IGNORE INTO lead_events (lead_id, event_type, event_data, created_at) VALUES 
(1, 'lead_created', '{"source": "facebook_ad", "campaign": "solar_q1_2024"}', '2024-01-15 10:30:00'),
(1, 'ping_sent', '{"px_endpoint": "direct_post", "response_time_ms": 234}', '2024-01-15 10:30:15'),
(1, 'ping_accepted', '{"transaction_id": "abc123", "buyer": "Solar Company A", "price": 25.00}', '2024-01-15 10:30:16'),
(1, 'postback_sent', '{"url": "https://affiliate-system.com/postback", "response_code": 200}', '2024-01-15 10:30:17'),
(2, 'lead_created', '{"source": "google_search", "keyword": "solar panels near me"}', '2024-01-16 14:45:00'),
(2, 'ping_sent', '{"px_endpoint": "direct_post", "response_time_ms": 189}', '2024-01-16 14:45:12'),
(2, 'ping_accepted', '{"transaction_id": "def456", "buyer": "Solar Company B", "price": 30.00}', '2024-01-16 14:45:13'),
(3, 'lead_created', '{"source": "email_newsletter", "list": "home_security_subscribers"}', '2024-01-17 09:15:00'),
(3, 'conversion_recorded', '{"conversion_type": "security_system_installed", "value": 60.00}', '2024-01-20 15:30:00'),
(4, 'lead_created', '{"source": "google_search", "keyword": "health insurance plans"}', '2024-01-18 16:20:00'),
(4, 'enrollment_complete', '{"policy_number": "HI123456789", "premium": 350.00}', '2024-01-25 10:15:00');

-- =============================================================================
-- SAMPLE API CALLS - Test API logging
-- =============================================================================
INSERT OR IGNORE INTO api_calls (lead_id, api_type, endpoint, request_data, response_data, status_code, response_time_ms, created_at) VALUES 
(1, 'direct_post', 'https://leadapi.px.com/api/lead/directpost', '{"vertical": "Solar", "subId": "FB01"}', '{"Success": true, "LeadId": "abc123", "Price": 25.00}', 200, 234, '2024-01-15 10:30:15'),
(2, 'direct_post', 'https://leadapi.px.com/api/lead/directpost', '{"vertical": "Solar", "subId": "GG01"}', '{"Success": true, "LeadId": "def456", "Price": 30.00}', 200, 189, '2024-01-16 14:45:12'),
(3, 'adt_tracking', 'https://homesafety.adt.com/aff_ad', '{"campaign_id": "477", "aff_sub": "EM01"}', '{"click_tracked": true}', 200, 45, '2024-01-17 09:15:30'),
(4, 'health_enrollment', 'https://health-api.example.com/enroll', '{"vertical": "Health", "subId": "HH01"}', '{"enrollment_id": "ENR789"}', 200, 567, '2024-01-18 16:20:45');

-- =============================================================================
-- SAMPLE CLICK TRACKING - Test click attribution
-- =============================================================================
INSERT OR IGNORE INTO click_tracking (click_id, campaign_id, sub_id, landing_url, tracking_url, ip_address, user_agent, referrer, clicked_at, created_at) VALUES 
('click_001', 1, 'FB01', 'https://solar-landing.com/', 'http://localhost:3000/track/click?c=1&s=FB01&id=click_001', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'https://facebook.com', '2024-01-15 10:29:45', '2024-01-15 10:29:45'),
('click_002', 2, 'GG01', 'https://solar-quotes.com/', 'http://localhost:3000/track/click?c=2&s=GG01&id=click_002', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'https://google.com', '2024-01-16 14:44:30', '2024-01-16 14:44:30'),
('adt_click_001', 5, 'EM01', 'https://www.adt.com/', 'https://homesafety.adt.com/aff_ad?campaign_id=477&aff_sub=EM01&aff_sub2=adt_click_001', '192.168.1.102', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'https://email-newsletter.com', '2024-01-17 09:14:15', '2024-01-17 09:14:15'),
('health_click_001', 7, 'HH01', 'https://health-insurance.gov/', 'http://localhost:3000/track/click?c=7&s=HH01&id=health_click_001', '192.168.1.103', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0)', 'https://google.com', '2024-01-18 16:19:45', '2024-01-18 16:19:45'),
('solar_ig_001', 3, 'AF01', 'https://solar-estimates.com/', 'http://localhost:3000/track/click?c=3&s=AF01&id=solar_ig_001', '192.168.1.104', 'Mozilla/5.0 (X11; Linux x86_64)', 'https://instagram.com', '2024-01-19 10:59:30', '2024-01-19 10:59:30');

-- =============================================================================
-- SUCCESS MESSAGE
-- =============================================================================
-- Insert a record to confirm seed data was loaded
INSERT OR IGNORE INTO lead_events (lead_id, event_type, event_data, created_at) VALUES 
(0, 'seed_data_loaded', '{"timestamp": "2024-01-01 00:00:00", "version": "1.0.0", "records_created": "100+"}', datetime('now'));

-- Display success message
SELECT 'SUCCESS: Seed data loaded successfully!' as message,
       COUNT(*) as total_affiliates FROM affiliates
UNION ALL
SELECT 'Campaigns created:', COUNT(*) FROM campaigns  
UNION ALL
SELECT 'Leads created:', COUNT(*) FROM leads
UNION ALL
SELECT 'Conversions created:', COUNT(*) FROM conversions
UNION ALL
SELECT 'Calls tracked:', COUNT(*) FROM inbound_calls;