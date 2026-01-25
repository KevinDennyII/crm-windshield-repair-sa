import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
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
  "paid_completed"
] as const;

export type PipelineStage = typeof pipelineStages[number];

export const paymentStatuses = ["pending", "partial", "paid"] as const;
export type PaymentStatus = typeof paymentStatuses[number];

export const jobSchema = z.object({
  id: z.string(),
  customerName: z.string().min(1, "Customer name is required"),
  customerPhone: z.string().min(1, "Phone is required"),
  customerEmail: z.string().email("Valid email required").optional().or(z.literal("")),
  customerAddress: z.string().optional(),
  vehicleYear: z.string().min(1, "Year is required"),
  vehicleMake: z.string().min(1, "Make is required"),
  vehicleModel: z.string().min(1, "Model is required"),
  vehicleVin: z.string().optional(),
  vehicleColor: z.string().optional(),
  glassType: z.string().min(1, "Glass type is required"),
  glassPartNumber: z.string().optional(),
  glassSupplier: z.string().optional(),
  installDate: z.string().optional(),
  installTime: z.string().optional(),
  installLocation: z.string().optional(),
  installNotes: z.string().optional(),
  totalDue: z.number().min(0, "Total must be positive"),
  deductible: z.number().min(0).default(0),
  paymentStatus: z.enum(paymentStatuses).default("pending"),
  pipelineStage: z.enum(pipelineStages).default("quote"),
  createdAt: z.string().optional(),
});

export const insertJobSchema = jobSchema.omit({ id: true, createdAt: true });

export type Job = z.infer<typeof jobSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;
