import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export auth models (users table with roles)
export * from "./models/auth";

export const pipelineStages = [
  "quote",
  "scheduled",
  "paid_completed",
  "lost_opportunity"
] as const;

export type PipelineStage = typeof pipelineStages[number];

export const paymentStatuses = ["pending", "partial", "paid"] as const;
export type PaymentStatus = typeof paymentStatuses[number];

export const paymentMethods = ["cash", "card", "check", "zelle", "bank_deposit"] as const;
export type PaymentMethod = typeof paymentMethods[number];

export const customerTypes = ["retail", "dealer", "fleet", "subcontractor"] as const;
export type CustomerType = typeof customerTypes[number];

export const leadSources = ["google_ads", "referral", "dealer", "repeat", "subcontractor", "facebook"] as const;
export type LeadSource = typeof leadSources[number];

export const jobTypes = [
  "windshield_replacement",
  "windshield_repair",
  "door_glass",
  "back_glass",
  "back_glass_powerslide",
  "quarter_glass",
  "sunroof",
  "side_mirror"
] as const;
export type JobType = typeof jobTypes[number];

export const repairLocations = ["in_shop", "mobile", "customer_location"] as const;
export type RepairLocation = typeof repairLocations[number];

export const calibrationTypes = ["none", "static", "dynamic", "dual", "declined"] as const;
export type CalibrationType = typeof calibrationTypes[number];

export const timeFrames = [
  "9a-12p",
  "12p-3p",
  "3p-6p",
  "10a-2p",
  "2p-6p",
  "custom"
] as const;
export type TimeFrame = typeof timeFrames[number];

// Map time frames to actual start/end times
export const timeFrameDetails: Record<string, { startTime: string; endTime: string; label: string }> = {
  "9a-12p": { startTime: "09:00", endTime: "12:00", label: "9am - 12pm" },
  "12p-3p": { startTime: "12:00", endTime: "15:00", label: "12pm - 3pm" },
  "3p-6p": { startTime: "15:00", endTime: "18:00", label: "3pm - 6pm" },
  "10a-2p": { startTime: "10:00", endTime: "14:00", label: "10am - 2pm" },
  "2p-6p": { startTime: "14:00", endTime: "18:00", label: "2pm - 6pm" },
  "custom": { startTime: "", endTime: "", label: "Custom Time..." },
};

export const causesOfLoss = [
  "rock_chip",
  "crack",
  "vandalism",
  "accident",
  "weather",
  "unknown",
  "other"
] as const;
export type CauseOfLoss = typeof causesOfLoss[number];

export const paymentSources = ["cash", "credit_card", "debit_card", "check", "insurance", "other"] as const;
export type PaymentSource = typeof paymentSources[number];

export const paymentHistorySchema = z.object({
  id: z.string(),
  date: z.string(),
  source: z.enum(paymentSources),
  amount: z.number(),
  notes: z.string().optional(),
});

export type PaymentHistoryEntry = z.infer<typeof paymentHistorySchema>;

// Part schema - each part has its own pricing calculator
export const partSchema = z.object({
  id: z.string(),
  jobType: z.enum(jobTypes).default("windshield_replacement"),
  glassPartNumber: z.string().optional(),
  isAftermarket: z.boolean().default(true),
  distributor: z.string().optional(),
  glassOrderedDate: z.string().optional(),
  glassArrivalDate: z.string().optional(),
  calibrationType: z.enum(calibrationTypes).default("none"),
  calibrationLocation: z.string().optional(),
  urethaneKit: z.string().optional(),
  
  // Part Pricing Calculator fields
  partPrice: z.number().default(0),
  markup: z.number().default(0),
  accessoriesPrice: z.number().default(0),
  urethanePrice: z.number().default(15),
  salesTaxPercent: z.number().default(8.25),
  laborPrice: z.number().default(0),
  calibrationPrice: z.number().default(0),
  mobileFee: z.number().default(0),
  materialCost: z.number().default(0),
  subcontractorCost: z.number().default(0), // Manual additional cost for subcontractor jobs
  
  // Calculated totals for this part
  partsSubtotal: z.number().default(0),
  partTotal: z.number().default(0),
});

export type Part = z.infer<typeof partSchema>;

// Vehicle schema - each vehicle has multiple parts
export const vehicleSchema = z.object({
  id: z.string(),
  vin: z.string().optional(),
  licensePlate: z.string().optional(),
  mileage: z.string().optional(),
  vehicleYear: z.string().default(""),
  vehicleMake: z.string().default(""),
  vehicleModel: z.string().default(""),
  bodyStyle: z.string().optional(),
  nagsCarId: z.string().optional(),
  vehicleColor: z.string().optional(),
  parts: z.array(partSchema).default([]),
});

export type Vehicle = z.infer<typeof vehicleSchema>;

export const jobSchema = z.object({
  id: z.string(),
  jobNumber: z.string(),
  
  // Customer Info
  isBusiness: z.boolean().default(false),
  businessName: z.string().optional(),
  customerType: z.enum(customerTypes).default("retail"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  
  // Vehicles array (each vehicle has parts)
  vehicles: z.array(vehicleSchema).default([]),
  
  // Job Details (applies to entire job)
  pipelineStage: z.enum(pipelineStages).default("quote"),
  repairLocation: z.enum(repairLocations).default("in_shop"),
  
  // Scheduling
  installer: z.string().optional(),
  installDate: z.string().optional(),
  timeFrame: z.enum(timeFrames).optional(),
  installTime: z.string().optional(),
  installEndTime: z.string().optional(),
  jobDuration: z.string().optional(),
  bookedBy: z.string().optional(),
  installedBy: z.string().optional(),
  googleCalendarEventId: z.string().optional(),
  leadSource: z.string().optional(),
  
  // Insurance (applies to entire job/claim)
  claimNumber: z.string().optional(),
  dispatchNumber: z.string().optional(),
  policyNumber: z.string().optional(),
  dateOfLoss: z.string().optional(),
  causeOfLoss: z.enum(causesOfLoss).optional(),
  insuranceCompany: z.string().optional(),
  
  // Job-level totals (sum of all parts across all vehicles)
  subtotal: z.number().default(0),
  taxAmount: z.number().default(0),
  totalDue: z.number().min(0, "Total must be positive").default(0),
  deductible: z.number().min(0).default(0),
  rebate: z.number().default(0),
  amountPaid: z.number().default(0),
  balanceDue: z.number().default(0),
  paymentStatus: z.enum(paymentStatuses).default("pending"),
  paymentMethod: z.array(z.enum(paymentMethods)).default([]),
  paymentHistory: z.array(paymentHistorySchema).default([]),
  
  // Notes
  installNotes: z.string().optional(),
  
  // Calibration decline tracking
  calibrationDeclined: z.boolean().default(false),
  
  // Signature capture
  signatureImage: z.string().optional(),
  receiptSentAt: z.string().optional(),
  
  createdAt: z.string().optional(),
});

export const insertJobSchema = jobSchema.omit({ id: true, jobNumber: true, createdAt: true });

export type Job = z.infer<typeof jobSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
