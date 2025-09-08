# API Reference - Affiliate Tracking Platform

## Base URL
- **Local Development**: `https://3000-ij2h1e6pzy3g67a52hvcw-6532622b.e2b.dev`
- **Production**: `https://your-project.pages.dev`

## Authentication
Currently using test mode. In production, implement API key authentication:
```
Authorization: Bearer your-api-key
```

## Lead Management

### Submit New Lead
**POST** `/api/leads`

Submit a new lead and automatically process through PX API ping/post workflow.

#### Request Body
```json
{
  "first_name": "John",
  "last_name": "Doe", 
  "email": "john.doe@email.com",
  "phone_number": "+15551234567",
  "zip_code": "90210",
  "ownership": "Own",
  "roof_shade": "No Shade", 
  "electricity_bill": "$150-200",
  "campaign_id": "1",
  "utm_source": "google",
  "utm_medium": "cpc",
  "utm_campaign": "solar-leads"
}
```

#### Required Fields
- `first_name` (string)
- `last_name` (string) 
- `phone_number` (string, E.164 format)
- `zip_code` (string)
- `campaign_id` (string)
- `ownership` (enum: "Own", "Rent")
- `roof_shade` (enum: "No Shade", "Little Shade", "Moderate Shade", "Heavy Shade")
- `electricity_bill` (enum: "Under $100", "$100-150", "$150-200", "$200-250", "$250-300", "$300+")

#### Optional Fields
- `email` (string, valid email format)
- `utm_source` (string)
- `utm_medium` (string) 
- `utm_campaign` (string)
- `utm_term` (string)
- `utm_content` (string)

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "lead_id": 123,
    "lead_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "ping_status": "accepted",
    "post_status": "posted",
    "px_result": {
      "ping_accepted": true,
      "post_successful": true,
      "errors": []
    }
  },
  "message": "Lead submitted successfully"
}
```

#### Error Response (400)
```json
{
  "success": false,
  "error": "Missing required field: first_name"
}
```

### Get Lead Details
**GET** `/api/leads/:id`

Retrieve detailed information about a specific lead.

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": 123,
    "campaign_id": 1,
    "affiliate_id": 1,
    "lead_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "px_lead_id": "px_123456",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@email.com",
    "phone_number": "+15551234567",
    "zip_code": "90210",
    "ownership": "Own",
    "roof_shade": "No Shade",
    "electricity_bill": "$150-200",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "referrer": "https://google.com",
    "utm_source": "google",
    "utm_medium": "cpc", 
    "utm_campaign": "solar-leads",
    "ping_status": "accepted",
    "post_status": "posted",
    "ping_response": "{\"Status\":\"BaeOK\",\"LeadId\":\"px_123456\"}",
    "post_response": "{\"Status\":\"Success\"}",
    "created_at": "2025-09-08T20:00:40.000Z",
    "ping_sent_at": "2025-09-08T20:00:41.000Z",
    "post_sent_at": "2025-09-08T20:00:42.000Z"
  }
}
```

#### Lead Status Values
- **ping_status**: `pending`, `accepted`, `rejected`, `failed`
- **post_status**: `pending`, `posted`, `failed`

## Campaign Management

### Get All Campaigns
**GET** `/api/campaigns`

Retrieve list of all available campaigns.

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "affiliate_id": 1,
      "name": "Facebook Solar Campaign",
      "description": "Facebook targeted solar leads campaign",
      "offer_id": "122",
      "sub_id": "FB1", 
      "traffic_type": "Facebook",
      "payout_amount": 25.00,
      "status": "active",
      "created_at": "2025-09-08T20:00:40.000Z",
      "updated_at": "2025-09-08T20:00:40.000Z"
    }
  ]
}
```

### Get Campaign Details  
**GET** `/api/campaigns/:id`

Retrieve detailed information about a specific campaign.

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "affiliate_id": 1,
    "name": "Facebook Solar Campaign",
    "description": "Facebook targeted solar leads campaign", 
    "offer_id": "122",
    "sub_id": "FB1",
    "traffic_type": "Facebook",
    "payout_amount": 25.00,
    "status": "active",
    "created_at": "2025-09-08T20:00:40.000Z",
    "updated_at": "2025-09-08T20:00:40.000Z"
  }
}
```

#### Campaign Status Values
- `active` - Currently accepting leads
- `paused` - Temporarily stopped
- `completed` - Campaign ended

## Analytics & Dashboard

### Get Dashboard Statistics
**GET** `/api/dashboard/stats`

Retrieve overall platform statistics.

