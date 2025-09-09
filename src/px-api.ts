// PX API Direct Post Implementation
// Based on PX Direct Post specification for Health and Solar verticals

export interface PXDirectPostRequest {
  // Contact Information
  FirstName: string;
  LastName: string;
  Email: string;
  Phone: string;
  
  // Address Information
  Address?: string;
  City?: string;
  State?: string;
  ZipCode: string;
  
  // Lead Context
  Vertical: 'Health' | 'Solar' | 'Home';
  SessionLength?: number; // in seconds
  TcpaText?: string;
  
  // Tracking Information
  SubId: string;
  Source?: string;
  ClickId?: string;
  IpAddress?: string;
  UserAgent?: string;
  
  // Solar-specific fields
  Ownership?: 'Own' | 'Rent';
  Roofshade?: 'No Shade' | 'Little Shade' | 'Moderate Shade' | 'Heavy Shade';
  ElectricityBill?: string;
  
  // Health-specific fields
  DateOfBirth?: string;
  Gender?: 'Male' | 'Female';
  Height?: string;
  Weight?: string;
  
  // Additional fields as needed
  [key: string]: any;
}

export interface PXDirectPostResponse {
  Success: boolean;
  Message?: string;
  LeadId?: string;
  Price?: number;
  BuyerName?: string;
  Errors?: string[];
}

export interface PXError {
  code: string;
  message: string;
  details?: any;
}

export class PXAPIClient {
  private static readonly DIRECT_POST_URL = 'https://leadapi.px.com/api/lead/directpost';
  
  // API Tokens from environment variables (fallback to production tokens for development)
  private static readonly API_TOKEN_HEALTH = 'F9F9B3CC-85D8-4142-9007-61F784C1F098';
  private static readonly API_TOKEN_SOLAR = 'B593425D-90C7-4CB8-8952-605D8A0CCEC0';
  
