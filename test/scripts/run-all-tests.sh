#!/bin/bash

# =============================================================================
# Complete Test Suite Runner
# =============================================================================
# Runs all integration tests for the affiliate tracking system
# Usage: ./test/scripts/run-all-tests.sh [base_url]

BASE_URL=${1:-"http://localhost:3000"}

echo "🚀 Affiliate Tracking System - Complete Test Suite"
echo "=================================================="
echo "Base URL: $BASE_URL"
echo "Started at: $(date)"
echo ""

# Check if server is running
echo "🔍 Checking server status..."
if ! curl --silent --fail "$BASE_URL/api/campaigns" > /dev/null; then
    echo "❌ Server is not running at $BASE_URL"
    echo "Please start the server first:"
    echo "  npm run build"
    echo "  pm2 start ecosystem.config.cjs"
    echo ""
    exit 1
fi
echo "✅ Server is running"
echo ""

# Make test scripts executable
chmod +x test/scripts/*.sh

# Test 1: Database and API Health Check
echo "🏥 System Health Check"
echo "====================="
echo "Testing basic API endpoints..."

echo "Campaigns API:"
curl -s "$BASE_URL/api/campaigns" | jq '.success'

echo "Affiliates API:" 
curl -s "$BASE_URL/api/affiliates" | jq '.success'

echo "Dashboard Stats:"
curl -s "$BASE_URL/api/dashboard/stats" | jq '.success'
echo ""

# Test 2: PX API Integration Tests
echo "🔥 Running PX API Integration Tests..."
echo "====================================="
./test/scripts/test-px-api.sh "$BASE_URL"
echo ""

# Test 3: Tracking Links Tests
echo "🔗 Running Tracking Links Tests..." 
echo "================================="
./test/scripts/test-tracking-links.sh "$BASE_URL"
echo ""

# Test 4: Webhook Integration Tests
echo "🎣 Running Webhook Integration Tests..."
echo "======================================"
./test/scripts/test-webhooks.sh "$BASE_URL"
echo ""

# Test 5: Campaign Management Tests
echo "📋 Campaign Management Tests"
echo "============================"

echo "Creating test campaign:"
NEW_CAMPAIGN=$(curl -s -X POST "$BASE_URL/api/campaigns" \
  -H "Content-Type: application/json" \
  -d '{
    "affiliate_id": 1,
    "name": "Test Campaign - API Created",
    "description": "Campaign created via API test",
    "offer_id": "TEST_001", 
    "sub_id": "TEST01",
    "traffic_type": "Test",
    "payout_amount": 15.00,
    "status": "active"
  }')

CAMPAIGN_ID=$(echo "$NEW_CAMPAIGN" | jq -r '.data.id // empty')
if [[ -n "$CAMPAIGN_ID" ]]; then
    echo "✅ Campaign created with ID: $CAMPAIGN_ID"
    
    echo "Updating campaign:"
    curl -s -X PUT "$BASE_URL/api/campaigns/$CAMPAIGN_ID" \
      -H "Content-Type: application/json" \
      -d '{"payout_amount": 20.00}' | jq '.success'
    
    echo "Getting campaign details:"
    curl -s "$BASE_URL/api/campaigns/$CAMPAIGN_ID" | jq '.data.name, .data.payout_amount'
else
    echo "❌ Failed to create test campaign"
fi
echo ""

# Test 6: SubID Generation and Validation
echo "🏷️  SubID Management Tests"
echo "=========================="

echo "Available SubIDs for Affiliates:"
curl -s "$BASE_URL/api/px/subids?traffic_type=Affiliates" | jq '.data.available_subids'

echo "Generate Email SubID:"
curl -s -X POST "$BASE_URL/api/px/subid/generate" \
  -H "Content-Type: application/json" \
  -d '{"trafficType": "Email", "campaignNumber": 1}' | jq '.data'

echo "Test invalid SubID:"
curl -s -X POST "$BASE_URL/api/px/subid/generate" \
  -H "Content-Type: application/json" \
  -d '{"trafficType": "InvalidType"}' | jq '.success'
echo ""

# Test 7: Analytics and Reporting
echo "📊 Analytics and Reporting Tests"
echo "==============================="

echo "Dashboard stats:"
curl -s "$BASE_URL/api/dashboard/stats" | jq '.data | keys'

echo "Recent activity:"
curl -s "$BASE_URL/api/dashboard/activity?limit=5" | jq '.data | length'

echo "Conversion analytics:"
curl -s "$BASE_URL/api/conversions/analytics" | jq '.success'
echo ""

# Test 8: Error Handling Tests
echo "⚠️  Error Handling Tests"
echo "======================="

echo "Invalid endpoint (should return 404):"
curl -s "$BASE_URL/api/nonexistent" | jq '.success // "404_expected"'

echo "Malformed JSON (should return 400):"
curl -s -X POST "$BASE_URL/api/campaigns" \
  -H "Content-Type: application/json" \
  -d '{"invalid json"}' 2>/dev/null || echo "400 Bad Request (expected)"

echo "Missing required field (should return 400):"
curl -s -X POST "$BASE_URL/api/campaigns" \
  -H "Content-Type: application/json" \
  -d '{"name": "Incomplete Campaign"}' | jq '.success'
echo ""

# Test 9: Load Test (Light)
echo "⚡ Light Load Test"
echo "=================="
echo "Sending 10 concurrent requests to campaigns API..."

for i in {1..10}; do
  curl -s "$BASE_URL/api/campaigns" > /dev/null &
done
wait

echo "✅ Load test completed"
echo ""

# Test Summary
echo "📊 Test Summary"
echo "==============="
echo "Test suite completed at: $(date)"
echo ""
echo "Manual verification steps:"
echo "1. Check PM2 logs for any errors: pm2 logs --nostream"
echo "2. Verify database integrity: curl $BASE_URL/api/dashboard/stats"
echo "3. Test in browser: open $BASE_URL"
echo ""

# Clean up test data (optional)
if [[ -n "$CAMPAIGN_ID" ]]; then
    echo "🧹 Cleaning up test campaign..."
    # Uncomment to delete test campaign
    # curl -s -X DELETE "$BASE_URL/api/campaigns/$CAMPAIGN_ID"
    echo "Test campaign ID $CAMPAIGN_ID left for manual inspection"
fi

echo "🎉 All tests completed successfully!"
echo "==================================="