import { Conversion, ConversionPixel, GoogleConversionRequest, FacebookConversionRequest, Lead } from './types';
import { createHash } from 'crypto';

export class ConversionService {
  private db: D1Database;
  
  constructor(db: D1Database) {
    this.db = db;
  }
  
  /**
   * Record a conversion event
   */
  async recordConversion(conversion: Omit<Conversion, 'id' | 'created_at'>): Promise<Conversion> {
    const result = await this.db.prepare(`
      INSERT INTO conversions (
        lead_id, campaign_id, affiliate_id, conversion_type, conversion_value, currency,
        source_platform, click_id, google_conversion_id, google_conversion_label,
        google_order_id, facebook_pixel_id, facebook_event_id, facebook_conversion_api_event_id,
        attribution_window_hours, time_to_conversion_hours, conversion_data,
        user_agent, ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      conversion.lead_id,
      conversion.campaign_id,
      conversion.affiliate_id,
      conversion.conversion_type,
      conversion.conversion_value,
      conversion.currency,
      conversion.source_platform || null,
      conversion.click_id || null,
      conversion.google_conversion_id || null,
      conversion.google_conversion_label || null,
      conversion.google_order_id || null,
      conversion.facebook_pixel_id || null,
      conversion.facebook_event_id || null,
      conversion.facebook_conversion_api_event_id || null,
      conversion.attribution_window_hours,
      conversion.time_to_conversion_hours || null,
      conversion.conversion_data ? JSON.stringify(conversion.conversion_data) : null,
      conversion.user_agent || null,
      conversion.ip_address || null
    ).first<Conversion>();
    
    if (!result) {
      throw new Error('Failed to record conversion');
    }
    
    return result;
  }
  
  /**
   * Send conversion to Google Ads Enhanced Conversions API
   */
  async sendGoogleConversion(
    conversionActionId: string,
    lead: Lead,
    conversion: Conversion,
    googleAdsCustomerId: string,
    accessToken: string
  ): Promise<boolean> {
    try {
      // Prepare user identifiers with hashed PII
      const userIdentifiers = [];
      
      if (lead.email) {
        userIdentifiers.push({
          hashed_email: this.hashPII(lead.email.toLowerCase().trim())
        });
      }
      
      if (lead.phone_number) {
        // Remove all non-digits and add country code if not present
        let phone = lead.phone_number.replace(/\D/g, '');
        if (!phone.startsWith('1') && phone.length === 10) {
          phone = '1' + phone; // Add US country code
        }
        userIdentifiers.push({
          hashed_phone_number: this.hashPII(phone)
        });
      }
      
      // Add address info if available
      if (lead.first_name || lead.last_name || lead.zip_code) {
        const addressInfo: any = {};
        
        if (lead.first_name) {
          addressInfo.hashed_first_name = this.hashPII(lead.first_name.toLowerCase().trim());
        }
        if (lead.last_name) {
          addressInfo.hashed_last_name = this.hashPII(lead.last_name.toLowerCase().trim());
        }
        if (lead.zip_code) {
          addressInfo.postal_code = lead.zip_code;
          addressInfo.country_code = 'US'; // Default to US
        }
        
        if (Object.keys(addressInfo).length > 0) {
          userIdentifiers.push({ address_info: addressInfo });
        }
      }
      
      // Prepare conversion request
      const conversionRequest: GoogleConversionRequest = {
        conversion_action: `customers/${googleAdsCustomerId}/conversionActions/${conversionActionId}`,
        conversion_date_time: conversion.created_at || new Date().toISOString(),
        conversion_value: conversion.conversion_value,
        currency_code: conversion.currency,
        order_id: conversion.google_order_id,
        user_identifiers: userIdentifiers
      };
      
      // Add gclid if available
      if (conversion.click_id?.startsWith('gclid')) {
        conversionRequest.gclid = conversion.click_id.replace('gclid=', '');
      }
      
      // Send to Google Ads API
      const response = await fetch(
        `https://googleads.googleapis.com/v16/customers/${googleAdsCustomerId}:uploadClickConversions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
          },
          body: JSON.stringify({
            conversions: [conversionRequest]
          })
        }
      );
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('Google Ads conversion sent successfully:', result);
        
        // Update conversion record with Google-specific data
        await this.db.prepare(`
          UPDATE conversions 
          SET google_conversion_id = ?, google_conversion_label = ?
          WHERE id = ?
        `).bind(conversionActionId, 'enhanced_conversion', conversion.id).run();
        
        return true;
      } else {
        console.error('Google Ads conversion failed:', result);
        return false;
      }
      
    } catch (error) {
      console.error('Google Ads conversion error:', error);
      return false;
    }
  }
  
  /**
   * Send conversion to Facebook Conversions API
   */
  async sendFacebookConversion(
    pixelId: string,
    lead: Lead,
    conversion: Conversion,
    accessToken: string,
    testEventCode?: string
  ): Promise<boolean> {
    try {
      // Generate unique event ID
      const eventId = conversion.facebook_event_id || this.generateEventId();
      
      // Prepare user data with hashed PII
      const userData: any = {};
      
      if (lead.email) {
        userData.em = this.hashPII(lead.email.toLowerCase().trim());
      }
      
      if (lead.phone_number) {
        // Remove all non-digits and add country code
        let phone = lead.phone_number.replace(/\D/g, '');
        if (!phone.startsWith('1') && phone.length === 10) {
          phone = '1' + phone;
        }
        userData.ph = this.hashPII(phone);
      }
      
      if (lead.first_name) {
        userData.fn = this.hashPII(lead.first_name.toLowerCase().trim());
      }
      
      if (lead.last_name) {
        userData.ln = this.hashPII(lead.last_name.toLowerCase().trim());
      }
      
      if (lead.zip_code) {
        userData.zp = this.hashPII(lead.zip_code);
      }
      
      if (lead.ip_address) {
        userData.client_ip_address = lead.ip_address;
      }
      
      if (lead.user_agent) {
        userData.client_user_agent = lead.user_agent;
      }
      
      // Add Facebook click ID if available
      if (conversion.click_id?.startsWith('fb')) {
        userData.fbc = conversion.click_id;
      }
      
      userData.country = 'us'; // Default to US
      
      // Prepare conversion event
      const conversionEvent: FacebookConversionRequest = {
        event_name: conversion.conversion_type === 'sale' ? 'Purchase' : 'Lead',
        event_time: Math.floor(new Date(conversion.created_at || Date.now()).getTime() / 1000),
        event_id: eventId,
        user_data: userData,
        custom_data: {
          value: conversion.conversion_value,
          currency: conversion.currency,
          order_id: conversion.google_order_id // Can be used for Facebook too
        },
        action_source: 'system_generated'
      };
      
      // Prepare request payload
      const payload = {
        data: [conversionEvent]
      };
      
      if (testEventCode) {
        payload.test_event_code = testEventCode;
      }
      
      // Send to Facebook Conversions API
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${pixelId}/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
      
      const result = await response.json();
      
      if (response.ok) {
        console.log('Facebook Conversions API event sent successfully:', result);
        
        // Update conversion record with Facebook-specific data
        await this.db.prepare(`
          UPDATE conversions 
          SET facebook_pixel_id = ?, facebook_conversion_api_event_id = ?
          WHERE id = ?
        `).bind(pixelId, eventId, conversion.id).run();
        
        return true;
      } else {
        console.error('Facebook Conversions API failed:', result);
        return false;
      }
      
    } catch (error) {
      console.error('Facebook Conversions API error:', error);
      return false;
    }
  }
  
  /**
   * Process conversion for all configured platforms
   */
  async processConversion(
    leadId: number,
    conversionType: string = 'lead_qualified',
    conversionValue: number = 0,
    additionalData: Partial<Conversion> = {}
  ): Promise<Conversion> {
    // Get lead details
    const lead = await this.db.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first<Lead>();
    if (!lead) {
      throw new Error('Lead not found');
    }
    
    // Calculate time to conversion
    const timeToConversion = Math.floor(
      (Date.now() - new Date(lead.created_at || '').getTime()) / (1000 * 60 * 60)
    );
    
    // Create conversion record
    const conversion: Omit<Conversion, 'id' | 'created_at'> = {
      lead_id: leadId,
      campaign_id: lead.campaign_id,
      affiliate_id: lead.affiliate_id,
      conversion_type: conversionType,
      conversion_value: conversionValue,
      currency: 'USD',
      attribution_window_hours: 168, // 7 days
      time_to_conversion_hours: timeToConversion,
      ip_address: lead.ip_address,
      user_agent: lead.user_agent,
      ...additionalData
    };
    
    const savedConversion = await this.recordConversion(conversion);
    
    // Get configured conversion pixels for this campaign
    const pixels = await this.db.prepare(`
      SELECT * FROM conversion_pixels 
      WHERE campaign_id = ? AND status = 'active'
    `).bind(lead.campaign_id).all<ConversionPixel>();
    
    // Send conversions to configured platforms
    for (const pixel of pixels.results) {
      try {
        if (pixel.pixel_type === 'google') {
          // Get Google Ads tokens
          const googleToken = await this.getLatestToken('google_ads', 'access_token');
          if (googleToken) {
            await this.sendGoogleConversion(
              pixel.conversion_label || pixel.pixel_id,
              lead,
              savedConversion,
              googleToken.account_id || '',
              googleToken.encrypted_token // In production, decrypt this
            );
          }
        } else if (pixel.pixel_type === 'facebook') {
          // Get Facebook tokens
          const facebookToken = await this.getLatestToken('facebook', 'access_token');
          if (facebookToken) {
            await this.sendFacebookConversion(
              pixel.pixel_id,
              lead,
              savedConversion,
              facebookToken.encrypted_token // In production, decrypt this
            );
          }
        }
      } catch (error) {
        console.error(`Failed to send conversion to ${pixel.pixel_type}:`, error);
      }
    }
    
    return savedConversion;
  }
  
  /**
   * Generate conversion tracking pixels for frontend
   */
  async generateTrackingPixels(campaignId: number, leadId: number): Promise<string[]> {
    const pixels = await this.db.prepare(`
      SELECT * FROM conversion_pixels 
      WHERE campaign_id = ? AND status = 'active'
    `).bind(campaignId).all<ConversionPixel>();
    
    const pixelCode: string[] = [];
    
    for (const pixel of pixels.results) {
      if (pixel.pixel_type === 'google') {
        pixelCode.push(`
          <!-- Google Ads Conversion Tracking -->
          <script async src="https://www.googletagmanager.com/gtag/js?id=${pixel.pixel_id}"></script>
          <script>
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${pixel.pixel_id}');
            gtag('event', 'conversion', {
              'send_to': '${pixel.pixel_id}/${pixel.conversion_label}',
              'value': ${pixel.value_mapping?.default_value || 0},
              'currency': '${pixel.value_mapping?.currency || 'USD'}',
              'transaction_id': '${leadId}'
            });
          </script>
        `);
      } else if (pixel.pixel_type === 'facebook') {
        pixelCode.push(`
          <!-- Facebook Pixel -->
          <script>
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixel.pixel_id}');
            fbq('track', '${pixel.event_name}', {
              value: ${pixel.value_mapping?.default_value || 0},
              currency: '${pixel.value_mapping?.currency || 'USD'}',
              content_ids: ['${leadId}'],
              content_type: 'lead'
            });
          </script>
          <noscript>
            <img height="1" width="1" style="display:none"
                 src="https://www.facebook.com/tr?id=${pixel.pixel_id}&ev=${pixel.event_name}&noscript=1" />
          </noscript>
        `);
      }
    }
    
    return pixelCode;
  }
  
  /**
   * Hash PII data for enhanced conversions
   */
  private hashPII(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get latest platform token
   */
  private async getLatestToken(platform: string, tokenType: string) {
    return await this.db.prepare(`
      SELECT * FROM platform_tokens 
      WHERE platform = ? AND token_type = ?
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(platform, tokenType).first<any>();
  }
  
  /**
   * Get conversion analytics
   */
  async getConversionAnalytics(
    affiliateId?: number,
    campaignId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<any> {
    let query = `
      SELECT 
        conversion_type,
        source_platform,
        COUNT(*) as count,
        SUM(conversion_value) as total_value,
        AVG(conversion_value) as avg_value,
        AVG(time_to_conversion_hours) as avg_time_to_conversion,
        DATE(created_at) as date
      FROM conversions
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (affiliateId) {
      query += ' AND affiliate_id = ?';
      params.push(affiliateId);
    }
    
    if (campaignId) {
      query += ' AND campaign_id = ?';
      params.push(campaignId);
    }
    
    if (startDate) {
      query += ' AND DATE(created_at) >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND DATE(created_at) <= ?';
      params.push(endDate);
    }
    
    query += ' GROUP BY conversion_type, source_platform, DATE(created_at) ORDER BY date DESC';
    
    const result = await this.db.prepare(query).bind(...params).all();
    return result.results;
  }
}