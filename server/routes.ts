import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertJobSchema, pipelineStages, paymentHistorySchema, insertCustomerReminderSchema, insertContactSchema, insertActivityLogSchema, userRoles, phoneCalls, pickupChecklist, techSuppliesChecklist, callForwardingSettings, activityLogs, jobs, scheduledTasks, followUpModes, aiReceptionistSettings } from "@shared/schema";
import { createFollowUpTasksForJob, archiveFollowUpsForJob, startFollowUpWorker, FOLLOW_UP_SEQUENCES } from "./follow-up-system";
import { z } from "zod";
import { sendEmail, sendEmailWithAttachment, sendReply, getInboxThreads } from "./gmail";
import { sendSms, getSmsConversations, getMessagesWithNumber, isTwilioConfigured, getTwilioPhoneNumber, isVoiceConfigured, generateVoiceToken, generateIncomingCallTwiml, generateOutboundCallTwiml, generateForwardTwiml, validateTwilioSignature, transferActiveCall, generateTransferFallbackTwiml, holdCall, unholdCall, getClient } from "./twilio";
import type { CallForwardingConfig } from "./twilio";
import { isBluehostConfigured, getBluehostEmail, getBluehostEmails, sendBluehostEmail, replyToBluehostEmail } from "./bluehost";
import { isCalendarConfigured, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvents } from "./calendar";
import { decodeVIN } from "./vin-decoder";
import { isPlacesConfigured, getAutocomplete, getPlaceDetails } from "./places";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { COMPANY_LOGO_BASE64 } from "./logo";
import { processNewLeads, startLeadPolling, stopLeadPolling } from "./lead-processor";
import { registerAIRoutes } from "./ai-routes";
import { isAIReceptionistEnabled } from "./voice-receptionist";
import bcrypt from "bcrypt";

// Helper to get current user from session or OIDC
async function getCurrentUser(req: any): Promise<{ id: string; username: string; role: string } | null> {
  if (req.session?.userId) {
    const [user] = await db.select().from(users).where(eq(users.id, req.session.userId));
    if (user) {
      return { id: user.id, username: user.username || '', role: user.role || 'technician' };
    }
  }
  if (req.user?.claims?.sub) {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.claims.sub));
    if (user) {
      return { id: user.id, username: user.username || '', role: user.role || 'technician' };
    }
  }
  if (req.user?.id) {
    const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
    if (user) {
      return { id: user.id, username: user.username || '', role: user.role || 'technician' };
    }
  }
  return null;
}

