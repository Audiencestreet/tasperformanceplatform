import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import { Bindings, LeadFormData, ApiResponse, Lead, Campaign, Affiliate, PostbackUrl, Conversion } from './types'
import { PXAPIClient } from './px-api'
import { Database } from './database'
import { PostbackService } from './postback-service'
import { ConversionService } from './conversion-service'

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use('/api/*', cors())
app.use('/api/*', logger())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Utility function to generate UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// API Routes

// Lead submission endpoint
app.post('/api/leads', async (c) => {
  try {
    const formData: LeadFormData = await c.req.json();
    const db = new Database(c.env.DB);
    
    // Validate required fields
    const requiredFields = ['first_name', 'last_name', 'phone_number', 'zip_code', 'campaign_id'];
    for (const field of requiredFields) {
      if (!formData[field as keyof LeadFormData]) {
        return c.json<ApiResponse>({ 
          success: false, 
          error: `Missing required field: ${field}` 
        }, 400);
      }
    }
    
    // Get campaign details
    const campaign = await db.getCampaign(parseInt(formData.campaign_id));
    if (!campaign) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Invalid campaign ID' 
      }, 400);
    }
    
    // Get affiliate details
    const affiliate = await db.getAffiliate(campaign.affiliate_id);
    if (!affiliate) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Affiliate not found' 
      }, 404);
    }
    
    // Extract client info
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const userAgent = c.req.header('User-Agent') || '';
    const referrer = c.req.header('Referer') || '';
    
    // Create lead record
    const leadUUID = generateUUID();
    const lead: Omit<Lead, 'id' | 'created_at'> = {
      campaign_id: campaign.id!,
      affiliate_id: affiliate.id!,
      lead_uuid: leadUUID,
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone_number: formData.phone_number,
      zip_code: formData.zip_code,
      ownership: formData.ownership,
      roof_shade: formData.roof_shade,
      electricity_bill: formData.electricity_bill,
      ip_address: clientIP,
      user_agent: userAgent,
      referrer: referrer,
      utm_source: formData.utm_source,
      utm_medium: formData.utm_medium,
      utm_campaign: formData.utm_campaign,
      utm_term: formData.utm_term,
      utm_content: formData.utm_content,
      ping_status: 'pending',
      post_status: 'pending'
    };
    
    const createdLead = await db.createLead(lead);
    await db.logLeadEvent(createdLead.id!, 'lead_created', { lead_uuid: leadUUID });
    
    // Process with PX API
    const startTime = Date.now();
    
    try {
      const pxResult = await PXAPIClient.processLead(
        affiliate.api_key, // Using affiliate's API key - would need PX token in production
        campaign.offer_id,
        campaign.sub_id,
        {
          FirstName: formData.first_name,
          LastName: formData.last_name,
          PhoneNumber: formData.phone_number,
          ZipCode: formData.zip_code,
          Email: formData.email,
          Ownership: formData.ownership,
          Roofshade: formData.roof_shade,
          ElectricityBill: formData.electricity_bill
        }
      );
      
      const responseTime = Date.now() - startTime;
      
      // Update lead with PX results
      const updates: any = {
        ping_sent_at: new Date().toISOString()
      };
      
      if (pxResult.pingResponse) {
        updates.ping_status = pxResult.pingResponse.Status === 'BaeOK' ? 'accepted' : 'rejected';
        updates.ping_response = JSON.stringify(pxResult.pingResponse);
        
        if (pxResult.pingResponse.LeadId) {
          updates.px_lead_id = pxResult.pingResponse.LeadId;
        }
        
        await db.logLeadEvent(createdLead.id!, 'ping_sent', pxResult.pingResponse);
      }
      
      if (pxResult.postResponse) {
        updates.post_status = pxResult.postResponse.Status === 'Success' ? 'posted' : 'failed';
        updates.post_response = JSON.stringify(pxResult.postResponse);
        updates.post_sent_at = new Date().toISOString();
        
        await db.logLeadEvent(createdLead.id!, 'post_sent', pxResult.postResponse);
      }
      
      await db.updateLeadStatus(createdLead.id!, updates);
      
      // Log API calls
      if (pxResult.pingResponse) {
        await db.logApiCall(
          createdLead.id!,
          'ping',
          'https://leadapi.px.com/api/call/ping',
          { lead_uuid: leadUUID },
          pxResult.pingResponse,
          200,
          responseTime / 2
        );
      }
      
      if (pxResult.postResponse) {
        await db.logApiCall(
          createdLead.id!,
          'post',
          'https://leadapi.px.com/api/call/post',
          { lead_uuid: leadUUID },
          pxResult.postResponse,
          200,
          responseTime / 2
        );
      }
      
      // Log any errors
      for (const error of pxResult.errors) {
        await db.logApiCall(
          createdLead.id!,
          'error',
          'px-api',
          { lead_uuid: leadUUID },
          error,
          500,
          0,
          error.message
        );
      }
      
      // Trigger postbacks based on PX result
      const postbackService = new PostbackService(c.env.DB);
      
      if (pxResult.pingResponse?.Status === 'BaeOK') {
        await postbackService.triggerPostbacks(createdLead.id!, 'ping_accepted', {
          click_id: formData.utm_source,
          payout: pxResult.pingResponse.Price?.toString()
        });
      }
      
      if (pxResult.postResponse?.Status === 'Success') {
        await postbackService.triggerPostbacks(createdLead.id!, 'post_successful', {
          click_id: formData.utm_source,
          payout: campaign.payout_amount.toString()
        });
        
        // Record conversion if post was successful
        const conversionService = new ConversionService(c.env.DB);
        await conversionService.processConversion(
          createdLead.id!,
          'lead_qualified',
          campaign.payout_amount
        );
      }
      
      return c.json<ApiResponse<any>>({
        success: true,
        data: {
          lead_id: createdLead.id,
          lead_uuid: leadUUID,
          ping_status: updates.ping_status || 'pending',
          post_status: updates.post_status || 'pending',
          px_result: {
            ping_accepted: pxResult.pingResponse?.Status === 'BaeOK',
            post_successful: pxResult.postResponse?.Status === 'Success',
            errors: pxResult.errors
          }
        },
        message: 'Lead submitted successfully'
      });
      
    } catch (pxError) {
      // Update lead with error status
      await db.updateLeadStatus(createdLead.id!, {
        ping_status: 'failed',
        post_status: 'failed'
      });
      
      await db.logLeadEvent(createdLead.id!, 'processing_error', { error: pxError });
      
      return c.json<ApiResponse>({
        success: false,
        error: 'Failed to process lead with PX API',
        data: { lead_id: createdLead.id, lead_uuid: leadUUID }
      }, 500);
    }
    
  } catch (error) {
    console.error('Error processing lead:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// Get lead details
app.get('/api/leads/:id', async (c) => {
  try {
    const leadId = parseInt(c.req.param('id'));
    const db = new Database(c.env.DB);
    
    const lead = await db.getLead(leadId);
    if (!lead) {
      return c.json<ApiResponse>({ success: false, error: 'Lead not found' }, 404);
    }
    
    return c.json<ApiResponse<Lead>>({ success: true, data: lead });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get campaign details
app.get('/api/campaigns/:id', async (c) => {
  try {
    const campaignId = parseInt(c.req.param('id'));
    const db = new Database(c.env.DB);
    
    const campaign = await db.getCampaign(campaignId);
    if (!campaign) {
      return c.json<ApiResponse>({ success: false, error: 'Campaign not found' }, 404);
    }
    
    return c.json<ApiResponse<Campaign>>({ success: true, data: campaign });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get all campaigns
app.get('/api/campaigns', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const campaigns = await db.getAllCampaigns();
    
    return c.json<ApiResponse<Campaign[]>>({ success: true, data: campaigns });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get affiliate dashboard stats
app.get('/api/dashboard/stats', async (c) => {
  try {
    const affiliateId = c.req.query('affiliate_id');
    const campaignId = c.req.query('campaign_id');
    const db = new Database(c.env.DB);
    
    const stats = await db.getDashboardStats(
      affiliateId ? parseInt(affiliateId) : undefined,
      campaignId ? parseInt(campaignId) : undefined
    );
    
    return c.json<ApiResponse>({ success: true, data: stats });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get recent activity
app.get('/api/dashboard/activity', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const db = new Database(c.env.DB);
    
    const activity = await db.getRecentActivity(limit);
    
    return c.json<ApiResponse>({ success: true, data: activity });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Internal server error' }, 500);
  }
});

// Test PX API connection
app.post('/api/test-px', async (c) => {
  try {
    const { api_token } = await c.req.json();
    
    if (!api_token) {
      return c.json<ApiResponse>({ success: false, error: 'API token is required' }, 400);
    }
    
    // Test with sample data
    const testResult = await PXAPIClient.processLead(
      api_token,
      '122', // Test offer ID
      'TEST1', // Test sub ID
      {
        FirstName: 'Test',
        LastName: 'User',
        PhoneNumber: '+15551234567',
        ZipCode: '90210',
        Email: 'test@example.com',
        Ownership: 'Own',
        Roofshade: 'No Shade',
        ElectricityBill: '$150-200'
      }
    );
    
    return c.json<ApiResponse>({
      success: testResult.errors.length === 0,
      data: testResult,
      message: testResult.errors.length === 0 ? 'PX API connection successful' : 'PX API connection failed'
    });
    
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to test PX API' }, 500);
  }
});

// Postback Management API Routes

// Create postback URL
app.post('/api/postbacks', async (c) => {
  try {
    const postbackData = await c.req.json();
    const postbackService = new PostbackService(c.env.DB);
    
    const postback = await postbackService.createPostbackUrl(postbackData);
    
    return c.json<ApiResponse<PostbackUrl>>({
      success: true,
      data: postback,
      message: 'Postback URL created successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to create postback URL' }, 500);
  }
});

// Get postback URLs for affiliate/campaign
app.get('/api/postbacks', async (c) => {
  try {
    const affiliateId = c.req.query('affiliate_id');
    const campaignId = c.req.query('campaign_id');
    
    if (!affiliateId) {
      return c.json<ApiResponse>({ success: false, error: 'affiliate_id is required' }, 400);
    }
    
    const postbackService = new PostbackService(c.env.DB);
    const postbacks = await postbackService.getPostbackUrls(
      parseInt(affiliateId),
      campaignId ? parseInt(campaignId) : undefined
    );
    
    return c.json<ApiResponse<PostbackUrl[]>>({ success: true, data: postbacks });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to get postback URLs' }, 500);
  }
});

// Get postback logs
app.get('/api/postbacks/logs', async (c) => {
  try {
    const affiliateId = c.req.query('affiliate_id');
    const campaignId = c.req.query('campaign_id');
    const limit = parseInt(c.req.query('limit') || '50');
    
    const postbackService = new PostbackService(c.env.DB);
    const logs = await postbackService.getPostbackLogs(
      affiliateId ? parseInt(affiliateId) : undefined,
      campaignId ? parseInt(campaignId) : undefined,
      limit
    );
    
    return c.json<ApiResponse>({ success: true, data: logs });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to get postback logs' }, 500);
  }
});

// Test postback URL
app.post('/api/postbacks/test', async (c) => {
  try {
    const { postback_url_id, lead_id } = await c.req.json();
    
    if (!postback_url_id || !lead_id) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'postback_url_id and lead_id are required' 
      }, 400);
    }
    
    const postbackService = new PostbackService(c.env.DB);
    await postbackService.triggerPostbacks(lead_id, 'test_event', {
      conversion_value: '25.00',
      currency: 'USD'
    });
    
    return c.json<ApiResponse>({
      success: true,
      message: 'Test postback sent successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to send test postback' }, 500);
  }
});

// Conversion Tracking API Routes

// Record manual conversion
app.post('/api/conversions', async (c) => {
  try {
    const conversionData = await c.req.json();
    const conversionService = new ConversionService(c.env.DB);
    
    const conversion = await conversionService.processConversion(
      conversionData.lead_id,
      conversionData.conversion_type || 'manual',
      conversionData.conversion_value || 0,
      conversionData
    );
    
    return c.json<ApiResponse<Conversion>>({
      success: true,
      data: conversion,
      message: 'Conversion recorded successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to record conversion' }, 500);
  }
});

// Get conversion analytics
app.get('/api/conversions/analytics', async (c) => {
  try {
    const affiliateId = c.req.query('affiliate_id');
    const campaignId = c.req.query('campaign_id');
    const startDate = c.req.query('start_date');
    const endDate = c.req.query('end_date');
    
    const conversionService = new ConversionService(c.env.DB);
    const analytics = await conversionService.getConversionAnalytics(
      affiliateId ? parseInt(affiliateId) : undefined,
      campaignId ? parseInt(campaignId) : undefined,
      startDate,
      endDate
    );
    
    return c.json<ApiResponse>({ success: true, data: analytics });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to get conversion analytics' }, 500);
  }
});

// Get tracking pixels for lead
app.get('/api/conversions/pixels/:leadId', async (c) => {
  try {
    const leadId = parseInt(c.req.param('leadId'));
    const db = new Database(c.env.DB);
    
    const lead = await db.getLead(leadId);
    if (!lead) {
      return c.json<ApiResponse>({ success: false, error: 'Lead not found' }, 404);
    }
    
    const conversionService = new ConversionService(c.env.DB);
    const pixels = await conversionService.generateTrackingPixels(lead.campaign_id, leadId);
    
    return c.json<ApiResponse>({ success: true, data: pixels });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to generate tracking pixels' }, 500);
  }
});

// Webhook endpoint for external postbacks
app.post('/webhooks/postback/:affiliateId', async (c) => {
  try {
    const affiliateId = parseInt(c.req.param('affiliateId'));
    const data = await c.req.json();
    
    // Verify webhook signature if needed
    // const signature = c.req.header('X-Signature');
    
    const postbackService = new PostbackService(c.env.DB);
    
    // Process external postback data
    if (data.lead_id && data.status) {
      await postbackService.triggerPostbacks(
        parseInt(data.lead_id),
        data.status,
        {
          conversion_value: data.payout?.toString(),
          currency: data.currency || 'USD',
          custom_param_1: data.custom1,
          custom_param_2: data.custom2,
          custom_param_3: data.custom3
        }
      );
      
      // If it's a conversion postback, record the conversion
      if (data.status === 'conversion' && data.payout) {
        const conversionService = new ConversionService(c.env.DB);
        await conversionService.processConversion(
          parseInt(data.lead_id),
          'external_conversion',
          parseFloat(data.payout)
        );
      }
    }
    
    return c.json<ApiResponse>({
      success: true,
      message: 'Postback processed successfully'
    });
  } catch (error) {
    console.error('Webhook postback error:', error);
    return c.json<ApiResponse>({ success: false, error: 'Failed to process postback' }, 500);
  }
});

// Conversion pixel endpoint (for server-side tracking)
app.post('/pixel/conversion', async (c) => {
  try {
    const data = await c.req.json();
    
    if (!data.lead_id || !data.campaign_id) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'lead_id and campaign_id are required' 
      }, 400);
    }
    
    const conversionService = new ConversionService(c.env.DB);
    const conversion = await conversionService.processConversion(
      data.lead_id,
      data.event_name || 'pixel_conversion',
      data.value || 0,
      {
        source_platform: 'pixel',
        click_id: data.click_id,
        ip_address: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
        user_agent: c.req.header('User-Agent')
      }
    );
    
    return c.json<ApiResponse<Conversion>>({
      success: true,
      data: conversion,
      message: 'Conversion tracked successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to track conversion' }, 500);
  }
});

// Main dashboard page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Affiliate Tracking Platform</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/style.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100 min-h-screen">
        <div class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-6">
                    <div class="flex items-center">
                        <i class="fas fa-chart-line text-blue-600 text-2xl mr-3"></i>
                        <h1 class="text-2xl font-bold text-gray-900">Affiliate Tracking Platform</h1>
                    </div>
                    <div class="flex items-center space-x-4">
                        <span class="text-sm text-gray-500">360° Lead Tracking</span>
                        <div class="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-blue-100 rounded-lg">
                            <i class="fas fa-users text-blue-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-500">Total Leads</p>
                            <p class="text-2xl font-semibold text-gray-900" id="total-leads">-</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-green-100 rounded-lg">
                            <i class="fas fa-check-circle text-green-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-500">Accepted Rate</p>
                            <p class="text-2xl font-semibold text-gray-900" id="acceptance-rate">-</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-yellow-100 rounded-lg">
                            <i class="fas fa-paper-plane text-yellow-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-500">Success Rate</p>
                            <p class="text-2xl font-semibold text-gray-900" id="success-rate">-</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-purple-100 rounded-lg">
                            <i class="fas fa-dollar-sign text-purple-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-500">Revenue</p>
                            <p class="text-2xl font-semibold text-gray-900" id="total-revenue">$0</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Main Content -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Lead Capture Form -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-6">
                        <i class="fas fa-plus-circle mr-2"></i>Capture New Lead
                    </h2>
                    
                    <form id="lead-form" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                                <input type="text" name="first_name" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                <input type="text" name="last_name" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input type="email" name="email" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                <input type="tel" name="phone_number" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                            <input type="text" name="zip_code" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Home Ownership</label>
                                <select name="ownership" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select...</option>
                                    <option value="Own">Own</option>
                                    <option value="Rent">Rent</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Roof Shade</label>
                                <select name="roof_shade" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select...</option>
                                    <option value="No Shade">No Shade</option>
                                    <option value="Little Shade">Little Shade</option>
                                    <option value="Moderate Shade">Moderate Shade</option>
                                    <option value="Heavy Shade">Heavy Shade</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Monthly Electric Bill</label>
                                <select name="electricity_bill" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select...</option>
                                    <option value="Under $100">Under $100</option>
                                    <option value="$100-150">$100-150</option>
                                    <option value="$150-200">$150-200</option>
                                    <option value="$200-250">$200-250</option>
                                    <option value="$250-300">$250-300</option>
                                    <option value="$300+">$300+</option>
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
                            <select name="campaign_id" id="campaign-select" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">Select Campaign...</option>
                            </select>
                        </div>
                        
                        <button type="submit" class="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold">
                            <i class="fas fa-paper-plane mr-2"></i>Submit Lead
                        </button>
                    </form>
                    
                    <div id="form-result" class="mt-4 hidden"></div>
                </div>
                
                <!-- Recent Activity -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-6">
                        <i class="fas fa-clock mr-2"></i>Recent Activity
                    </h2>
                    
                    <div id="recent-activity" class="space-y-3">
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                            <p>Loading activity...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/app.js"></script>
    </body>
    </html>
  `)
})

// Campaign management page
app.get('/campaigns', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Campaign Management - Affiliate Tracking</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100 min-h-screen">
        <div class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-6">
                    <div class="flex items-center">
                        <a href="/" class="text-gray-500 hover:text-gray-700 mr-4">
                            <i class="fas fa-arrow-left"></i>
                        </a>
                        <i class="fas fa-bullhorn text-blue-600 text-2xl mr-3"></i>
                        <h1 class="text-2xl font-bold text-gray-900">Campaign Management</h1>
                    </div>
                    <div class="flex space-x-2">
                        <a href="/postbacks" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                            <i class="fas fa-webhook mr-2"></i>Postbacks
                        </a>
                        <a href="/conversions" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700">
                            <i class="fas fa-chart-pie mr-2"></i>Conversions
                        </a>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">All Campaigns</h2>
                </div>
                
                <div id="campaigns-list" class="p-6">
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>Loading campaigns...</p>
                    </div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/campaigns.js"></script>
    </body>
    </html>
  `)
})

// Postbacks management page
app.get('/postbacks', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Postback Management - Affiliate Tracking</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100 min-h-screen">
        <div class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-6">
                    <div class="flex items-center">
                        <a href="/campaigns" class="text-gray-500 hover:text-gray-700 mr-4">
                            <i class="fas fa-arrow-left"></i>
                        </a>
                        <i class="fas fa-webhook text-green-600 text-2xl mr-3"></i>
                        <h1 class="text-2xl font-bold text-gray-900">Postback Management</h1>
                    </div>
                    <button id="create-postback-btn" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                        <i class="fas fa-plus mr-2"></i>New Postback
                    </button>
                </div>
            </div>
        </div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Postback URLs -->
            <div class="bg-white rounded-lg shadow mb-8">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">Configured Postback URLs</h2>
                </div>
                <div id="postbacks-list" class="p-6">
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>Loading postback URLs...</p>
                    </div>
                </div>
            </div>
            
            <!-- Postback Logs -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">Recent Postback Activity</h2>
                </div>
                <div id="postback-logs" class="p-6">
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>Loading postback logs...</p>
                    </div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/postbacks.js"></script>
    </body>
    </html>
  `)
})

// Conversions analytics page
app.get('/conversions', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conversion Analytics - Affiliate Tracking</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gray-100 min-h-screen">
        <div class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between items-center py-6">
                    <div class="flex items-center">
                        <a href="/campaigns" class="text-gray-500 hover:text-gray-700 mr-4">
                            <i class="fas fa-arrow-left"></i>
                        </a>
                        <i class="fas fa-chart-pie text-purple-600 text-2xl mr-3"></i>
                        <h1 class="text-2xl font-bold text-gray-900">Conversion Analytics</h1>
                    </div>
                    <div class="flex space-x-2">
                        <button id="google-sync-btn" class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
                            <i class="fab fa-google mr-2"></i>Google Ads
                        </button>
                        <button id="facebook-sync-btn" class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                            <i class="fab fa-facebook mr-2"></i>Facebook
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Conversion Stats -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-purple-100 rounded-lg">
                            <i class="fas fa-bullseye text-purple-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-500">Total Conversions</p>
                            <p class="text-2xl font-semibold text-gray-900" id="total-conversions">-</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-green-100 rounded-lg">
                            <i class="fas fa-dollar-sign text-green-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-500">Conversion Value</p>
                            <p class="text-2xl font-semibold text-gray-900" id="total-value">$0</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-blue-100 rounded-lg">
                            <i class="fas fa-percentage text-blue-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-500">Conversion Rate</p>
                            <p class="text-2xl font-semibold text-gray-900" id="conversion-rate">0%</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="p-2 bg-yellow-100 rounded-lg">
                            <i class="fas fa-clock text-yellow-600"></i>
                        </div>
                        <div class="ml-4">
                            <p class="text-sm text-gray-500">Avg Time to Convert</p>
                            <p class="text-2xl font-semibold text-gray-900" id="avg-time">-</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Conversion Charts -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Conversions by Platform</h3>
                    <canvas id="platform-chart" width="400" height="300"></canvas>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Conversion Timeline</h3>
                    <canvas id="timeline-chart" width="400" height="300"></canvas>
                </div>
            </div>
            
            <!-- Conversion Details -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">Recent Conversions</h2>
                </div>
                <div id="conversions-list" class="p-6">
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>Loading conversion data...</p>
                    </div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/conversions.js"></script>
    </body>
    </html>
  `)
})

export default app
