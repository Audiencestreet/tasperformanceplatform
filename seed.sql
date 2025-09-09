-- Sample affiliates
INSERT OR IGNORE INTO affiliates (id, name, email, api_key, status) VALUES 
  (1, 'Solar Power Marketing', 'admin@solarpowermarketing.com', 'spk_test_key_123456789', 'active'),
  (2, 'Green Energy Leads', 'contact@greenergyleads.com', 'gel_test_key_987654321', 'active'),
  (3, 'Renewable Solutions', 'info@renewablesolutions.com', 'rs_test_key_456789123', 'active');

-- Sample campaigns
INSERT OR IGNORE INTO campaigns (id, affiliate_id, name, description, offer_id, sub_id, traffic_type, payout_amount, status) VALUES 
  (1, 1, 'Facebook Solar Campaign', 'Facebook targeted solar leads campaign', '122', 'FB1', 'Facebook', 25.00, 'active'),
  (2, 1, 'Google Ads Solar', 'Google Search solar keywords campaign', '122', 'GG1', 'Google', 30.00, 'active'),
  (3, 2, 'Social Media Solar', 'Multi-platform social media campaign', '122', 'Social1', 'Social', 22.50, 'active'),
  (4, 3, 'Search Engine Marketing', 'Broad search engine marketing campaign', '122', 'Search1', 'Search', 27.50, 'active');

-- Sample leads
INSERT OR IGNORE INTO leads (
  id, campaign_id, affiliate_id, lead_uuid, first_name, last_name, email, phone_number, zip_code,
  ownership, roof_shade, electricity_bill, ping_status, post_status
) VALUES 
  (1, 1, 1, '550e8400-e29b-41d4-a716-446655440001', 'John', 'Doe', 'john.doe@email.com', '+15551234567', '90210', 'Own', 'No Shade', '$150-200', 'accepted', 'posted'),
  (2, 1, 1, '550e8400-e29b-41d4-a716-446655440002', 'Jane', 'Smith', 'jane.smith@email.com', '+15551234568', '90211', 'Own', 'Little Shade', '$200-250', 'accepted', 'posted'),
  (3, 2, 1, '550e8400-e29b-41d4-a716-446655440003', 'Mike', 'Johnson', 'mike.johnson@email.com', '+15551234569', '90212', 'Own', 'No Shade', '$250-300', 'rejected', 'pending'),
  (4, 3, 2, '550e8400-e29b-41d4-a716-446655440004', 'Sarah', 'Wilson', 'sarah.wilson@email.com', '+15551234570', '90213', 'Rent', 'Moderate Shade', '$100-150', 'accepted', 'posted'),
  (5, 4, 3, '550e8400-e29b-41d4-a716-446655440005', 'David', 'Brown', 'david.brown@email.com', '+15551234571', '90214', 'Own', 'No Shade', '$300+', 'accepted', 'pending');

-- Sample lead events
INSERT OR IGNORE INTO lead_events (lead_id, event_type, event_data) VALUES 
  (1, 'ping_sent', '{"timestamp": "2024-01-15T10:00:00Z", "endpoint": "ping"}'),
  (1, 'ping_accepted', '{"timestamp": "2024-01-15T10:00:01Z", "response": "BaeOK"}'),
  (1, 'post_sent', '{"timestamp": "2024-01-15T10:00:02Z", "endpoint": "post"}'),
  (1, 'post_success', '{"timestamp": "2024-01-15T10:00:03Z", "px_lead_id": "px_123456"}'),
  
  (2, 'ping_sent', '{"timestamp": "2024-01-15T11:00:00Z", "endpoint": "ping"}'),
  (2, 'ping_accepted', '{"timestamp": "2024-01-15T11:00:01Z", "response": "BaeOK"}'),
  (2, 'post_sent', '{"timestamp": "2024-01-15T11:00:02Z", "endpoint": "post"}'),
  (2, 'post_success', '{"timestamp": "2024-01-15T11:00:03Z", "px_lead_id": "px_123457"}'),
  
  (3, 'ping_sent', '{"timestamp": "2024-01-15T12:00:00Z", "endpoint": "ping"}'),
  (3, 'ping_rejected', '{"timestamp": "2024-01-15T12:00:01Z", "response": "BaeNok", "reason": "No agent available"}');

