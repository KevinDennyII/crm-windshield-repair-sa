import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, pipelineStages, paymentHistorySchema, insertCustomerReminderSchema, insertContactSchema } from "@shared/schema";
import { z } from "zod";
import { sendEmail, sendEmailWithAttachment, sendReply, getInboxThreads } from "./gmail";
import { sendSms, getSmsConversations, getMessagesWithNumber, isTwilioConfigured, getTwilioPhoneNumber } from "./twilio";
import { isBluehostConfigured, getBluehostEmail, getBluehostEmails, sendBluehostEmail, replyToBluehostEmail } from "./bluehost";
import { isCalendarConfigured, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvents } from "./calendar";
import { decodeVIN } from "./vin-decoder";
import { isPlacesConfigured, getAutocomplete, getPlaceDetails } from "./places";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { COMPANY_LOGO_BASE64 } from "./logo";
import { processNewLeads, startLeadPolling, stopLeadPolling } from "./lead-processor";

export async function registerRoutes(server: Server, app: Express): Promise<void> {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);

  // Simple username/password login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginSchema = z.object({
        username: z.string().min(1, "Username is required"),
        password: z.string().min(1, "Password is required"),
      });

      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const { username, password } = parsed.data;

      // Find user by username
      const [user] = await db.select().from(users).where(eq(users.username, username));
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Check password (simple comparison for now)
      if (user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Store user in session
      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };

      res.json({ 
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user with role (supports both session and OIDC auth)
  app.get("/api/auth/user-with-role", async (req: any, res) => {
    try {
      // First check session-based auth
      if ((req.session as any)?.userId) {
        const userId = (req.session as any).userId;
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (user) {
          return res.json(user);
        }
      }

      // Fall back to OIDC auth
      if (!req.user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }

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

  // Send receipt email with PDF attachment
  app.post("/api/jobs/:id/send-receipt", async (req, res) => {
    try {
      const receiptSchema = z.object({
        pdfBase64: z.string().min(1, "PDF data is required"),
        pdfFilename: z.string().min(1, "Filename is required"),
      });
      
      const parsed = receiptSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid receipt data", 
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

      const customerName = job.isBusiness && job.businessName 
        ? job.businessName 
        : `${job.firstName} ${job.lastName}`;

      const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #29ABE2; padding-bottom: 20px; margin-bottom: 20px; }
    .content { padding: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${COMPANY_LOGO_BASE64}" alt="Windshield Repair SA" style="max-width: 280px; height: auto; margin-bottom: 10px;" />
  </div>

  <div class="content">
    <p>Dear ${customerName},</p>
    <p>Thank you for choosing Windshield Repair SA for your auto glass service!</p>
    <p>Please find your signed receipt attached to this email. This document includes your complete service details, payment summary, warranty information, and your signature.</p>
    <p>If you have any questions about your service or warranty, please don't hesitate to contact us.</p>
  </div>

  <div class="footer">
    <p><strong>Windshield Repair SA</strong></p>
    <p>901 SE Military Hwy #C051, San Antonio, TX 78214</p>
    <p>Email: windshieldrepairsa@gmail.com | Phone: (210) 890-0210</p>
  </div>
</body>
</html>`;

      await sendEmailWithAttachment(
        job.email,
        `Your Service Receipt - Windshield Repair SA - Job #${job.jobNumber}`,
        emailBody,
        {
          filename: parsed.data.pdfFilename,
          base64: parsed.data.pdfBase64,
          mimeType: 'application/pdf'
        }
      );

      // Update job with receipt sent timestamp and store the PDF
      await storage.updateJob(job.id, {
        receiptSentAt: new Date().toISOString(),
        receiptPdf: parsed.data.pdfBase64
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
    res.json({ 
      configured: isTwilioConfigured(),
      phoneNumber: getTwilioPhoneNumber()
    });
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

  // Bluehost email endpoints
  app.get("/api/bluehost/status", async (req, res) => {
    res.json({ 
      configured: isBluehostConfigured(),
      email: getBluehostEmail()
    });
  });

  app.get("/api/bluehost/threads", async (req, res) => {
    try {
      if (!isBluehostConfigured()) {
        return res.status(400).json({ message: "Bluehost email is not configured" });
      }
      const threads = await getBluehostEmails(30);
      res.json(threads);
    } catch (error: any) {
      console.error("Failed to fetch Bluehost emails:", error);
      res.status(500).json({ message: error.message || "Failed to fetch Bluehost emails" });
    }
  });

  app.post("/api/bluehost/send", async (req, res) => {
    try {
      if (!isBluehostConfigured()) {
        return res.status(400).json({ message: "Bluehost email is not configured" });
      }
      
      const emailSchema = z.object({
        to: z.string().email("Invalid email address"),
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

      await sendBluehostEmail(parsed.data.to, parsed.data.subject, parsed.data.body);
      res.json({ message: "Email sent successfully" });
    } catch (error: any) {
      console.error("Failed to send Bluehost email:", error);
      res.status(500).json({ message: error.message || "Failed to send email" });
    }
  });

  app.post("/api/bluehost/reply", async (req, res) => {
    try {
      if (!isBluehostConfigured()) {
        return res.status(400).json({ message: "Bluehost email is not configured" });
      }
      
      const replySchema = z.object({
        to: z.string().email("Invalid email address"),
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

      await replyToBluehostEmail(parsed.data.to, parsed.data.subject, parsed.data.body);
      res.json({ message: "Reply sent successfully" });
    } catch (error: any) {
      console.error("Failed to send Bluehost reply:", error);
      res.status(500).json({ message: error.message || "Failed to send reply" });
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

  // Customer Reminders API
  app.get("/api/customer-reminders/:customerKey", async (req, res) => {
    try {
      const customerKey = decodeURIComponent(req.params.customerKey);
      const reminder = await storage.getCustomerReminder(customerKey);
      if (!reminder) {
        return res.status(404).json({ message: "No reminder found" });
      }
      res.json(reminder);
    } catch (error: any) {
      console.error("Get customer reminder error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch reminder" });
    }
  });

  app.post("/api/customer-reminders", async (req, res) => {
    try {
      const parsed = insertCustomerReminderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid reminder data", 
          errors: parsed.error.errors 
        });
      }
      
      const reminder = await storage.upsertCustomerReminder(parsed.data);
      res.json(reminder);
    } catch (error: any) {
      console.error("Upsert customer reminder error:", error);
      res.status(500).json({ message: error.message || "Failed to save reminder" });
    }
  });

  app.delete("/api/customer-reminders/:customerKey", async (req, res) => {
    try {
      const customerKey = decodeURIComponent(req.params.customerKey);
      await storage.deleteCustomerReminder(customerKey);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete customer reminder error:", error);
      res.status(500).json({ message: error.message || "Failed to delete reminder" });
    }
  });

  // ============ CONTACTS ROUTES ============
  
  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await storage.getAllContacts();
      res.json(contacts);
    } catch (error: any) {
      console.error("Get contacts error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error: any) {
      console.error("Get contact error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const parsed = insertContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid contact data", 
          errors: parsed.error.errors 
        });
      }
      const contact = await storage.createContact(parsed.data);
      res.status(201).json(contact);
    } catch (error: any) {
      console.error("Create contact error:", error);
      res.status(500).json({ message: error.message || "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.updateContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error: any) {
      console.error("Update contact error:", error);
      res.status(500).json({ message: error.message || "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      await storage.deleteContact(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete contact error:", error);
      res.status(500).json({ message: error.message || "Failed to delete contact" });
    }
  });

  // Get jobs for a specific contact (by phone number match)
  app.get("/api/contacts/:id/jobs", async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      const allJobs = await storage.getAllJobs();
      const cleanContactPhone = contact.phone.replace(/\D/g, "");
      
      const contactJobs = allJobs.filter(job => {
        const cleanJobPhone = job.phone.replace(/\D/g, "");
        return cleanJobPhone === cleanContactPhone || 
               cleanJobPhone.endsWith(cleanContactPhone.slice(-10)) || 
               cleanContactPhone.endsWith(cleanJobPhone.slice(-10));
      });
      
      res.json(contactJobs);
    } catch (error: any) {
      console.error("Get contact jobs error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch contact jobs" });
    }
  });

  // Sync contacts from all existing jobs
  app.post("/api/contacts/sync-from-jobs", async (req, res) => {
    try {
      const allJobs = await storage.getAllJobs();
      const syncedContacts = [];
      
      for (const job of allJobs) {
        const contact = await storage.syncContactFromJob(job);
        syncedContacts.push(contact);
      }
      
      res.json({ 
        message: `Synced ${syncedContacts.length} contacts from jobs`,
        count: syncedContacts.length 
      });
    } catch (error: any) {
      console.error("Sync contacts error:", error);
      res.status(500).json({ message: error.message || "Failed to sync contacts" });
    }
  });

  // Lead Processing Routes
  app.get("/api/leads/status", async (req, res) => {
    res.json({
      configured: isBluehostConfigured(),
      message: isBluehostConfigured() 
        ? "Lead processing is active. Checking Bluehost for new leads every 60 seconds." 
        : "Bluehost email not configured. Lead processing is disabled.",
    });
  });

  app.post("/api/leads/process", async (req, res) => {
    try {
      if (!isBluehostConfigured()) {
        return res.status(400).json({ message: "Bluehost email not configured" });
      }
      
      const result = await processNewLeads();
      res.json({
        message: `Processed ${result.processed} new leads`,
        processed: result.processed,
        errors: result.errors,
      });
    } catch (error: any) {
      console.error("Lead processing error:", error);
      res.status(500).json({ message: error.message || "Failed to process leads" });
    }
  });

  // Lead polling DISABLED - was sending duplicate messages to already-contacted customers
  // To re-enable, uncomment the lines below after implementing proper deduplication
  // if (isBluehostConfigured()) {
  //   startLeadPolling(60000); // Check every 60 seconds
  //   console.log("Lead polling started - checking for new website leads every 60 seconds");
  // }
}
