import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, pipelineStages, paymentHistorySchema } from "@shared/schema";
import { z } from "zod";
import { sendEmail, sendReply, getInboxThreads } from "./gmail";
import { sendSms, getSmsConversations, getMessagesWithNumber, isTwilioConfigured } from "./twilio";
import { isCalendarConfigured, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvents } from "./calendar";
import { decodeVIN } from "./vin-decoder";
import { isPlacesConfigured, getAutocomplete, getPlaceDetails } from "./places";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(server: Server, app: Express): Promise<void> {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  // Get current user with role
  app.get("/api/auth/user-with-role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user with role:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user role (admin only)
  app.patch("/api/users/:id/role", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const [admin] = await db.select().from(users).where(eq(users.id, adminId));
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ message: "Only admins can change user roles" });
      }

      const { role } = req.body;
      if (!["admin", "csr", "technician"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const [updated] = await db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Get all users (admin only)
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user.claims.sub;
      const [admin] = await db.select().from(users).where(eq(users.id, adminId));
      if (!admin || admin.role !== "admin") {
        return res.status(403).json({ message: "Only admins can view all users" });
      }

      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Get all jobs
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getAllJobs();
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  // Get single job
  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job" });
    }
  });

  // Create new job
  app.post("/api/jobs", async (req, res) => {
    try {
      const parsed = insertJobSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid job data", 
          errors: parsed.error.errors 
        });
      }
      const job = await storage.createJob(parsed.data);
      res.status(201).json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  // Update job
  app.patch("/api/jobs/:id", async (req, res) => {
    try {
      const parsed = insertJobSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid job data", 
          errors: parsed.error.errors 
        });
      }
      const job = await storage.updateJob(req.params.id, parsed.data);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  // Update job pipeline stage
  app.patch("/api/jobs/:id/stage", async (req, res) => {
    try {
      const stageSchema = z.object({
        pipelineStage: z.enum(pipelineStages),
      });
      const parsed = stageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid stage", 
          errors: parsed.error.errors 
        });
      }
      
      const currentJob = await storage.getJob(req.params.id);
      if (!currentJob) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const job = await storage.updateJobStage(req.params.id, parsed.data.pipelineStage);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Auto-create Google Calendar event when stage changes to "scheduled"
      if (parsed.data.pipelineStage === 'scheduled' && 
          currentJob.pipelineStage !== 'scheduled' &&
          job.installDate && job.installTime) {
        try {
          const configured = await isCalendarConfigured();
          if (configured) {
            const eventId = await createCalendarEvent(job);
            if (eventId) {
              await storage.updateJob(req.params.id, { googleCalendarEventId: eventId });
              job.googleCalendarEventId = eventId;
            }
          }
        } catch (calendarError: any) {
          console.error("Failed to create calendar event:", calendarError.message);
        }
      }
      
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to update job stage" });
    }
  });

  // Add payment to job
  app.post("/api/jobs/:id/payments", async (req, res) => {
    try {
      const parsed = paymentHistorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid payment data", 
          errors: parsed.error.errors 
        });
      }
      const job = await storage.addPaymentToJob(req.params.id, parsed.data);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to add payment" });
    }
  });

  // Delete job
  app.delete("/api/jobs/:id", async (req, res) => {
    try {
      const success = await storage.deleteJob(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Job not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete job" });
    }
  });

  // Send email to customer
  app.post("/api/jobs/:id/email", async (req, res) => {
    try {
      const emailSchema = z.object({
        subject: z.string().min(1, "Subject is required"),
        body: z.string().min(1, "Message body is required"),
      });
      
      const parsed = emailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid email data", 
          errors: parsed.error.errors 
        });
      }

      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (!job.email) {
        return res.status(400).json({ message: "Customer has no email address" });
      }

      await sendEmail(job.email, parsed.data.subject, parsed.data.body);
      res.json({ message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Failed to send email:", error);
      res.status(500).json({ message: error.message || "Failed to send email" });
    }
  });

  // Send receipt email with signature
  app.post("/api/jobs/:id/send-receipt", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (!job.email) {
        return res.status(400).json({ message: "Customer has no email address" });
      }

      // Get vehicle and part info
      const vehicle = job.vehicles?.[0];
      const part = vehicle?.parts?.[0];

      // Build receipt HTML
      const receiptHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #29ABE2; padding-bottom: 20px; margin-bottom: 20px; }
    .header h1 { color: #29ABE2; margin: 0; }
    .section { margin-bottom: 20px; }
    .section-title { font-weight: bold; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; padding: 5px 0; }
    .label { color: #666; }
    .value { font-weight: bold; color: #333; }
    .total-row { font-size: 1.2em; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
    .signature-section { margin-top: 30px; text-align: center; }
    .signature-section img { max-width: 300px; border: 1px solid #ddd; padding: 10px; background: #fff; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>AutoGlass Pro</h1>
    <p>Service Receipt</p>
  </div>

  <div class="section">
    <div class="section-title">Job Details</div>
    <div class="row"><span class="label">Job Number:</span><span class="value">${job.jobNumber}</span></div>
    <div class="row"><span class="label">Date:</span><span class="value">${job.installDate || new Date().toLocaleDateString()}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Customer Information</div>
    <div class="row"><span class="label">Name:</span><span class="value">${job.firstName} ${job.lastName}</span></div>
    <div class="row"><span class="label">Phone:</span><span class="value">${job.phone}</span></div>
    <div class="row"><span class="label">Email:</span><span class="value">${job.email}</span></div>
    ${job.streetAddress ? `<div class="row"><span class="label">Address:</span><span class="value">${job.streetAddress}, ${job.city}, ${job.state} ${job.zipCode}</span></div>` : ''}
  </div>

  ${vehicle ? `
  <div class="section">
    <div class="section-title">Vehicle Information</div>
    <div class="row"><span class="label">Vehicle:</span><span class="value">${vehicle.vehicleYear} ${vehicle.vehicleMake} ${vehicle.vehicleModel}</span></div>
    ${vehicle.vin ? `<div class="row"><span class="label">VIN:</span><span class="value">${vehicle.vin}</span></div>` : ''}
    ${vehicle.bodyStyle ? `<div class="row"><span class="label">Body Style:</span><span class="value">${vehicle.bodyStyle}</span></div>` : ''}
  </div>
  ` : ''}

  ${part ? `
  <div class="section">
    <div class="section-title">Service Details</div>
    <div class="row"><span class="label">Service:</span><span class="value">${(part.jobType || 'windshield_replacement').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</span></div>
    ${part.glassPartNumber ? `<div class="row"><span class="label">Part #:</span><span class="value">${part.glassPartNumber}</span></div>` : ''}
    ${part.distributor ? `<div class="row"><span class="label">Supplier:</span><span class="value">${part.distributor}</span></div>` : ''}
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Payment Summary</div>
    <div class="row"><span class="label">Subtotal:</span><span class="value">$${(job.subtotal || 0).toFixed(2)}</span></div>
    <div class="row"><span class="label">Tax:</span><span class="value">$${(job.taxAmount || 0).toFixed(2)}</span></div>
    <div class="row total-row"><span class="label">Total:</span><span class="value">$${(job.totalDue || 0).toFixed(2)}</span></div>
    <div class="row"><span class="label">Amount Paid:</span><span class="value">$${(job.amountPaid || 0).toFixed(2)}</span></div>
    ${job.paymentMethod && job.paymentMethod.length > 0 ? `<div class="row"><span class="label">Payment Method:</span><span class="value">${job.paymentMethod.join(', ').replace(/_/g, ' ')}</span></div>` : ''}
  </div>

  ${job.signatureImage ? `
  <div class="signature-section">
    <div class="section-title">Customer Signature</div>
    <img src="${job.signatureImage}" alt="Customer Signature" />
    <p style="font-size: 12px; color: #666; margin-top: 5px;">Signed on ${new Date().toLocaleDateString()}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Thank you for choosing AutoGlass Pro!</p>
    <p>Questions? Contact us at windshieldrepairsa@gmail.com</p>
  </div>
</body>
</html>`;

      await sendEmail(
        job.email,
        `AutoGlass Pro Receipt - Job #${job.jobNumber}`,
        receiptHtml
      );

      // Update job with receipt sent timestamp
      await storage.updateJob(job.id, {
        receiptSentAt: new Date().toISOString()
      });

      res.json({ message: "Receipt sent successfully" });
    } catch (error: any) {
      console.error("Failed to send receipt:", error);
      res.status(500).json({ message: error.message || "Failed to send receipt" });
    }
  });

  // Get email inbox threads
  app.get("/api/emails/inbox", async (req, res) => {
    try {
      const threads = await getInboxThreads(20);
      res.json(threads);
    } catch (error: any) {
      console.error("Failed to fetch emails:", error);
      res.status(500).json({ message: error.message || "Failed to fetch emails" });
    }
  });

  // Reply to email thread
  app.post("/api/emails/reply", async (req, res) => {
    try {
      const replySchema = z.object({
        threadId: z.string().min(1, "Thread ID is required"),
        to: z.string().min(1, "Recipient is required"),
        subject: z.string().min(1, "Subject is required"),
        body: z.string().min(1, "Message body is required"),
      });
      
      const parsed = replySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid reply data", 
          errors: parsed.error.errors 
        });
      }

      await sendReply(parsed.data.threadId, parsed.data.to, parsed.data.subject, parsed.data.body);
      res.json({ message: "Reply sent successfully" });
    } catch (error: any) {
      console.error("Failed to send reply:", error);
      res.status(500).json({ message: error.message || "Failed to send reply" });
    }
  });

  // Check if Twilio is configured
  app.get("/api/sms/status", async (req, res) => {
    res.json({ configured: isTwilioConfigured() });
  });

  // Get SMS conversations
  app.get("/api/sms/conversations", async (req, res) => {
    try {
      if (!isTwilioConfigured()) {
        return res.status(400).json({ message: "Twilio is not configured" });
      }
      const conversations = await getSmsConversations(50);
      res.json(conversations);
    } catch (error: any) {
      console.error("Failed to fetch SMS conversations:", error);
      res.status(500).json({ message: error.message || "Failed to fetch SMS conversations" });
    }
  });

  // Get messages with a specific phone number
  app.get("/api/sms/messages/:phoneNumber", async (req, res) => {
    try {
      if (!isTwilioConfigured()) {
        return res.status(400).json({ message: "Twilio is not configured" });
      }
      const messages = await getMessagesWithNumber(req.params.phoneNumber, 50);
      res.json(messages);
    } catch (error: any) {
      console.error("Failed to fetch messages:", error);
      res.status(500).json({ message: error.message || "Failed to fetch messages" });
    }
  });

  // Send SMS
  app.post("/api/sms/send", async (req, res) => {
    try {
      if (!isTwilioConfigured()) {
        return res.status(400).json({ message: "Twilio is not configured" });
      }
      
      const smsSchema = z.object({
        to: z.string().min(1, "Phone number is required"),
        body: z.string().min(1, "Message body is required"),
      });
      
      const parsed = smsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid SMS data", 
          errors: parsed.error.errors 
        });
      }

      const message = await sendSms(parsed.data.to, parsed.data.body);
      res.json({ message: "SMS sent successfully", data: message });
    } catch (error: any) {
      console.error("Failed to send SMS:", error);
      res.status(500).json({ message: error.message || "Failed to send SMS" });
    }
  });

  // Send SMS to job customer
  app.post("/api/jobs/:id/sms", async (req, res) => {
    try {
      if (!isTwilioConfigured()) {
        return res.status(400).json({ message: "Twilio is not configured" });
      }
      
      const smsSchema = z.object({
        body: z.string().min(1, "Message body is required"),
      });
      
      const parsed = smsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid SMS data", 
          errors: parsed.error.errors 
        });
      }

      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (!job.phone) {
        return res.status(400).json({ message: "Customer has no phone number" });
      }

      const message = await sendSms(job.phone, parsed.data.body);
      res.json({ message: "SMS sent successfully", data: message });
    } catch (error: any) {
      console.error("Failed to send SMS:", error);
      res.status(500).json({ message: error.message || "Failed to send SMS" });
    }
  });

  // Calendar endpoints
  app.get("/api/calendar/status", async (req, res) => {
    try {
      const configured = await isCalendarConfigured();
      res.json({ configured });
    } catch (error) {
      res.json({ configured: false });
    }
  });

  app.get("/api/calendar/events", async (req, res) => {
    try {
      const { start, end } = req.query;
      if (!start || !end) {
        return res.status(400).json({ message: "Start and end dates are required" });
      }
      const events = await getCalendarEvents(start as string, end as string);
      res.json(events);
    } catch (error: any) {
      console.error("Failed to fetch calendar events:", error);
      res.status(500).json({ message: error.message || "Failed to fetch calendar events" });
    }
  });

  app.post("/api/jobs/:id/calendar", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (!job.installDate || !job.installTime) {
        return res.status(400).json({ message: "Job must have install date and time" });
      }

      const configured = await isCalendarConfigured();
      if (!configured) {
        return res.status(400).json({ message: "Google Calendar is not connected" });
      }

      if (job.googleCalendarEventId) {
        await updateCalendarEvent(job.googleCalendarEventId, job);
        res.json({ message: "Calendar event updated", eventId: job.googleCalendarEventId });
      } else {
        const eventId = await createCalendarEvent(job);
        if (eventId) {
          await storage.updateJob(req.params.id, { googleCalendarEventId: eventId });
        }
        res.json({ message: "Calendar event created", eventId });
      }
    } catch (error: any) {
      console.error("Failed to sync calendar event:", error);
      res.status(500).json({ message: error.message || "Failed to sync calendar event" });
    }
  });

  app.delete("/api/jobs/:id/calendar", async (req, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      if (!job.googleCalendarEventId) {
        return res.status(400).json({ message: "Job has no calendar event" });
      }

      await deleteCalendarEvent(job.googleCalendarEventId);
      await storage.updateJob(req.params.id, { googleCalendarEventId: undefined });
      res.json({ message: "Calendar event deleted" });
    } catch (error: any) {
      console.error("Failed to delete calendar event:", error);
      res.status(500).json({ message: error.message || "Failed to delete calendar event" });
    }
  });

  // VIN Decoder endpoint
  app.get("/api/vin/decode/:vin", async (req, res) => {
    try {
      const vin = req.params.vin;
      if (!vin || vin.length !== 17) {
        return res.status(400).json({ message: "VIN must be exactly 17 characters" });
      }
      
      const decoded = await decodeVIN(vin);
      res.json(decoded);
    } catch (error: any) {
      console.error("VIN decode error:", error);
      res.status(500).json({ message: error.message || "Failed to decode VIN" });
    }
  });

  // Google Places API - Status
  app.get("/api/places/status", (req, res) => {
    res.json({ configured: isPlacesConfigured() });
  });

  // Google Places API - Autocomplete
  app.get("/api/places/autocomplete", async (req, res) => {
    try {
      const input = req.query.input as string;
      if (!input || input.length < 3) {
        return res.json({ predictions: [] });
      }
      
      const result = await getAutocomplete(input);
      res.json(result);
    } catch (error: any) {
      console.error("Places autocomplete error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch address predictions" });
    }
  });

  // Google Places API - Place Details
  app.get("/api/places/details", async (req, res) => {
    try {
      const placeId = req.query.place_id as string;
      if (!placeId) {
        return res.status(400).json({ message: "place_id is required" });
      }
      
      const result = await getPlaceDetails(placeId);
      res.json(result);
    } catch (error: any) {
      console.error("Place details error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch place details" });
    }
  });
}
