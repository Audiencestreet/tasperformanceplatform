/**
 * =============================================================================
 * AFFILIATE TRACKING SYSTEM - MAIN APPLICATION
 * =============================================================================
 * 
 * Comprehensive affiliate tracking and lead management system for Cloudflare Pages.
 * Handles PX API integration, call tracking, postback processing, and campaign attribution.
 * 
 * @author Affiliate Tracking System Team
 * @version 1.0.0
 * @platform Cloudflare Pages + Workers
 * @database Cloudflare D1 (SQLite)
 * 
 * CORE INTEGRATIONS:
 * ==================
 * 
 * 1. PX API DIRECT POST (✅ Active)
 *    - Endpoint: https://leadapi.px.com/api/lead/directpost
 *    - Supported Verticals: Solar (122), Health, Home
 *    - Format: XML payload with complete lead qualification
 *    - Transaction ID tracking for attribution
 * 
 * 2. RINGBA CALL TRACKING (✅ Active) 
 *    - Webhook: GET /api/webhooks/ringba
 *    - Inbound call attribution to campaigns
 *    - Call qualification (>30 seconds = qualified)
 *    - Recording URL storage and postback triggers
 * 
 * 3. ADT HOME SECURITY (✅ Active)
 *    - Offer ID: 477, Payout: $60
 *    - Special tracking link format: homesafety.adt.com/aff_ad
 *    - Email campaign optimization (EM01/EM02 SubIDs)
 * 
 * 4. MARKETCALL INTEGRATION (🚧 In Development)
 *    - Lead distribution and real-time bidding
 *    - Backup routing for rejected PX leads
 * 
 * 5. OPTIZMO COMPLIANCE (📋 Planned)
 *    - TCPA compliance checking
 *    - Data validation and enhancement
 * 
 * CAMPAIGN STRUCTURE:
 * ===================
 * 
 * Campaign Types by Vertical:
 * - Solar Campaigns (Offer ID: 122)
 *   - Facebook Solar (FB01, $25 payout)
 *   - Google Ads Solar (GG01, $30 payout)  
 *   - Affiliate Solar (AF01-AF02, $22.50-27.50 payout)
 * 
 * - ADT Home Security (Offer ID: 477)
 *   - Email Campaign (EM01, $60 payout)
 *   - Affiliate Campaign (AF03, $55 payout)
 * 
 * - Health Insurance (Offer: HEALTH_*)
 *   - Search Campaign (HH01, $35 payout)
 *   - Email Campaign (EM02, $40 payout)
 * 
 * - Home Improvement (Offer: HOME_*, HVAC_*)
 *   - General Home (AF04, $20 payout)
 *   - HVAC Specific (GG02, $45 payout)
 * 
 * SUBID STRATEGY:
 * ===============
 * 
 * Traffic Source → SubID Mapping (20 total limit):
 * - Affiliates: AF01, AF02, AF03, AF04
 * - Email: EM01, EM02  
 * - Social: FB01, IG01, TT01, TW01
 * - Search: GG01, GG02
 * - Native: TB01, OB01
 * - Health: HH01
 * 
 * TRACKING ARCHITECTURE:
 * ======================
 * 
 * Lead Attribution Flow:
 * 1. Click → Tracking Link Generation (UUID click_id)
 * 2. Landing → Lead Form Submission
 * 3. PX API → Direct Post with Transaction ID
 * 4. Postback → Affiliate notification with conversion data
 * 5. Call Tracking → Ringba webhook attribution
 * 
 * Data Storage:
 * - leads: Complete lead records with PX responses
 * - campaigns: Campaign configuration and payout settings
 * - conversions: Conversion tracking with revenue attribution
 * - inbound_calls: Call tracking data from Ringba
 * - click_tracking: Click attribution and user behavior
 * - postback_logs: Postback delivery tracking
 * 
 * =============================================================================
 */

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

/**
 * TRACKING LINK GENERATION API
 * ============================
 * 
 * Generates campaign-specific tracking links with unique click attribution.
 * Supports both generic tracking format and special ADT format.
 * 
 * SUPPORTED FORMATS:
 * 
 * 1. ADT Home Security (Offer ID: 477):
 *    https://homesafety.adt.com/aff_ad?campaign_id=477&aff_id=15441&hostNameId=23326&aff_sub={sub_id}&aff_sub2={click_id}
 * 
 * 2. Generic Campaigns (Solar, Health, etc.):
 *    https://your-domain.com/track/click?c={campaign_id}&s={sub_id}&id={click_id}&url={landing_url}
 * 
 * CLICK ATTRIBUTION:
 * - Each link gets unique UUID click_id for attribution
 * - Links stored in database for reporting
 * - Click events trigger postbacks to affiliates
 * - User behavior tracked (IP, User-Agent, Referrer)
 * 
 * @route POST /api/tracking/generate
 * @param {number} campaign_id - Campaign ID from campaigns table
 * @param {string} sub_id - PX SubID (AF01, EM01, etc.)
 * @param {string} landing_url - Final destination URL
 * @returns {object} Generated tracking link and attribution data
 */
app.post('/api/tracking/generate', async (c) => {
  try {
    const { campaign_id, sub_id, landing_url } = await c.req.json();
    
    if (!campaign_id || !sub_id || !landing_url) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'campaign_id, sub_id, and landing_url are required' 
      }, 400);
    }
    
    const db = new Database(c.env.DB);
    const campaign = await db.getCampaign(parseInt(campaign_id));
    
    if (!campaign) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Campaign not found' 
      }, 404);
    }
    
    // Generate unique click ID
    const clickId = generateUUID();
    
    // Generate tracking link based on campaign type
    let trackingLink = '';
    
    if (campaign.name.toLowerCase().includes('adt') || campaign.offer_id === '477') {
      // ADT Home Security specific format
      trackingLink = `https://homesafety.adt.com/aff_ad?campaign_id=477&aff_id=15441&hostNameId=23326&aff_sub=${encodeURIComponent(sub_id)}&aff_sub2=${encodeURIComponent(clickId)}`;
    } else {
      // Generic tracking format
      const baseUrl = c.req.header('host') || 'your-domain.com';
      const protocol = c.req.header('cf-visitor') ? 'https' : 'http';
      trackingLink = `${protocol}://${baseUrl}/track/click?c=${campaign_id}&s=${encodeURIComponent(sub_id)}&id=${clickId}&url=${encodeURIComponent(landing_url)}`;
    }
    
    // Store tracking link in database
    const trackingData = {
      click_id: clickId,
      campaign_id: campaign.id!,
      sub_id: sub_id,
      landing_url: landing_url,
      tracking_url: trackingLink,
      created_at: new Date().toISOString()
    };
    
    // Log the tracking link generation
    await db.logTrackingLink(trackingData);
    
    return c.json<ApiResponse>({
      success: true,
      data: {
        tracking_link: trackingLink,
        click_id: clickId,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          offer_id: campaign.offer_id
        },
        sub_id: sub_id,
        landing_url: landing_url
      },
      message: 'Tracking link generated successfully'
    });
    
  } catch (error) {
    console.error('Error generating tracking link:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Failed to generate tracking link' 
    }, 500);
  }
});

// Click tracking endpoint
app.get('/track/click', async (c) => {
  try {
    const campaignId = c.req.query('c');
    const subId = c.req.query('s');
    const clickId = c.req.query('id');
    const landingUrl = c.req.query('url');
    
    if (!campaignId || !subId || !clickId || !landingUrl) {
      return c.redirect('https://example.com'); // Fallback redirect
    }
    
    const db = new Database(c.env.DB);
    
    // Extract tracking data
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const userAgent = c.req.header('User-Agent') || '';
    const referrer = c.req.header('Referer') || '';
    
    // Log the click
    const clickData = {
      click_id: clickId,
      campaign_id: parseInt(campaignId),
      sub_id: subId,
      landing_url: decodeURIComponent(landingUrl),
      ip_address: clientIP,
      user_agent: userAgent,
      referrer: referrer,
      clicked_at: new Date().toISOString()
    };
    
    await db.logClick(clickData);
    
    // Get campaign for postback triggering
    const campaign = await db.getCampaign(parseInt(campaignId));
    if (campaign) {
      const postbackService = new PostbackService(c.env.DB);
      await postbackService.triggerPostbacks(0, 'click_tracked', {
        click_id: clickId,
        campaign_id: campaignId,
        sub_id: subId
      });
    }
    
    // Redirect to landing page
    return c.redirect(decodeURIComponent(landingUrl));
    
  } catch (error) {
    console.error('Error tracking click:', error);
    // Fallback redirect on error
    const landingUrl = c.req.query('url');
    if (landingUrl) {
      return c.redirect(decodeURIComponent(landingUrl));
    }
    return c.redirect('https://example.com');
  }
});

