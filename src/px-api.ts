// PX API Direct Post Implementation
// Based on PX Direct Post specification for Health and Solar verticals

export interface PXDirectPostRequest {
  // Required API Token
  ApiToken: string;
  
  // Contact Information (exact PX field names)
  FirstName: string;
  LastName: string;
  EmailAddress: string;  // PX uses EmailAddress, not Email
  PhoneNumber: string;   // PX uses PhoneNumber, not Phone
  
  // Address Information
  Address?: string;
  City?: string;
  State?: string;
  ZipCode: string;
  
  // Lead Context (required by PX)
  Vertical: 'Health' | 'Solar' | 'Home';
  SubId: string;
  Source?: string;
  OriginalUrl?: string;  // PX expects this field
  
  // Session Information
  SessionLength?: number; // in seconds
  TcpaText?: string;
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
      
      // Build the payload using exact PX field names
      const payload: PXDirectPostRequest = {
        // Contact Information (exact PX field names)
        FirstName: contact.firstName,
        LastName: contact.lastName,
        EmailAddress: contact.email,  // PX uses EmailAddress, not Email
        PhoneNumber: contact.phone,   // PX uses PhoneNumber, not Phone
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
        
        // Add OriginalUrl if not present (PX seems to expect this)
        OriginalUrl: context.clickId ? `https://example.com/landing?id=${context.clickId}` : 'https://example.com/solar',
        
        // Include any extra fields
        ...extras
      };
      
      // Add API token to payload
      const payloadWithToken = {
        ApiToken: apiToken,
        ...payload
      };
      
      console.log('=== PX DIRECT POST DEBUG ===');
      console.log('URL:', this.DIRECT_POST_URL);
      console.log('API Token:', apiToken.substring(0, 8) + '...');
      console.log('Headers:', { 'Content-Type': 'application/json', 'Accept': 'application/json' });
      console.log('Payload size:', JSON.stringify(payloadWithToken).length, 'bytes');
      console.log('Full payload:', JSON.stringify(payloadWithToken, null, 2));
      console.log('Raw JSON (first 300 chars):', JSON.stringify(payloadWithToken).substring(0, 300));
      
      // Convert payload to XML format (PX API expects XML, not JSON!)
      const xmlPayload = this.buildXmlPayload(payloadWithToken);
      
      console.log('XML Payload:', xmlPayload);
      
