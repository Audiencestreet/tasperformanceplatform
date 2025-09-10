#!/bin/bash

# =============================================================================
# Webhooks Test Script  
# =============================================================================
# Tests webhook integrations (Ringba, PX Postbacks)
# Usage: ./test/scripts/test-webhooks.sh [base_url]

BASE_URL=${1:-"http://localhost:3000"}

echo "🎣 Webhook Integration Tests"
echo "============================"
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Ringba Webhook - Completed Call
echo "📞 Test 1: Ringba Webhook - Completed Call"
echo "------------------------------------------"
curl -X GET "$BASE_URL/api/webhooks/ringba" \
  -G \
  --data-urlencode "event=Completed" \
  --data-urlencode "call_id=TEST_CALL_001" \
  --data-urlencode "tracking_number=+18001234567" \
  --data-urlencode "caller_number=+15551111111" \
  --data-urlencode "duration=120" \
  --data-urlencode "status=answered" \
  --data-urlencode "recording_url=https://recordings.ringba.com/test001.mp3" \
  --data-urlencode "timestamp=2024-01-20T10:30:00Z" \
  --silent --show-error | jq '.'
echo ""

# Test 2: Ringba Webhook - Short Call (Under 30 seconds)
echo "📞 Test 2: Ringba Webhook - Short Call (No Qualification)"
echo "---------------------------------------------------------"
curl -X GET "$BASE_URL/api/webhooks/ringba" \
  -G \
  --data-urlencode "event=Completed" \
  --data-urlencode "call_id=TEST_CALL_002" \
  --data-urlencode "tracking_number=+18002345678" \
  --data-urlencode "caller_number=+15552222222" \
  --data-urlencode "duration=15" \
  --data-urlencode "status=answered" \
  --data-urlencode "timestamp=2024-01-20T10:35:00Z" \
  --silent --show-error | jq '.'
echo ""

# Test 3: Ringba Webhook - Qualified Call (Over 30 seconds)
echo "📞 Test 3: Ringba Webhook - Qualified Call (Should Trigger Postback)"
echo "--------------------------------------------------------------------"
curl -X GET "$BASE_URL/api/webhooks/ringba" \
  -G \
  --data-urlencode "event=Completed" \
  --data-urlencode "call_id=TEST_CALL_003" \
  --data-urlencode "tracking_number=+18003456789" \
  --data-urlencode "caller_number=+15553333333" \
  --data-urlencode "duration=180" \
  --data-urlencode "status=answered" \
  --data-urlencode "recording_url=https://recordings.ringba.com/test003.mp3" \
  --data-urlencode "timestamp=2024-01-20T10:40:00Z" \
  --silent --show-error | jq '.'
echo ""

# Test 4: PX Postback - Lead Conversion 
echo "💰 Test 4: PX Postback - Lead Conversion"
echo "---------------------------------------"
curl -X GET "$BASE_URL/api/postback/px" \
  -G \
  --data-urlencode "aff_sub=AF01" \
  --data-urlencode "aff_sub2=px_test_click_001" \
  --data-urlencode "transaction_id=PX_TEST_TXN_001" \
  --data-urlencode "payout=25.00" \
  --data-urlencode "campaign_id=1" \
  --data-urlencode "status=conversion" \
  --silent --show-error | jq '.'
echo ""

# Test 5: PX Postback - ADT Conversion
echo "🏠 Test 5: PX Postback - ADT Conversion"
echo "--------------------------------------"
curl -X GET "$BASE_URL/api/postback/px" \
  -G \
  --data-urlencode "aff_sub=EM01" \
  --data-urlencode "aff_sub2=adt_test_click_001" \
  --data-urlencode "transaction_id=PX_ADT_TXN_001" \
  --data-urlencode "payout=60.00" \
  --data-urlencode "campaign_id=5" \
  --data-urlencode "status=conversion" \
  --silent --show-error | jq '.'
echo ""

# Test 6: Generic Affiliate Postback
echo "🔄 Test 6: Generic Affiliate Postback"
echo "------------------------------------"
curl -X POST "$BASE_URL/webhooks/postback/1" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "1",
    "status": "conversion",
    "payout": 25.00,
    "currency": "USD",
    "custom1": "solar_campaign",
    "custom2": "facebook_traffic",
    "custom3": "test_conversion"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 7: Inbound Call Tracking API
echo "📞 Test 7: Inbound Call Tracking API"
echo "-----------------------------------"
curl -X POST "$BASE_URL/api/calls/inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+15551234567",
    "campaign_id": "1",
    "affiliate_id": "1",
    "duration": 145,
    "caller_name": "John Smith",
    "caller_location": "Beverly Hills, CA",
    "status": "answered",
    "recording_url": "https://recordings.example.com/call001.mp3",
    "timestamp": "2024-01-20T10:45:00Z",
    "tracking_number": "+18001234567",
    "source_number": "+15551234567"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 8: Conversion Pixel Endpoint
echo "📊 Test 8: Conversion Pixel Tracking"
echo "-----------------------------------"
curl -X POST "$BASE_URL/pixel/conversion" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": 1,
    "campaign_id": 1,
    "event_name": "pixel_conversion",
    "value": 25.00,
    "click_id": "pixel_test_001"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 9: Missing Parameters (Error Tests)
echo "❌ Test 9: Missing Required Parameters"
echo "-------------------------------------"
echo "PX Postback without transaction_id:"
curl -X GET "$BASE_URL/api/postback/px" \
  -G \
  --data-urlencode "campaign_id=1" \
  --data-urlencode "payout=25.00" \
  --silent --show-error | jq '.'
echo ""

echo "Inbound Call without required fields:"
curl -X POST "$BASE_URL/api/calls/inbound" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+15551234567"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 10: Call Tracking Number Management
echo "📋 Test 10: Call Tracking Number Management"
echo "------------------------------------------"
curl -X POST "$BASE_URL/api/call-tracking/numbers" \
  -H "Content-Type: application/json" \
  -d '{
    "tracking_number": "+18009999999",
    "campaign_id": 1,
    "affiliate_id": 1,
    "provider": "ringba"
  }' \
  --silent --show-error | jq '.'
echo ""

echo "✅ Webhook Tests Complete"
echo "========================="