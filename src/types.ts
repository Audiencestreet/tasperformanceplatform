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