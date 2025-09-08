import { PXPingRequest, PXPingResponse, PXPostRequest, PXPostResponse, PXError } from './types';

export class PXAPIClient {
  private static readonly PING_URL = 'https://leadapi.px.com/api/call/ping';
  private static readonly POST_URL = 'https://leadapi.px.com/api/call/post';
  private static readonly TEST_OFFER_ID = '122';
  private static readonly TEST_DID = '+18576880648';
  
  /**
   * Send a ping request to PX API
   */
  static async sendPing(request: PXPingRequest): Promise<{ response: PXPingResponse | null, error: PXError | null }> {
    try {
      console.log('Sending ping request to PX:', JSON.stringify(request, null, 2));
      
      const response = await fetch(this.PING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request)
      });
      
      const responseText = await response.text();
      console.log('PX Ping Response Status:', response.status);
      console.log('PX Ping Response Body:', responseText);
      
      if (!response.ok) {
        return {
          response: null,
          error: {
            code: 'HTTP_ERROR',
            message: `HTTP ${response.status}: ${response.statusText}`,
            details: responseText
          }
        };
      }
      
      let pingResponse: PXPingResponse;
      try {
        pingResponse = JSON.parse(responseText);
      } catch (e) {
        return {
          response: null,
          error: {
            code: 'PARSE_ERROR',
            message: 'Failed to parse PX response',
            details: responseText
          }
        };
      }
      
      return { response: pingResponse, error: null };
      
    } catch (error) {
      console.error('Error sending ping to PX:', error);
      return {
        response: null,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown network error',
          details: error
        }
      };
    }
  }
  
  /**
   * Send a post request to PX API
   */
  static async sendPost(request: PXPostRequest): Promise<{ response: PXPostResponse | null, error: PXError | null }> {
    try {
      console.log('Sending post request to PX:', JSON.stringify(request, null, 2));
      
      const response = await fetch(this.POST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request)
      });
      
      const responseText = await response.text();
      console.log('PX Post Response Status:', response.status);
      console.log('PX Post Response Body:', responseText);
      
      if (!response.ok) {
        return {
          response: null,
          error: {
            code: 'HTTP_ERROR',
            message: `HTTP ${response.status}: ${response.statusText}`,
            details: responseText
          }
        };
      }
      
      let postResponse: PXPostResponse;
      try {
        postResponse = JSON.parse(responseText);
      } catch (e) {
        return {
          response: null,
          error: {
            code: 'PARSE_ERROR',
            message: 'Failed to parse PX response',
            details: responseText
          }
        };
      }
      
      return { response: postResponse, error: null };
      
    } catch (error) {
      console.error('Error sending post to PX:', error);
      return {
        response: null,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown network error',
          details: error
        }
      };
    }
  }
  
  /**
   * Process a complete ping-post flow
   */
  static async processLead(
    apiToken: string,
    offerId: string,
    subId: string,
    contactData: PXPingRequest['ContactData'],
    did?: string
  ): Promise<{
    pingResponse: PXPingResponse | null;
    postResponse: PXPostResponse | null;
    errors: PXError[];
  }> {
    const errors: PXError[] = [];
    let pingResponse: PXPingResponse | null = null;
    let postResponse: PXPostResponse | null = null;
    
    // Prepare ping request
    const pingRequest: PXPingRequest = {
      ApiToken: apiToken,
      OfferId: offerId || this.TEST_OFFER_ID,
      DID: did || this.TEST_DID,
      SubId: subId,
      ContactData: contactData
    };
    
    // Send ping
    const pingResult = await this.sendPing(pingRequest);
    if (pingResult.error) {
      errors.push(pingResult.error);
      return { pingResponse, postResponse, errors };
    }
    
    pingResponse = pingResult.response!;
    
    // Check if ping was accepted
    if (pingResponse.Status !== 'BaeOK') {
      errors.push({
        code: 'PING_REJECTED',
        message: pingResponse.Message || 'Ping was rejected',
        details: pingResponse
      });
      return { pingResponse, postResponse, errors };
    }
    
    // If ping accepted, send post within 15 seconds
    const postRequest: PXPostRequest = {
      ...pingRequest
    };
    
    const postResult = await this.sendPost(postRequest);
    if (postResult.error) {
      errors.push(postResult.error);
      return { pingResponse, postResponse, errors };
    }
    
    postResponse = postResult.response!;
    
    return { pingResponse, postResponse, errors };
  }
  
  /**
   * Validate PX API token format
   */
  static validateApiToken(token: string): boolean {
    // Basic validation - you may want to make this more specific
    return typeof token === 'string' && token.length > 10;
  }
  
  /**
   * Validate SubId format according to PX requirements
   */
  static validateSubId(subId: string): { valid: boolean; error?: string } {
    if (!subId || typeof subId !== 'string') {
      return { valid: false, error: 'SubId is required' };
    }
    
    if (subId.length > 20) {
      return { valid: false, error: 'SubId must be 20 characters or less' };
    }
    
    // Check for special characters
    if (/[;\\\/\'\",]/.test(subId)) {
      return { valid: false, error: 'SubId cannot contain special characters (;, \\, /, \', ", ,)' };
    }
    
    return { valid: true };
  }
  
  /**
   * Generate a valid SubId from traffic type and campaign number
   */
  static generateSubId(trafficType: string, campaignNumber?: number): string {
    const typeMap: Record<string, string> = {
      'Facebook': 'FB',
      'Google': 'GG',
      'Taboola': 'TB',
      'Email': 'EM',
      'Search': 'SE',
      'Social': 'SO'
    };
    
    const prefix = typeMap[trafficType] || trafficType.substring(0, 2).toUpperCase();
    const suffix = campaignNumber ? campaignNumber.toString() : '1';
    
    return `${prefix}${suffix}`;
  }
}