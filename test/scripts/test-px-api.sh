#!/bin/bash

# =============================================================================
# PX API Test Script
# =============================================================================
# Tests PX Direct Post API for all supported verticals
# Usage: ./test/scripts/test-px-api.sh [base_url]

BASE_URL=${1:-"http://localhost:3000"}
API_ENDPOINT="$BASE_URL/api/px/direct-post"

echo "🧪 PX API Integration Tests"
echo "================================"
echo "API Endpoint: $API_ENDPOINT"
echo ""

# Test 1: Solar Lead
echo "📋 Test 1: Solar Lead Submission"
echo "--------------------------------"
curl -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @test/fixtures/solar-lead.json \
  --silent --show-error | jq '.'
echo ""

# Test 2: Health Lead  
echo "🏥 Test 2: Health Lead Submission"
echo "--------------------------------"
curl -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d @test/fixtures/health-lead.json \
  --silent --show-error | jq '.'
echo ""

# Test 3: Home Lead (using Solar structure)
echo "🏠 Test 3: Home Lead Submission" 
echo "--------------------------------"
curl -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "vertical": "Home",
    "subId": "AF04",
    "source": "Home Improvement Test",
    "contact": {
      "firstName": "Mike", 
      "lastName": "Wilson",
      "email": "mike.wilson@example.com",
      "phone": "+15553456789",
      "zipCode": "77001",
      "address": "789 Home St",
      "city": "Houston",
      "state": "TX"
    },
    "context": {
      "sessionLength": 150,
      "tcpaText": "I agree to receive information about home improvement services.",
      "clickId": "home_test_click_789"
    },
    "extras": {
      "Ownership": "Own",
      "PropertyType": "Single Family",
      "HomeAge": "10-20 years"
    }
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 4: Invalid SubID Test
echo "❌ Test 4: Invalid SubID (Expected Failure)"
echo "--------------------------------------------"
curl -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "vertical": "Solar",
    "subId": "INVALID_SUBID_TOO_LONG_AND_SPECIAL_CHARS!@#",
    "contact": {
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com", 
      "phone": "+15551111111",
      "zipCode": "12345"
    }
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 5: Missing Required Fields
echo "⚠️  Test 5: Missing Required Fields (Expected Failure)"
echo "-----------------------------------------------------"
curl -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "vertical": "Solar",
    "subId": "AF01"
  }' \
  --silent --show-error | jq '.'
echo ""

# Test 6: SubID Generation
echo "🔧 Test 6: SubID Generation" 
echo "---------------------------"
echo "Available SubIDs for Affiliates:"
curl -X GET "$BASE_URL/api/px/subids?traffic_type=Affiliates" \
  --silent --show-error | jq '.data.available_subids'
echo ""

echo "Generate SubID for Email traffic:"
curl -X POST "$BASE_URL/api/px/subid/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "trafficType": "Email",
    "campaignNumber": 1
  }' \
  --silent --show-error | jq '.data.generated_subid'
echo ""

echo "✅ PX API Tests Complete"
echo "========================"