  /**
   * Post lead directly to PX API using Direct Post endpoint
   */
  static async postDirectLead({
    vertical,
    token,
    subId,
    source,
    contact,
    context = {},
    extras = {},
    env
  }: {
    vertical: 'Health' | 'Solar' | 'Home';
    token?: string;
    subId: string;
    source?: string;
    contact: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      zipCode: string;
      address?: string;
      city?: string;
      state?: string;
    };
    context?: {
      sessionLength?: number;
      tcpaText?: string;
      clickId?: string;
      ipAddress?: string;
      userAgent?: string;
    };
    extras?: Record<string, any>;
    env?: any;
  }): Promise<{ response: PXDirectPostResponse | null; error: PXError | null }> {
    try {
      // Use provided token or default based on vertical
      const apiToken = token || this.getDefaultToken(vertical, env);
      
      // Build the payload
      const payload: PXDirectPostRequest = {
        // Contact Information
        FirstName: contact.firstName,
        LastName: contact.lastName,
        Email: contact.email,
        Phone: contact.phone,
        ZipCode: contact.zipCode,
        
        // Optional Address Information
        ...(contact.address && { Address: contact.address }),
        ...(contact.city && { City: contact.city }),
        ...(contact.state && { State: contact.state }),
        
        // Lead Context
        Vertical: vertical,
        SubId: subId,
        ...(source && { Source: source }),
        ...(context.sessionLength && { SessionLength: context.sessionLength }),
        ...(context.tcpaText && { TcpaText: context.tcpaText }),
        ...(context.clickId && { ClickId: context.clickId }),
        ...(context.ipAddress && { IpAddress: context.ipAddress }),
        ...(context.userAgent && { UserAgent: context.userAgent }),
        
        // Include any extra fields
        ...extras
      };
      
      console.log('Sending Direct Post request to PX:', JSON.stringify(payload, null, 2));
      
      // Add API token to payload instead of using Authorization header
      const payloadWithToken = {
        ApiToken: apiToken,
        ...payload
      };
      
      const response = await fetch(this.DIRECT_POST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payloadWithToken)
      });
      
      const responseText = await response.text();
      console.log('PX Direct Post Response Status:', response.status);
      console.log('PX Direct Post Response Body:', responseText);
      
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
      
      let directPostResponse: PXDirectPostResponse;
      try {
        directPostResponse = JSON.parse(responseText);
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
      
      return { response: directPostResponse, error: null };
      
    } catch (error) {
      console.error('Error sending Direct Post to PX:', error);
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
   * Get default API token for vertical
   */
  private static getDefaultToken(vertical: string, env?: any): string {
    switch (vertical.toLowerCase()) {
      case 'health':
        return env?.PX_API_TOKEN_HEALTH || this.API_TOKEN_HEALTH;
      case 'solar':
        return env?.PX_API_TOKEN_SOLAR || this.API_TOKEN_SOLAR;
      default:
        throw new Error(`No default token configured for vertical: ${vertical}`);
    }
  }
  
  /**
   * Convenience method for Health vertical
   */
  static async postHealthLead({
    subId,
    source,
    contact,
    context = {},
    healthData = {},
    env
  }: {
    subId: string;
    source?: string;
    contact: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      zipCode: string;
      address?: string;
      city?: string;
      state?: string;
    };
    context?: {
      sessionLength?: number;
      tcpaText?: string;
      clickId?: string;
      ipAddress?: string;
      userAgent?: string;
    };
    healthData?: {
      dateOfBirth?: string;
      gender?: 'Male' | 'Female';
      height?: string;
      weight?: string;
      [key: string]: any;
    };
    env?: any;
  }) {
    return this.postDirectLead({
      vertical: 'Health',
      subId,
      source,
      contact,
      context,
      extras: {
        ...(healthData.dateOfBirth && { DateOfBirth: healthData.dateOfBirth }),
        ...(healthData.gender && { Gender: healthData.gender }),
        ...(healthData.height && { Height: healthData.height }),
        ...(healthData.weight && { Weight: healthData.weight }),
        ...healthData
      },
      env
    });
  }
  
  /**
   * Convenience method for Solar vertical
   */
  static async postSolarLead({
    subId,
    source,
    contact,
    context = {},
    solarData = {},
    env
  }: {
    subId: string;
    source?: string;
    contact: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      zipCode: string;
      address?: string;
      city?: string;
      state?: string;
    };
    context?: {
      sessionLength?: number;
      tcpaText?: string;
      clickId?: string;
      ipAddress?: string;
      userAgent?: string;
    };
    solarData?: {
      ownership?: 'Own' | 'Rent';
      roofshade?: 'No Shade' | 'Little Shade' | 'Moderate Shade' | 'Heavy Shade';
      electricityBill?: string;
      [key: string]: any;
    };
    env?: any;
  }) {
    return this.postDirectLead({
      vertical: 'Solar',
      subId,
      source,
      contact,
      context,
      extras: {
        ...(solarData.ownership && { Ownership: solarData.ownership }),
        ...(solarData.roofshade && { Roofshade: solarData.roofshade }),
        ...(solarData.electricityBill && { ElectricityBill: solarData.electricityBill }),
        ...solarData
      },
      env
    });
  }
  
  /**
   * Legacy method - use postDirectLead instead
   * @deprecated Use postDirectLead, postHealthLead, or postSolarLead instead
   */
  static async processLead(
    vertical: 'Health' | 'Solar' | 'Home',
    subId: string,
    contactData: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      zipCode: string;
      ownership?: string;
      roofshade?: string;
      electricityBill?: string;
    },
    context?: {
      source?: string;
      clickId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<{
    response: PXDirectPostResponse | null;
    error: PXError | null;
  }> {
    // Convert legacy format to new Direct Post format
    const contact = {
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      email: contactData.email,
      phone: contactData.phone,
      zipCode: contactData.zipCode
    };
    
    const extras: Record<string, any> = {};
    if (contactData.ownership) extras.Ownership = contactData.ownership;
    if (contactData.roofshade) extras.Roofshade = contactData.roofshade;
    if (contactData.electricityBill) extras.ElectricityBill = contactData.electricityBill;
    
    return this.postDirectLead({
      vertical,
      subId,
      source: context?.source,
      contact,
      context: {
        clickId: context?.clickId,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent
      },
      extras
    });
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
   * Updated mapping based on PX SubId strategy (≤20 total per account)
   */
  static generateSubId(trafficType: string, campaignNumber?: number): string {
    const typeMap: Record<string, string[]> = {
      'Email': ['EM01', 'EM02'],
      'Facebook': ['FB01'],
      'Instagram': ['IG01'],
      'TikTok': ['TT01'],
      'Twitter': ['TW01'],
      'Taboola': ['TB01'],
      'Outbrain': ['OB01'],
      'Google': ['GG01'],
      'Search': ['GG01'],
      'Social': ['FB01', 'IG01', 'TT01', 'TW01'],
      'Native': ['TB01', 'OB01']
    };
    
    const options = typeMap[trafficType];
    if (options) {
      const index = (campaignNumber || 1) - 1;
      return options[Math.min(index, options.length - 1)];
    }
    
    // Fallback for unknown traffic types
    const prefix = trafficType.substring(0, 2).toUpperCase();
    const suffix = (campaignNumber || 1).toString().padStart(2, '0');
    return `${prefix}${suffix}`;
  }
  
  /**
   * Get all available SubIds for a traffic type
   */
  static getAvailableSubIds(trafficType: string): string[] {
    const typeMap: Record<string, string[]> = {
      'Email': ['EM01', 'EM02'],
      'Facebook': ['FB01'],
      'Instagram': ['IG01'],
      'TikTok': ['TT01'],
      'Twitter': ['TW01'],
      'Taboola': ['TB01'],
      'Outbrain': ['OB01'],
      'Google': ['GG01'],
      'Search': ['GG01'],
      'Social': ['FB01', 'IG01', 'TT01', 'TW01'],
      'Native': ['TB01', 'OB01']
    };
    
    return typeMap[trafficType] || [];
  }
  
  /**
   * Get all SubId mappings
   */
  static getAllSubIdMappings(): Record<string, string[]> {
    return {
      'Email': ['EM01', 'EM02'],
      'Facebook': ['FB01'],
      'Instagram': ['IG01'], 
      'TikTok': ['TT01'],
      'Twitter': ['TW01'],
      'Taboola': ['TB01'],
      'Outbrain': ['OB01'],
      'Google': ['GG01'],
      'Search': ['GG01'],
      'Social': ['FB01', 'IG01', 'TT01', 'TW01'],
      'Native': ['TB01', 'OB01']
    };
  }
}