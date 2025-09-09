// Database bindings interface
export interface Bindings {
  DB: D1Database;
}

// PX API Types
export interface PXPingRequest {
  ApiToken: string;
  OfferId: string;
  DID: string;
  SubId: string;
  ContactData: {
    FirstName: string;
    LastName: string;
    PhoneNumber: string;
    ZipCode: string;
    Email?: string;
    Ownership?: string; // Own, Rent
    Roofshade?: string; // No Shade, Little Shade, Moderate Shade, Heavy Shade
    ElectricityBill?: string; // Monthly bill amount range
  };
}

export interface PXPingResponse {
  Status: 'BaeOK' | 'BaeNok';
  Message?: string;
  LeadId?: string;
  Price?: number;
  BuyerName?: string;
}

export interface PXPostRequest extends PXPingRequest {
  // Post includes all ping data plus any additional required fields
}

export interface PXPostResponse {
  Status: 'Success' | 'Error';
  Message?: string;
  LeadId?: string;
  TransactionId?: string;
}

// Internal Lead Types
export interface Lead {
  id?: number;
  campaign_id: number;
  affiliate_id: number;
  lead_uuid: string;
  px_lead_id?: string;
  
  // Contact info
  first_name: string;
  last_name: string;
  email?: string;
  phone_number: string;
  zip_code: string;
  
  // Solar-specific data
  ownership?: string;
  roof_shade?: string;
  electricity_bill?: string;
  
  // Tracking data
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  
  // PX status
  ping_status?: string;
  post_status?: string;
  ping_response?: string;
  post_response?: string;
  
  created_at?: string;
  ping_sent_at?: string;
  post_sent_at?: string;
}

export interface Campaign {
  id?: number;
  affiliate_id: number;
  name: string;
  description?: string;
  offer_id: string;
  sub_id: string;
  traffic_type: string;
  payout_amount: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface Affiliate {
  id?: number;
  name: string;
  email: string;
  api_key: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Lead capture form data
export interface LeadFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  zip_code: string;
  ownership: string;
  roof_shade: string;
  electricity_bill: string;
  
  // Campaign/tracking info
  campaign_id: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

// Analytics types
export interface AnalyticsData {
  date: string;
  affiliate_id: number;
  campaign_id?: number;
  leads_generated: number;
  pings_sent: number;
  pings_accepted: number;
  posts_sent: number;
  posts_successful: number;
  total_payout: number;
  traffic_type: string;
}

export interface DashboardStats {
  total_leads: number;
  accepted_leads: number;
  successful_posts: number;
  total_revenue: number;
  conversion_rate: number;
  acceptance_rate: number;
  success_rate: number;
}

// Error types
export interface PXError {
  code: string;
  message: string;
  details?: any;
}

// Postback Integration Types
export interface PostbackUrl {
  id?: number;
  affiliate_id: number;
  campaign_id?: number;
  name: string;
  url_template: string;
  trigger_events: string[]; // ['ping_accepted', 'post_successful', 'conversion']
  http_method: 'GET' | 'POST';
  headers?: Record<string, string>;
  payload_template?: string;
  status: 'active' | 'paused' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface PostbackLog {
  id?: number;
  postback_url_id: number;
  lead_id: number;
  event_type: string;
  request_url: string;
  request_method: string;
  request_headers?: Record<string, string>;
  request_payload?: string;
  response_status?: number;
  response_body?: string;
  response_time_ms?: number;
  success: boolean;
  error_message?: string;
  retry_count: number;
  created_at?: string;
}

// Conversion Tracking Types
export interface Conversion {
  id?: number;
  lead_id: number;
  campaign_id: number;
  affiliate_id: number;
  conversion_type: string; // 'sale', 'signup', 'install', 'lead_qualified'
  conversion_value: number;
  currency: string;
  
  // Source tracking
  source_platform?: string; // 'google', 'facebook', 'tiktok', 'postback', 'pixel'
  click_id?: string; // gclid, fbclid, ttclid
  
  // Platform-specific IDs
  google_conversion_id?: string;
  google_conversion_label?: string;
  google_order_id?: string;
  facebook_pixel_id?: string;
  facebook_event_id?: string;
  facebook_conversion_api_event_id?: string;
  
  // Attribution
  attribution_window_hours: number;
  time_to_conversion_hours?: number;
  
  // Metadata
  conversion_data?: Record<string, any>;
  user_agent?: string;
  ip_address?: string;
  
  created_at?: string;
}

export interface ConversionPixel {
  id?: number;
  campaign_id: number;
  pixel_type: 'google' | 'facebook' | 'tiktok' | 'custom';
  pixel_id: string;
  conversion_label?: string;
  event_name: string;
  value_mapping?: Record<string, any>;
  custom_parameters?: Record<string, any>;
  status: 'active' | 'inactive';
  created_at?: string;
}

export interface PlatformToken {
  id?: number;
  platform: 'google_ads' | 'facebook' | 'tiktok';
  token_type: 'access_token' | 'refresh_token' | 'api_key';
  encrypted_token: string;
  account_id?: string;
  expires_at?: string;
  refresh_token?: string;
  scope?: string;
  created_at?: string;
  updated_at?: string;
}

// Conversion API Request Types
export interface GoogleConversionRequest {
  conversion_action: string;
  gclid?: string;
  conversion_date_time: string;
  conversion_value?: number;
  currency_code?: string;
  order_id?: string;
  user_identifiers?: Array<{
    hashed_email?: string;
    hashed_phone_number?: string;
    address_info?: {
      hashed_first_name?: string;
      hashed_last_name?: string;
      city?: string;
      state?: string;
      country_code?: string;
      postal_code?: string;
    };
  }>;
}

export interface FacebookConversionRequest {
  event_name: string;
  event_time: number;
  event_id?: string;
  user_data: {
    em?: string; // hashed email
    ph?: string; // hashed phone
    fn?: string; // hashed first name
    ln?: string; // hashed last name
    ct?: string; // hashed city
    st?: string; // hashed state
    zp?: string; // hashed zip
    country?: string; // country code
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string; // Facebook click ID
    fbp?: string; // Facebook browser ID
  };
  custom_data?: {
    value?: number;
    currency?: string;
    content_ids?: string[];
    content_type?: string;
    order_id?: string;
  };
  action_source: 'email' | 'website' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
}

// Postback URL Template Variables
export interface PostbackVariables {
  lead_id: string;
  lead_uuid: string;
  campaign_id: string;
  affiliate_id: string;
  click_id?: string;
  conversion_value?: string;
  currency?: string;
  status: string;
  payout?: string;
  timestamp: string;
  custom_param_1?: string;
  custom_param_2?: string;
  custom_param_3?: string;
}