#!/bin/bash

# =============================================================================
# Tracking Links Test Script
# =============================================================================
# Tests tracking link generation for all campaign types
# Usage: ./test/scripts/test-tracking-links.sh [base_url]

BASE_URL=${1:-"http://localhost:3000"}
TRACKING_API="$BASE_URL/api/tracking/generate"

echo "🔗 Tracking Links Integration Tests"
echo "===================================="
echo "API Endpoint: $TRACKING_API"
echo ""

# Test 1: ADT Campaign Tracking Link (Special Format)
echo "🏠 Test 1: ADT Home Security Campaign"
echo "------------------------------------"
curl -X POST "$TRACKING_API" \
  -H "Content-Type: application/json" \
  -d @test/fixtures/adt-campaign.json \
  --silent --show-error | jq '.'
echo ""

# Test 2: Solar Campaign Tracking Link (Generic Format)
echo "☀️  Test 2: Solar Campaign Tracking Link"
echo "---------------------------------------"
curl -X POST "$TRACKING_API" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "1",
    "sub_id": "FB01", 
    "landing_url": "https://solar-quotes.example.com/",
    "utm_source": "facebook",
    "utm_medium": "social",
    "utm_campaign": "solar_q1_2024"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 3: Health Insurance Campaign
echo "🏥 Test 3: Health Insurance Campaign"
echo "-----------------------------------"
curl -X POST "$TRACKING_API" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "7",
    "sub_id": "HH01",
    "landing_url": "https://health-insurance.gov/",
    "utm_source": "google_search",
    "utm_medium": "search", 
    "utm_campaign": "health_aca_enrollment"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 4: Email Campaign with EM SubID
echo "📧 Test 4: Email Campaign Tracking"
echo "---------------------------------"
curl -X POST "$TRACKING_API" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "8",
    "sub_id": "EM02",
    "landing_url": "https://health-enrollment.example.com/",
    "utm_source": "email_newsletter",
    "utm_medium": "email",
    "utm_campaign": "health_insurance_email_q1"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 5: Affiliate Campaign with AF SubID
echo "🤝 Test 5: Affiliate Network Campaign" 
echo "------------------------------------"
curl -X POST "$TRACKING_API" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "3",
    "sub_id": "AF01",
    "landing_url": "https://solar-estimates.example.com/",
    "utm_source": "affiliate_network",
    "utm_medium": "referral",
    "utm_campaign": "solar_affiliate_q1"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 6: Missing Required Fields (Error Test)
echo "❌ Test 6: Missing Required Fields"
echo "----------------------------------"
curl -X POST "$TRACKING_API" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "1"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 7: Invalid Campaign ID (Error Test)
echo "⚠️  Test 7: Invalid Campaign ID"
echo "------------------------------"
curl -X POST "$TRACKING_API" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "99999",
    "sub_id": "TEST01",
    "landing_url": "https://example.com/"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 8: Test Click Tracking (Simulate Click)
echo "👆 Test 8: Click Tracking Simulation"
echo "-----------------------------------"
echo "Note: This would normally redirect, using --head to see headers only"
curl --head "$BASE_URL/track/click?c=1&s=FB01&id=test_click_123&url=https%3A%2F%2Fexample.com" \
  --silent --show-error
echo ""

# Test 9: Get Campaign List (Verify Campaign IDs)
echo "📋 Test 9: Available Campaigns"
echo "-----------------------------"
curl -X GET "$BASE_URL/api/campaigns" \
  --silent --show-error | jq '.data[] | {id, name, offer_id, sub_id, traffic_type}'
echo ""

echo "✅ Tracking Links Tests Complete"
echo "================================"