      const response = await fetch(this.DIRECT_POST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Accept': 'application/xml'
        },
        body: xmlPayload
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
        // Parse XML response to JSON
        directPostResponse = this.parseXmlResponse(responseText);
      } catch (e) {
        return {
          response: null,
          error: {
            code: 'PARSE_ERROR',
            message: 'Failed to parse PX XML response',
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
   * Parse XML response from PX API to JSON format
   */
  private static parseXmlResponse(xmlText: string): PXDirectPostResponse {
    // Simple XML parsing for PX response structure
    const success = /<Success>(.*?)<\/Success>/.exec(xmlText)?.[1] === 'true';
    const message = /<Message>(.*?)<\/Message>/.exec(xmlText)?.[1] || '';
    const leadId = /<LeadId.*?>(.*?)<\/LeadId>/.exec(xmlText)?.[1] || undefined;
    const payout = /<Payout.*?>(.*?)<\/Payout>/.exec(xmlText)?.[1];
    const buyerName = /<BuyerName.*?>(.*?)<\/BuyerName>/.exec(xmlText)?.[1] || undefined;
    
    // Extract errors
    const errors: string[] = [];
    const errorMatches = xmlText.match(/<string>(.*?)<\/string>/g);
    if (errorMatches) {
      errorMatches.forEach(match => {
        const error = /<string>(.*?)<\/string>/.exec(match)?.[1];
        if (error) errors.push(error);
      });
    }
    
    return {
      Success: success,
      Message: message,
      LeadId: leadId,
      Price: payout ? parseFloat(payout) : undefined,
      BuyerName: buyerName,
      Errors: errors.length > 0 ? errors : undefined
    };
  }
  
  /**
   * Build XML payload for PX Direct Post API
   */
  private static buildXmlPayload(payload: any): string {
    // Helper to escape XML content
    const escapeXml = (str: string | undefined): string => {
      if (!str) return '';
      return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    
    // Convert state to valid US state code
    const getValidState = (state: string): string => {
      const stateMap: Record<string, string> = {
        'TS': 'TX', 'Hyderabad': 'CA', 'India': 'CA'
      };
      return stateMap[state] || (state && state.length === 2 ? state : 'CA');
    };
    
    // Build Contact Data section
    const contactData = `
      <ContactData>
        <FirstName>${escapeXml(payload.FirstName)}</FirstName>
        <LastName>${escapeXml(payload.LastName)}</LastName>
        <EmailAddress>${escapeXml(payload.EmailAddress)}</EmailAddress>
        <PhoneNumber>${escapeXml(payload.PhoneNumber)}</PhoneNumber>
        <Address>${escapeXml(payload.Address || '123 Main St')}</Address>
        <City>${escapeXml(payload.City || 'Los Angeles')}</City>
        <State>${getValidState(payload.State)}</State>
        <ZipCode>${escapeXml(payload.ZipCode)}</ZipCode>
        <Ownership>${escapeXml(payload.Ownership || 'Own')}</Ownership>
        <Roofshade>${escapeXml(this.mapRoofShade(payload.Roofshade))}</Roofshade>
        <ElectricityBill>${escapeXml(this.mapElectricityBill(payload.ElectricityBill))}</ElectricityBill>
      </ContactData>`;
    
    // Build Solar-specific fields (all required for Solar vertical)
    const solarFields = payload.Vertical === 'Solar' ? `
  <AuthorizedForPropertyChanges>${payload.AuthorizedForPropertyChanges || 'Yes'}</AuthorizedForPropertyChanges>
  <CurrentUtilityProvider>${payload.CurrentUtilityProvider || 'Pacific Gas & Electric'}</CurrentUtilityProvider>
  <ProjectStatus>${payload.ProjectStatus || 'Existing home'}</ProjectStatus>
  <PropertyStories>${payload.PropertyStories || 'Two stories'}</PropertyStories>
  <PropertyUsage>${payload.PropertyUsage || 'Residential'}</PropertyUsage>
  <SolarSystemType>${payload.SolarSystemType || 'Solar electricity'}</SolarSystemType>
  <SolarInstallationLocation>${payload.SolarInstallationLocation || 'Roof'}</SolarInstallationLocation>` : '';
    
    // Build Home section
    const homeSection = `
      <Home>
        <Ownership>${escapeXml(payload.Ownership || 'Own')}</Ownership>
      </Home>`;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Lead>
  <ApiToken>${escapeXml(payload.ApiToken)}</ApiToken>
  <Vertical>${escapeXml(payload.Vertical)}</Vertical>
  <SubId>${escapeXml(payload.SubId)}</SubId>
  <Source>${escapeXml(payload.Source || 'Direct')}</Source>
  <JornayaLeadId>${escapeXml(payload.JornayaLeadId || 'PX_' + Date.now())}</JornayaLeadId>
  <SessionLength>${payload.SessionLength || 180}</SessionLength>
  <TcpaText>${escapeXml(payload.TcpaText || 'I agree to be contacted.')}</TcpaText>
  <OriginalUrl>${escapeXml(payload.OriginalUrl || 'https://example.com')}</OriginalUrl>
  <IpAddress>${escapeXml(payload.IpAddress || '203.0.113.10')}</IpAddress>
  <UserAgent>${escapeXml(payload.UserAgent || 'Mozilla/5.0')}</UserAgent>
  ${contactData}
  ${solarFields}
  ${homeSection}
</Lead>`;
  }
  
  /**
   * Map roof shade values to PX accepted values
   */
  private static mapRoofShade(roofshade?: string): string {
    const mapping: Record<string, string> = {
      'No Shade': 'Full sun',
      'Little Shade': 'Partial sun', 
      'Moderate Shade': 'Mostly shaded',
      'Heavy Shade': 'Mostly shaded'
    };
    return mapping[roofshade || ''] || 'Full sun';
  }
  
  /**
   * Map electricity bill values to PX accepted values
   */
  private static mapElectricityBill(bill?: string): string {
    const mapping: Record<string, string> = {
      '$100-150': '$101-125',
      '$150-200': '$151-175',
      '$200+': '$201-300'
    };
    return mapping[bill || ''] || '$101-125';
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