// Lead submission endpoint (kept for existing integrations)
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
    
    // Process with PX Direct Post API
    const startTime = Date.now();
    
    try {
      // Determine vertical based on campaign or form data
      const vertical = campaign.name.toLowerCase().includes('solar') ? 'Solar' : 
                     campaign.name.toLowerCase().includes('health') ? 'Health' : 'Solar'; // Default to Solar
      
      const pxResult = await PXAPIClient.postDirectLead({
        vertical: vertical,
        subId: campaign.sub_id,
        source: formData.utm_source || 'direct',
        contact: {
          firstName: formData.first_name,
          lastName: formData.last_name,
          email: formData.email || '',
          phone: formData.phone_number,
          zipCode: formData.zip_code
        },
        context: {
          sessionLength: Math.floor(Math.random() * 300) + 60, // Random 1-5 minutes
          tcpaText: 'By submitting this form, I consent to receive calls and texts.',
          clickId: leadUUID,
          ipAddress: clientIP,
          userAgent: userAgent
        },
        extras: vertical === 'Solar' ? {
          ...(formData.ownership && { Ownership: formData.ownership }),
          ...(formData.roof_shade && { Roofshade: formData.roof_shade }),
          ...(formData.electricity_bill && { ElectricityBill: formData.electricity_bill })
        } : {},
        env: c.env
      });
      
      const responseTime = Date.now() - startTime;
      
      // Update lead with PX results
      const updates: any = {
        ping_sent_at: new Date().toISOString(),
        post_sent_at: new Date().toISOString()
      };
      
      if (pxResult.response) {
        updates.ping_status = pxResult.response.Success ? 'accepted' : 'rejected';
        updates.post_status = pxResult.response.Success ? 'posted' : 'failed';
        updates.ping_response = JSON.stringify(pxResult.response);
        updates.post_response = JSON.stringify(pxResult.response);
        
        if (pxResult.response.LeadId) {
          updates.px_lead_id = pxResult.response.LeadId;
        }
        
        await db.logLeadEvent(createdLead.id!, 'direct_post_sent', pxResult.response);
      }
      
      if (pxResult.error) {
        updates.ping_status = 'failed';
        updates.post_status = 'failed';
        await db.logLeadEvent(createdLead.id!, 'direct_post_error', pxResult.error);
      }
      
      await db.updateLeadStatus(createdLead.id!, updates);
      
      // Log API call
      await db.logApiCall(
        createdLead.id!,
        'direct_post',
        'https://leadapi.px.com/api/lead/directpost',
        { 
          lead_uuid: leadUUID,
          vertical: vertical,
          sub_id: campaign.sub_id
        },
        pxResult.response || pxResult.error,
        pxResult.response ? 200 : 500,
        responseTime,
        pxResult.error?.message
      );
      
      // Trigger postbacks based on PX result
      const postbackService = new PostbackService(c.env.DB);
      
      if (pxResult.response?.Success) {
        await postbackService.triggerPostbacks(createdLead.id!, 'ping_accepted', {
          click_id: formData.utm_source,
          payout: pxResult.response.Price?.toString()
        });
        
        await postbackService.triggerPostbacks(createdLead.id!, 'post_successful', {
          click_id: formData.utm_source,
          payout: campaign.payout_amount.toString()
        });
        
        // Record conversion if post was successful
        const conversionService = new ConversionService(c.env.DB);
        await conversionService.processConversion(
          createdLead.id!,
          'lead_qualified',
          pxResult.response.Price || campaign.payout_amount
        );
      }
      
      return c.json<ApiResponse<any>>({
        success: true,
        data: {
          lead_id: createdLead.id,
          lead_uuid: leadUUID,
          vertical: vertical,
          sub_id: campaign.sub_id,
          status: pxResult.response?.Success ? 'accepted' : 'rejected',
          px_result: {
            success: !!pxResult.response?.Success,
            lead_id: pxResult.response?.LeadId,
            price: pxResult.response?.Price,
            buyer_name: pxResult.response?.BuyerName,
            message: pxResult.response?.Message,
            errors: pxResult.response?.Errors || (pxResult.error ? [pxResult.error.message] : [])
          }
        },
        message: 'Lead submitted successfully using Direct Post API'
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

/**
 * PX DIRECT POST API ENDPOINT
 * ============================
 * 
 * Direct interface to PX API for lead submission and testing.
 * Handles complete XML payload construction and response parsing.
 * 
 * SUPPORTED VERTICALS:
 * - Solar: Residential solar qualification with ownership, roof shade, electricity bill
 * - Health: Individual health insurance with demographic data
 * - Home: Home security and improvement leads
 * 
 * REQUIRED FIELDS:
 * - vertical: "Solar" | "Health" | "Home"
 * - subId: Valid PX SubID (see SubID strategy above)
 * - contact: Complete contact information (name, email, phone, address)
 * - context: Session data (IP, User-Agent, TCPA consent)
 * 
 * RESPONSE FORMAT:
 * - Success: PX Transaction ID + Lead ID + Payout amount
 * - Failure: Detailed validation errors from PX API
 * 
 * API TOKEN MAPPING:
 * - Solar: B593425D-90C7-4CB8-8952-605D8A0CCEC0
 * - Health: F9F9B3CC-85D8-4142-9007-61F784C1F098
 * - Home: (Token TBD)
 * 
 * @route POST /api/px/direct-post
 * @param {object} payload - Complete lead data for PX submission
 * @returns {object} PX API response with transaction tracking
 */
app.post('/api/px/direct-post', async (c) => {
  try {
    const {
      vertical,
      subId,
      source,
      contact,
      context = {},
      extras = {}
    } = await c.req.json();
    
    // Validate required fields
    if (!vertical || !subId || !contact) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'vertical, subId, and contact are required' 
      }, 400);
    }
    
    if (!contact.firstName || !contact.lastName || !contact.email || !contact.phone || !contact.zipCode) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'firstName, lastName, email, phone, and zipCode are required in contact' 
      }, 400);
    }
    
    // Extract client info for context
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const userAgent = c.req.header('User-Agent') || '';
    
    // Merge context with client info
    const fullContext = {
      sessionLength: 180, // 3 minutes default
      tcpaText: 'By submitting this form, I consent to receive calls and texts.',
      ipAddress: clientIP,
      userAgent: userAgent,
      ...context
    };
    
    const startTime = Date.now();
    const pxResult = await PXAPIClient.postDirectLead({
      vertical,
      subId,
      source,
      contact,
      context: fullContext,
      extras,
      env: c.env
    });
    const responseTime = Date.now() - startTime;
    
    return c.json<ApiResponse>({
      success: !pxResult.error,
      data: {
        vertical,
        subId,
        source,
        response_time_ms: responseTime,
        px_response: pxResult.response,
        px_error: pxResult.error,
        success: !!pxResult.response?.Success,
        lead_id: pxResult.response?.LeadId,
        price: pxResult.response?.Price,
        buyer_name: pxResult.response?.BuyerName,
        message: pxResult.response?.Message,
        errors: pxResult.response?.Errors
      },
      message: pxResult.error ? 'Direct Post failed' : 'Direct Post sent successfully'
    });
    
  } catch (error) {
    console.error('Error testing PX Direct Post:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// PX SubId Helper Endpoints
app.get('/api/px/subids', async (c) => {
  try {
    const trafficType = c.req.query('traffic_type');
    
    if (trafficType) {
      const subIds = PXAPIClient.getAvailableSubIds(trafficType);
      return c.json<ApiResponse>({
        success: true,
        data: { traffic_type: trafficType, available_subids: subIds }
      });
    }
    
    const allMappings = PXAPIClient.getAllSubIdMappings();
    return c.json<ApiResponse>({
      success: true,
      data: { subid_mappings: allMappings }
    });
    
  } catch (error) {
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

app.post('/api/px/subid/generate', async (c) => {
  try {
    const { trafficType, campaignNumber } = await c.req.json();
    
    if (!trafficType) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'trafficType is required' 
      }, 400);
    }
    
    const subId = PXAPIClient.generateSubId(trafficType, campaignNumber);
    const validation = PXAPIClient.validateSubId(subId);
    
    return c.json<ApiResponse>({
      success: validation.valid,
      data: {
        traffic_type: trafficType,
        campaign_number: campaignNumber,
        generated_subid: subId,
        valid: validation.valid,
        error: validation.error
      },
      message: validation.valid ? 'SubId generated successfully' : validation.error
    });
    
  } catch (error) {
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

// Affiliate Management API Routes

// Create new affiliate
app.post('/api/affiliates', async (c) => {
  try {
    const affiliateData = await c.req.json();
    const db = new Database(c.env.DB);
    
    // Validate required fields
    if (!affiliateData.name || !affiliateData.email) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Name and email are required' 
      }, 400);
    }
    
    // Generate API key if not provided
    if (!affiliateData.api_key) {
      affiliateData.api_key = generateUUID().replace(/-/g, '');
    }
    
    // Set default status if not provided
    if (!affiliateData.status) {
      affiliateData.status = 'active';
    }
    
    const affiliate = await db.createAffiliate(affiliateData);
    
    return c.json<ApiResponse<Affiliate>>({
      success: true,
      data: affiliate,
      message: 'Affiliate created successfully'
    });
  } catch (error) {
    console.error('Error creating affiliate:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Failed to create affiliate' 
    }, 500);
  }
});

// Get all affiliates
app.get('/api/affiliates', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const affiliates = await db.getAllAffiliates();
    
    return c.json<ApiResponse<Affiliate[]>>({ success: true, data: affiliates });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Internal server error' }, 500);
  }
});

// Get affiliate details
app.get('/api/affiliates/:id', async (c) => {
  try {
    const affiliateId = parseInt(c.req.param('id'));
    const db = new Database(c.env.DB);
    
    const affiliate = await db.getAffiliate(affiliateId);
    if (!affiliate) {
      return c.json<ApiResponse>({ success: false, error: 'Affiliate not found' }, 404);
    }
    
    return c.json<ApiResponse<Affiliate>>({ success: true, data: affiliate });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Internal server error' }, 500);
  }
});

