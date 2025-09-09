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

// Generate tracking links
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

// PX Direct Post Test Endpoint
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
      error: 'Failed to create campaign' 
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
    
    // Validate required fields
    const requiredFields = ['name', 'offer_id', 'sub_id', 'traffic_type', 'payout_amount', 'status'];
    for (const field of requiredFields) {
      if (campaignData[field] === undefined || campaignData[field] === '') {
        return c.json<ApiResponse>({ 
          success: false, 
          error: `Missing required field: ${field}` 
        }, 400);
      }
    }
    
    // Validate status values
    const validStatuses = ['active', 'paused', 'inactive'];
    if (!validStatuses.includes(campaignData.status)) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Invalid status. Must be: active, paused, or inactive' 
      }, 400);
    }
    
    // Validate payout_amount is a number
    if (isNaN(parseFloat(campaignData.payout_amount))) {
      return c.json<ApiResponse>({ 
        success: false, 
        error: 'Payout amount must be a valid number' 
      }, 400);
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
                        <a href="/px-test" class="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700">
                            <i class="fas fa-vial mr-2"></i>PX Test
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
        
        <!-- Create/Edit Affiliate Modal -->
        <div id="affiliate-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden flex items-center justify-center p-4">
            <div class="bg-white rounded-lg max-w-md w-full p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 id="modal-title" class="text-lg font-semibold text-gray-900">New Affiliate</h3>
                    <button id="close-modal" class="text-gray-400 hover:text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <form id="affiliate-form" class="space-y-4">
                    <input type="hidden" id="affiliate-id" name="id">
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input type="text" name="name" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <input type="email" name="email" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <input type="text" name="api_key" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Auto-generated if left empty">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                    
                    <div class="flex justify-end space-x-2 pt-4">
                        <button type="button" id="cancel-affiliate" class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
                            Cancel
                        </button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                            Save Affiliate
                        </button>
                    </div>
                </form>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/affiliates.js"></script>
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
            
            <!-- Direct Post Test Form -->
            <div class="bg-white rounded-lg shadow">
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
                                    <option value="Home">Home</option>
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
