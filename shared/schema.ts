import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const pipelineStages = [
  "quote",
  "glass_ordered",
  "glass_arrived",
  "scheduled",
  "in_progress",
  "paid_completed"
] as const;

export type PipelineStage = typeof pipelineStages[number];

export const paymentStatuses = ["pending", "partial", "paid"] as const;
export type PaymentStatus = typeof paymentStatuses[number];

export const jobTypes = [
  "windshield_replacement",
  "windshield_repair",
  "door_glass",
  "back_glass",
  "quarter_glass",
  "sunroof",
  "side_mirror"
] as const;
export type JobType = typeof jobTypes[number];

export const repairLocations = ["in_shop", "mobile", "customer_location"] as const;
export type RepairLocation = typeof repairLocations[number];

export const calibrationTypes = ["none", "static", "dynamic", "dual"] as const;
export type CalibrationType = typeof calibrationTypes[number];

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

export const jobSchema = z.object({
  id: z.string(),
  jobNumber: z.string(),
  
  // Customer Info
  isBusiness: z.boolean().default(false),
  businessName: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  
  // Vehicle Info
  vin: z.string().optional(),
  licensePlate: z.string().optional(),
  mileage: z.string().optional(),
  vehicleYear: z.string().min(1, "Year is required"),
  vehicleMake: z.string().min(1, "Make is required"),
  vehicleModel: z.string().min(1, "Model is required"),
  bodyStyle: z.string().optional(),
  nagsCarId: z.string().optional(),
  vehicleColor: z.string().optional(),
  
  // Job Details
  jobType: z.enum(jobTypes).default("windshield_replacement"),
  pipelineStage: z.enum(pipelineStages).default("quote"),
  repairLocation: z.enum(repairLocations).default("in_shop"),
  
  // Scheduling
  installer: z.string().optional(),
  installDate: z.string().optional(),
  installTime: z.string().optional(),
  jobDuration: z.string().optional(),
  
  // Parts - Glass
  glassPartNumber: z.string().optional(),
  isAftermarket: z.boolean().default(true),
  nagsListPrice: z.number().default(0),
  laborHours: z.number().default(1),
  laborRate: z.number().default(50),
  
  // Additional Parts
  calibrationType: z.enum(calibrationTypes).default("none"),
  calibrationLocation: z.string().optional(),
  calibrationPrice: z.number().default(0),
  distributor: z.string().optional(),
  glassOrderedDate: z.string().optional(),
  glassArrivalDate: z.string().optional(),
  urethaneKit: z.string().optional(),
  urethaneKitPrice: z.number().default(0),
  
  // Insurance
  claimNumber: z.string().optional(),
  dispatchNumber: z.string().optional(),
  policyNumber: z.string().optional(),
  dateOfLoss: z.string().optional(),
  causeOfLoss: z.enum(causesOfLoss).optional(),
  insuranceCompany: z.string().optional(),
  
  // Payments
  glassPrice: z.number().default(0),
  laborTotal: z.number().default(0),
  subtotal: z.number().default(0),
  taxRate: z.number().default(0),
  taxAmount: z.number().default(0),
  totalDue: z.number().min(0, "Total must be positive").default(0),
  deductible: z.number().min(0).default(0),
  rebate: z.number().default(0),
  amountPaid: z.number().default(0),
  balanceDue: z.number().default(0),
  paymentStatus: z.enum(paymentStatuses).default("pending"),
  paymentHistory: z.array(paymentHistorySchema).default([]),
  
  // Notes
  installNotes: z.string().optional(),
  
  createdAt: z.string().optional(),
});

export const insertJobSchema = jobSchema.omit({ id: true, jobNumber: true, createdAt: true });

export type Job = z.infer<typeof jobSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