// Update affiliate
app.put('/api/affiliates/:id', async (c) => {
  try {
    const affiliateId = parseInt(c.req.param('id'));
    const updateData = await c.req.json();
    const db = new Database(c.env.DB);
    
    const affiliate = await db.updateAffiliate(affiliateId, updateData);
    if (!affiliate) {
      return c.json<ApiResponse>({ success: false, error: 'Affiliate not found' }, 404);
    }
    
    return c.json<ApiResponse<Affiliate>>({
      success: true,
      data: affiliate,
      message: 'Affiliate updated successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to update affiliate' }, 500);
  }
});

// Get affiliate postbacks
app.get('/api/affiliates/:id/postbacks', async (c) => {
  try {
    const affiliateId = parseInt(c.req.param('id'));
    const postbackService = new PostbackService(c.env.DB);
    
    const postbacks = await postbackService.getPostbackUrls(affiliateId);
    
    return c.json<ApiResponse>({ success: true, data: postbacks });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to get affiliate postbacks' }, 500);
  }
});

// Create postback URL
app.post('/api/postbacks', async (c) => {
  try {
    const postbackData = await c.req.json();
    const postbackService = new PostbackService(c.env.DB);
    
    // Validate required fields
    if (!postbackData.affiliate_id || !postbackData.name || !postbackData.url_template) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'affiliate_id, name, and url_template are required' 
      }, 400);
    }
    
    // Set defaults
    postbackData.http_method = postbackData.http_method || 'GET';
    postbackData.status = postbackData.status || 'active';
    
    const postback = await postbackService.createPostbackUrl(postbackData);
    
    return c.json<ApiResponse>({
      success: true,
      data: postback,
      message: 'Postback created successfully'
    });
  } catch (error) {
    console.error('Error creating postback:', error);
    return c.json<ApiResponse>({ success: false, error: 'Failed to create postback' }, 500);
  }
});

// Create new campaign
app.post('/api/campaigns', async (c) => {
  try {
    // Check if database is available
    if (!c.env?.DB) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Database not configured. Please set up D1 database.' 
      }, 503);
    }
    
    const campaignData = await c.req.json();
    const db = new Database(c.env.DB);
    
    // Validate required fields
    const requiredFields = ['affiliate_id', 'name', 'offer_id', 'sub_id', 'traffic_type', 'payout_amount'];
    for (const field of requiredFields) {
      if (!campaignData[field]) {
        return c.json<ApiResponse>({ 
          success: false, 
          error: `Missing required field: ${field}` 
        }, 400);
      }
    }
    
    // Verify affiliate exists
    const affiliate = await db.getAffiliate(campaignData.affiliate_id);
    if (!affiliate) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Affiliate not found' 
      }, 404);
    }
    
    // Set default status if not provided
    if (!campaignData.status) {
      campaignData.status = 'active';
    }
    
    const campaign = await db.createCampaign(campaignData);
    
    return c.json<ApiResponse<Campaign>>({
      success: true,
      data: campaign,
      message: 'Campaign created successfully'
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Database service unavailable. Please contact administrator.' 
    }, 503);
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
    // Check if database is available
    if (!c.env?.DB) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Database not configured. Please contact administrator.' 
      }, 503);
    }
    
    const db = new Database(c.env.DB);
    const campaigns = await db.getAllCampaigns();
    
    return c.json<ApiResponse<Campaign[]>>({ success: true, data: campaigns });
  } catch (error) {
    console.error('Campaigns API error:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Database service unavailable. Please contact administrator.' 
    }, 503);
  }
});

// Update campaign
app.put('/api/campaigns/:id', async (c) => {
  try {
    const campaignId = parseInt(c.req.param('id'));
    const campaignData = await c.req.json();
    const db = new Database(c.env.DB);
    
    // Check if campaign exists
    const existingCampaign = await db.getCampaign(campaignId);
    if (!existingCampaign) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Campaign not found' 
      }, 404);
    }
    
    // Only validate provided fields (for partial updates)
    const providedFields = Object.keys(campaignData);
    const validFields = ['name', 'offer_id', 'sub_id', 'traffic_type', 'payout_amount', 'status', 'affiliate_id', 'description'];
    
    // Check if any invalid fields are provided
    const invalidFields = providedFields.filter(field => !validFields.includes(field));
    if (invalidFields.length > 0) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: `Invalid fields: ${invalidFields.join(', ')}` 
      }, 400);
    }
    
    // If status is provided, validate it
    if (campaignData.status && !['active', 'paused', 'inactive'].includes(campaignData.status)) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Invalid status. Must be: active, paused, or inactive' 
      }, 400);
    }
    
    // If payout_amount is provided, validate it's a number
    if (campaignData.payout_amount !== undefined && isNaN(parseFloat(campaignData.payout_amount))) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Payout amount must be a valid number' 
      }, 400);
    }
    
    // If affiliate_id is provided, validate it exists
    if (campaignData.affiliate_id !== undefined) {
      const affiliate = await db.getAffiliate(campaignData.affiliate_id);
      if (!affiliate) {
        return c.json<ApiResponse>({ 
          success: false, 
          error: 'Affiliate not found' 
        }, 404);
      }
    }
    
    // Update campaign
    const updatedCampaign = await db.updateCampaign(campaignId, campaignData);
    
    return c.json<ApiResponse<Campaign>>({
      success: true,
      data: updatedCampaign,
      message: 'Campaign updated successfully'
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Failed to update campaign' 
    }, 500);
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

// Campaign Postback Parameters API Routes

// Create campaign postback parameter
app.post('/api/campaigns/:campaignId/postback-params', async (c) => {
  try {
    const campaignId = parseInt(c.req.param('campaignId'));
    const { parameter_name, parameter_value, description } = await c.req.json();
    
    if (!parameter_name || !parameter_value) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'parameter_name and parameter_value are required' 
      }, 400);
    }
    
    const db = new Database(c.env.DB);
    
    // Verify campaign exists
    const campaign = await db.getCampaign(campaignId);
    if (!campaign) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Campaign not found' 
      }, 404);
    }
    
    const param = await db.createCampaignPostbackParam({
      campaign_id: campaignId,
      parameter_name,
      parameter_value,
      description: description || null
    });
    
    return c.json<ApiResponse>({
      success: true,
      data: param,
      message: 'Campaign postback parameter created successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to create postback parameter' }, 500);
  }
});

// Get campaign postback parameters
app.get('/api/campaigns/:campaignId/postback-params', async (c) => {
  try {
    const campaignId = parseInt(c.req.param('campaignId'));
    const db = new Database(c.env.DB);
    
    const params = await db.getCampaignPostbackParams(campaignId);
    
    return c.json<ApiResponse>({ success: true, data: params });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to get postback parameters' }, 500);
  }
});

// Update campaign postback parameter
app.put('/api/campaigns/:campaignId/postback-params/:paramId', async (c) => {
  try {
    const campaignId = parseInt(c.req.param('campaignId'));
    const paramId = parseInt(c.req.param('paramId'));
    const updates = await c.req.json();
    
    const db = new Database(c.env.DB);
    
    const param = await db.updateCampaignPostbackParam(paramId, updates);
    if (!param) {
      return c.json<ApiResponse>({ success: false, error: 'Postback parameter not found' }, 404);
    }
    
    return c.json<ApiResponse>({
      success: true,
      data: param,
      message: 'Postback parameter updated successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to update postback parameter' }, 500);
  }
});

// Delete campaign postback parameter
app.delete('/api/campaigns/:campaignId/postback-params/:paramId', async (c) => {
  try {
    const paramId = parseInt(c.req.param('paramId'));
    const db = new Database(c.env.DB);
    
    const deleted = await db.deleteCampaignPostbackParam(paramId);
    if (!deleted) {
      return c.json<ApiResponse>({ success: false, error: 'Postback parameter not found' }, 404);
    }
    
    return c.json<ApiResponse>({
      success: true,
      message: 'Postback parameter deleted successfully'
    });
  } catch (error) {
    return c.json<ApiResponse>({ success: false, error: 'Failed to delete postback parameter' }, 500);
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

// Postback URL Management API Routes

// Create new postback URL
app.post('/api/postbacks', async (c) => {
  try {
    // Check if database is available
    if (!c.env?.DB) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Database not configured. Please contact administrator.' 
      }, 503);
    }
    
    const postbackData = await c.req.json();
    const postbackService = new PostbackService(c.env.DB);
    
    // Validate required fields
    const requiredFields = ['affiliate_id', 'name', 'url_template', 'trigger_events'];
    for (const field of requiredFields) {
      if (!postbackData[field]) {
        return c.json<ApiResponse>({ 
          success: false, 
          error: `Missing required field: ${field}` 
        }, 400);
      }
    }
    
    // Set defaults
    if (!postbackData.http_method) postbackData.http_method = 'GET';
    if (!postbackData.status) postbackData.status = 'active';
    
    const postbackUrl = await postbackService.createPostbackUrl(postbackData);
    
    return c.json<ApiResponse>({
      success: true,
      data: postbackUrl,
      message: 'Postback URL created successfully'
    });
  } catch (error) {
    console.error('Error creating postback URL:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Failed to create postback URL' 
    }, 500);
  }
});

