import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Export auth models (users table with roles)
export * from "./models/auth";

// Customer reminders table for storing reminders by customer name
export const customerReminders = pgTable("customer_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerKey: varchar("customer_key").notNull().unique(),
  reminderMessage: text("reminder_message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerReminderSchema = createInsertSchema(customerReminders).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export type CustomerReminder = typeof customerReminders.$inferSelect;
export type InsertCustomerReminder = z.infer<typeof insertCustomerReminderSchema>;

// Jobs table for persistent storage
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobNumber: varchar("job_number").notNull(),
  
  // Customer Info
  isBusiness: boolean("is_business").default(false),
  businessName: varchar("business_name"),
  customerType: varchar("customer_type").default("retail"),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  phone: varchar("phone").notNull(),
  email: varchar("email"),
  streetAddress: varchar("street_address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  
  // Vehicles array stored as JSONB
  vehicles: jsonb("vehicles").default([]),
  
  // Job Details
  pipelineStage: varchar("pipeline_stage").default("quote"),
  repairLocation: varchar("repair_location").default("in_shop"),
  
  // Scheduling
  installer: varchar("installer"),
  installDate: varchar("install_date"),
  timeFrame: varchar("time_frame"),
  installTime: varchar("install_time"),
  installEndTime: varchar("install_end_time"),
  jobDuration: varchar("job_duration"),
  bookedBy: varchar("booked_by"),
  installedBy: varchar("installed_by"),
  googleCalendarEventId: varchar("google_calendar_event_id"),
  leadSource: varchar("lead_source"),
  
  // Insurance
  claimNumber: varchar("claim_number"),
  dispatchNumber: varchar("dispatch_number"),
  policyNumber: varchar("policy_number"),
  dateOfLoss: varchar("date_of_loss"),
  causeOfLoss: varchar("cause_of_loss"),
  insuranceCompany: varchar("insurance_company"),
  
  // Job-level totals
  subtotal: numeric("subtotal").default("0"),
  taxAmount: numeric("tax_amount").default("0"),
  totalDue: numeric("total_due").default("0"),
  deductible: numeric("deductible").default("0"),
  rebate: numeric("rebate").default("0"),
  amountPaid: numeric("amount_paid").default("0"),
  balanceDue: numeric("balance_due").default("0"),
  paymentStatus: varchar("payment_status").default("pending"),
  paymentMethod: jsonb("payment_method").default([]),
  paymentHistory: jsonb("payment_history").default([]),
  
  // Notes
  installNotes: text("install_notes"),
  repeatCustomerNotes: text("repeat_customer_notes"),
  
  // Calibration decline tracking
  calibrationDeclined: boolean("calibration_declined").default(false),
  
  // Signature capture
  signatureImage: text("signature_image"),
  receiptSentAt: varchar("receipt_sent_at"),
  receiptPdf: text("receipt_pdf"),
  
  // Completion photos (optional)
  completionPhotos: jsonb("completion_photos").default({}),
  
  // Follow-up mode: auto sends SMS/Email automatically, manual creates notifications for CSRs
  followUpMode: varchar("follow_up_mode").default("manual"),
  
  // Warranty tracking
  isWarranty: boolean("is_warranty").default(false),
  warrantyOriginalJobId: varchar("warranty_original_job_id"),
  
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const followUpModes = ["auto", "manual"] as const;
export type FollowUpMode = typeof followUpModes[number];

export const pipelineStages = [
  "new_lead",
  "quote",
  "warm_lead",
  "scheduled",
  "paid_completed",
  "lost_opportunity",
  "archived"
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

// Service type - what action is being performed
export const serviceTypes = ["repair", "replace", "calibration", "warranty"] as const;
export type ServiceType = typeof serviceTypes[number];

// Glass type - what part is being worked on
export const glassTypes = [
  "windshield",
  "door_glass",
  "back_glass",
  "back_glass_powerslide",
  "quarter_glass",
  "sunroof",
  "side_mirror"
] as const;
export type GlassType = typeof glassTypes[number];

// Legacy jobTypes for backwards compatibility during migration
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

export const calibrationTypes = ["none", "static", "dynamic", "dual", "approve", "declined"] as const;
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
  serviceType: z.enum(serviceTypes).default("replace"),
  glassType: z.enum(glassTypes).default("windshield"),
  jobType: z.enum(jobTypes).optional(), // Legacy field for backwards compatibility
  glassPartNumber: z.string().optional(),
  isAftermarket: z.boolean().default(true),
  distributor: z.string().optional(),
  accessories: z.string().optional(), // Description of accessories needed (moldings, clips, etc.)
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
  repeatCustomerNotes: z.string().optional(),
  
  // Calibration decline tracking
  calibrationDeclined: z.boolean().default(false),
  
  // Signature capture
  signatureImage: z.string().optional(),
  receiptSentAt: z.string().optional(),
  receiptPdf: z.string().optional(),
  
  // Completion photos (optional)
  completionPhotos: z.record(z.string()).optional(),
  
  // Follow-up mode
  followUpMode: z.enum(followUpModes).default("manual"),
  
  // Warranty tracking
  isWarranty: z.boolean().default(false),
  warrantyOriginalJobId: z.string().optional(),
  
  completedAt: z.string().optional(),
  createdAt: z.string().optional(),
});

export const insertJobSchema = jobSchema.omit({ id: true, jobNumber: true, createdAt: true });

export type Job = z.infer<typeof jobSchema>;
export type InsertJob = z.infer<typeof insertJobSchema>;

// Contacts table for manual and auto-synced contacts
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  phone: varchar("phone").notNull(),
  email: varchar("email"),
  streetAddress: varchar("street_address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  category: varchar("category").default("customer"), // customer, dealer, fleet, subcontractor, vendor, other
  isBusiness: boolean("is_business").default(false),
  businessName: varchar("business_name"),
  notes: text("notes"),
  autoSynced: boolean("auto_synced").default(false), // true if created from job
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contactCategories = ["customer", "dealer", "fleet", "subcontractor", "vendor", "other"] as const;
export type ContactCategory = typeof contactCategories[number];

export const contactSchema = z.object({
  id: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  category: z.enum(contactCategories).default("customer"),
  isBusiness: z.boolean().default(false),
  businessName: z.string().optional(),
  notes: z.string().optional(),
  autoSynced: z.boolean().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const insertContactSchema = contactSchema.omit({ id: true, createdAt: true, updatedAt: true });

export type Contact = z.infer<typeof contactSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;

// Activity logs for tracking user actions (CSR accountability)
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  username: varchar("username").notNull(),
  userRole: varchar("user_role"),
  actionType: varchar("action_type").notNull(), // job_created, job_stage_changed, email_sent, sms_sent, note_added, etc.
  actionCategory: varchar("action_category").notNull(), // jobs, conversations, calendar, other
  jobId: varchar("job_id"), // Reference to job if applicable
  jobNumber: varchar("job_number"), // Job number for display
  details: jsonb("details").default({}), // Additional details (from/to stage, message preview, etc.)
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityActionTypes = [
  "login",
  "logout",
  "job_created",
  "job_updated",
  "job_stage_changed",
  "job_deleted",
  "email_sent",
  "email_replied",
  "sms_sent",
  "note_added",
  "calendar_event_created",
  "calendar_event_updated",
  "payment_recorded",
  "contact_created",
  "contact_updated"
] as const;
export type ActivityActionType = typeof activityActionTypes[number];

export const activityCategories = ["jobs", "conversations", "calendar", "contacts", "auth", "other"] as const;
export type ActivityCategory = typeof activityCategories[number];

export const activityLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  userRole: z.string().optional(),
  actionType: z.string(),
  actionCategory: z.string(),
  jobId: z.string().optional(),
  jobNumber: z.string().optional(),
  details: z.record(z.any()).optional(),
  createdAt: z.string().optional(),
});

export const insertActivityLogSchema = activityLogSchema.omit({ id: true, createdAt: true });

export type ActivityLog = z.infer<typeof activityLogSchema>;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Processed leads table - tracks email IDs that have already been processed to prevent duplicate sends
export const processedLeads = pgTable("processed_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailId: varchar("email_id").notNull().unique(), // The unique email ID from Bluehost
  emailSubject: varchar("email_subject"), // For debugging/tracking
  customerEmail: varchar("customer_email"), // For debugging/tracking
  customerPhone: varchar("customer_phone"), // For phone-based dedup of SMS
  processedAt: timestamp("processed_at").defaultNow(),
});

export const insertProcessedLeadSchema = createInsertSchema(processedLeads).omit({ 
  id: true, 
  processedAt: true 
});

export type ProcessedLead = typeof processedLeads.$inferSelect;
export type InsertProcessedLead = z.infer<typeof insertProcessedLeadSchema>;

// AI Chat conversations table
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

// AI Chat messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Phone calls table for tracking incoming/outgoing calls
export const phoneCalls = pgTable("phone_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callSid: varchar("call_sid").notNull().unique(),
  direction: varchar("direction").notNull(), // 'inbound' or 'outbound'
  fromNumber: varchar("from_number").notNull(),
  toNumber: varchar("to_number").notNull(),
  status: varchar("status").notNull(), // 'ringing', 'in-progress', 'completed', 'missed', 'busy', 'failed'
  duration: integer("duration"), // seconds
  answeredBy: varchar("answered_by"), // user ID who answered
  jobId: varchar("job_id"), // linked job if identified
  contactName: varchar("contact_name"), // caller name if known
  notes: text("notes"),
  recordingUrl: text("recording_url"),
  startedAt: timestamp("started_at").defaultNow(),
  answeredAt: timestamp("answered_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPhoneCallSchema = createInsertSchema(phoneCalls).omit({
  id: true,
  createdAt: true,
});

export type PhoneCall = typeof phoneCalls.$inferSelect;
export type InsertPhoneCall = z.infer<typeof insertPhoneCallSchema>;

// Technician job data - stores per-job technician-editable data like task status and part checklist
export const technicianJobData = pgTable("technician_job_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().unique(),
  taskStatus: jsonb("task_status").default({}), // { onMyWay: boolean, onSite: boolean, takePayment: boolean }
  partsChecklist: jsonb("parts_checklist").default({}), // { [partId]: boolean } - tracks which parts are completed
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTechnicianJobDataSchema = createInsertSchema(technicianJobData).omit({
  id: true,
  updatedAt: true,
});

export type TechnicianJobData = typeof technicianJobData.$inferSelect;
export type InsertTechnicianJobData = z.infer<typeof insertTechnicianJobDataSchema>;

// Technician materials checklist - global supplies list for technicians
export const techMaterialsList = pgTable("tech_materials_list", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  quantity: integer("quantity").default(0),
  minQuantity: integer("min_quantity").default(0), // Alert when below this
  isChecked: boolean("is_checked").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTechMaterialsListSchema = createInsertSchema(techMaterialsList).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TechMaterial = typeof techMaterialsList.$inferSelect;
export type InsertTechMaterial = z.infer<typeof insertTechMaterialsListSchema>;

// Pickup list checklist - tracks which parts have been picked up
export const pickupChecklist = pgTable("pickup_checklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  partIndex: integer("part_index").notNull(), // Index of the part in the vehicle's parts array
  vehicleIndex: integer("vehicle_index").notNull(), // Index of the vehicle in the job's vehicles array
  isPickedUp: boolean("is_picked_up").default(false),
  pickedUpAt: timestamp("picked_up_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPickupChecklistSchema = createInsertSchema(pickupChecklist).omit({
  id: true,
  createdAt: true,
});

export type PickupChecklistItem = typeof pickupChecklist.$inferSelect;
export type InsertPickupChecklistItem = z.infer<typeof insertPickupChecklistSchema>;

// Technician supplies checklist - permanent checklist in the Pickup List tab
export const techSuppliesChecklist = pgTable("tech_supplies_checklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  isChecked: boolean("is_checked").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTechSuppliesChecklistSchema = createInsertSchema(techSuppliesChecklist).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TechSupplyItem = typeof techSuppliesChecklist.$inferSelect;
export type InsertTechSupplyItem = z.infer<typeof insertTechSuppliesChecklistSchema>;

export const callForwardingSettings = pgTable("call_forwarding_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  forwardingNumber: varchar("forwarding_number").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  timeoutSeconds: integer("timeout_seconds").notNull().default(5),
  whisperMessage: text("whisper_message").default("Incoming call from Windshield Repair SA"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCallForwardingSchema = createInsertSchema(callForwardingSettings).omit({
  id: true,
  updatedAt: true,
});

export type CallForwardingSettings = typeof callForwardingSettings.$inferSelect;
export type InsertCallForwardingSettings = z.infer<typeof insertCallForwardingSchema>;

// Scheduled tasks for automated follow-up system
export const scheduledTasks = pgTable("scheduled_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  sequenceNumber: integer("sequence_number").notNull(),
  taskType: varchar("task_type").notNull(),
  followUpMode: varchar("follow_up_mode").notNull().default("manual"),
  status: varchar("status").notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  executedAt: timestamp("executed_at"),
  smsContent: text("sms_content"),
  emailSubject: varchar("email_subject"),
  emailBody: text("email_body"),
  customerName: varchar("customer_name"),
  customerPhone: varchar("customer_phone"),
  customerEmail: varchar("customer_email"),
  vehicleInfo: varchar("vehicle_info"),
  jobNumber: varchar("job_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scheduledTaskStatuses = ["pending", "sent", "notified", "archived", "failed"] as const;
export type ScheduledTaskStatus = typeof scheduledTaskStatuses[number];

export const insertScheduledTaskSchema = createInsertSchema(scheduledTasks).omit({
  id: true,
  createdAt: true,
});

export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type InsertScheduledTask = z.infer<typeof insertScheduledTaskSchema>;

// Follow-up activity logs
export const followUpLogs = pgTable("follow_up_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  jobNumber: varchar("job_number"),
  action: varchar("action").notNull(),
  sequenceNumber: integer("sequence_number"),
  details: text("details"),
  performedBy: varchar("performed_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const followUpActionTypes = [
  "sms_sent",
  "email_sent",
  "call_logged",
  "task_notified",
  "tasks_archived",
  "tasks_created",
  "manual_send",
] as const;
export type FollowUpActionType = typeof followUpActionTypes[number];

export const insertFollowUpLogSchema = createInsertSchema(followUpLogs).omit({
  id: true,
  createdAt: true,
});

export type FollowUpLog = typeof followUpLogs.$inferSelect;
export type InsertFollowUpLog = z.infer<typeof insertFollowUpLogSchema>;

export const manualFollowUpLogs = pgTable("manual_follow_up_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull(),
  followUpNumber: integer("follow_up_number").notNull(),
  datePerformed: timestamp("date_performed").defaultNow(),
  methodCall: boolean("method_call").default(false),
  methodText: boolean("method_text").default(false),
  methodEmail: boolean("method_email").default(false),
  notes: text("notes"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  createTask: boolean("create_task").default(false),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertManualFollowUpLogSchema = createInsertSchema(manualFollowUpLogs).omit({
  id: true,
  createdAt: true,
});

export type ManualFollowUpLog = typeof manualFollowUpLogs.$inferSelect;
export type InsertManualFollowUpLog = z.infer<typeof insertManualFollowUpLogSchema>;

export const aiReceptionistSettings = pgTable("ai_receptionist_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isEnabled: boolean("is_enabled").default(false),
  greeting: text("greeting").default("Hello! Thank you for calling Windshield Repair SA. How can I help you today?"),
  systemPrompt: text("system_prompt").default(""),
  businessContext: text("business_context").default(""),
  voiceName: varchar("voice_name").default("Polly.Joanna"),
  maxTurns: integer("max_turns").default(10),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiReceptionistSettingsSchema = createInsertSchema(aiReceptionistSettings).omit({
  id: true,
  updatedAt: true,
});
export type AiReceptionistSettings = typeof aiReceptionistSettings.$inferSelect;
export type InsertAiReceptionistSettings = z.infer<typeof insertAiReceptionistSettingsSchema>;

export const aiReceptionistCalls = pgTable("ai_receptionist_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callSid: varchar("call_sid").unique(),
  callerNumber: varchar("caller_number").notNull(),
  transcript: jsonb("transcript").default([]),
  extractedData: jsonb("extracted_data"),
  leadCreated: boolean("lead_created").default(false),
  jobId: varchar("job_id"),
  status: varchar("status").default("in_progress"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiReceptionistCallSchema = createInsertSchema(aiReceptionistCalls).omit({
  id: true,
  createdAt: true,
});
export type AiReceptionistCall = typeof aiReceptionistCalls.$inferSelect;
export type InsertAiReceptionistCall = z.infer<typeof insertAiReceptionistCallSchema>;
