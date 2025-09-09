import { Bindings, Lead, Campaign, Affiliate, AnalyticsData, DashboardStats } from './types';

export class Database {
  constructor(private db: D1Database) {}
  
  // Affiliate methods
  async createAffiliate(affiliate: Omit<Affiliate, 'id' | 'created_at' | 'updated_at'>): Promise<Affiliate> {
    const result = await this.db.prepare(`
      INSERT INTO affiliates (name, email, api_key, status)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `).bind(affiliate.name, affiliate.email, affiliate.api_key, affiliate.status).first<Affiliate>();
    
    if (!result) {
      throw new Error('Failed to create affiliate');
    }
    return result;
  }
  
  async getAffiliate(id: number): Promise<Affiliate | null> {
    return await this.db.prepare('SELECT * FROM affiliates WHERE id = ?').bind(id).first<Affiliate>();
  }
  
  async getAffiliateByApiKey(apiKey: string): Promise<Affiliate | null> {
    return await this.db.prepare('SELECT * FROM affiliates WHERE api_key = ?').bind(apiKey).first<Affiliate>();
  }
  
  async getAllAffiliates(): Promise<Affiliate[]> {
    const result = await this.db.prepare('SELECT * FROM affiliates ORDER BY created_at DESC').all<Affiliate>();
    return result.results;
  }
  
  async updateAffiliate(id: number, updates: Partial<Affiliate>): Promise<Affiliate | null> {
    // Add updated_at to the updates
    const updatesWithTimestamp = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    const setClause = Object.keys(updatesWithTimestamp).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updatesWithTimestamp);
    
    const result = await this.db.prepare(`
      UPDATE affiliates SET ${setClause} WHERE id = ?
      RETURNING *
    `).bind(...values, id).first<Affiliate>();
    