#### Query Parameters
- `affiliate_id` (optional) - Filter by specific affiliate
- `campaign_id` (optional) - Filter by specific campaign

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "total_leads": 150,
    "accepted_leads": 120,
    "successful_posts": 100,
    "total_revenue": 2500.00,
    "conversion_rate": 66.67,
    "acceptance_rate": 80.00,
    "success_rate": 83.33
  }
}
```

#### Metrics Definitions
- **total_leads** - Total leads submitted
- **accepted_leads** - Leads with accepted ping status  
- **successful_posts** - Leads successfully posted to PX
- **total_revenue** - Calculated revenue from successful posts
- **conversion_rate** - (successful_posts / total_leads) × 100
- **acceptance_rate** - (accepted_leads / total_leads) × 100  
- **success_rate** - (successful_posts / accepted_leads) × 100

### Get Recent Activity
**GET** `/api/dashboard/activity`

Retrieve recent lead activity for dashboard feed.

#### Query Parameters
- `limit` (optional, default: 50) - Maximum number of records

#### Success Response (200)
```json
{
  "success": true,
  "data": [
    {
      "type": "lead",
      "id": 123,
      "name": "John Doe",
      "ping_status": "accepted",
      "post_status": "posted", 
      "created_at": "2025-09-08T20:00:40.000Z",
      "campaign_name": "Facebook Solar Campaign",
      "affiliate_name": "Solar Power Marketing"
    }
  ]
}
```

## Testing & Utilities

### Test PX API Connection
**POST** `/api/test-px`

Test connection to PX API with sample data.

#### Request Body
```json
{
  "api_token": "your-px-api-token"
}
```

#### Success Response (200)
```json
{
  "success": true,
  "data": {
    "pingResponse": {
      "Status": "BaeOK",
      "LeadId": "test_123",
      "Price": 25.00
    },
    "postResponse": {
      "Status": "Success", 
      "TransactionId": "tx_456"
    },
    "errors": []
  },
  "message": "PX API connection successful"
}
```

#### Error Response (400/500)
```json
{
  "success": false,
  "data": {
    "pingResponse": null,
    "postResponse": null,
    "errors": [
      {
        "code": "HTTP_ERROR",
        "message": "HTTP 401: Unauthorized",
        "details": "Invalid API token"
      }
    ]
  },
  "message": "PX API connection failed"
}
```

## PX API Integration Details

### Ping/Post Workflow
1. **Lead Submission** → Internal lead record created
2. **PX Ping** → Test lead qualification with PX API
3. **If Accepted** → PX Post within 15 seconds
4. **Status Updates** → Real-time status tracking

### PX API Request Format
The platform automatically formats requests according to PX specifications:

#### Ping Request
```json
{
  "ApiToken": "your-token",
  "OfferId": "122",
  "DID": "+18576880648", 
  "SubId": "FB1",
  "ContactData": {
    "FirstName": "John",
    "LastName": "Doe",
    "PhoneNumber": "+15551234567",
    "ZipCode": "90210",
    "Email": "john@example.com",
    "Ownership": "Own",
    "Roofshade": "No Shade",
    "ElectricityBill": "$150-200"
  }
}
```

### PX Response Handling
- **BaeOK** → Ping accepted, proceed with post
- **BaeNok** → Ping rejected, no post sent
- **Timeout** → Retry logic and error logging
- **Network Error** → Comprehensive error tracking

## Rate Limiting & Performance

### Current Limits
- No rate limiting implemented (development)
- PX API has its own rate limits
- Database optimized with indexes

### Performance Considerations
- Lead processing: ~2-3 seconds average
- PX API timeout: 10 seconds
- Dashboard updates: Real-time via API
- Database queries: Optimized with indexes

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE" // Optional error code
}
```

### Common Error Codes
- `VALIDATION_ERROR` - Invalid input data
- `CAMPAIGN_NOT_FOUND` - Invalid campaign ID
- `PX_API_ERROR` - PX API integration failure
- `DATABASE_ERROR` - Database operation failed
- `NETWORK_ERROR` - External API timeout/failure

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation error)
- `404` - Not Found (invalid ID)
- `500` - Internal Server Error

## Webhooks (Future Implementation)

### Lead Status Updates
```http
POST /webhooks/lead-status
Content-Type: application/json
Authorization: Bearer webhook-secret

{
  "lead_id": 123,
  "lead_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "status": "posted",
  "timestamp": "2025-09-08T20:00:40.000Z"
}
```

## SDK Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const apiClient = axios.create({
  baseURL: 'https://your-domain.pages.dev/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Submit lead
async function submitLead(leadData) {
  try {
    const response = await apiClient.post('/leads', leadData);
    return response.data;
  } catch (error) {
    console.error('Lead submission failed:', error.response?.data);
    throw error;
  }
}

// Usage
const lead = {
  first_name: 'John',
  last_name: 'Doe',
  phone_number: '+15551234567',
  zip_code: '90210',
  ownership: 'Own',
  roof_shade: 'No Shade',
  electricity_bill: '$150-200',
  campaign_id: '1'
};

submitLead(lead)
  .then(result => console.log('Lead submitted:', result))
  .catch(error => console.error('Error:', error));
```

### cURL Examples
```bash
# Submit lead
curl -X POST https://your-domain.pages.dev/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe", 
    "phone_number": "+15551234567",
    "zip_code": "90210",
    "ownership": "Own",
    "roof_shade": "No Shade",
    "electricity_bill": "$150-200",
    "campaign_id": "1"
  }'

# Get dashboard stats
curl https://your-domain.pages.dev/api/dashboard/stats

# Get campaigns
curl https://your-domain.pages.dev/api/campaigns
```

## Development & Testing

### Local API Testing
```bash
# Start local server
npm run build && pm2 start ecosystem.config.cjs

# Test endpoints
curl http://localhost:3000/api/dashboard/stats
curl http://localhost:3000/api/campaigns

# Submit test lead
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d @test-lead.json
```

### Database Access
```bash
# Local database console
npm run db:console:local

# Execute custom queries
wrangler d1 execute webapp-production --local \
  --command="SELECT * FROM leads ORDER BY created_at DESC LIMIT 10"
```

This API provides comprehensive lead tracking capabilities with robust PX integration, real-time analytics, and detailed audit logging.