-- Sample analytics data
INSERT OR IGNORE INTO analytics (date, affiliate_id, campaign_id, leads_generated, pings_sent, pings_accepted, posts_sent, posts_successful, total_payout, traffic_type) VALUES 
  ('2024-01-15', 1, 1, 15, 15, 12, 12, 10, 250.00, 'Facebook'),
  ('2024-01-15', 1, 2, 10, 10, 8, 8, 7, 210.00, 'Google'),
  ('2024-01-15', 2, 3, 8, 8, 6, 6, 5, 112.50, 'Social'),
  ('2024-01-15', 3, 4, 12, 12, 9, 9, 8, 220.00, 'Search'),
  
  ('2024-01-14', 1, 1, 18, 18, 14, 14, 12, 300.00, 'Facebook'),
  ('2024-01-14', 1, 2, 12, 12, 10, 10, 9, 270.00, 'Google'),
  ('2024-01-14', 2, 3, 10, 10, 7, 7, 6, 135.00, 'Social'),
  ('2024-01-14', 3, 4, 14, 14, 11, 11, 9, 247.50, 'Search');

-- Sample postback URLs
INSERT OR IGNORE INTO postback_urls (id, affiliate_id, campaign_id, name, url_template, trigger_events, http_method, status) VALUES 
  (1, 1, 1, 'Facebook Campaign Postback', 'https://affiliate1.com/postback?lead_id={lead_id}&status={status}&payout={payout}&campaign={campaign_id}', '["ping_accepted", "post_successful", "conversion"]', 'GET', 'active'),
  (2, 1, 2, 'Google Campaign Postback', 'https://affiliate1.com/postback?lead_id={lead_id}&status={status}&value={conversion_value}', '["post_successful", "conversion"]', 'GET', 'active'),
  (3, 2, null, 'All Campaigns Postback', 'https://affiliate2.com/webhook', '["conversion"]', 'POST', 'active'),
  (4, 3, 4, 'Search Campaign Postback', 'https://affiliate3.com/track?id={lead_uuid}&event={status}&amount={payout}', '["ping_accepted", "post_successful"]', 'GET', 'active');

-- Sample conversions
INSERT OR IGNORE INTO conversions (id, lead_id, campaign_id, affiliate_id, conversion_type, conversion_value, currency, source_platform, attribution_window_hours, time_to_conversion_hours) VALUES 
  (1, 1, 1, 1, 'lead_qualified', 25.00, 'USD', 'facebook', 168, 2),
  (2, 2, 1, 1, 'lead_qualified', 25.00, 'USD', 'facebook', 168, 1),
  (3, 4, 3, 2, 'lead_qualified', 22.50, 'USD', 'google', 168, 4),
  (4, 1, 1, 1, 'sale', 150.00, 'USD', 'postback', 168, 48),
  (5, 2, 1, 1, 'sale', 200.00, 'USD', 'postback', 168, 72);

-- Sample conversion pixels
INSERT OR IGNORE INTO conversion_pixels (id, campaign_id, pixel_type, pixel_id, conversion_label, event_name, status) VALUES 
  (1, 1, 'google', 'AW-123456789', 'conversion_label_123', 'conversion', 'active'),
  (2, 1, 'facebook', '123456789012345', null, 'Lead', 'active'),
  (3, 2, 'google', 'AW-987654321', 'conversion_label_456', 'conversion', 'active'),
  (4, 3, 'facebook', '987654321098765', null, 'Lead', 'active');

-- Sample postback logs
INSERT OR IGNORE INTO postback_logs (postback_url_id, lead_id, event_type, request_url, request_method, response_status, success, response_time_ms) VALUES 
  (1, 1, 'ping_accepted', 'https://affiliate1.com/postback?lead_id=1&status=ping_accepted&payout=25.00&campaign=1', 'GET', 200, 1, 150),
  (1, 1, 'post_successful', 'https://affiliate1.com/postback?lead_id=1&status=post_successful&payout=25.00&campaign=1', 'GET', 200, 1, 120),
  (2, 2, 'post_successful', 'https://affiliate1.com/postback?lead_id=2&status=post_successful&value=25.00', 'GET', 200, 1, 180),
  (4, 5, 'ping_accepted', 'https://affiliate3.com/track?id=550e8400-e29b-41d4-a716-446655440005&event=ping_accepted&amount=27.50', 'GET', 404, 0, 5000);