    return result || null;
  }
  
  // Campaign methods
  async createCampaign(campaign: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>): Promise<Campaign> {
    const result = await this.db.prepare(`
      INSERT INTO campaigns (affiliate_id, name, description, offer_id, sub_id, traffic_type, payout_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      campaign.affiliate_id, campaign.name, campaign.description, 
      campaign.offer_id, campaign.sub_id, campaign.traffic_type, 
      campaign.payout_amount, campaign.status
    ).first<Campaign>();
    
    if (!result) {
      throw new Error('Failed to create campaign');
    }
    return result;
  }
  
  async getCampaign(id: number): Promise<Campaign | null> {
    return await this.db.prepare('SELECT * FROM campaigns WHERE id = ?').bind(id).first<Campaign>();
  }
  
  async getCampaignsByAffiliate(affiliateId: number): Promise<Campaign[]> {
    const result = await this.db.prepare('SELECT * FROM campaigns WHERE affiliate_id = ? ORDER BY created_at DESC')
      .bind(affiliateId).all<Campaign>();
    return result.results;
  }
  
  async getAllCampaigns(): Promise<Campaign[]> {
    const result = await this.db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all<Campaign>();
    return result.results;
  }
  
  // Lead methods
  async createLead(lead: Omit<Lead, 'id' | 'created_at'>): Promise<Lead> {
    const result = await this.db.prepare(`
      INSERT INTO leads (
        campaign_id, affiliate_id, lead_uuid, px_lead_id, first_name, last_name, 
        email, phone_number, zip_code, ownership, roof_shade, electricity_bill,
        ip_address, user_agent, referrer, utm_source, utm_medium, utm_campaign, 
        utm_term, utm_content, ping_status, post_status, ping_response, post_response
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      lead.campaign_id, lead.affiliate_id, lead.lead_uuid, lead.px_lead_id || null,
      lead.first_name, lead.last_name, lead.email || null, lead.phone_number, lead.zip_code,
      lead.ownership || null, lead.roof_shade || null, lead.electricity_bill || null, lead.ip_address || null,
      lead.user_agent || null, lead.referrer || null, lead.utm_source || null, lead.utm_medium || null, 
      lead.utm_campaign || null, lead.utm_term || null, lead.utm_content || null, lead.ping_status || 'pending',
      lead.post_status || 'pending', lead.ping_response || null, lead.post_response || null
    ).first<Lead>();
    
    if (!result) {
      throw new Error('Failed to create lead');
    }
    return result;
  }
  
  async updateLeadStatus(id: number, updates: Partial<Pick<Lead, 'ping_status' | 'post_status' | 'px_lead_id' | 'ping_response' | 'post_response' | 'ping_sent_at' | 'post_sent_at'>>): Promise<void> {
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    await this.db.prepare(`UPDATE leads SET ${setClause} WHERE id = ?`)
      .bind(...values, id).run();
  }
  
  async getLead(id: number): Promise<Lead | null> {
    return await this.db.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first<Lead>();
  }
  
  async getLeadsByAffiliate(affiliateId: number, limit: number = 100): Promise<Lead[]> {
    const result = await this.db.prepare('SELECT * FROM leads WHERE affiliate_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(affiliateId, limit).all<Lead>();
    return result.results;
  }
  
  async getLeadsByCampaign(campaignId: number, limit: number = 100): Promise<Lead[]> {
    const result = await this.db.prepare('SELECT * FROM leads WHERE campaign_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(campaignId, limit).all<Lead>();
    return result.results;
  }
  
  // Lead events
  async logLeadEvent(leadId: number, eventType: string, eventData: any): Promise<void> {
    await this.db.prepare(`
      INSERT INTO lead_events (lead_id, event_type, event_data)
      VALUES (?, ?, ?)
    `).bind(leadId, eventType, JSON.stringify(eventData)).run();
  }
  
  // Analytics methods
  async getDashboardStats(affiliateId?: number, campaignId?: number): Promise<DashboardStats> {
    let whereClause = '1=1';
    const bindValues: any[] = [];
    
    if (affiliateId) {
      whereClause += ' AND affiliate_id = ?';
      bindValues.push(affiliateId);
    }
    
    if (campaignId) {
      whereClause += ' AND campaign_id = ?';
      bindValues.push(campaignId);
    }
    
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_leads,
        SUM(CASE WHEN ping_status = 'accepted' THEN 1 ELSE 0 END) as accepted_leads,
        SUM(CASE WHEN post_status = 'posted' THEN 1 ELSE 0 END) as successful_posts,
        0 as total_revenue
      FROM leads 
      WHERE ${whereClause}
    `).bind(...bindValues).first<any>();
    
    if (!result) {
      return {
        total_leads: 0,
        accepted_leads: 0,
        successful_posts: 0,
        total_revenue: 0,
        conversion_rate: 0,
        acceptance_rate: 0,
        success_rate: 0
      };
    }
    
    const total_leads = result.total_leads || 0;
    const accepted_leads = result.accepted_leads || 0;
    const successful_posts = result.successful_posts || 0;
    
    return {
      total_leads,
      accepted_leads,
      successful_posts,
      total_revenue: 0, // Calculate from campaigns and successful posts
      conversion_rate: total_leads > 0 ? (successful_posts / total_leads) * 100 : 0,
      acceptance_rate: total_leads > 0 ? (accepted_leads / total_leads) * 100 : 0,
      success_rate: accepted_leads > 0 ? (successful_posts / accepted_leads) * 100 : 0
    };
  }
  
  async getAnalyticsByDateRange(
    startDate: string, 
    endDate: string, 
    affiliateId?: number
  ): Promise<AnalyticsData[]> {
    let whereClause = 'DATE(created_at) BETWEEN ? AND ?';
    const bindValues: any[] = [startDate, endDate];
    
    if (affiliateId) {
      whereClause += ' AND affiliate_id = ?';
      bindValues.push(affiliateId);
    }
    
    const result = await this.db.prepare(`
      SELECT 
        DATE(created_at) as date,
        affiliate_id,
        campaign_id,
        COUNT(*) as leads_generated,
        SUM(CASE WHEN ping_status = 'pending' OR ping_status = 'accepted' OR ping_status = 'rejected' THEN 1 ELSE 0 END) as pings_sent,
        SUM(CASE WHEN ping_status = 'accepted' THEN 1 ELSE 0 END) as pings_accepted,
        SUM(CASE WHEN post_status = 'pending' OR post_status = 'posted' OR post_status = 'failed' THEN 1 ELSE 0 END) as posts_sent,
        SUM(CASE WHEN post_status = 'posted' THEN 1 ELSE 0 END) as posts_successful,
        0 as total_payout
      FROM leads
      WHERE ${whereClause}
      GROUP BY DATE(created_at), affiliate_id, campaign_id
      ORDER BY date DESC
    `).bind(...bindValues).all<any>();
    
    return result.results.map(row => ({
      ...row,
      traffic_type: 'Mixed' // Would need join with campaigns to get actual traffic type
    }));
  }
  
  // API logging
  async logApiCall(
    leadId: number | null,
    requestType: string,
    endpoint: string,
    requestData: any,
    responseData: any,
    statusCode: number,
    responseTimeMs: number,
    errorMessage?: string
  ): Promise<void> {
    await this.db.prepare(`
      INSERT INTO api_logs (lead_id, request_type, endpoint, request_data, response_data, status_code, response_time_ms, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      leadId, requestType, endpoint, 
      JSON.stringify(requestData), 
      JSON.stringify(responseData),
      statusCode, responseTimeMs, errorMessage
    ).run();
  }
  
  // Tracking methods
  async logTrackingLink(trackingData: {
    click_id: string;
    campaign_id: number;
    sub_id: string;
    landing_url: string;
    tracking_url: string;
    created_at: string;
  }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO tracking_links (click_id, campaign_id, sub_id, landing_url, tracking_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      trackingData.click_id,
      trackingData.campaign_id,
      trackingData.sub_id,
      trackingData.landing_url,
      trackingData.tracking_url,
      trackingData.created_at
    ).run();
  }

  async logClick(clickData: {
    click_id: string;
    campaign_id: number;
    sub_id: string;
    landing_url: string;
    ip_address: string;
    user_agent: string;
    referrer: string;
    clicked_at: string;
  }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO clicks (click_id, campaign_id, sub_id, landing_url, ip_address, user_agent, referrer, clicked_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      clickData.click_id,
      clickData.campaign_id,
      clickData.sub_id,
      clickData.landing_url,
      clickData.ip_address,
      clickData.user_agent,
      clickData.referrer,
      clickData.clicked_at
    ).run();
  }

  // Campaign postback parameters methods
  async createCampaignPostbackParam(param: {
    campaign_id: number;
    parameter_name: string;
    parameter_value: string;
    description?: string | null;
  }): Promise<any> {
    const result = await this.db.prepare(`
      INSERT INTO campaign_postback_params (campaign_id, parameter_name, parameter_value, description)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `).bind(
      param.campaign_id,
      param.parameter_name,
      param.parameter_value,
      param.description || null
    ).first();
    
    if (!result) {
      throw new Error('Failed to create campaign postback parameter');
    }
    return result;
  }

  async getCampaignPostbackParams(campaignId: number): Promise<any[]> {
    const result = await this.db.prepare(`
      SELECT * FROM campaign_postback_params 
      WHERE campaign_id = ? 
      ORDER BY created_at DESC
    `).bind(campaignId).all();
    
    return result.results;
  }

  async updateCampaignPostbackParam(paramId: number, updates: any): Promise<any | null> {
    const updatesWithTimestamp = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    const setClause = Object.keys(updatesWithTimestamp).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updatesWithTimestamp);
    
    const result = await this.db.prepare(`
      UPDATE campaign_postback_params SET ${setClause} WHERE id = ?
      RETURNING *
    `).bind(...values, paramId).first();
    
    return result || null;
  }

  async deleteCampaignPostbackParam(paramId: number): Promise<boolean> {
    const result = await this.db.prepare(`
      DELETE FROM campaign_postback_params WHERE id = ?
    `).bind(paramId).run();
    
    return result.changes > 0;
  }

  // Utility methods
  async getRecentActivity(limit: number = 50): Promise<any[]> {
    const result = await this.db.prepare(`
      SELECT 
        'lead' as type,
        l.id,
        l.first_name || ' ' || l.last_name as name,
        l.ping_status,
        l.post_status,
        l.created_at,
        c.name as campaign_name,
        a.name as affiliate_name
      FROM leads l
      JOIN campaigns c ON l.campaign_id = c.id
      JOIN affiliates a ON l.affiliate_id = a.id
      ORDER BY l.created_at DESC
      LIMIT ?
    `).bind(limit).all();
    
    return result.results;
  }
}