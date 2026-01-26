import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, pipelineStages, paymentHistorySchema } from "@shared/schema";
import { z } from "zod";
import { sendEmail } from "./gmail";

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
      const job = await storage.updateJobStage(req.params.id, parsed.data.pipelineStage);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
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
}