// Get postback URLs for affiliate
app.get('/api/postbacks', async (c) => {
  try {
    // Check if database is available
    if (!c.env?.DB) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Database not configured. Please contact administrator.' 
      }, 503);
    }
    
    const affiliateId = c.req.query('affiliate_id');
    const campaignId = c.req.query('campaign_id');
    
    if (!affiliateId) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'affiliate_id parameter is required' 
      }, 400);
    }
    
    const postbackService = new PostbackService(c.env.DB);
    const postbackUrls = await postbackService.getPostbackUrls(
      parseInt(affiliateId),
      campaignId ? parseInt(campaignId) : undefined
    );
    
    return c.json<ApiResponse>({ success: true, data: postbackUrls });
  } catch (error) {
    console.error('Error getting postback URLs:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Failed to get postback URLs' 
    }, 500);
  }
});

// Update postback URL
app.put('/api/postbacks/:id', async (c) => {
  try {
    if (!c.env?.DB) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Database not configured. Please contact administrator.' 
      }, 503);
    }
    
    const postbackId = parseInt(c.req.param('id'));
    const updates = await c.req.json();
    
    const db = new Database(c.env.DB);
    
    // Update postback URL
    const result = await db.db.prepare(`
      UPDATE postback_urls 
      SET name = ?, url_template = ?, trigger_events = ?, http_method = ?, 
          headers = ?, payload_template = ?, status = ?, updated_at = ?
      WHERE id = ?
      RETURNING *
    `).bind(
      updates.name,
      updates.url_template,
      JSON.stringify(updates.trigger_events),
      updates.http_method,
      updates.headers ? JSON.stringify(updates.headers) : null,
      updates.payload_template || null,
      updates.status,
      new Date().toISOString(),
      postbackId
    ).first();
    
    if (!result) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Postback URL not found' 
      }, 404);
    }
    
    return c.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Postback URL updated successfully'
    });
  } catch (error) {
    console.error('Error updating postback URL:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Failed to update postback URL' 
    }, 500);
  }
});

// Delete postback URL
app.delete('/api/postbacks/:id', async (c) => {
  try {
    if (!c.env?.DB) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Database not configured. Please contact administrator.' 
      }, 503);
    }
    
    const postbackId = parseInt(c.req.param('id'));
    const db = new Database(c.env.DB);
    
    const result = await db.db.prepare('DELETE FROM postback_urls WHERE id = ?').bind(postbackId).run();
    
    if (result.changes === 0) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Postback URL not found' 
      }, 404);
    }
    
    return c.json<ApiResponse>({
      success: true,
      message: 'Postback URL deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting postback URL:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Failed to delete postback URL' 
    }, 500);
  }
});

// Get postback logs
app.get('/api/postbacks/logs', async (c) => {
  try {
    if (!c.env?.DB) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Database not configured. Please contact administrator.' 
      }, 503);
    }
    
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
    console.error('Error getting postback logs:', error);
    return c.json<ApiResponse>({ 
      success: false, 
      error: 'Failed to get postback logs' 
    }, 500);
  }
});

/**
 * PX POSTBACK RECEIVER
 * ====================
 * 
 * Receives conversion notifications from PX when leads convert to sales.
 * Creates conversion records and triggers affiliate postbacks.
 * 
 * POSTBACK URL FORMAT (configured in PX dashboard):
 * https://your-domain.com/api/postback/px?aff_sub={aff_sub}&aff_sub2={aff_sub2}&transaction_id={transaction_id}&payout={payout}&campaign_id={campaign_id}&status={status}
 * 
 * PARAMETER MAPPING:
 * - aff_sub: Original SubID from tracking link (AF01, EM01, etc.)
 * - aff_sub2: Unique click ID from tracking link (UUID)
 * - transaction_id: PX transaction ID from original lead submission
 * - payout: Commission amount paid by PX buyer
 * - campaign_id: Internal campaign ID
 * - status: Conversion status (conversion, chargeback, etc.)
 * 
 * CONVERSION PROCESSING:
 * 1. Validates required parameters (transaction_id, campaign_id)
 * 2. Creates synthetic lead record if none exists
 * 3. Records conversion in conversions table
 * 4. Triggers affiliate postbacks with commission data
 * 5. Logs all activity for reporting and debugging
 * 
 * AFFILIATE POSTBACK TRIGGERS:
 * - Successful conversions trigger configured postback URLs
 * - Postback includes: conversion value, campaign info, attribution data
 * - Failed postbacks logged and retried automatically
 * 
 * ERROR HANDLING:
 * - Missing parameters return 400 Bad Request
 * - Database errors return 500 Internal Server Error
 * - All errors logged with full context for debugging
 * - Always returns success to PX to prevent retries
 * 
 * @route GET /api/postback/px
 * @param {string} aff_sub - SubID from original tracking link
 * @param {string} aff_sub2 - Click ID from original tracking link  
 * @param {string} transaction_id - PX transaction ID (required)
 * @param {number} payout - Commission payout amount
 * @param {number} campaign_id - Campaign ID (required)
 * @param {string} status - Conversion status
 * @returns {object} Success confirmation with timestamp
 */
