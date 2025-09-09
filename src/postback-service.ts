import { PostbackUrl, PostbackLog, PostbackVariables, Lead, Conversion } from './types';

export class PostbackService {
  private db: D1Database;
  
  constructor(db: D1Database) {
    this.db = db;
  }
  
  /**
   * Create a new postback URL configuration
   */
  async createPostbackUrl(postback: Omit<PostbackUrl, 'id' | 'created_at' | 'updated_at'>): Promise<PostbackUrl> {
    const result = await this.db.prepare(`
      INSERT INTO postback_urls (
        affiliate_id, campaign_id, name, url_template, trigger_events, 
        http_method, headers, payload_template, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      postback.affiliate_id,
      postback.campaign_id || null,
      postback.name,
      postback.url_template,
      JSON.stringify(postback.trigger_events),
      postback.http_method,
      postback.headers ? JSON.stringify(postback.headers) : null,
      postback.payload_template || null,
      postback.status
    ).first<PostbackUrl>();
    
    if (!result) {
      throw new Error('Failed to create postback URL');
    }
    
    return result;
  }
  
  /**
   * Get postback URLs for a specific affiliate/campaign
   */
  async getPostbackUrls(affiliateId: number, campaignId?: number): Promise<PostbackUrl[]> {
    let query = 'SELECT * FROM postback_urls WHERE affiliate_id = ?';
    const params: any[] = [affiliateId];
    
    if (campaignId) {
      query += ' AND (campaign_id = ? OR campaign_id IS NULL)';
      params.push(campaignId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await this.db.prepare(query).bind(...params).all<PostbackUrl>();
    
    return result.results.map(url => ({
      ...url,
      trigger_events: JSON.parse(url.trigger_events as any),
      headers: url.headers ? JSON.parse(url.headers as any) : undefined
    }));
  }
  
  /**
   * Trigger postbacks for a specific event
   */
  async triggerPostbacks(
    leadId: number,
    eventType: string,
    additionalVariables: Partial<PostbackVariables> = {}
  ): Promise<void> {
    // Get lead details
    const lead = await this.db.prepare('SELECT * FROM leads WHERE id = ?').bind(leadId).first<Lead>();
    if (!lead) {
      console.error('Lead not found for postback:', leadId);
      return;
    }
    
    // Get campaign and affiliate details
    const campaign = await this.db.prepare('SELECT * FROM campaigns WHERE id = ?').bind(lead.campaign_id).first();
    const affiliate = await this.db.prepare('SELECT * FROM affiliates WHERE id = ?').bind(lead.affiliate_id).first();
    
    if (!campaign || !affiliate) {
      console.error('Campaign or affiliate not found for lead:', leadId);
      return;
    }
    
    // Get applicable postback URLs
    const postbackUrls = await this.getPostbackUrls(lead.affiliate_id, lead.campaign_id);
    const applicableUrls = postbackUrls.filter(url => 
      url.status === 'active' && url.trigger_events.includes(eventType)
    );
    
    if (applicableUrls.length === 0) {
      console.log(`No postback URLs configured for event ${eventType} on lead ${leadId}`);
      return;
    }
    
    // Prepare variables for URL template substitution
    const variables: PostbackVariables = {
      lead_id: lead.id!.toString(),
      lead_uuid: lead.lead_uuid,
      campaign_id: lead.campaign_id.toString(),
      affiliate_id: lead.affiliate_id.toString(),
      click_id: lead.utm_source || '',
      status: eventType,
      timestamp: new Date().toISOString(),
      ...additionalVariables
    };
    
    // Send postbacks
    for (const postbackUrl of applicableUrls) {
      await this.sendPostback(postbackUrl, leadId, eventType, variables);
    }
  }
  
  /**
   * Send individual postback request
   */
  private async sendPostback(
    postbackUrl: PostbackUrl,
    leadId: number,
    eventType: string,
    variables: PostbackVariables
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Replace variables in URL template
      const requestUrl = this.replaceVariables(postbackUrl.url_template, variables);
      
      // Prepare headers
      const headers: Record<string, string> = {
        'User-Agent': 'AffiliateTracker/1.0',
        'Content-Type': 'application/json',
        ...postbackUrl.headers
      };
      
      // Prepare request options
      const requestOptions: RequestInit = {
        method: postbackUrl.http_method,
        headers
      };
      
      // Add payload for POST requests
      let requestPayload = null;
      if (postbackUrl.http_method === 'POST' && postbackUrl.payload_template) {
        requestPayload = this.replaceVariables(postbackUrl.payload_template, variables);
        requestOptions.body = requestPayload;
      }
      
      console.log(`Sending ${postbackUrl.http_method} postback to: ${requestUrl}`);
      
      // Send request
      const response = await fetch(requestUrl, requestOptions);
      const responseBody = await response.text();
      const responseTime = Date.now() - startTime;
      
      // Log postback request
      await this.logPostback({
        postback_url_id: postbackUrl.id!,
        lead_id: leadId,
        event_type: eventType,
        request_url: requestUrl,
        request_method: postbackUrl.http_method,
        request_headers: headers,
        request_payload: requestPayload,
        response_status: response.status,
        response_body: responseBody.substring(0, 1000), // Limit response body size
        response_time_ms: responseTime,
        success: response.ok,
        error_message: !response.ok ? `HTTP ${response.status}: ${response.statusText}` : undefined,
        retry_count: 0
      });
      
      if (response.ok) {
        console.log(`Postback successful: ${postbackUrl.name} (${responseTime}ms)`);
      } else {
        console.error(`Postback failed: ${postbackUrl.name} - ${response.status} ${response.statusText}`);
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(`Postback error: ${postbackUrl.name} - ${errorMessage}`);
      
      // Log failed postback
      await this.logPostback({
        postback_url_id: postbackUrl.id!,
        lead_id: leadId,
        event_type: eventType,
        request_url: postbackUrl.url_template,
        request_method: postbackUrl.http_method,
        request_headers: postbackUrl.headers,
        response_time_ms: responseTime,
        success: false,
        error_message: errorMessage,
        retry_count: 0
      });
    }
  }
  
  /**
   * Replace variables in template strings
   */
  private replaceVariables(template: string, variables: PostbackVariables): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 
                             encodeURIComponent(value || ''));
    }
    
    return result;
  }
  
  /**
   * Log postback request details
   */
  private async logPostback(log: Omit<PostbackLog, 'id' | 'created_at'>): Promise<void> {
    try {
      await this.db.prepare(`
        INSERT INTO postback_logs (
          postback_url_id, lead_id, event_type, request_url, request_method,
          request_headers, request_payload, response_status, response_body,
          response_time_ms, success, error_message, retry_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        log.postback_url_id,
        log.lead_id,
        log.event_type,
        log.request_url,
        log.request_method,
        log.request_headers ? JSON.stringify(log.request_headers) : null,
        log.request_payload,
        log.response_status || null,
        log.response_body || null,
        log.response_time_ms,
        log.success ? 1 : 0,
        log.error_message || null,
        log.retry_count
      ).run();
    } catch (error) {
      console.error('Failed to log postback:', error);
    }
  }
  
