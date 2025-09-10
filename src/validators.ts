import { z } from "zod";

export const SubId = z.string().regex(/^[A-Z0-9_]{2,20}$/);
export const ClickId = z.string().min(3).max(128);

export const GenerateTrackingSchema = z.object({
  campaignId: z.number().int().positive(),
  subId: SubId,
  clickId: ClickId,
});

// Additional validators for Solar/Health/Home and consent
export const Address = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().min(4),
});

export const Consent = z.object({
  tcpaText: z.string().min(10),
  optIn: z.boolean(),
  timestamp: z.string().datetime(),
  ip: z.string(),
  userAgent: z.string(),
});

export const SolarLead = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().regex(/^[0-9]{10,15}$/),
  address: Address,
  homeowner: z.boolean(),
  electricBill: z.number().int().positive().optional(),
  roofShade: z.enum(["low","medium","high"]).optional(),
});

export const HealthLead = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().regex(/^[0-9]{10,15}$/),
  address: Address,
  age: z.number().int().min(18).max(99),
  gender: z.enum(["male","female","other"]).optional(),
});

export const HomeLead = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().regex(/^[0-9]{10,15}$/),
  address: Address,
  propertyType: z.enum(["single_family","multi_family","apartment"]).optional(),
});

export const PxDirectPost = z.object({
  vertical: z.enum(["solar","health","home"]),
  offerId: z.string().uuid(),
  subId: SubId,
  subId2: ClickId,
  consent: Consent,
  lead: z.union([SolarLead, HealthLead, HomeLead]),
});
