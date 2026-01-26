import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, pipelineStages, paymentHistorySchema } from "@shared/schema";
import { z } from "zod";
import { sendEmail, sendReply, getInboxThreads } from "./gmail";
import { sendSms, getSmsConversations, getMessagesWithNumber, isTwilioConfigured } from "./twilio";
import { isCalendarConfigured, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvents } from "./calendar";
import { decodeVIN } from "./vin-decoder";

export async function registerRoutes(server: Server, app: Express): Promise<void> {
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
}