  /**
   * Get postback logs for monitoring
   */
  async getPostbackLogs(
    affiliateId?: number,
    campaignId?: number,
    limit: number = 50
  ): Promise<PostbackLog[]> {
    let query = `
      SELECT pl.*, pu.name as postback_name, pu.affiliate_id, pu.campaign_id
      FROM postback_logs pl
      JOIN postback_urls pu ON pl.postback_url_id = pu.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (affiliateId) {
      query += ' AND pu.affiliate_id = ?';
      params.push(affiliateId);
    }
    
    if (campaignId) {
      query += ' AND pu.campaign_id = ?';
      params.push(campaignId);
    }
    
    query += ' ORDER BY pl.created_at DESC LIMIT ?';
    params.push(limit);
    
    const result = await this.db.prepare(query).bind(...params).all<any>();
    
    return result.results.map(log => ({
      ...log,
      request_headers: log.request_headers ? JSON.parse(log.request_headers) : undefined
    }));
  }
  
  /**
   * Retry failed postbacks
   */
  async retryFailedPostbacks(maxRetries: number = 3): Promise<void> {
    const failedLogs = await this.db.prepare(`
      SELECT pl.*, pu.*, l.id as lead_id
      FROM postback_logs pl
      JOIN postback_urls pu ON pl.postback_url_id = pu.id
      JOIN leads l ON pl.lead_id = l.id
      WHERE pl.success = 0 AND pl.retry_count < ? AND pl.created_at > datetime('now', '-24 hours')
      ORDER BY pl.created_at DESC
      LIMIT 100
    `).bind(maxRetries).all<any>();
    
    for (const log of failedLogs.results) {
      // Extract variables from original request
      const variables: PostbackVariables = {
        lead_id: log.lead_id.toString(),
        lead_uuid: log.lead_uuid || '',
        campaign_id: log.campaign_id?.toString() || '',
        affiliate_id: log.affiliate_id.toString(),
        status: log.event_type,
        timestamp: new Date().toISOString()
      };
      
      // Retry the postback
      await this.sendPostback({
        id: log.postback_url_id,
        affiliate_id: log.affiliate_id,
        campaign_id: log.campaign_id,
        name: log.name,
        url_template: log.url_template,
        trigger_events: JSON.parse(log.trigger_events),
        http_method: log.http_method,
        headers: log.headers ? JSON.parse(log.headers) : undefined,
        payload_template: log.payload_template,
        status: log.status
      }, log.lead_id, log.event_type, variables);
      
      // Update retry count
      await this.db.prepare('UPDATE postback_logs SET retry_count = retry_count + 1 WHERE id = ?')
        .bind(log.id).run();
    }
  }
}