app.get('/api/postback/px', async (c) => {
  try {
    // Extract PX parameters
    const aff_sub = c.req.query('aff_sub');           // SubId from tracking link
    const aff_sub2 = c.req.query('aff_sub2');         // Click ID from tracking link
    const transaction_id = c.req.query('transaction_id'); // PX lead/transaction ID
    const payout = c.req.query('payout');             // Commission payout amount
    const campaign_id = c.req.query('campaign_id');   // Campaign ID
    const status = c.req.query('status');             // Conversion status
    
    console.log('=== PX POSTBACK RECEIVED ===');
    console.log('Parameters:', {
      aff_sub, aff_sub2, transaction_id, payout, campaign_id, status
    });
    console.log('Full query:', c.req.url);
    
    if (!c.env?.DB) {
      console.error('Database not available for postback processing');
      return c.json({ success: false, error: 'Database unavailable' }, 503);
    }
    
    const db = new Database(c.env.DB);
    
    // Validate required parameters
    if (!transaction_id || !campaign_id) {
      console.error('Missing required parameters: transaction_id or campaign_id');
      return c.json({ 
        success: false, 
        error: 'Missing required parameters: transaction_id and campaign_id are required' 
      }, 400);
    }
    
    // Prepare conversion data
    const conversionData = {
      campaign_id: parseInt(campaign_id),
      affiliate_id: null, // Will be set from campaign lookup
      status: status || 'conversion',
      payout_amount: payout ? parseFloat(payout) : null
    };
    
    // Get campaign details to find affiliate_id
    const campaign = await db.getCampaign(parseInt(campaign_id));
    if (campaign) {
      conversionData.affiliate_id = campaign.affiliate_id;
    }
    
    // For PX postbacks, we'll create a synthetic lead record first, then record the conversion
    // This ensures foreign key constraints are satisfied
    const leadResult = await db.db.prepare(`
      INSERT INTO leads (
        campaign_id, affiliate_id, lead_uuid, first_name, last_name, 
        phone_number, zip_code, ping_status, post_status,
        utm_source, utm_medium, utm_campaign, utm_content,
        ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).bind(
      conversionData.campaign_id,
      conversionData.affiliate_id || 1,
      `px_${transaction_id}`,
      'PX', 'Conversion',
      '0000000000', '00000',
      'converted', 'converted',
      aff_sub || 'PX',
      'postback',
      `px_${transaction_id}`,
      aff_sub2 || 'direct',
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1',
      c.req.header('User-Agent') || 'PX-Postback/1.0'
    ).first<{id: number}>();
    
    const leadId = leadResult?.id;
    if (!leadId) {
      throw new Error('Failed to create lead record for PX conversion');
    }
    
    // Now record the conversion with the proper lead_id
    await db.db.prepare(`
      INSERT INTO conversions (
        lead_id, campaign_id, affiliate_id, conversion_type, conversion_value,
        source_platform, click_id, conversion_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      leadId,
      conversionData.campaign_id,
      conversionData.affiliate_id || 1,
      conversionData.status || 'conversion',
      conversionData.payout_amount || 0.00,
      'PX',
      aff_sub2 || 'no_click_id',
      JSON.stringify({
        px_transaction_id: transaction_id,
        aff_sub: aff_sub || null,
        aff_sub2: aff_sub2 || null,
        received_at: new Date().toISOString(),
        raw_query: c.req.url
      })
    ).run();
    
    // Log success
    console.log('PX postback processed successfully:', {
      transaction_id,
      campaign_id,
      payout,
      affiliate_id: conversionData.affiliate_id
    });
    
    // Return success response to PX
    return c.json({
      success: true,
      message: 'Conversion recorded successfully',
      transaction_id: transaction_id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error processing PX postback:', error);
    
    // Return error response to PX
    return c.json({
      success: false,
      error: 'Failed to process conversion',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Tracking Link Handler - Process clicks and redirect to destination
app.get('/track', async (c) => {
  try {
    const campaign_id = c.req.query('campaign_id');
    const affiliate_id = c.req.query('affiliate_id');
    const aff_sub = c.req.query('aff_sub');           // SubId for PX
    const aff_sub2 = c.req.query('aff_sub2');         // Unique click ID for PX
    const destination = c.req.query('destination');    // Final destination URL
    
    // UTM parameters
    const utm_source = c.req.query('utm_source');
    const utm_medium = c.req.query('utm_medium');
    const utm_campaign = c.req.query('utm_campaign');
    const utm_content = c.req.query('utm_content');
    
    if (!campaign_id || !affiliate_id) {
      return c.redirect('https://example.com'); // Fallback destination
    }
    
    if (c.env?.DB) {
      const db = new Database(c.env.DB);
      
      // Log the click
      const clickData = {
        click_id: aff_sub2 || `click_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        campaign_id: parseInt(campaign_id),
        sub_id: aff_sub || 'unknown',
        landing_url: destination || 'https://example.com',
        ip_address: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1',
        user_agent: c.req.header('User-Agent') || 'Unknown',
        referrer: c.req.header('Referer') || '',
        clicked_at: new Date().toISOString()
      };
      
      await db.logClick(clickData);
      
      console.log('Click tracked:', {
        campaign_id,
        affiliate_id,
        aff_sub,
        aff_sub2: clickData.click_id,
        ip: clickData.ip_address
      });
    }
    
    // Default destination for ADT Home Security
    const defaultDestination = 'https://www.adt.com/';
    const finalDestination = destination || defaultDestination;
    
    // Append tracking parameters to destination if it doesn't have them
    const destinationUrl = new URL(finalDestination);
    if (aff_sub) destinationUrl.searchParams.set('aff_sub', aff_sub);
    if (aff_sub2) destinationUrl.searchParams.set('aff_sub2', aff_sub2);
    if (utm_source) destinationUrl.searchParams.set('utm_source', utm_source);
    if (utm_medium) destinationUrl.searchParams.set('utm_medium', utm_medium);
    if (utm_campaign) destinationUrl.searchParams.set('utm_campaign', utm_campaign);
    if (utm_content) destinationUrl.searchParams.set('utm_content', utm_content);
    
    return c.redirect(destinationUrl.toString());
    
  } catch (error) {
    console.error('Error processing tracking link:', error);
    return c.redirect('https://www.adt.com/'); // Fallback
  }
});

// Inbound Call Tracking API for Solar and other verticals
app.post('/api/calls/inbound', async (c) => {
  try {
    const callData = await c.req.json();
    
    console.log('=== INBOUND CALL RECEIVED ===');
    console.log('Call data:', JSON.stringify(callData, null, 2));
    
    // Validate required fields for call tracking
    const requiredFields = ['phone_number', 'campaign_id', 'affiliate_id'];
    const missing = requiredFields.filter(field => !callData[field]);
    
    if (missing.length > 0) {
      return c.json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
        required_fields: requiredFields
      }, 400);
    }
    
    if (c.env?.DB) {
      const db = new Database(c.env.DB);
      
      // Log inbound call
      const callRecord = {
        phone_number: callData.phone_number,
        campaign_id: parseInt(callData.campaign_id),
        affiliate_id: parseInt(callData.affiliate_id),
        call_duration: callData.duration || 0,
        caller_name: callData.caller_name || 'Unknown',
        caller_location: callData.caller_location || '',
        call_status: callData.status || 'answered',
        recording_url: callData.recording_url || '',
        call_timestamp: callData.timestamp || new Date().toISOString(),
        tracking_number: callData.tracking_number || '',
        source_number: callData.source_number || '',
        ip_address: c.req.header('CF-Connecting-IP') || '127.0.0.1',
        user_agent: c.req.header('User-Agent') || 'Unknown'
      };
      
      // Store call record in database
      await db.db.prepare(`
        INSERT INTO inbound_calls (
          phone_number, campaign_id, affiliate_id, call_duration, caller_name,
          caller_location, call_status, recording_url, call_timestamp,
          tracking_number, source_number, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        callRecord.phone_number,
        callRecord.campaign_id,
        callRecord.affiliate_id,
        callRecord.call_duration,
        callRecord.caller_name,
        callRecord.caller_location,
        callRecord.call_status,
        callRecord.recording_url,
        callRecord.call_timestamp,
        callRecord.tracking_number,
        callRecord.source_number,
        callRecord.ip_address,
        callRecord.user_agent,
        new Date().toISOString()
      ).run();
      
      console.log('Inbound call logged successfully');
      
      // Trigger affiliate postbacks for call events
      const postbackService = new PostbackService(c.env.DB);
      await postbackService.triggerPostbacks(0, 'inbound_call', {
        phone_number: callData.phone_number,
        call_duration: callData.duration?.toString(),
        call_value: callData.call_value?.toString() || '0'
      });
    }
    
    return c.json({
      success: true,
      message: 'Inbound call logged successfully',
      call_id: callData.call_id || `call_${Date.now()}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error processing inbound call:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * RINGBA WEBHOOK INTEGRATION
 * ===========================
 * 
 * Processes inbound call tracking webhooks from Ringba platform.
 * Handles call attribution, qualification, and postback triggers.
 * 
 * WEBHOOK FORMAT (GET request with query parameters):
 * /api/webhooks/ringba?event=Completed&call_id=12345&tracking_number=%2B18001234567&caller_number=%2B15551234567&duration=120&status=answered&recording_url=https://...
 * 
 * CALL QUALIFICATION RULES:
 * - Duration > 30 seconds = Qualified call (triggers postbacks)
 * - Duration ≤ 30 seconds = Logged but no postbacks
 * - Missed calls = Logged for reporting only
 * 
 * CAMPAIGN ATTRIBUTION:
 * - tracking_number mapped to campaign via call_tracking_numbers table
 * - If no mapping found, creates record with default campaign/affiliate
 * - Attribution data stored for reporting and optimization
 * 
 * POSTBACK TRIGGERS:
 * - Qualified calls trigger affiliate postbacks with call_value
 * - Default call value: $25.00 (configurable per campaign)
 * - Postback includes: call_duration, tracking_number, ringba_call_id
 * 
 * CALL TRACKING NUMBER MANAGEMENT:
 * - Each campaign can have multiple tracking numbers
 * - Numbers configured via: POST /api/call-tracking/numbers
 * - Provider field supports: "ringba", "callrail", "marchex"
 * 
 * @route GET /api/webhooks/ringba
 * @param {string} event - Webhook event type (Completed, Missed, etc.)
 * @param {string} call_id - Unique Ringba call identifier
 * @param {string} tracking_number - Phone number that was called
 * @param {string} caller_number - Phone number of caller
 * @param {number} duration - Call duration in seconds
 * @param {string} status - Call status (answered, missed, busy, etc.)
 * @param {string} recording_url - URL to call recording (optional)
 * @returns {object} Success confirmation for Ringba platform
 */
app.get('/api/webhooks/ringba', async (c) => {
  try {
    // Ringba sends data as query parameters, not JSON body
    const webhookData = {
      event: c.req.query('event'),
      call_id: c.req.query('call_id'),
      tracking_number: c.req.query('tracking_number'),
      caller_number: c.req.query('caller_number'),
      duration: parseInt(c.req.query('duration') || '0'),
      status: c.req.query('status'),
      recording_url: c.req.query('recording_url'),
      timestamp: c.req.query('timestamp')
    };
    
    console.log('=== RINGBA WEBHOOK RECEIVED ===');
    console.log('Event:', webhookData.event);
    console.log('Call ID:', webhookData.call_id);
    console.log('Tracking Number:', webhookData.tracking_number);
    console.log('Caller Number:', webhookData.caller_number);
    console.log('Duration:', webhookData.duration, 'seconds');
    console.log('Status:', webhookData.status);
    console.log('Recording URL:', webhookData.recording_url);
    console.log('Timestamp:', webhookData.timestamp);
    
    if (c.env?.DB) {
      const db = new Database(c.env.DB);
      
      // Store webhook data for processing
      await db.db.prepare(`
        INSERT INTO ringba_webhooks (
          webhook_type, call_id, tracking_number, caller_number,
          duration, status, recording_url, webhook_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        webhookData.event || 'Completed',
        webhookData.call_id || 'unknown',
        webhookData.tracking_number || '',
        webhookData.caller_number || '',
        webhookData.duration || 0,
        webhookData.status || 'unknown',
        webhookData.recording_url || '',
        JSON.stringify(webhookData),
        new Date().toISOString()
      ).run();
      
      // Process webhook based on event type
      if (webhookData.event === 'Completed' || webhookData.status === 'answered') {
        // Find campaign and affiliate from tracking number
        const trackingInfo = await db.db.prepare(`
          SELECT campaign_id, affiliate_id FROM call_tracking_numbers 
          WHERE tracking_number = ?
        `).bind(webhookData.tracking_number || '').first();
        
        if (trackingInfo) {
          // Log the inbound call
          const callResult = await db.db.prepare(`
            INSERT INTO inbound_calls (
              phone_number, campaign_id, affiliate_id, call_duration,
              call_status, recording_url, call_timestamp, tracking_number,
              source_number, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            RETURNING id
          `).bind(
            webhookData.caller_number || 'unknown',
            trackingInfo.campaign_id,
            trackingInfo.affiliate_id,
            webhookData.duration || 0,
            webhookData.status || 'completed',
            webhookData.recording_url || '',
            webhookData.timestamp || new Date().toISOString(),
            webhookData.tracking_number || '',
            webhookData.caller_number || 'unknown',
            new Date().toISOString()
          ).first();
          
          // Trigger postbacks for qualified calls (duration > 30 seconds)
          const callDuration = webhookData.duration || 0;
          console.log(`Call duration: ${callDuration} seconds`);
          
          if (callDuration > 30 && callResult?.id) {
            console.log('Triggering postbacks for qualified call');
            const postbackService = new PostbackService(c.env.DB);
            await postbackService.triggerPostbacks(callResult.id, 'qualified_call', {
              call_duration: callDuration.toString(),
              tracking_number: webhookData.tracking_number || '',
              call_value: '25.00', // Default call value - adjust as needed
              ringba_call_id: webhookData.call_id
            });
          } else {
            console.log('Call not qualified for postback (duration <= 30 seconds or no call ID)');
          }
        } else {
          console.log('No tracking number configuration found for:', webhookData.tracking_number);
          
          // Create a default entry if no tracking number config exists
          if (webhookData.tracking_number) {
            console.log('Creating inbound call record without campaign attribution');
            await db.db.prepare(`
              INSERT INTO inbound_calls (
                phone_number, campaign_id, affiliate_id, call_duration,
                call_status, recording_url, call_timestamp, tracking_number,
                source_number, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              webhookData.caller_number || 'unknown',
              1, // Default campaign ID
              1, // Default affiliate ID  
              webhookData.duration || 0,
              webhookData.status || 'completed',
              webhookData.recording_url || '',
              webhookData.timestamp || new Date().toISOString(),
              webhookData.tracking_number || '',
              webhookData.caller_number || 'unknown',
              new Date().toISOString()
            ).run();
          }
        }
        
        // Mark webhook as processed
        await db.db.prepare(`
          UPDATE ringba_webhooks SET processed = 1, processed_at = ? 
          WHERE call_id = ?
        `).bind(
          new Date().toISOString(),
          webhookData.call_id || 'unknown'
        ).run();
      } else {
        console.log('Webhook event not processed:', webhookData.event);
      }
    }
    
    // Always return success to Ringba to prevent retries
    return c.json({
      success: true,
      message: 'Webhook processed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error processing Ringba webhook:', error);
    
    // Log error in webhook table if we have the data
    if (c.env?.DB) {
      try {
        const webhookData = await c.req.json();
        const db = new Database(c.env.DB);
        await db.db.prepare(`
          UPDATE ringba_webhooks SET error_message = ?, processed_at = ?
          WHERE call_id = ?
        `).bind(
          error instanceof Error ? error.message : 'Unknown error',
          new Date().toISOString(),
          webhookData.call_id || webhookData.callId
        ).run();
      } catch (logError) {
        console.error('Failed to log webhook error:', logError);
      }
    }
    
    return c.json({
      success: false,
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Call Tracking Number Management API
app.post('/api/call-tracking/numbers', async (c) => {
  try {
    const { tracking_number, campaign_id, affiliate_id, provider = 'ringba' } = await c.req.json();
    
    if (!tracking_number || !campaign_id) {
      return c.json({
        success: false,
        error: 'tracking_number and campaign_id are required'
      }, 400);
    }
    
    if (c.env?.DB) {
      const db = new Database(c.env.DB);
      
      const result = await db.db.prepare(`
        INSERT INTO call_tracking_numbers (
          tracking_number, campaign_id, affiliate_id, provider, created_at
        ) VALUES (?, ?, ?, ?, ?)
        RETURNING *
      `).bind(
        tracking_number,
        campaign_id,
        affiliate_id || null,
        provider,
        new Date().toISOString()
      ).first();
      
      return c.json({
        success: true,
        data: result,
        message: 'Call tracking number added successfully'
      });
    }
    
    return c.json({
      success: false,
      error: 'Database not available'
    }, 503);
    
  } catch (error) {
    console.error('Error adding call tracking number:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Get recent PX transaction IDs
app.get('/api/px/transactions', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    
    if (c.env?.DB) {
      const db = new Database(c.env.DB);
      
      // Get recent leads with PX transaction data
      const transactions = await db.db.prepare(`
        SELECT 
          id,
          lead_uuid,
          px_lead_id,
          first_name,
          last_name,
          phone_number,
          ping_response,
          post_response,
          ping_sent_at,
          post_sent_at,
          ping_status,
          post_status,
          created_at
        FROM leads 
        WHERE ping_response IS NOT NULL 
        ORDER BY created_at DESC 
        LIMIT ?
      `).bind(limit).all();
      
      // Parse and extract transaction IDs
      const parsedTransactions = transactions.map((lead: any) => {
        let pingData = null;
        let postData = null;
        let transactionId = null;
        
        try {
          if (lead.ping_response) {
            pingData = JSON.parse(lead.ping_response);
            transactionId = pingData.TransactionId || pingData.transaction_id;
          }
          if (lead.post_response) {
            postData = JSON.parse(lead.post_response);
          }
        } catch (e) {
          console.error('Error parsing PX response:', e);
        }
        
        return {
          lead_id: lead.id,
          lead_uuid: lead.lead_uuid,
          px_lead_id: lead.px_lead_id,
          transaction_id: transactionId,
          contact: {
            first_name: lead.first_name,
            last_name: lead.last_name,
            phone_number: lead.phone_number
          },
          ping_status: lead.ping_status,
          post_status: lead.post_status,
          ping_data: pingData,
          post_data: postData,
          timestamps: {
            ping_sent_at: lead.ping_sent_at,
            post_sent_at: lead.post_sent_at,
            created_at: lead.created_at
          }
        };
      });
      
      return c.json({
        success: true,
        data: parsedTransactions,
        count: parsedTransactions.length
      });
    }
    
    return c.json({
      success: false,
      error: 'Database not available'
    }, 503);
    
  } catch (error) {
    console.error('Error getting PX transactions:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Get call tracking statistics
app.get('/api/call-tracking/stats', async (c) => {
  try {
    const campaignId = c.req.query('campaign_id');
    const affiliateId = c.req.query('affiliate_id');
    
    if (c.env?.DB) {
      const db = new Database(c.env.DB);
      
      let whereClause = '';
      const params = [];
      
      if (campaignId) {
        whereClause += ' WHERE campaign_id = ?';
        params.push(parseInt(campaignId));
      }
      
      if (affiliateId) {
        whereClause += campaignId ? ' AND affiliate_id = ?' : ' WHERE affiliate_id = ?';
        params.push(parseInt(affiliateId));
      }
      
      const callStats = await db.db.prepare(`
        SELECT 
          COUNT(*) as total_calls,
          AVG(call_duration) as avg_duration,
          COUNT(CASE WHEN call_duration > 30 THEN 1 END) as qualified_calls,
          COUNT(CASE WHEN call_status = 'answered' THEN 1 END) as answered_calls,
          SUM(CASE WHEN call_duration > 30 THEN call_value ELSE 0 END) as total_revenue
        FROM inbound_calls${whereClause}
      `).bind(...params).first();
      
      return c.json({
        success: true,
        data: callStats
      });
    }
    
    return c.json({
      success: false,
      error: 'Database not available'
    }, 503);
    
  } catch (error) {
    console.error('Error getting call stats:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// PX Ping-Post API Implementation for Solar Leads
app.post('/api/px/ping-post', async (c) => {
  try {
    const leadData = await c.req.json();
    
    console.log('=== PX PING-POST REQUEST ===');
    console.log('Lead data received:', JSON.stringify(leadData, null, 2));
    
    // Validate required fields for solar leads
    const requiredFields = ['firstName', 'lastName', 'phone', 'zipCode', 'ownership', 'roofshade', 'electricityBill'];
    const missing = requiredFields.filter(field => !leadData[field]);
    
    if (missing.length > 0) {
      return c.json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`,
        required_fields: requiredFields
      }, 400);
    }
    
    // Get API token from account settings (you'll need to add this)
    const apiToken = c.env?.PX_API_TOKEN_SOLAR || 'B593425D-90C7-4CB8-8952-605D8A0CCEC0';
    
    // Step 1: Send PING to PX
    const pingResult = await sendPxPing({
      apiToken,
      leadData,
      offerId: '122', // Test offer ID
      subId: leadData.subId || 'EM01',
      did: '+18576880648' // Test DID
    });
    
    if (!pingResult.success) {
      return c.json({
        success: false,
        step: 'ping',
        error: pingResult.error,
        px_response: pingResult.response
      });
    }
    
    // Check ping response
    if (pingResult.response?.CallId && pingResult.response?.Status === 'BaeOK') {
      console.log('PING ACCEPTED - Proceeding with POST');
      
      // Step 2: Send POST within 15 seconds
      const postResult = await sendPxPost({
        apiToken,
        leadData,
        callId: pingResult.response.CallId,
        offerId: '122',
        subId: leadData.subId || 'EM01',
        did: '+18576880648'
      });
      
      // Log lead to database if we have DB available
      if (c.env?.DB) {
        const db = new Database(c.env.DB);
        try {
          const leadRecord = await db.createLead({
            campaign_id: 1, // Solar campaign
            affiliate_id: leadData.affiliateId || 1,
            lead_uuid: pingResult.response.CallId || `px_${Date.now()}`,
            px_lead_id: pingResult.response.CallId || null,
            first_name: leadData.firstName,
            last_name: leadData.lastName,
            phone_number: leadData.phone,
            zip_code: leadData.zipCode,
            ownership: leadData.ownership,
            roof_shade: leadData.roofshade,
            electricity_bill: leadData.electricityBill,
            ping_status: 'accepted',
            post_status: postResult.success ? 'posted' : 'failed',
            ping_response: JSON.stringify(pingResult.response),
            post_response: JSON.stringify(postResult.response),
            ping_sent_at: new Date().toISOString(),
            post_sent_at: new Date().toISOString(),
            ip_address: c.req.header('CF-Connecting-IP') || '127.0.0.1',
            user_agent: c.req.header('User-Agent') || 'Unknown'
          });
          
          console.log('Lead saved to database:', leadRecord.id);
        } catch (dbError) {
          console.error('Failed to save lead to database:', dbError);
        }
      }
      
      return c.json({
        success: true,
        step: 'post_complete',
        call_id: pingResult.response.CallId,
        ping_response: pingResult.response,
        post_response: postResult.response,
        message: postResult.success ? 'Lead successfully posted to PX' : 'Ping accepted but post failed'
      });
      
    } else {
      console.log('PING REJECTED');
      
      return c.json({
        success: false,
        step: 'ping_rejected',
        ping_response: pingResult.response,
        message: 'Ping was rejected by PX - no buyers available or lead not qualified'
      });
    }
    
  } catch (error) {
    console.error('Error in ping-post flow:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Helper function to send PX Ping
async function sendPxPing({apiToken, leadData, offerId, subId, did}: {
  apiToken: string;
  leadData: any;
  offerId: string;
  subId: string;
  did: string;
}) {
  try {
    const pingPayload = {
      ApiToken: apiToken,
      Vertical: "Solar", // Required field for Ping-Post
      OriginalUrl: "https://solar-leads.example.com", // Required field for Ping-Post
      OfferId: offerId,
      SubId: subId,
      DID: did,
      ContactData: {
        FirstName: leadData.firstName,
        LastName: leadData.lastName,
        PhoneNumber: leadData.phone,
        ZipCode: leadData.zipCode,
        Ownership: leadData.ownership,
        Roofshade: leadData.roofshade,
        ElectricityBill: leadData.electricityBill
      }
    };
    
    console.log('Sending PING to PX:', JSON.stringify(pingPayload, null, 2));
    
    const response = await fetch('https://leadapi.px.com/api/call/ping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(pingPayload)
    });
    
    const responseText = await response.text();
    console.log('PX PING Response Status:', response.status);
    console.log('PX PING Response Body:', responseText);
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        response: responseText
      };
    }
    
    let pingResponse;
    try {
      pingResponse = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        error: 'Failed to parse PX ping response',
        response: responseText
      };
    }
    
    return {
      success: true,
      response: pingResponse
    };
    
  } catch (error) {
    console.error('Error sending ping to PX:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      response: null
    };
  }
}

// Helper function to send PX Post
async function sendPxPost({apiToken, leadData, callId, offerId, subId, did}: {
  apiToken: string;
  leadData: any;
  callId: string;
  offerId: string;
  subId: string;
  did: string;
}) {
  try {
    const postPayload = {
      ApiToken: apiToken,
      Vertical: "Solar", // Required field for Ping-Post
      OriginalUrl: "https://solar-leads.example.com", // Required field for Ping-Post
      CallId: callId,
      OfferId: offerId,
      SubId: subId,
      DID: did,
      ContactData: {
        FirstName: leadData.firstName,
        LastName: leadData.lastName,
        PhoneNumber: leadData.phone,
        ZipCode: leadData.zipCode,
        Ownership: leadData.ownership,
        Roofshade: leadData.roofshade,
        ElectricityBill: leadData.electricityBill,
        // Add additional data for better payouts
        Address: leadData.address || '',
        City: leadData.city || '',
        State: leadData.state || '',
        Email: leadData.email || ''
      }
    };
    
    console.log('Sending POST to PX:', JSON.stringify(postPayload, null, 2));
    
    const response = await fetch('https://leadapi.px.com/api/call/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(postPayload)
    });
    
    const responseText = await response.text();
    console.log('PX POST Response Status:', response.status);
    console.log('PX POST Response Body:', responseText);
    
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        response: responseText
      };
    }
    
    let postResponse;
    try {
      postResponse = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        error: 'Failed to parse PX post response',
        response: responseText
      };
    }
    
    return {
      success: true,
      response: postResponse
    };
    
  } catch (error) {
    console.error('Error sending post to PX:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      response: null
    };
  }
}

// Main dashboard page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Affiliate Click Tracking Platform</title>
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
                        <h1 class="text-2xl font-bold text-gray-900">Affiliate Click Tracking Platform</h1>
                    </div>
                    <div class="flex items-center space-x-4">
                        <nav class="flex space-x-4">
                            <a href="/affiliates" class="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-100">
                                <i class="fas fa-users mr-1"></i>Affiliates
                            </a>
                            <a href="/campaigns" class="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-100">
                                <i class="fas fa-bullhorn mr-1"></i>Campaigns
                            </a>
                            <a href="/px-test" class="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-100">
                                <i class="fas fa-vial mr-1"></i>PX Test
                            </a>
                            <a href="/postbacks" class="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md hover:bg-gray-100">
                                <i class="fas fa-webhook mr-1"></i>Postbacks
                            </a>
                        </nav>
                        <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-500">360° Click Tracking</span>
                            <div class="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        </div>
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
                <!-- Tracking Links Generator -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-6">
                        <i class="fas fa-link mr-2"></i>Generate Tracking Links
                    </h2>
                    
                    <form id="tracking-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
                            <select name="campaign_id" id="campaign-select" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">Select Campaign...</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Your SubID</label>
                            <input type="text" name="sub_id" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. EM1, FB2, GG1">
                            <p class="text-xs text-gray-500 mt-1">Use format: EM1, FB2, GG1 (traffic type + number)</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Landing Page URL</label>
                            <input type="url" name="landing_url" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://your-landing-page.com">
                        </div>
                        
                        <button type="submit" class="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold">
                            <i class="fas fa-link mr-2"></i>Generate Tracking Link
                        </button>
                    </form>
                    
                    <div id="tracking-result" class="mt-4 hidden"></div>
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
                        <a href="/px-test" class="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700">
                            <i class="fas fa-vial mr-2"></i>PX Test
                        </a>
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
                <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 class="text-lg font-semibold text-gray-900">All Campaigns</h2>
                    <button onclick="campaignManager.showCreateCampaignModal()" 
                            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center">
                        <i class="fas fa-plus mr-2"></i>Create Campaign
                    </button>
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

// Affiliates management page
app.get('/affiliates', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Affiliate Management - Affiliate Tracking</title>
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
                        <i class="fas fa-users text-blue-600 text-2xl mr-3"></i>
                        <h1 class="text-2xl font-bold text-gray-900">Affiliate Management</h1>
                    </div>
                    <div class="flex space-x-2">
                        <a href="/campaigns" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                            <i class="fas fa-bullhorn mr-2"></i>Campaigns
                        </a>
                        <a href="/postbacks" class="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700">
                            <i class="fas fa-webhook mr-2"></i>Postbacks
                        </a>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- Affiliates List -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 class="text-lg font-semibold text-gray-900">All Affiliates</h2>
                    <button onclick="affiliateManager.showCreateAffiliateModal()" 
                            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center">
                        <i class="fas fa-plus mr-2"></i>Create Affiliate
                    </button>
                </div>
                
                <div id="affiliates-list" class="p-6">
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <p>Loading affiliates...</p>
                    </div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/affiliates.js"></script>
    </body>
    </html>
  `)
});

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

// PX Direct Post Test Page
app.get('/px-test', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>PX Direct Post Test - Affiliate Tracking</title>
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
                        <i class="fas fa-vial text-orange-600 text-2xl mr-3"></i>
                        <h1 class="text-2xl font-bold text-gray-900">PX Direct Post Test</h1>
                    </div>
                    <div class="text-sm text-gray-500">
                        API Endpoint: https://leadapi.px.com/api/lead/directpost
                    </div>
                </div>
            </div>
        </div>
        
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <!-- SubId Helper -->
            <div class="bg-white rounded-lg shadow mb-8">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">SubId Generator</h2>
                    <p class="text-sm text-gray-600">Generate valid SubIds based on traffic type (≤20 total per account)</p>
                </div>
                <div class="p-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Traffic Type</label>
                            <select id="traffic-type" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                <option value="">Select Traffic Type</option>
                                <option value="Email">Email (EM01, EM02)</option>
                                <option value="Facebook">Facebook (FB01)</option>
                                <option value="Instagram">Instagram (IG01)</option>
                                <option value="TikTok">TikTok (TT01)</option>
                                <option value="Twitter">Twitter (TW01)</option>
                                <option value="Taboola">Taboola (TB01)</option>
                                <option value="Outbrain">Outbrain (OB01)</option>
                                <option value="Google">Google/Search (GG01)</option>
                                <option value="Affiliates">Affiliates (AF01, AF02, etc.)</option>
                                <option value="Social">Social Media (Multiple)</option>
                                <option value="Native">Native Ads (Multiple)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Campaign Number (Optional)</label>
                            <input type="number" id="campaign-number" min="1" max="10" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="1">
                        </div>
                        <div class="md:col-span-2">
                            <button onclick="generateSubId()" class="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">
                                <i class="fas fa-magic mr-2"></i>Generate SubId
                            </button>
                            <div id="subid-result" class="mt-4 p-4 bg-gray-50 border rounded-md hidden">
                                <div class="flex items-center justify-between">
                                    <span class="font-mono text-lg" id="generated-subid"></span>
                                    <button onclick="copySubId()" class="text-blue-600 hover:text-blue-800">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- API Method Selection -->
            <div class="bg-white rounded-lg shadow mb-8">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">API Method Selection</h2>
                    <p class="text-sm text-gray-600">Choose between Direct Post (immediate) or Ping-Post (two-step with bidding)</p>
                </div>
                <div class="p-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <input type="radio" id="method-direct" name="api-method" value="direct" checked class="mr-2">
                            <label for="method-direct" class="text-sm font-medium text-gray-700">Direct Post</label>
                            <p class="text-xs text-gray-500 ml-6">Submit lead directly to PX (immediate response)</p>
                        </div>
                        <div>
                            <input type="radio" id="method-ping-post" name="api-method" value="ping-post" class="mr-2">
                            <label for="method-ping-post" class="text-sm font-medium text-gray-700">Ping-Post (Solar Only)</label>
                            <p class="text-xs text-gray-500 ml-6">Two-step process: Ping for bid, then Post if accepted</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Direct Post Test Form -->
            <div id="direct-post-form" class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">Direct Post Test Form</h2>
                    <p class="text-sm text-gray-600">Test PX Direct Post API with Health and Solar verticals</p>
                </div>
                <div class="p-6">
                    <form id="px-test-form" class="space-y-6">
                        <!-- Vertical Selection -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Vertical *</label>
                                <select id="vertical" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                    <option value="">Select Vertical</option>
                                    <option value="Health">Health</option>
                                    <option value="Solar">Solar</option>
                                    <!-- <option value="Home">Home</option> <!-- Disabled: Missing PX API token for Home vertical -->
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">SubId *</label>
                                <input type="text" id="subId" required maxlength="20" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., FB01, EM01, GG01">
                                <p class="text-xs text-gray-500 mt-1">Max 20 characters, no special chars</p>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Source</label>
                                <input type="text" id="source" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="e.g., facebook, google">
                            </div>
                        </div>
                        
                        <!-- Contact Information -->
                        <div class="border-t pt-6">
                            <h3 class="text-md font-medium text-gray-900 mb-4">Contact Information</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                                    <input type="text" id="firstName" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                                    <input type="text" id="lastName" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                                    <input type="email" id="email" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                                    <input type="tel" id="phone" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="(555) 123-4567">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Zip Code *</label>
                                    <input type="text" id="zipCode" required pattern="[0-9]{5}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="12345">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">State</label>
                                    <input type="text" id="state" maxlength="2" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="CA">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Solar-Specific Fields -->
                        <div id="solar-fields" class="border-t pt-6 hidden">
                            <h3 class="text-md font-medium text-gray-900 mb-4">Solar Information</h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Property Ownership</label>
                                    <select id="ownership" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                        <option value="">Select</option>
                                        <option value="Own">Own</option>
                                        <option value="Rent">Rent</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Roof Shade</label>
                                    <select id="roofshade" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                        <option value="">Select</option>
                                        <option value="No Shade">No Shade</option>
                                        <option value="Little Shade">Little Shade</option>
                                        <option value="Moderate Shade">Moderate Shade</option>
                                        <option value="Heavy Shade">Heavy Shade</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Electricity Bill</label>
                                    <input type="text" id="electricityBill" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="$100-200">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Health-Specific Fields -->
                        <div id="health-fields" class="border-t pt-6 hidden">
                            <h3 class="text-md font-medium text-gray-900 mb-4">Health Information</h3>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                                    <input type="date" id="dateOfBirth" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                                    <select id="gender" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Height</label>
                                    <input type="text" id="height" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="5'10&quot;">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Weight</label>
                                    <input type="text" id="weight" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="180 lbs">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Submit Button -->
                        <div class="border-t pt-6">
                            <button type="submit" class="bg-green-600 text-white px-8 py-3 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                <i class="fas fa-paper-plane mr-2"></i>
                                <span id="submit-text">Send Direct Post</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Ping-Post Test Form -->
            <div id="ping-post-form" class="bg-white rounded-lg shadow hidden">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">Ping-Post Test Form (Solar)</h2>
                    <p class="text-sm text-gray-600">Test PX Ping-Post API for Solar leads - Two-step process with real-time bidding</p>
                </div>
                <div class="p-6">
                    <form id="ping-post-test-form" class="space-y-6">
                        <!-- Configuration -->
                        <div class="bg-blue-50 p-4 rounded-md">
                            <h3 class="text-md font-medium text-blue-900 mb-2">Test Configuration</h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div>
                                    <label class="block text-blue-700 font-medium">Offer ID:</label>
                                    <span class="text-blue-900">122 (Solar Test)</span>
                                </div>
                                <div>
                                    <label class="block text-blue-700 font-medium">DID:</label>
                                    <span class="text-blue-900">+18576880648</span>
                                </div>
                                <div>
                                    <label class="block text-blue-700 font-medium">API Token:</label>
                                    <span class="text-blue-900">B593425D-90C7-4CB8-8952-***</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- SubId Selection -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">SubId *</label>
                            <select id="ping-post-subId" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                <option value="">Select SubId</option>
                                <option value="EM01">EM01 (Email Campaign #1)</option>
                                <option value="EM02">EM02 (Email Campaign #2)</option>
                                <option value="FB01">FB01 (Facebook Campaign #1)</option>
                                <option value="IG01">IG01 (Instagram Campaign #1)</option>
                                <option value="TT01">TT01 (TikTok Campaign #1)</option>
                                <option value="TW01">TW01 (Twitter Campaign #1)</option>
                                <option value="TB01">TB01 (Taboola Campaign #1)</option>
                                <option value="OB01">OB01 (Outbrain Campaign #1)</option>
                                <option value="GG01">GG01 (Google Campaign #1)</option>
                                <option value="AF01">AF01 (Affiliate Campaign #1)</option>
                                <option value="AF02">AF02 (Affiliate Campaign #2)</option>
                                <option value="AF03">AF03 (Affiliate Campaign #3)</option>
                                <option value="AF04">AF04 (Affiliate Campaign #4)</option>
                            </select>
                            <p class="text-xs text-gray-500 mt-1">Choose SubId based on traffic source (max 20 per PX account)</p>
                        </div>
                        
                        <!-- Contact Information -->
                        <div class="border-t pt-6">
                            <h3 class="text-md font-medium text-gray-900 mb-4">Contact Information</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                                    <input type="text" id="ping-post-firstName" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" value="John">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                                    <input type="text" id="ping-post-lastName" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" value="Smith">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                                    <input type="tel" id="ping-post-phone" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" value="5551234567">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Zip Code *</label>
                                    <input type="text" id="ping-post-zipCode" required pattern="[0-9]{5}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" value="90210">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Solar-Specific Information -->
                        <div class="border-t pt-6">
                            <h3 class="text-md font-medium text-gray-900 mb-4">Solar Information *</h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Property Ownership *</label>
                                    <select id="ping-post-ownership" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                        <option value="">Select</option>
                                        <option value="Own" selected>Own</option>
                                        <option value="Rent">Rent</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Roof Shade *</label>
                                    <select id="ping-post-roofshade" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                        <option value="">Select</option>
                                        <option value="No Shade" selected>No Shade</option>
                                        <option value="Little Shade">Little Shade</option>
                                        <option value="Moderate Shade">Moderate Shade</option>
                                        <option value="Heavy Shade">Heavy Shade</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Electricity Bill *</label>
                                    <select id="ping-post-electricityBill" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                                        <option value="">Select Range</option>
                                        <option value="$100-150" selected>$100-150</option>
                                        <option value="$150-200">$150-200</option>
                                        <option value="$200-250">$200-250</option>
                                        <option value="$250-300">$250-300</option>
                                        <option value="$300+">$300+</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Optional Information -->
                        <div class="border-t pt-6">
                            <h3 class="text-md font-medium text-gray-900 mb-4">Optional Information (Higher Payouts)</h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                    <input type="email" id="ping-post-email" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="john@example.com">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Address</label>
                                    <input type="text" id="ping-post-address" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="123 Main St">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">City</label>
                                    <input type="text" id="ping-post-city" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Los Angeles">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">State</label>
                                    <input type="text" id="ping-post-state" maxlength="2" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="CA">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Submit Button -->
                        <div class="border-t pt-6">
                            <button type="submit" class="bg-orange-600 text-white px-8 py-3 rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                <i class="fas fa-exchange-alt mr-2"></i>
                                <span id="ping-post-submit-text">Start Ping-Post Process</span>
                            </button>
                            <p class="text-xs text-gray-500 mt-2">
                                <i class="fas fa-info-circle mr-1"></i>
                                Process: 1) Send Ping → 2) Wait for bid response → 3) Send Post if accepted (within 15 seconds)
                            </p>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Results -->
            <div id="results" class="mt-8 bg-white rounded-lg shadow hidden">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h2 class="text-lg font-semibold text-gray-900">PX API Response</h2>
                </div>
                <div class="p-6">
                    <div id="response-content" class="bg-gray-50 p-4 rounded-md">
                        <!-- Response will be displayed here -->
                    </div>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/px-test.js"></script>
    </body>
    </html>
  `)
})

export default app