// Helper to log activity
async function logActivity(
  userId: string,
  username: string,
  userRole: string,
  actionType: string,
  actionCategory: string,
  jobId?: string,
  jobNumber?: string,
  details?: Record<string, any>
) {
  try {
    await storage.createActivityLog({
      userId,
      username,
      userRole,
      actionType,
      actionCategory,
      jobId,
      jobNumber,
      details,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

function getScheduleValidationErrors(job: any): string[] {
  const missing: string[] = [];

  if (!job.firstName?.trim()) missing.push("First Name");
  if (!job.lastName?.trim()) missing.push("Last Name");
  if (!job.phone?.trim()) missing.push("Phone");
  if (!job.email?.trim()) missing.push("Email");
  if (!job.streetAddress?.trim()) missing.push("Street Address");
  if (!job.city?.trim()) missing.push("City");
  if (!job.state?.trim()) missing.push("State");
  if (!job.zipCode?.trim()) missing.push("Zip Code");
  if (!job.installDate?.trim()) missing.push("Install Date");
  if (!job.timeFrame?.trim()) missing.push("Time Frame");

  const vehicles = Array.isArray(job.vehicles) ? job.vehicles : [];
  if (vehicles.length === 0) {
    missing.push("Vehicle (Year, Make, Model, Body Style)");
    missing.push("Part (Job Type, Glass Type, Glass Part #, Distributor, Accessories)");
  } else {
    for (let vi = 0; vi < vehicles.length; vi++) {
      const v = vehicles[vi];
      const vLabel = vehicles.length > 1 ? ` (Vehicle ${vi + 1})` : "";
      if (!v.vehicleYear?.trim()) missing.push(`Year${vLabel}`);
      if (!v.vehicleMake?.trim()) missing.push(`Make${vLabel}`);
      if (!v.vehicleModel?.trim()) missing.push(`Model${vLabel}`);
      if (!v.bodyStyle?.trim()) missing.push(`Body Style${vLabel}`);

      const parts = Array.isArray(v.parts) ? v.parts : [];
      if (parts.length === 0) {
        missing.push(`Part (Job Type, Glass Type, Glass Part #, Distributor, Accessories)${vLabel}`);
      } else {
        for (let pi = 0; pi < parts.length; pi++) {
          const p = parts[pi];
          const pLabel = parts.length > 1 ? ` (Part ${pi + 1})` : "";
          const label = `${pLabel}${vLabel}`;
          if (!p.serviceType?.trim()) missing.push(`Job Type${label}`);
          if (!p.glassType?.trim()) missing.push(`Glass Type${label}`);
          if (!p.glassPartNumber?.trim()) missing.push(`Glass Part #${label}`);
          if (!p.distributor?.trim()) missing.push(`Distributor${label}`);
          if (!p.accessories?.trim()) missing.push(`Accessories${label}`);
        }
      }
    }
  }

  return missing;
}

export async function registerRoutes(server: Server, app: Express): Promise<void> {
  // Setup authentication BEFORE other routes
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Register AI routes
  registerAIRoutes(app);

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

      // Check if user is active
      if (user.isActive === "false") {
        return res.status(401).json({ message: "Account is disabled" });
      }

      // Check password - support both hashed and plain text (for migration)
      let passwordValid = false;
      if (user.password?.startsWith("$2")) {
        // Bcrypt hashed password
        passwordValid = await bcrypt.compare(password, user.password);
      } else {
        // Plain text password (legacy)
        passwordValid = user.password === password;
      }

      if (!passwordValid) {
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

      // Establish Passport session so req.isAuthenticated() returns true
      await new Promise<void>((resolve, reject) => {
        req.login(user, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Log login activity
      await logActivity(
        user.id,
        user.username || '',
        user.role || 'technician',
        'login',
        'auth',
        undefined,
        undefined,
        { loginMethod: 'username_password' }
      );

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
  app.post("/api/auth/logout", async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'logout',
          'auth'
        );
      }
    } catch (error) {
      console.error("Error logging logout:", error);
    }
    
    req.session.destroy((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user with role (supports both session and OIDC auth)
  app.get("/api/auth/user-with-role", async (req: any, res) => {
    try {
      const stripPassword = (user: any) => {
        const { password, ...safe } = user;
        return safe;
      };

      // First check session-based auth
      if ((req.session as any)?.userId) {
        const userId = (req.session as any).userId;
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (user) {
          return res.json(stripPassword(user));
        }
      }

      // Check OIDC auth
      if (req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        const [user] = await db.select().from(users).where(eq(users.id, userId));
        if (user) {
          return res.json(stripPassword(user));
        }
      }

      // Check Passport-deserialized local auth (req.user populated by deserializeUser)
      if (req.user?.id) {
        const [user] = await db.select().from(users).where(eq(users.id, req.user.id));
        if (user) {
          return res.json(stripPassword(user));
        }
      }

      return res.status(401).json({ message: "Unauthorized" });
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

  // Get all users (admin only) - supports both session and OIDC auth
  app.get("/api/users", async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "Only admins can view all users" });
      }

      const allUsers = await db.select().from(users);
      // Don't expose passwords
      const sanitizedUsers = allUsers.map(u => ({
        ...u,
        password: u.password ? "[HIDDEN]" : null,
      }));
      res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Create new staff account (admin only)
  app.post("/api/staff", async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "Only admins can create staff accounts" });
      }

      const staffSchema = z.object({
        username: z.string().min(3, "Username must be at least 3 characters"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().min(1, "Last name is required"),
        email: z.string().email("Valid email required").optional().or(z.literal("")),
        role: z.enum(["admin", "csr", "technician", "reports"]),
      });

      const parsed = staffSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }

      const { username, password, firstName, lastName, email, role } = parsed.data;

      // Check if username already exists
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const newUser = await storage.createUser({
        username,
        password: hashedPassword,
        firstName,
        lastName,
        email: email || null,
        role,
        isActive: "true",
      });

      // Log the creation
      await logActivity(
        currentUser.id,
        currentUser.username,
        currentUser.role,
        'contact_created',
        'other',
        undefined,
        undefined,
        { createdUsername: username, createdRole: role }
      );

      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
      });
    } catch (error) {
      console.error("Error creating staff account:", error);
      res.status(500).json({ message: "Failed to create staff account" });
    }
  });

  // Update staff account (admin only)
  app.patch("/api/staff/:id", async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "Only admins can update staff accounts" });
      }

      const updateSchema = z.object({
        username: z.string().min(3).optional(),
        password: z.string().min(6).optional(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        email: z.string().email().optional().or(z.literal("")),
        role: z.enum(["admin", "csr", "technician", "reports"]).optional(),
        isActive: z.enum(["true", "false"]).optional(),
      });

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }

      const updates: any = { ...parsed.data };
      
      // Hash password if provided
      if (updates.password) {
        updates.password = await bcrypt.hash(updates.password, 10);
      }

      const updatedUser = await storage.updateUser(req.params.id, updates);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: updatedUser.id,
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      });
    } catch (error) {
      console.error("Error updating staff account:", error);
      res.status(500).json({ message: "Failed to update staff account" });
    }
  });

  // Get activity logs (admin only)
  app.get("/api/activity-logs", async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "Only admins can view activity logs" });
      }

      const { userId, startDate, endDate, actionType, limit } = req.query;
      
      const filters: any = {};
      if (userId) filters.userId = userId;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (actionType) filters.actionType = actionType;

      const logs = await storage.getActivityLogs(filters);
      
      // Apply limit if specified
      const limitNum = limit ? parseInt(limit as string, 10) : 500;
      res.json(logs.slice(0, limitNum));
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Get activity logs for a specific user (admin only)
  app.get("/api/activity-logs/user/:userId", async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "Only admins can view activity logs" });
      }

      const { limit } = req.query;
      const limitNum = limit ? parseInt(limit as string, 10) : 100;
      
      const logs = await storage.getActivityLogsByUser(req.params.userId, limitNum);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching user activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  // Get activity summary for reporting (admin only)
  app.get("/api/activity-summary", async (req: any, res) => {
    try {
      const currentUser = await getCurrentUser(req);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "Only admins can view activity summary" });
      }

      const { startDate, endDate } = req.query;
      
      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const logs = await storage.getActivityLogs(filters);
      
      // Calculate summary by user
      const userSummary: Record<string, {
        userId: string;
        username: string;
        userRole: string;
        totalActions: number;
        jobsCreated: number;
        stageChanges: number;
        emailsSent: number;
        smsSent: number;
        logins: number;
        firstActivity: string;
        lastActivity: string;
      }> = {};

      for (const log of logs) {
        if (!userSummary[log.userId]) {
          userSummary[log.userId] = {
            userId: log.userId,
            username: log.username,
            userRole: log.userRole || 'unknown',
            totalActions: 0,
            jobsCreated: 0,
            stageChanges: 0,
            emailsSent: 0,
            smsSent: 0,
            logins: 0,
            firstActivity: log.createdAt || '',
            lastActivity: log.createdAt || '',
          };
        }

        const summary = userSummary[log.userId];
        summary.totalActions++;
        if (log.actionType === 'job_created') summary.jobsCreated++;
        if (log.actionType === 'job_stage_changed') summary.stageChanges++;
        if (log.actionType === 'email_sent' || log.actionType === 'email_replied') summary.emailsSent++;
        if (log.actionType === 'sms_sent') summary.smsSent++;
        if (log.actionType === 'login') summary.logins++;
        
        // Track first and last activity
        if (log.createdAt && log.createdAt < summary.firstActivity) {
          summary.firstActivity = log.createdAt;
        }
        if (log.createdAt && log.createdAt > summary.lastActivity) {
          summary.lastActivity = log.createdAt;
        }
      }

      res.json(Object.values(userSummary));
    } catch (error) {
      console.error("Error fetching activity summary:", error);
      res.status(500).json({ message: "Failed to fetch activity summary" });
    }
  });

  app.get("/api/health", async (req, res) => {
    try {
      const jobs = await storage.getAllJobs();
      res.json({ status: "ok", jobCount: jobs.length, dbConnected: true });
    } catch (error: any) {
      console.error("Health check DB error:", error?.message || error);
      res.json({ status: "error", dbConnected: false, error: error?.message || "Unknown error" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const missedCalls = await db.select({
        id: phoneCalls.id,
        fromNumber: phoneCalls.fromNumber,
        contactName: phoneCalls.contactName,
        startedAt: phoneCalls.startedAt,
      }).from(phoneCalls)
        .where(eq(phoneCalls.status, "ringing"))
        .orderBy(desc(phoneCalls.startedAt))
        .limit(10);

      const newLeads = await db.select({
        id: jobs.id,
        jobNumber: jobs.jobNumber,
        firstName: jobs.firstName,
        lastName: jobs.lastName,
        phone: jobs.phone,
        createdAt: jobs.createdAt,
      }).from(jobs)
        .where(and(
          eq(jobs.pipelineStage, "new_lead"),
          gte(jobs.createdAt, sevenDaysAgo),
        ))
        .orderBy(desc(jobs.createdAt))
        .limit(10);

      const recentSms = await db.select({
        id: activityLogs.id,
        actionType: activityLogs.actionType,
        details: activityLogs.details,
        jobNumber: activityLogs.jobNumber,
        createdAt: activityLogs.createdAt,
      }).from(activityLogs)
        .where(eq(activityLogs.actionType, "sms_sent"))
        .orderBy(desc(activityLogs.createdAt))
        .limit(10);

      const recentEmails = await db.select({
        id: activityLogs.id,
        actionType: activityLogs.actionType,
        details: activityLogs.details,
        jobNumber: activityLogs.jobNumber,
        createdAt: activityLogs.createdAt,
      }).from(activityLogs)
        .where(eq(activityLogs.actionType, "email_sent"))
        .orderBy(desc(activityLogs.createdAt))
        .limit(10);

      const totalCount = missedCalls.length + newLeads.length + recentSms.length + recentEmails.length;

      res.json({
        totalCount,
        missedCalls,
        newLeads,
        recentSms,
        recentEmails,
      });
    } catch (error: any) {
      console.error("Failed to fetch notifications:", error?.message || error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Get all jobs
  app.get("/api/jobs", async (req, res) => {
    try {
      const jobs = await storage.getAllJobs();
      res.json(jobs);
    } catch (error: any) {
      console.error("Failed to fetch jobs:", error?.message || error);
      res.status(500).json({ message: "Failed to fetch jobs", error: error?.message });
    }
  });

  app.get("/api/jobs/search", async (req, res) => {
    try {
      const query = (req.query.q as string || "").trim().toLowerCase();
      if (!query) {
        return res.json([]);
      }
      const allJobs = await storage.getAllJobs();
      const results = allJobs.filter((j: any) => {
        const name = `${j.firstName || ""} ${j.lastName || ""}`.toLowerCase();
        const phone = (j.phone || "").toLowerCase();
        const jobNum = (j.jobNumber || "").toLowerCase();
        const vehicles = (j.vehicles || []) as any[];
        const vehicleMatch = vehicles.some((v: any) =>
          `${v.vehicleYear || ""} ${v.vehicleMake || ""} ${v.vehicleModel || ""}`.toLowerCase().includes(query)
        );
        return name.includes(query) || phone.includes(query) || jobNum.includes(query) || vehicleMatch;
      });
      res.json(results.slice(0, 20));
    } catch (error: any) {
      res.status(500).json({ message: "Search failed", error: error?.message });
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
  app.post("/api/jobs", async (req: any, res) => {
    try {
      const parsed = insertJobSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid job data", 
          errors: parsed.error.errors 
        });
      }
      const job = await storage.createJob(parsed.data);
      
      // Log activity
      const currentUser = await getCurrentUser(req);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'job_created',
          'jobs',
          job.id,
          job.jobNumber,
          { customerName: `${job.firstName} ${job.lastName}`, totalDue: job.totalDue }
        );
      }
      
      // Auto-create follow-up tasks for new jobs (only for quote/new_lead stage)
      if (job.pipelineStage === "quote" || job.pipelineStage === "new_lead") {
        try {
          await createFollowUpTasksForJob(job);
        } catch (followUpError: any) {
          console.error("Failed to create follow-up tasks:", followUpError.message);
        }
      }
      
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

      if (parsed.data.pipelineStage === "scheduled") {
        const currentJob = await storage.getJob(req.params.id);
        if (currentJob) {
          const merged = { ...currentJob, ...parsed.data };
          const missingFields = getScheduleValidationErrors(merged);
          if (missingFields.length > 0) {
            return res.status(400).json({
              message: "Cannot move to Scheduled. The following fields are required:",
              missingFields,
            });
          }
        }
      }

      // Auto-set completedAt only on transition to paid_completed (not on re-saves)
      if (parsed.data.pipelineStage === "paid_completed") {
        const currentJob = await storage.getJob(req.params.id);
        if (currentJob && currentJob.pipelineStage !== "paid_completed" && !currentJob.completedAt) {
          parsed.data.completedAt = new Date() as any;
        }
      }
      
      const job = await storage.updateJob(req.params.id, parsed.data);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Auto-terminate follow-ups if stage changed to scheduled or beyond
      if (parsed.data.pipelineStage === "scheduled" || parsed.data.pipelineStage === "paid_completed") {
        try {
          await archiveFollowUpsForJob(job.id, job.jobNumber);
        } catch (err: any) {
          console.error("Failed to archive follow-up tasks:", err.message);
        }
      }
      
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to update job" });
    }
  });

  // Update job pipeline stage
  app.patch("/api/jobs/:id/stage", async (req: any, res) => {
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

      if (parsed.data.pipelineStage === "scheduled") {
        const missingFields = getScheduleValidationErrors(currentJob);
        if (missingFields.length > 0) {
          return res.status(400).json({
            message: "Cannot move to Scheduled. The following fields are required:",
            missingFields,
          });
        }
      }
      
      const previousStage = currentJob.pipelineStage;
      const job = await storage.updateJobStage(req.params.id, parsed.data.pipelineStage);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Log stage change activity
      const currentUser = await getCurrentUser(req);
      if (currentUser && previousStage !== parsed.data.pipelineStage) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'job_stage_changed',
          'jobs',
          job.id,
          job.jobNumber,
          { 
            fromStage: previousStage, 
            toStage: parsed.data.pipelineStage,
            customerName: `${job.firstName} ${job.lastName}`
          }
        );
      }
      
      // Auto-create Google Calendar event when stage changes to "scheduled" (only if dates are set)
      if (parsed.data.pipelineStage === 'scheduled' && 
          previousStage !== 'scheduled' &&
          job.installDate && job.installTime) {
        try {
          const configured = await isCalendarConfigured();
          if (configured) {
            const eventId = await createCalendarEvent(job);
            if (eventId) {
              await storage.updateJob(req.params.id, { googleCalendarEventId: eventId });
              job.googleCalendarEventId = eventId;
              
              // Log calendar event creation
              if (currentUser) {
                await logActivity(
                  currentUser.id,
                  currentUser.username,
                  currentUser.role,
                  'calendar_event_created',
                  'calendar',
                  job.id,
                  job.jobNumber,
                  { eventId, installDate: job.installDate, installTime: job.installTime }
                );
              }
            }
          }
        } catch (calendarError: any) {
          console.error("Failed to create calendar event:", calendarError.message);
        }
      }
      
      // Auto-terminate follow-up tasks when job moves to scheduled or beyond
      if ((parsed.data.pipelineStage === 'scheduled' || parsed.data.pipelineStage === 'paid_completed') && 
          previousStage !== parsed.data.pipelineStage) {
        try {
          await archiveFollowUpsForJob(job.id, job.jobNumber);
        } catch (archiveError: any) {
          console.error("Failed to archive follow-up tasks:", archiveError.message);
        }
      }
      
      res.json(job);
    } catch (error) {
      res.status(500).json({ message: "Failed to update job stage" });
    }
  });

  // Send appointment confirmation email/SMS
  app.post("/api/jobs/:id/send-confirmation", async (req: any, res) => {
    try {
      const confirmationSchema = z.object({
        sendEmail: z.boolean().default(true),
        sendSms: z.boolean().default(true),
      });
      
      const parsed = confirmationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.errors });
      }
      
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const currentUser = await getCurrentUser(req);
      
      const vehicle = job.vehicles?.[0];
      const vehicleInfo = vehicle 
        ? `${vehicle.vehicleYear || ""} ${vehicle.vehicleMake || ""} ${vehicle.vehicleModel || ""}`.trim()
        : "Your Vehicle";
      
      // Get service type and glass type from parts
      const parts = vehicle?.parts || [];
      const serviceTypes = Array.from(new Set(parts.map(p => p.serviceType === 'repair' ? 'Repair' : p.serviceType === 'replace' ? 'Replacement' : 'Calibration')));
      const glassTypes = Array.from(new Set(parts.map(p => {
        const glassMap: Record<string, string> = {
          'windshield': 'Windshield',
          'door_glass': 'Door Glass',
          'back_glass': 'Back Glass',
          'back_glass_powerslide': 'Back Glass (Powerslide)',
          'quarter_glass': 'Quarter Glass',
          'sunroof': 'Sunroof',
          'side_mirror': 'Side Mirror'
        };
        return glassMap[p.glassType] || p.glassType;
      })));
      
      // Format date nicely
      const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      };
      
      // Format time frame
      const timeFrameMap: Record<string, string> = {
        'am': 'Morning (8am-12pm)',
        'pm': 'Afternoon (12pm-5pm)',
        'anytime': 'Anytime'
      };
      
      // Format payment method
      const paymentMethodText = Array.isArray(job.paymentMethod) && job.paymentMethod.length > 0
        ? job.paymentMethod.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')
        : 'TBD';
      
      const confirmationMessage = `Thank you for scheduling your auto glass service with Windshield Repair SA! If all information is correct can you reply with "confirm".

Service day: ${job.installDate ? formatDate(job.installDate) : 'TBD'}
Time frame: ${job.installTime ? timeFrameMap[job.installTime] || job.installTime : 'TBD'}
Vehicle: ${vehicleInfo}
Service: ${serviceTypes.join(', ') || 'Auto Glass Service'}
Glass: ${glassTypes.join(', ') || 'TBD'}
Address: ${job.streetAddress || 'TBD'}
Total price: $${Number(job.totalDue || 0).toFixed(2)}
Payment method: ${paymentMethodText}

Please be sure to be onsite so we can take payment before start work and please keep in mind that our technician do not have change on hand (if paying cash)

Please let us know of any changes.`;

      const results = { emailSent: false, smsSent: false, errors: [] as string[] };

      // Send email if requested and customer has email
      if (parsed.data.sendEmail && job.email) {
        try {
          const subject = `Appointment Confirmation - Windshield Repair SA - ${vehicleInfo}`;
          await sendEmail(job.email, subject, confirmationMessage);
          results.emailSent = true;
          
          if (currentUser) {
            await logActivity(
              currentUser.id,
              currentUser.username,
              currentUser.role,
              'email_sent',
              'communications',
              job.id,
              job.jobNumber,
              { type: 'appointment_confirmation', to: job.email }
            );
          }
        } catch (emailError: any) {
          console.error("Failed to send confirmation email:", emailError.message);
          results.errors.push(`Email failed: ${emailError.message}`);
        }
      }
      
      // Send SMS if requested and customer has phone and Twilio is configured
      if (parsed.data.sendSms && job.phone && isTwilioConfigured()) {
        try {
          await sendSms(job.phone, confirmationMessage);
          results.smsSent = true;
          
          if (currentUser) {
            await logActivity(
              currentUser.id,
              currentUser.username,
              currentUser.role,
              'sms_sent',
              'communications',
              job.id,
              job.jobNumber,
              { type: 'appointment_confirmation', to: job.phone }
            );
          }
        } catch (smsError: any) {
          console.error("Failed to send confirmation SMS:", smsError.message);
          results.errors.push(`SMS failed: ${smsError.message}`);
        }
      }
      
      res.json({ 
        success: results.emailSent || results.smsSent, 
        ...results,
        message: confirmationMessage
      });
    } catch (error: any) {
      console.error("Failed to send appointment confirmation:", error.message);
      res.status(500).json({ message: "Failed to send confirmation" });
    }
  });

  // Add payment to job
  app.post("/api/jobs/:id/payments", async (req: any, res) => {
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
      
      // Log payment activity
      const currentUser = await getCurrentUser(req);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'payment_recorded',
          'jobs',
          job.id,
          job.jobNumber,
          { amount: parsed.data.amount, source: parsed.data.source, newBalance: job.balanceDue }
        );
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

  // Auto-archive completed jobs older than 2 weeks
  app.post("/api/jobs/auto-archive", isAuthenticated, async (req, res) => {
    try {
      const allJobs = await storage.getAllJobs();
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      let archivedCount = 0;
      
      for (const job of allJobs) {
        if (job.pipelineStage === "paid_completed" && job.completedAt) {
          const completedDate = new Date(job.completedAt);
          if (completedDate < twoWeeksAgo) {
            await storage.updateJob(job.id, { pipelineStage: "archived" });
            archivedCount++;
          }
        }
      }
      
      res.json({ archivedCount, message: `${archivedCount} jobs archived` });
    } catch (error) {
      res.status(500).json({ message: "Failed to auto-archive jobs" });
    }
  });

  // Manually archive/unarchive a job
  app.patch("/api/jobs/:id/archive", isAuthenticated, async (req, res) => {
    try {
      const { action } = req.body;
      if (action === "archive") {
        const job = await storage.updateJob(req.params.id, { pipelineStage: "archived" });
        if (!job) return res.status(404).json({ message: "Job not found" });
        res.json(job);
      } else if (action === "unarchive") {
        const currentJob = await storage.getJob(req.params.id);
        const updateData: any = { pipelineStage: "paid_completed" };
        if (currentJob && !currentJob.completedAt) {
          updateData.completedAt = new Date();
        }
        const job = await storage.updateJob(req.params.id, updateData);
        if (!job) return res.status(404).json({ message: "Job not found" });
        res.json(job);
      } else {
        res.status(400).json({ message: "Invalid action. Use 'archive' or 'unarchive'" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to archive/unarchive job" });
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
      
      // Log email activity
      const currentUser = await getCurrentUser(req as any);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'email_sent',
          'communications',
          req.params.id,
          `Sent email to ${job.email}: ${parsed.data.subject}`
        );
      }
      
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
      
      // Log receipt email activity
      const currentUser = await getCurrentUser(req as any);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'email_sent',
          'communications',
          job.id,
          `Sent receipt email to ${job.email}`
        );
      }

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
      
      // Log email reply activity
      const currentUser = await getCurrentUser(req as any);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'email_replied',
          'communications',
          undefined,
          `Replied to email thread: ${parsed.data.subject}`
        );
      }
      
      res.json({ message: "Reply sent successfully" });
    } catch (error: any) {
      console.error("Failed to send reply:", error);
      res.status(500).json({ message: error.message || "Failed to send reply" });
    }
  });

  // Send invoice email to dealer (requires authentication)
  app.post("/api/email/send-invoice", isAuthenticated, async (req, res) => {
    try {
      const invoiceSchema = z.object({
        jobId: z.string().min(1, "Job ID is required"),
        toEmail: z.string().email("Valid email is required"),
        pdfBase64: z.string().min(1, "PDF content is required"),
        filename: z.string().min(1, "Filename is required"),
      });
      
      const parsed = invoiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Invalid invoice data", 
          errors: parsed.error.errors 
        });
      }

      const { jobId, toEmail, pdfBase64, filename } = parsed.data;
      
      // Get job details for the email
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const customerName = job.isBusiness && job.businessName 
        ? job.businessName 
        : `${job.firstName} ${job.lastName}`;
      
      const subject = `Invoice #${job.jobNumber} - Windshield Repair SA`;
      
      const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #29ABE2;">Invoice from Windshield Repair SA</h2>
          <p>Dear ${customerName},</p>
          <p>Please find attached the invoice for Job #${job.jobNumber}.</p>
          <p><strong>Total Due:</strong> $${job.totalDue.toFixed(2)}</p>
          ${job.balanceDue > 0 ? `<p><strong>Balance Due:</strong> $${job.balanceDue.toFixed(2)}</p>` : ''}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #666; font-size: 12px;">
            Windshield Repair SA<br />
            901 SE Military Hwy #C051<br />
            San Antonio, TX 78214<br />
            Phone: (210) 890-0210<br />
            Email: windshieldrepairsa@gmail.com
          </p>
        </div>
      `;

      await sendEmailWithAttachment(toEmail, subject, body, {
        filename,
        base64: pdfBase64,
        mimeType: 'application/pdf'
      });

      res.json({ message: "Invoice sent successfully" });
    } catch (error: any) {
      console.error("Failed to send invoice:", error);
      res.status(500).json({ message: error.message || "Failed to send invoice" });
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
      
      // Log SMS activity
      const currentUser = await getCurrentUser(req as any);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'sms_sent',
          'communications',
          undefined,
          `Sent SMS to ${parsed.data.to}`
        );
      }
      
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
      
      // Log SMS activity
      const currentUser = await getCurrentUser(req as any);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'sms_sent',
          'communications',
          req.params.id,
          `Sent SMS to ${job.phone}`
        );
      }
      
      res.json({ message: "SMS sent successfully", data: message });
    } catch (error: any) {
      console.error("Failed to send SMS:", error);
      res.status(500).json({ message: error.message || "Failed to send SMS" });
    }
  });

  // Quote sending endpoints
  app.post("/api/quote/send-email", async (req, res) => {
    try {
      const quoteSchema = z.object({
        jobId: z.string(),
        to: z.string().email(),
        content: z.string(),
      });
      
      const parsed = quoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      }
      
      const job = await storage.getJob(parsed.data.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      const vehicle = job.vehicles?.[0];
      const vehicleInfo = vehicle 
        ? `${vehicle.vehicleYear || ""} ${vehicle.vehicleMake || ""} ${vehicle.vehicleModel || ""}`.trim()
        : "Your Vehicle";
      
      const subject = `Your Quote from Windshield Repair SA - ${vehicleInfo}`;
      
      await sendEmail(parsed.data.to, subject, parsed.data.content);
      
      // Log activity
      const currentUser = await getCurrentUser(req as any);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'email_sent',
          'communications',
          parsed.data.jobId,
          `Sent quote email to ${parsed.data.to}`
        );
      }
      
      res.json({ message: "Quote email sent successfully" });
    } catch (error: any) {
      console.error("Failed to send quote email:", error);
      res.status(500).json({ message: error.message || "Failed to send quote email" });
    }
  });

  app.post("/api/quote/send-sms", async (req, res) => {
    try {
      if (!isTwilioConfigured()) {
        return res.status(400).json({ message: "Twilio is not configured" });
      }
      
      const quoteSchema = z.object({
        jobId: z.string(),
        to: z.string(),
        content: z.string(),
      });
      
      const parsed = quoteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.issues });
      }
      
      const job = await storage.getJob(parsed.data.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      await sendSms(parsed.data.to, parsed.data.content);
      
      // Log activity
      const currentUser = await getCurrentUser(req as any);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'sms_sent',
          'communications',
          parsed.data.jobId,
          `Sent quote SMS to ${parsed.data.to}`
        );
      }
      
      res.json({ message: "Quote SMS sent successfully" });
    } catch (error: any) {
      console.error("Failed to send quote SMS:", error);
      res.status(500).json({ message: error.message || "Failed to send quote SMS" });
    }
  });

  // ====== VOICE CALLING ENDPOINTS ======

  // Check if voice calling is configured
  app.get("/api/voice/status", async (req, res) => {
    res.json({ 
      configured: isVoiceConfigured(),
      twilioConfigured: isTwilioConfigured(),
      phoneNumber: getTwilioPhoneNumber()
    });
  });

  // Generate access token for browser-based calling
  app.post("/api/voice/token", isAuthenticated, async (req, res) => {
    try {
      if (!isVoiceConfigured()) {
        return res.status(400).json({ 
          message: "Voice calling not configured. Need TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_TWIML_APP_SID." 
        });
      }

      const currentUser = await getCurrentUser(req as any);
      if (!currentUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Use user ID as the client identity
      const identity = `user_${currentUser.id}`;
      const token = generateVoiceToken(identity);

      res.json({ token, identity });
    } catch (error: any) {
      console.error("Failed to generate voice token:", error);
      res.status(500).json({ message: error.message || "Failed to generate voice token" });
    }
  });

  // Incoming call webhook - Twilio calls this when someone dials the number OR when browser initiates outbound
  app.post("/api/voice/incoming", async (req, res) => {
    res.set("Content-Type", "text/xml");
    try {
      console.log("Voice webhook received:", req.body);

      // Validate Twilio signature for security (in production)
      const twilioSignature = req.headers['x-twilio-signature'] as string;
      if (twilioSignature && process.env.NODE_ENV === 'production') {
        const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        if (!validateTwilioSignature(url, req.body, twilioSignature)) {
          console.warn("Invalid Twilio signature - possible spoofing attempt");
          return res.status(403).send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
        }
      }

      const { CallSid, From, To, CallStatus } = req.body;
      
      const isOutboundFromBrowser = From && From.startsWith("client:");
      
      if (isOutboundFromBrowser && To) {
        const toNumber = To;
        console.log("Outbound call from browser detected, dialing:", toNumber);
        
        let formattedNumber = toNumber.replace(/\D/g, "");
        if (formattedNumber.length === 10) {
          formattedNumber = "+1" + formattedNumber;
        } else if (!formattedNumber.startsWith("+")) {
          formattedNumber = "+" + formattedNumber;
        }
        
        const twiml = generateOutboundCallTwiml(formattedNumber);
        res.send(twiml);

        // Log outbound call asynchronously after response is sent
        try {
          let contactName = "Unknown";
          const jobs = await storage.getAllJobs();
          const matchingJob = jobs.find((j: any) => j.phone?.replace(/\D/g, "") === formattedNumber.replace(/\D/g, ""));
          if (matchingJob) {
            contactName = `${matchingJob.firstName} ${matchingJob.lastName}`;
          }
          await db.insert(phoneCalls).values({
            callSid: CallSid,
            direction: 'outbound',
            fromNumber: getTwilioPhoneNumber() || "",
            toNumber: formattedNumber,
            status: 'initiated',
            contactName: contactName,
          }).onConflictDoUpdate({
            target: phoneCalls.callSid,
            set: { status: 'initiated' }
          });
        } catch (logErr) {
          console.error("Failed to log outbound call:", logErr);
        }
        return;
      }

      const aiEnabled = await isAIReceptionistEnabled();
      if (aiEnabled) {
        console.log("[AI Receptionist] Routing incoming call to ElevenLabs AI agent");
        const wsUrl = `wss://${req.get('host')}/media-stream`;
        const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${wsUrl}"><Parameter name="caller" value="${From || ''}" /></Stream></Connect></Response>`;
        res.send(twiml);

        try {
          let contactName = "Unknown Caller";
          const formattedFrom = From?.replace(/\D/g, "");
          if (formattedFrom) {
            const allJobs = await storage.getAllJobs();
            const matchingJob = allJobs.find((j: any) => j.phone?.replace(/\D/g, "") === formattedFrom);
            if (matchingJob) contactName = `${matchingJob.firstName} ${matchingJob.lastName}`;
          }
          await db.insert(phoneCalls).values({
            callSid: CallSid,
            direction: 'inbound',
            fromNumber: From,
            toNumber: To,
            status: CallStatus || 'ringing',
            contactName,
          }).onConflictDoUpdate({
            target: phoneCalls.callSid,
            set: { status: CallStatus || 'ringing' }
          });
        } catch (logErr) {
          console.error("Failed to log AI-routed call:", logErr);
        }
        return;
      }

      // AI Receptionist is OFF - handle inbound call normally
      // Send TwiML response FIRST, then log asynchronously
      let contactName = "Unknown Caller";
      try {
        const formattedFrom = From?.replace(/\D/g, "");
        if (formattedFrom) {
          const jobs = await storage.getAllJobs();
          const matchingJob = jobs.find((j: any) => j.phone?.replace(/\D/g, "") === formattedFrom);
          if (matchingJob) {
            contactName = `${matchingJob.firstName} ${matchingJob.lastName}`;
          }
        }
      } catch (lookupErr) {
        console.error("Contact lookup failed, using default name:", lookupErr);
      }

      // Get call forwarding settings
      let forwarding: CallForwardingConfig | undefined;
      try {
        const [fwdSettings] = await db.select().from(callForwardingSettings).limit(1);
        if (fwdSettings && fwdSettings.isEnabled) {
          forwarding = {
            forwardingNumber: fwdSettings.forwardingNumber,
            isEnabled: fwdSettings.isEnabled,
            timeoutSeconds: fwdSettings.timeoutSeconds,
            whisperMessage: fwdSettings.whisperMessage || "Incoming call from Windshield Repair SA",
          };
        }
      } catch (fwdErr) {
        console.error("Failed to get call forwarding settings:", fwdErr);
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const twiml = generateIncomingCallTwiml(contactName, forwarding, baseUrl);
      console.log("Generated TwiML for incoming call:", twiml);
      res.send(twiml);

      // Log the incoming call asynchronously after response is sent
      try {
        await db.insert(phoneCalls).values({
          callSid: CallSid,
          direction: 'inbound',
          fromNumber: From,
          toNumber: To,
          status: CallStatus || 'ringing',
          contactName: contactName,
        }).onConflictDoUpdate({
          target: phoneCalls.callSid,
          set: { status: CallStatus || 'ringing' }
        });
      } catch (logErr) {
        console.error("Failed to log incoming call:", logErr);
      }
    } catch (error: any) {
      console.error("Incoming call webhook error:", error);
      if (!res.headersSent) {
        res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are experiencing technical difficulties. Please try again later.</Say></Response>`);
      }
    }
  });

  // Call status callback - Twilio calls this when call status changes
  app.post("/api/voice/status-callback", async (req, res) => {
    try {
      // Validate Twilio signature for security (in production)
      const twilioSignature = req.headers['x-twilio-signature'] as string;
      if (twilioSignature && process.env.NODE_ENV === 'production') {
        const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        if (!validateTwilioSignature(url, req.body, twilioSignature)) {
          console.warn("Invalid Twilio signature on status callback");
          return res.status(204).end();
        }
      }

      const { CallSid, CallStatus, CallDuration, From, Direction } = req.body;
      console.log("Call status callback:", { CallSid, CallStatus, CallDuration, From, Direction });

      const updateData: any = { status: CallStatus };
      if (CallDuration) {
        updateData.duration = parseInt(CallDuration);
      }
      if (CallStatus === 'in-progress') {
        updateData.answeredAt = new Date();
      }
      if (['completed', 'failed', 'busy', 'no-answer'].includes(CallStatus)) {
        updateData.endedAt = new Date();
      }

      await db.update(phoneCalls)
        .set(updateData)
        .where(eq(phoneCalls.callSid, CallSid));

      if (['no-answer', 'busy', 'failed'].includes(CallStatus) && From && Direction === 'inbound') {
        const twilioNumber = getTwilioPhoneNumber();
        const callerNumber = From.replace(/\D/g, '');
        const ownNumber = twilioNumber?.replace(/\D/g, '');
        if (callerNumber && callerNumber !== ownNumber && isTwilioConfigured()) {
          const [existingCall] = await db.select({ notes: phoneCalls.notes })
            .from(phoneCalls)
            .where(eq(phoneCalls.callSid, CallSid))
            .limit(1);
          const alreadySent = existingCall?.notes?.includes('auto-reply sent');
          if (!alreadySent) {
            try {
              const autoReplyMessage =
                "Thanks for reaching out to Windshield Repair SA! Sorry we missed your call\u2014we're currently assisting another customer. We'll call you back shortly!\n\n" +
                "For a faster response, feel free to text us your VIN (or Year/Make/Model) and the service you're inquiring about. We will get back to you ASAP. Reply STOP to opt out.";
              await sendSms(From, autoReplyMessage);
              const currentNotes = existingCall?.notes || '';
              await db.update(phoneCalls)
                .set({ notes: currentNotes ? `${currentNotes} | auto-reply sent` : 'auto-reply sent' })
                .where(eq(phoneCalls.callSid, CallSid));
              console.log(`Auto-reply SMS sent to ${From} for missed call ${CallSid}`);
            } catch (smsError: any) {
              console.error(`Failed to send auto-reply SMS to ${From}:`, smsError.message);
            }
          } else {
            console.log(`Auto-reply already sent for call ${CallSid}, skipping`);
          }
        }
      }

      res.status(204).end();
    } catch (error: any) {
      console.error("Call status callback error:", error);
      res.status(204).end();
    }
  });

  // Dial action - called by Twilio when browser client doesn't answer (timeout/no-answer)
  app.post("/api/voice/dial-action", async (req, res) => {
    res.set("Content-Type", "text/xml");
    try {
      const { DialCallStatus, CallSid, From } = req.body;
      console.log("Dial action received:", { DialCallStatus, CallSid, From });

      // If the browser client answered, we're done
      if (DialCallStatus === "completed" || DialCallStatus === "answered") {
        const response = new (await import("twilio")).default.twiml.VoiceResponse();
        res.send(response.toString());
        return;
      }

      // ElevenLabs handles AI receptionist calls directly - skip to call forwarding

      const [fwdSettings] = await db.select().from(callForwardingSettings).limit(1);
      if (fwdSettings && fwdSettings.isEnabled && fwdSettings.forwardingNumber) {
        console.log(`Forwarding call ${CallSid} to ${fwdSettings.forwardingNumber}`);
        const fwdBaseUrl = `${req.protocol}://${req.get('host')}`;
        const twiml = generateForwardTwiml(
          fwdSettings.forwardingNumber,
          fwdSettings.whisperMessage || "Incoming call from Windshield Repair SA",
          fwdBaseUrl
        );
        console.log("Forward TwiML:", twiml);
        res.send(twiml);

        // Update call log with forwarding info
        try {
          await db.update(phoneCalls)
            .set({ notes: `Forwarded to ${fwdSettings.forwardingNumber}` })
            .where(eq(phoneCalls.callSid, CallSid));
        } catch (logErr) {
          console.error("Failed to update call log with forwarding info:", logErr);
        }
      } else {
        // No forwarding configured - send auto-reply SMS and play voicemail
        const twilio = (await import("twilio")).default;
        const response = new twilio.twiml.VoiceResponse();
        response.say({ voice: "Polly.Joanna" }, "We're sorry, no one is available to take your call right now. Please try again later or leave a message after the beep.");
        response.record({ maxLength: 120, transcribe: false });
        res.send(response.toString());

        if (From && isTwilioConfigured()) {
          const twilioNumber = getTwilioPhoneNumber();
          const callerDigits = From.replace(/\D/g, '');
          const ownDigits = twilioNumber?.replace(/\D/g, '');
          if (callerDigits && callerDigits !== ownDigits) {
            (async () => {
              try {
                const [existingCall] = await db.select({ notes: phoneCalls.notes })
                  .from(phoneCalls)
                  .where(eq(phoneCalls.callSid, CallSid))
                  .limit(1);
                if (existingCall?.notes?.includes('auto-reply sent')) {
                  console.log(`Auto-reply already sent for call ${CallSid}, skipping`);
                  return;
                }
                const autoReplyMessage =
                  "Thanks for reaching out to Windshield Repair SA! Sorry we missed your call\u2014we're currently assisting another customer. We'll call you back shortly!\n\n" +
                  "For a faster response, feel free to text us your VIN (or Year/Make/Model) and the service you're inquiring about. We will get back to you ASAP. Reply STOP to opt out.";
                await sendSms(From, autoReplyMessage);
                const currentNotes = existingCall?.notes || '';
                await db.update(phoneCalls)
                  .set({ notes: currentNotes ? `${currentNotes} | auto-reply sent` : 'auto-reply sent' })
                  .where(eq(phoneCalls.callSid, CallSid));
                console.log(`Auto-reply SMS sent to ${From} for missed call ${CallSid} (via dial-action)`);
              } catch (smsError: any) {
                console.error(`Failed to send auto-reply SMS to ${From}:`, smsError.message);
              }
            })();
          }
        }
      }
    } catch (error: any) {
      console.error("Dial action error:", error);
      if (!res.headersSent) {
        res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred. Please try again later.</Say></Response>`);
      }
    }
  });

  // Whisper endpoint - plays a message to the person answering the forwarded call
  app.post("/api/voice/whisper", async (req, res) => {
    res.set("Content-Type", "text/xml");
    try {
      const [fwdSettings] = await db.select().from(callForwardingSettings).limit(1);
      const whisperMessage = fwdSettings?.whisperMessage || "Incoming call from Windshield Repair SA";

      const twilio = (await import("twilio")).default;
      const response = new twilio.twiml.VoiceResponse();
      response.say({ voice: "Polly.Joanna" }, whisperMessage);
      res.send(response.toString());
    } catch (error: any) {
      console.error("Whisper endpoint error:", error);
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
    }
  });

  app.post("/api/voice/transfer", isAuthenticated, async (req: any, res) => {
    try {
      const { callSid, transferTo } = req.body;
      if (!callSid || !transferTo) {
        return res.status(400).json({ message: "callSid and transferTo are required" });
      }

      const protocol = req.headers["x-forwarded-proto"] || "https";
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      await transferActiveCall(callSid, transferTo, baseUrl);
      res.json({ success: true, message: `Transferring call to ${transferTo}` });
    } catch (error: any) {
      console.error("Failed to transfer call:", error);
      res.status(500).json({ message: error.message || "Failed to transfer call" });
    }
  });

  app.post("/api/voice/hold", isAuthenticated, async (req: any, res) => {
    try {
      const { callSid } = req.body;
      if (!callSid) {
        return res.status(400).json({ message: "callSid is required" });
      }
      const parentCallSid = await holdCall(callSid);
      res.json({ success: true, message: "Call placed on hold", parentCallSid });
    } catch (error: any) {
      console.error("Failed to hold call:", error);
      res.status(500).json({ message: error.message || "Failed to hold call" });
    }
  });

  app.post("/api/voice/unhold", isAuthenticated, async (req: any, res) => {
    try {
      const { callSid } = req.body;
      if (!callSid) {
        return res.status(400).json({ message: "callSid is required" });
      }
      await unholdCall(callSid);
      res.json({ success: true, message: "Call resumed from hold" });
    } catch (error: any) {
      console.error("Failed to unhold call:", error);
      res.status(500).json({ message: error.message || "Failed to resume call" });
    }
  });

  app.post("/api/voice/hangup-held", isAuthenticated, async (req: any, res) => {
    try {
      const { callSid } = req.body;
      if (!callSid) {
        return res.status(400).json({ message: "callSid is required" });
      }
      const twilioClient = getClient();
      await twilioClient.calls(callSid).update({ status: "completed" });
      res.json({ success: true, message: "Held call terminated" });
    } catch (error: any) {
      console.error("Failed to hang up held call:", error);
      res.status(500).json({ message: error.message || "Failed to end held call" });
    }
  });

  app.post("/api/voice/transfer-fallback", async (req, res) => {
    res.set("Content-Type", "text/xml");
    try {
      const { DialCallStatus } = req.body;
      console.log("Transfer fallback - DialCallStatus:", DialCallStatus);

      if (DialCallStatus === "completed") {
        const response = new (await import("twilio")).default.twiml.VoiceResponse();
        response.hangup();
        return res.send(response.toString());
      }

      const twiml = generateTransferFallbackTwiml();
      res.send(twiml);
    } catch (error: any) {
      console.error("Transfer fallback error:", error);
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>Transfer failed. Please hold.</Say></Response>`);
    }
  });

  // Get call forwarding settings
  app.get("/api/voice/forwarding", isAuthenticated, async (req, res) => {
    try {
      const [settings] = await db.select().from(callForwardingSettings).limit(1);
      res.json(settings || { isEnabled: false, forwardingNumber: "", timeoutSeconds: 5, whisperMessage: "Incoming call from Windshield Repair SA" });
    } catch (error: any) {
      console.error("Failed to get forwarding settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update call forwarding settings
  app.put("/api/voice/forwarding", isAuthenticated, async (req: any, res) => {
    try {
      const { forwardingNumber, isEnabled, timeoutSeconds, whisperMessage } = req.body;
      
      const [existing] = await db.select().from(callForwardingSettings).limit(1);
      
      if (existing) {
        const [updated] = await db.update(callForwardingSettings)
          .set({
            forwardingNumber: forwardingNumber !== undefined ? forwardingNumber : existing.forwardingNumber,
            isEnabled: isEnabled !== undefined ? isEnabled : existing.isEnabled,
            timeoutSeconds: timeoutSeconds !== undefined ? timeoutSeconds : existing.timeoutSeconds,
            whisperMessage: whisperMessage !== undefined ? whisperMessage : existing.whisperMessage,
            updatedAt: new Date(),
          })
          .where(eq(callForwardingSettings.id, existing.id))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db.insert(callForwardingSettings).values({
          forwardingNumber: forwardingNumber || "",
          isEnabled: isEnabled !== undefined ? isEnabled : true,
          timeoutSeconds: timeoutSeconds || 5,
          whisperMessage: whisperMessage || "Incoming call from Windshield Repair SA",
        }).returning();
        res.json(created);
      }
    } catch (error: any) {
      console.error("Failed to update forwarding settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get call logs
  app.get("/api/voice/calls", isAuthenticated, async (req, res) => {
    try {
      const calls = await db.select()
        .from(phoneCalls)
        .orderBy(desc(phoneCalls.startedAt))
        .limit(100);
      res.json(calls);
    } catch (error: any) {
      console.error("Failed to get calls:", error);
      res.status(500).json({ message: error.message || "Failed to get calls" });
    }
  });

  // Update call record (e.g., add notes, link to job)
  app.patch("/api/voice/calls/:callSid", isAuthenticated, async (req, res) => {
    try {
      const callSidParam = req.params.callSid;
      const { notes, jobId, answeredBy } = req.body;

      const updateData: Partial<typeof phoneCalls.$inferInsert> = {};
      if (notes !== undefined) updateData.notes = notes;
      if (jobId !== undefined) updateData.jobId = jobId;
      if (answeredBy !== undefined) updateData.answeredBy = answeredBy;

      await db.update(phoneCalls)
        .set(updateData)
        .where(eq(phoneCalls.callSid, callSidParam as string));

      res.json({ message: "Call updated" });
    } catch (error: any) {
      console.error("Failed to update call:", error);
      res.status(500).json({ message: error.message || "Failed to update call" });
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
      
      // Log email activity
      const currentUser = await getCurrentUser(req as any);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'email_sent',
          'communications',
          undefined,
          `Sent Bluehost email to ${parsed.data.to}: ${parsed.data.subject}`
        );
      }
      
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
      
      // Log email reply activity
      const currentUser = await getCurrentUser(req as any);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          'email_replied',
          'communications',
          undefined,
          `Replied to Bluehost email: ${parsed.data.subject}`
        );
      }
      
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

  app.get("/api/config/maps-key", (req, res) => {
    res.json({ key: process.env.GOOGLE_MAPS_API_KEY || "" });
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

  // ============ FOLLOW-UP SYSTEM ROUTES ============

  // Get follow-up tasks for a specific job
  app.get("/api/jobs/:id/follow-up-tasks", isAuthenticated, async (req, res) => {
    try {
      const tasks = await storage.getScheduledTasksByJob(req.params.id as string);
      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get follow-up tasks" });
    }
  });

  // Get follow-up logs for a specific job
  app.get("/api/jobs/:id/follow-up-logs", isAuthenticated, async (req, res) => {
    try {
      const logs = await storage.getFollowUpLogsByJob(req.params.id as string);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get follow-up logs" });
    }
  });

  // Get all pending follow-up notifications (for the notification bell)
  app.get("/api/follow-up-notifications", isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getPendingNotifications();
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get follow-up notifications" });
    }
  });

  // Manually send a follow-up (SMS/Email) from a notification
  app.post("/api/follow-up-tasks/:id/send", isAuthenticated, async (req: any, res) => {
    try {
      const taskId = req.params.id;
      const { sendSms: shouldSendSms, sendEmail: shouldSendEmail } = req.body;
      
      const allTasks = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, taskId));
      const task = allTasks[0];
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      let smsSent = false;
      let emailSent = false;

      if (shouldSendSms !== false && task.customerPhone && task.smsContent) {
        try {
          if (isTwilioConfigured()) {
            await sendSms(task.customerPhone, task.smsContent);
            smsSent = true;
          } else {
            console.log(`[FollowUp] Manual SMS would send to ${task.customerPhone}`);
            smsSent = true;
          }
        } catch (err: any) {
          console.error("Follow-up SMS send error:", err.message);
        }
      }

      if (shouldSendEmail !== false && task.customerEmail && task.emailSubject && task.emailBody) {
        try {
          await sendEmail(task.customerEmail, task.emailSubject, task.emailBody);
          emailSent = true;
        } catch (err: any) {
          console.error("Follow-up Email send error:", err.message);
        }
      }

      await storage.updateScheduledTaskStatus(taskId, "sent", new Date());
      
      const currentUser = await getCurrentUser(req);
      const actions: string[] = [];
      if (smsSent) actions.push("SMS");
      if (emailSent) actions.push("Email");

      await storage.createFollowUpLog({
        jobId: task.jobId,
        jobNumber: task.jobNumber,
        action: "manual_send",
        sequenceNumber: task.sequenceNumber,
        details: `Sequence ${task.sequenceNumber}: Manually sent ${actions.join(" & ")} to ${task.customerName}`,
        performedBy: currentUser?.username || "unknown",
      });

      res.json({ success: true, smsSent, emailSent });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to send follow-up" });
    }
  });

  // Log a call result for a follow-up task
  app.post("/api/follow-up-tasks/:id/log-call", isAuthenticated, async (req: any, res) => {
    try {
      const taskId = req.params.id;
      const { result, notes } = req.body;
      
      const allTasks = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, taskId));
      const task = allTasks[0];
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      await storage.updateScheduledTaskStatus(taskId, "sent", new Date());

      const currentUser = await getCurrentUser(req);

      await storage.createFollowUpLog({
        jobId: task.jobId,
        jobNumber: task.jobNumber,
        action: "call_logged",
        sequenceNumber: task.sequenceNumber,
        details: `Call result: ${result}${notes ? ` - ${notes}` : ""}`,
        performedBy: currentUser?.username || "unknown",
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to log call result" });
    }
  });

  // Update follow-up mode for a job
  app.patch("/api/jobs/:id/follow-up-mode", isAuthenticated, async (req, res) => {
    try {
      const modeSchema = z.object({
        followUpMode: z.enum(followUpModes),
      });
      const parsed = modeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid follow-up mode" });
      }

      const job = await storage.updateJob(req.params.id, { followUpMode: parsed.data.followUpMode } as any);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Update all pending tasks to the new mode
      const tasks = await storage.getScheduledTasksByJob(req.params.id);
      for (const task of tasks) {
        if (task.status === "pending") {
          await db.update(scheduledTasks)
            .set({ followUpMode: parsed.data.followUpMode })
            .where(eq(scheduledTasks.id, task.id));
        }
      }

      res.json(job);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to update follow-up mode" });
    }
  });

  // Get follow-up sequence templates (for reference)
  app.get("/api/follow-up-sequences", isAuthenticated, async (req, res) => {
    const sequences = FOLLOW_UP_SEQUENCES.map(s => ({
      sequenceNumber: s.sequenceNumber,
      hoursDelay: s.hoursDelay,
      label: s.label,
    }));
    res.json(sequences);
  });

  // ============ CUSTOMER SEARCH (Auto-Populate) ============

  app.get("/api/search-customers", isAuthenticated, async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      const field = (req.query.field as string) || "lastName";
      const validFields = ["businessName", "lastName", "phone"];
      if (!validFields.includes(field)) {
        return res.status(400).json({ message: "Invalid field. Must be businessName, lastName, or phone" });
      }
      if (!query || query.trim().length < 2) {
        return res.json([]);
      }
      const results = await storage.searchContacts(query, field as "businessName" | "lastName" | "phone");
      res.json(results);
    } catch (error: any) {
      console.error("Search customers error:", error);
      res.status(500).json({ message: error.message || "Failed to search customers" });
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

  // Lead polling with date cutoff safeguard - only processes emails after Jan 31, 2026 noon UTC
  if (isBluehostConfigured()) {
    startLeadPolling(60000); // Check every 60 seconds
  }

  // ==================== Technician Job Data Routes ====================
  
  // Validation schemas for technician data
  const taskStatusSchema = z.object({
    onMyWay: z.boolean().optional(),
    onSite: z.boolean().optional(),
    takePayment: z.boolean().optional(),
  }).optional();

  const partsChecklistSchema = z.record(z.string(), z.boolean()).optional();

  const techDataUpdateSchema = z.object({
    taskStatus: taskStatusSchema,
    partsChecklist: partsChecklistSchema,
  });

  // Get technician data for a specific job
  app.get("/api/tech-data/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Validate jobId format (basic sanitization)
      if (!jobId || typeof jobId !== "string" || jobId.length > 100) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      const data = await storage.getTechnicianJobData(jobId);
      res.json(data || { jobId, taskStatus: {}, partsChecklist: {} });
    } catch (error: any) {
      console.error("Error fetching technician job data:", error);
      res.status(500).json({ message: error.message || "Failed to fetch technician data" });
    }
  });

  // Update technician data for a job
  app.patch("/api/tech-data/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Validate jobId format
      if (!jobId || typeof jobId !== "string" || jobId.length > 100) {
        return res.status(400).json({ message: "Invalid job ID" });
      }

      // Validate request body
      const parseResult = techDataUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: parseResult.error.flatten() 
        });
      }

      const { taskStatus, partsChecklist } = parseResult.data;
      const data = await storage.upsertTechnicianJobData(jobId, { taskStatus, partsChecklist });
      res.json(data);
    } catch (error: any) {
      console.error("Error updating technician job data:", error);
      res.status(500).json({ message: error.message || "Failed to update technician data" });
    }
  });

  // ==================== Tech Materials List Routes ====================
  
  // Validation schema for materials
  const materialCreateSchema = z.object({
    name: z.string().min(1).max(100),
    quantity: z.number().int().min(0).optional(),
    minQuantity: z.number().int().min(0).optional(),
    sortOrder: z.number().int().min(0).optional(),
  });

  const materialUpdateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    quantity: z.number().int().min(0).optional(),
    minQuantity: z.number().int().min(0).optional(),
    isChecked: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  });
  
  // Get all materials
  app.get("/api/tech-materials", async (req, res) => {
    try {
      const materials = await storage.getTechMaterials();
      res.json(materials);
    } catch (error: any) {
      console.error("Error fetching tech materials:", error);
      res.status(500).json({ message: error.message || "Failed to fetch materials" });
    }
  });

  // Create a new material (admin only)
  app.post("/api/tech-materials", async (req, res) => {
    try {
      // Check authentication
      const currentUser = await getCurrentUser(req);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Validate request body
      const parseResult = materialCreateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: parseResult.error.flatten() 
        });
      }

      const material = await storage.createTechMaterial(parseResult.data);
      res.json(material);
    } catch (error: any) {
      console.error("Error creating tech material:", error);
      res.status(500).json({ message: error.message || "Failed to create material" });
    }
  });

  // Update a material
  app.patch("/api/tech-materials/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate ID format
      if (!id || typeof id !== "string" || id.length > 100) {
        return res.status(400).json({ message: "Invalid material ID" });
      }

      // Validate request body
      const parseResult = materialUpdateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body", 
          errors: parseResult.error.flatten() 
        });
      }

      const material = await storage.updateTechMaterial(id, parseResult.data);
      res.json(material);
    } catch (error: any) {
      console.error("Error updating tech material:", error);
      res.status(500).json({ message: error.message || "Failed to update material" });
    }
  });

  // Delete a material (admin only)
  app.delete("/api/tech-materials/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check authentication
      const currentUser = await getCurrentUser(req);
      if (!currentUser || currentUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      // Validate ID format
      if (!id || typeof id !== "string" || id.length > 100) {
        return res.status(400).json({ message: "Invalid material ID" });
      }

      await storage.deleteTechMaterial(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting tech material:", error);
      res.status(500).json({ message: error.message || "Failed to delete material" });
    }
  });

  // Seed default materials (run once to populate the list)
  app.post("/api/tech-materials/seed", async (req, res) => {
    try {
      const defaultMaterials = [
        { name: "Glass Cleaner", quantity: 0, minQuantity: 2, sortOrder: 1 },
        { name: "Paper Towels", quantity: 0, minQuantity: 2, sortOrder: 2 },
        { name: "Urethane", quantity: 0, minQuantity: 2, sortOrder: 3 },
        { name: "Primer", quantity: 0, minQuantity: 2, sortOrder: 4 },
        { name: "Small Daubers", quantity: 0, minQuantity: 5, sortOrder: 5 },
        { name: "Large Daubers", quantity: 0, minQuantity: 5, sortOrder: 6 },
        { name: "Blades", quantity: 0, minQuantity: 5, sortOrder: 7 },
        { name: "White Sponges", quantity: 0, minQuantity: 5, sortOrder: 8 },
        { name: "Cloth Towels", quantity: 0, minQuantity: 5, sortOrder: 9 },
      ];

      const existing = await storage.getTechMaterials();
      if (existing.length === 0) {
        for (const mat of defaultMaterials) {
          await storage.createTechMaterial(mat);
        }
        const materials = await storage.getTechMaterials();
        res.json({ message: "Default materials seeded", materials });
      } else {
        res.json({ message: "Materials already exist", materials: existing });
      }
    } catch (error: any) {
      console.error("Error seeding tech materials:", error);
      res.status(500).json({ message: error.message || "Failed to seed materials" });
    }
  });

  // ==================== Pickup Checklist ====================
  
  // Get all pickup checklist items
  app.get("/api/pickup-checklist", async (req, res) => {
    try {
      const items = await db.select().from(pickupChecklist);
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching pickup checklist:", error);
      res.status(500).json({ message: error.message || "Failed to fetch pickup checklist" });
    }
  });

  // Toggle pickup status for a part
  app.post("/api/pickup-checklist/toggle", async (req, res) => {
    try {
      const toggleSchema = z.object({
        jobId: z.string(),
        vehicleIndex: z.number(),
        partIndex: z.number(),
        isPickedUp: z.boolean(),
      });

      const { jobId, vehicleIndex, partIndex, isPickedUp } = toggleSchema.parse(req.body);

      // Check if record exists
      const existing = await db.select().from(pickupChecklist)
        .where(
          and(
            eq(pickupChecklist.jobId, jobId),
            eq(pickupChecklist.vehicleIndex, vehicleIndex),
            eq(pickupChecklist.partIndex, partIndex)
          )
        );

      if (existing.length > 0) {
        // Update existing record
        await db.update(pickupChecklist)
          .set({ 
            isPickedUp, 
            pickedUpAt: isPickedUp ? new Date() : null 
          })
          .where(eq(pickupChecklist.id, existing[0].id));
      } else {
        // Create new record
        await db.insert(pickupChecklist).values({
          jobId,
          vehicleIndex,
          partIndex,
          isPickedUp,
          pickedUpAt: isPickedUp ? new Date() : null,
        });
      }

      const items = await db.select().from(pickupChecklist);
      res.json(items);
    } catch (error: any) {
      console.error("Error toggling pickup status:", error);
      res.status(500).json({ message: error.message || "Failed to toggle pickup status" });
    }
  });

  // ==================== Technician Supplies Checklist ====================
  
  // Get all supplies in the checklist
  app.get("/api/tech-supplies", async (req, res) => {
    try {
      const supplies = await db.select().from(techSuppliesChecklist).orderBy(techSuppliesChecklist.sortOrder);
      res.json(supplies);
    } catch (error: any) {
      console.error("Error fetching supplies checklist:", error);
      res.status(500).json({ message: error.message || "Failed to fetch supplies checklist" });
    }
  });

  // Toggle a supply's checked status
  app.patch("/api/tech-supplies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const toggleSchema = z.object({
        isChecked: z.boolean(),
      });

      const { isChecked } = toggleSchema.parse(req.body);

      await db.update(techSuppliesChecklist)
        .set({ isChecked, updatedAt: new Date() })
        .where(eq(techSuppliesChecklist.id, id));

      const supplies = await db.select().from(techSuppliesChecklist).orderBy(techSuppliesChecklist.sortOrder);
      res.json(supplies);
    } catch (error: any) {
      console.error("Error toggling supply:", error);
      res.status(500).json({ message: error.message || "Failed to toggle supply" });
    }
  });

  // ==================== Technician Payment Recording ====================
  
  // Add payment from technician portal
  app.post("/api/tech/jobs/:id/payment", async (req, res) => {
    try {
      const { id } = req.params;
      const paymentSchema = z.object({
        amount: z.number().min(0.01, "Amount must be greater than 0"),
        source: z.enum(["cash", "credit_card", "debit_card", "check", "insurance", "other"]),
        notes: z.string().optional(),
      });

      const { amount, source, notes } = paymentSchema.parse(req.body);
      
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Create payment entry
      const paymentEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        source,
        amount,
        notes: notes || `Payment recorded by technician`,
      };

      // Calculate new totals
      const currentPaymentHistory = (job.paymentHistory as any[]) || [];
      const newPaymentHistory = [...currentPaymentHistory, paymentEntry];
      const newAmountPaid = (job.amountPaid || 0) + amount;
      const totalDue = job.totalDue || 0;
      const newBalanceDue = Math.max(0, totalDue - newAmountPaid);
      
      // Determine payment status
      let newPaymentStatus: "pending" | "partial" | "paid" = "pending";
      if (newBalanceDue <= 0) {
        newPaymentStatus = "paid";
      } else if (newAmountPaid > 0) {
        newPaymentStatus = "partial";
      }

      // Update payment methods
      type PaymentMethodType = "cash" | "card" | "check" | "zelle" | "bank_deposit";
      const currentMethods = (job.paymentMethod as PaymentMethodType[]) || [];
      const methodMap: Record<string, PaymentMethodType> = {
        cash: "cash",
        credit_card: "card",
        debit_card: "card",
        check: "check",
        insurance: "card",
        other: "cash",
      };
      const newMethod: PaymentMethodType = methodMap[source] || "cash";
      const updatedMethods: PaymentMethodType[] = currentMethods.includes(newMethod) 
        ? currentMethods 
        : [...currentMethods, newMethod];

      // Update job
      const updatedJob = await storage.updateJob(id, {
        paymentHistory: newPaymentHistory,
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        paymentStatus: newPaymentStatus,
        paymentMethod: updatedMethods,
        // If fully paid, move to paid_completed stage and set completion timestamp (only if not already set)
        ...(newPaymentStatus === "paid" ? { pipelineStage: "paid_completed", ...(!job.completedAt ? { completedAt: new Date() } : {}) } : {}),
      });

      // Log activity if we have a current user
      const currentUser = await getCurrentUser(req);
      if (currentUser) {
        await logActivity(
          currentUser.id,
          currentUser.username,
          currentUser.role,
          "payment_recorded",
          "jobs",
          job.id,
          job.jobNumber,
          { amount, source, newBalance: newBalanceDue, newStatus: newPaymentStatus }
        );
      }

      res.json(updatedJob);
    } catch (error: any) {
      console.error("Error recording tech payment:", error);
      res.status(500).json({ message: error.message || "Failed to record payment" });
    }
  });
}
