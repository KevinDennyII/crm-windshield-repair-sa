import { type User, type UpsertUser, type Job, type InsertJob, type PipelineStage, type PaymentHistoryEntry, type Vehicle, type Part, type CustomerReminder, type InsertCustomerReminder, type Contact, type InsertContact, type ActivityLog, type InsertActivityLog, type ProcessedLead, type InsertProcessedLead, jobs, users, customerReminders, contacts, activityLogs, processedLeads } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, sql, max, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  
  getAllJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  updateJobStage(id: string, stage: PipelineStage): Promise<Job | undefined>;
  addPaymentToJob(id: string, payment: PaymentHistoryEntry): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
  getNextJobNumber(): Promise<string>;
  
  // Customer reminders
  getCustomerReminder(customerKey: string): Promise<CustomerReminder | undefined>;
  upsertCustomerReminder(reminder: InsertCustomerReminder): Promise<CustomerReminder>;
  deleteCustomerReminder(customerKey: string): Promise<boolean>;
  
  // Contacts
  getAllContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  getContactByPhone(phone: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
  syncContactFromJob(job: Job): Promise<Contact>;
  
  // Activity logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(filters?: { userId?: string; startDate?: Date; endDate?: Date; actionType?: string }): Promise<ActivityLog[]>;
  getActivityLogsByUser(userId: string, limit?: number): Promise<ActivityLog[]>;
  
  // User management
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined>;
  
  // Processed leads (for preventing duplicate lead processing)
  isLeadProcessed(emailId: string): Promise<boolean>;
  markLeadProcessed(emailId: string, emailSubject?: string, customerEmail?: string): Promise<void>;
  getAllProcessedLeadIds(): Promise<string[]>;
}

function createDefaultPart(overrides: Partial<Part> = {}): Part {
  return {
    id: randomUUID(),
    serviceType: "replace",
    glassType: "windshield",
    glassPartNumber: "",
    isAftermarket: true,
    distributor: "",
    glassOrderedDate: "",
    glassArrivalDate: "",
    calibrationType: "none",
    calibrationLocation: "",
    urethaneKit: "Standard",
    partPrice: 0,
    markup: 0,
    accessoriesPrice: 0,
    urethanePrice: 15,
    salesTaxPercent: 8.25,
    laborPrice: 0,
    calibrationPrice: 0,
    mobileFee: 0,
    materialCost: 0,
    subcontractorCost: 0,
    partsSubtotal: 0,
    partTotal: 0,
    ...overrides,
  };
}

function createDefaultVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: randomUUID(),
    vin: "",
    licensePlate: "",
    mileage: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    bodyStyle: "",
    nagsCarId: "",
    vehicleColor: "",
    parts: [],
    ...overrides,
  };
}

function dbRowToJob(row: any): Job {
  return {
    id: row.id,
    jobNumber: row.jobNumber,
    isBusiness: row.isBusiness ?? false,
    businessName: row.businessName ?? undefined,
    customerType: row.customerType ?? "retail",
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    email: row.email ?? undefined,
    streetAddress: row.streetAddress ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    zipCode: row.zipCode ?? undefined,
    vehicles: (row.vehicles as Vehicle[]) ?? [],
    pipelineStage: row.pipelineStage ?? "quote",
    repairLocation: row.repairLocation ?? "in_shop",
    installer: row.installer ?? undefined,
    installDate: row.installDate ?? undefined,
    timeFrame: row.timeFrame ?? undefined,
    installTime: row.installTime ?? undefined,
    installEndTime: row.installEndTime ?? undefined,
    jobDuration: row.jobDuration ?? undefined,
    bookedBy: row.bookedBy ?? undefined,
    installedBy: row.installedBy ?? undefined,
    googleCalendarEventId: row.googleCalendarEventId ?? undefined,
    leadSource: row.leadSource ?? undefined,
    claimNumber: row.claimNumber ?? undefined,
    dispatchNumber: row.dispatchNumber ?? undefined,
    policyNumber: row.policyNumber ?? undefined,
    dateOfLoss: row.dateOfLoss ?? undefined,
    causeOfLoss: row.causeOfLoss ?? undefined,
    insuranceCompany: row.insuranceCompany ?? undefined,
    subtotal: Number(row.subtotal) || 0,
    taxAmount: Number(row.taxAmount) || 0,
    totalDue: Number(row.totalDue) || 0,
    deductible: Number(row.deductible) || 0,
    rebate: Number(row.rebate) || 0,
    amountPaid: Number(row.amountPaid) || 0,
    balanceDue: Number(row.balanceDue) || 0,
    paymentStatus: row.paymentStatus ?? "pending",
    paymentMethod: (row.paymentMethod as ("cash" | "card" | "check" | "zelle" | "bank_deposit")[]) ?? [],
    paymentHistory: (row.paymentHistory as PaymentHistoryEntry[]) ?? [],
    installNotes: row.installNotes ?? undefined,
    calibrationDeclined: row.calibrationDeclined ?? false,
    signatureImage: row.signatureImage ?? undefined,
    receiptSentAt: row.receiptSentAt ?? undefined,
    receiptPdf: row.receiptPdf ?? undefined,
    completionPhotos: (row.completionPhotos as Record<string, string>) ?? undefined,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

function jobToDbRow(job: Partial<InsertJob> & { jobNumber?: string }): any {
  const row: any = {};
  
  if (job.jobNumber !== undefined) row.jobNumber = job.jobNumber;
  if (job.isBusiness !== undefined) row.isBusiness = job.isBusiness;
  if (job.businessName !== undefined) row.businessName = job.businessName;
  if (job.customerType !== undefined) row.customerType = job.customerType;
  if (job.firstName !== undefined) row.firstName = job.firstName;
  if (job.lastName !== undefined) row.lastName = job.lastName;
  if (job.phone !== undefined) row.phone = job.phone;
  if (job.email !== undefined) row.email = job.email || null;
  if (job.streetAddress !== undefined) row.streetAddress = job.streetAddress;
  if (job.city !== undefined) row.city = job.city;
  if (job.state !== undefined) row.state = job.state;
  if (job.zipCode !== undefined) row.zipCode = job.zipCode;
  if (job.vehicles !== undefined) row.vehicles = job.vehicles;
  if (job.pipelineStage !== undefined) row.pipelineStage = job.pipelineStage;
  if (job.repairLocation !== undefined) row.repairLocation = job.repairLocation;
  if (job.installer !== undefined) row.installer = job.installer;
  if (job.installDate !== undefined) row.installDate = job.installDate;
  if (job.timeFrame !== undefined) row.timeFrame = job.timeFrame;
  if (job.installTime !== undefined) row.installTime = job.installTime;
  if (job.installEndTime !== undefined) row.installEndTime = job.installEndTime;
  if (job.jobDuration !== undefined) row.jobDuration = job.jobDuration;
  if (job.bookedBy !== undefined) row.bookedBy = job.bookedBy;
  if (job.installedBy !== undefined) row.installedBy = job.installedBy;
  if (job.googleCalendarEventId !== undefined) row.googleCalendarEventId = job.googleCalendarEventId;
  if (job.leadSource !== undefined) row.leadSource = job.leadSource;
  if (job.claimNumber !== undefined) row.claimNumber = job.claimNumber;
  if (job.dispatchNumber !== undefined) row.dispatchNumber = job.dispatchNumber;
  if (job.policyNumber !== undefined) row.policyNumber = job.policyNumber;
  if (job.dateOfLoss !== undefined) row.dateOfLoss = job.dateOfLoss;
  if (job.causeOfLoss !== undefined) row.causeOfLoss = job.causeOfLoss;
  if (job.insuranceCompany !== undefined) row.insuranceCompany = job.insuranceCompany;
  if (job.subtotal !== undefined) row.subtotal = String(job.subtotal);
  if (job.taxAmount !== undefined) row.taxAmount = String(job.taxAmount);
  if (job.totalDue !== undefined) row.totalDue = String(job.totalDue);
  if (job.deductible !== undefined) row.deductible = String(job.deductible);
  if (job.rebate !== undefined) row.rebate = String(job.rebate);
  if (job.amountPaid !== undefined) row.amountPaid = String(job.amountPaid);
  if (job.balanceDue !== undefined) row.balanceDue = String(job.balanceDue);
  if (job.paymentStatus !== undefined) row.paymentStatus = job.paymentStatus;
  if (job.paymentMethod !== undefined) row.paymentMethod = job.paymentMethod;
  if (job.paymentHistory !== undefined) row.paymentHistory = job.paymentHistory;
  if (job.installNotes !== undefined) row.installNotes = job.installNotes;
  if (job.calibrationDeclined !== undefined) row.calibrationDeclined = job.calibrationDeclined;
  if (job.signatureImage !== undefined) row.signatureImage = job.signatureImage;
  if (job.receiptSentAt !== undefined) row.receiptSentAt = job.receiptSentAt;
  if (job.receiptPdf !== undefined) row.receiptPdf = job.receiptPdf;
  if (job.completionPhotos !== undefined) row.completionPhotos = job.completionPhotos;
  
  return row;
}

export class DatabaseStorage implements IStorage {
  async getNextJobNumber(): Promise<string> {
    const result = await db.select({ maxNum: sql<string>`MAX(job_number)` }).from(jobs);
    const maxNum = result[0]?.maxNum;
    const nextNum = maxNum ? parseInt(maxNum, 10) + 1 : 1;
    return String(nextNum).padStart(6, '0');
  }

  async getUser(id: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0] as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.username, username));
    return rows[0] as User | undefined;
  }

  async createUser(upsertUser: UpsertUser): Promise<User> {
    const id = upsertUser.id || randomUUID();
    const existingUser = await this.getUser(id);
    if (existingUser) {
      return existingUser;
    }
    await db.insert(users).values({ ...upsertUser, id });
    const created = await this.getUser(id);
    return created!;
  }

  async getAllJobs(): Promise<Job[]> {
    const rows = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    return rows.map(dbRowToJob);
  }

  async getJob(id: string): Promise<Job | undefined> {
    const rows = await db.select().from(jobs).where(eq(jobs.id, id));
    if (rows.length === 0) return undefined;
    return dbRowToJob(rows[0]);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const jobNumber = await this.getNextJobNumber();
    
    const dbRow = jobToDbRow({ ...insertJob, jobNumber });
    dbRow.id = id;
    
    await db.insert(jobs).values(dbRow);
    
    const created = await this.getJob(id);
    return created!;
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined> {
    const existingJob = await this.getJob(id);
    if (!existingJob) {
      return undefined;
    }
    
    const dbRow = jobToDbRow(updates);
    
    if (Object.keys(dbRow).length > 0) {
      await db.update(jobs).set(dbRow).where(eq(jobs.id, id));
    }
    
    return this.getJob(id);
  }

  async updateJobStage(id: string, stage: PipelineStage): Promise<Job | undefined> {
    const existingJob = await this.getJob(id);
    if (!existingJob) {
      return undefined;
    }
    
    await db.update(jobs).set({ pipelineStage: stage }).where(eq(jobs.id, id));
    
    return this.getJob(id);
  }

  async addPaymentToJob(id: string, payment: PaymentHistoryEntry): Promise<Job | undefined> {
    const existingJob = await this.getJob(id);
    if (!existingJob) {
      return undefined;
    }
    
    const newPaymentHistory = [...existingJob.paymentHistory, payment];
    const newAmountPaid = newPaymentHistory.reduce((sum, p) => sum + p.amount, 0);
    const newBalanceDue = existingJob.totalDue - newAmountPaid;
    const newPaymentStatus = newBalanceDue <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : "pending";
    
    await db.update(jobs).set({
      paymentHistory: newPaymentHistory,
      amountPaid: String(newAmountPaid),
      balanceDue: String(Math.max(0, newBalanceDue)),
      paymentStatus: newPaymentStatus,
    }).where(eq(jobs.id, id));
    
    return this.getJob(id);
  }

  async deleteJob(id: string): Promise<boolean> {
    const result = await db.delete(jobs).where(eq(jobs.id, id));
    return true;
  }

  // Customer reminder methods
  async getCustomerReminder(customerKey: string): Promise<CustomerReminder | undefined> {
    const normalizedKey = customerKey.toLowerCase().trim();
    const result = await db.select().from(customerReminders).where(eq(customerReminders.customerKey, normalizedKey));
    return result[0] ?? undefined;
  }

  async upsertCustomerReminder(reminder: InsertCustomerReminder): Promise<CustomerReminder> {
    const normalizedKey = reminder.customerKey.toLowerCase().trim();
    const existing = await this.getCustomerReminder(normalizedKey);
    
    if (existing) {
      await db.update(customerReminders)
        .set({ 
          reminderMessage: reminder.reminderMessage,
          updatedAt: new Date()
        })
        .where(eq(customerReminders.customerKey, normalizedKey));
      return (await this.getCustomerReminder(normalizedKey))!;
    } else {
      const result = await db.insert(customerReminders)
        .values({ 
          customerKey: normalizedKey,
          reminderMessage: reminder.reminderMessage
        })
        .returning();
      return result[0];
    }
  }

  async deleteCustomerReminder(customerKey: string): Promise<boolean> {
    const normalizedKey = customerKey.toLowerCase().trim();
    await db.delete(customerReminders).where(eq(customerReminders.customerKey, normalizedKey));
    return true;
  }

  // Contact methods
  async getAllContacts(): Promise<Contact[]> {
    const rows = await db.select().from(contacts).orderBy(desc(contacts.createdAt));
    return rows.map(row => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      email: row.email ?? undefined,
      streetAddress: row.streetAddress ?? undefined,
      city: row.city ?? undefined,
      state: row.state ?? undefined,
      zipCode: row.zipCode ?? undefined,
      category: (row.category as Contact["category"]) ?? "customer",
      isBusiness: row.isBusiness ?? false,
      businessName: row.businessName ?? undefined,
      notes: row.notes ?? undefined,
      autoSynced: row.autoSynced ?? false,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    }));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const rows = await db.select().from(contacts).where(eq(contacts.id, id));
    if (rows.length === 0) return undefined;
    const row = rows[0];
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      email: row.email ?? undefined,
      streetAddress: row.streetAddress ?? undefined,
      city: row.city ?? undefined,
      state: row.state ?? undefined,
      zipCode: row.zipCode ?? undefined,
      category: (row.category as Contact["category"]) ?? "customer",
      isBusiness: row.isBusiness ?? false,
      businessName: row.businessName ?? undefined,
      notes: row.notes ?? undefined,
      autoSynced: row.autoSynced ?? false,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async getContactByPhone(phone: string): Promise<Contact | undefined> {
    const cleanPhone = phone.replace(/\D/g, "");
    const allContacts = await this.getAllContacts();
    return allContacts.find(c => c.phone.replace(/\D/g, "") === cleanPhone);
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    await db.insert(contacts).values({
      id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: contact.email || null,
      streetAddress: contact.streetAddress || null,
      city: contact.city || null,
      state: contact.state || null,
      zipCode: contact.zipCode || null,
      category: contact.category || "customer",
      isBusiness: contact.isBusiness || false,
      businessName: contact.businessName || null,
      notes: contact.notes || null,
      autoSynced: contact.autoSynced || false,
    });
    return (await this.getContact(id))!;
  }

  async updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined> {
    const existing = await this.getContact(id);
    if (!existing) return undefined;
    
    const updateData: any = { updatedAt: new Date() };
    if (contact.firstName !== undefined) updateData.firstName = contact.firstName;
    if (contact.lastName !== undefined) updateData.lastName = contact.lastName;
    if (contact.phone !== undefined) updateData.phone = contact.phone;
    if (contact.email !== undefined) updateData.email = contact.email || null;
    if (contact.streetAddress !== undefined) updateData.streetAddress = contact.streetAddress || null;
    if (contact.city !== undefined) updateData.city = contact.city || null;
    if (contact.state !== undefined) updateData.state = contact.state || null;
    if (contact.zipCode !== undefined) updateData.zipCode = contact.zipCode || null;
    if (contact.category !== undefined) updateData.category = contact.category;
    if (contact.isBusiness !== undefined) updateData.isBusiness = contact.isBusiness;
    if (contact.businessName !== undefined) updateData.businessName = contact.businessName || null;
    if (contact.notes !== undefined) updateData.notes = contact.notes || null;
    if (contact.autoSynced !== undefined) updateData.autoSynced = contact.autoSynced;
    
    await db.update(contacts).set(updateData).where(eq(contacts.id, id));
    return this.getContact(id);
  }

  async deleteContact(id: string): Promise<boolean> {
    await db.delete(contacts).where(eq(contacts.id, id));
    return true;
  }

  async syncContactFromJob(job: Job): Promise<Contact> {
    const existingContact = await this.getContactByPhone(job.phone);
    
    const categoryMap: Record<string, Contact["category"]> = {
      retail: "customer",
      dealer: "dealer",
      fleet: "fleet",
      subcontractor: "subcontractor",
    };
    
    if (existingContact) {
      return (await this.updateContact(existingContact.id, {
        firstName: job.firstName,
        lastName: job.lastName,
        email: job.email,
        streetAddress: job.streetAddress,
        city: job.city,
        state: job.state,
        zipCode: job.zipCode,
        category: categoryMap[job.customerType] || "customer",
        isBusiness: job.isBusiness,
        businessName: job.businessName,
        autoSynced: true,
      }))!;
    }
    
    return this.createContact({
      firstName: job.firstName,
      lastName: job.lastName,
      phone: job.phone,
      email: job.email,
      streetAddress: job.streetAddress,
      city: job.city,
      state: job.state,
      zipCode: job.zipCode,
      category: categoryMap[job.customerType] || "customer",
      isBusiness: job.isBusiness,
      businessName: job.businessName,
      autoSynced: true,
    });
  }

  // Activity log methods
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    await db.insert(activityLogs).values({
      id,
      userId: log.userId,
      username: log.username,
      userRole: log.userRole || null,
      actionType: log.actionType,
      actionCategory: log.actionCategory,
      jobId: log.jobId || null,
      jobNumber: log.jobNumber || null,
      details: log.details || {},
    });
    
    const result = await db.select().from(activityLogs).where(eq(activityLogs.id, id));
    const row = result[0];
    return {
      id: row.id,
      userId: row.userId,
      username: row.username,
      userRole: row.userRole ?? undefined,
      actionType: row.actionType,
      actionCategory: row.actionCategory,
      jobId: row.jobId ?? undefined,
      jobNumber: row.jobNumber ?? undefined,
      details: (row.details as Record<string, any>) ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async getActivityLogs(filters?: { userId?: string; startDate?: Date; endDate?: Date; actionType?: string }): Promise<ActivityLog[]> {
    const conditions = [];
    
    if (filters?.userId) {
      conditions.push(eq(activityLogs.userId, filters.userId));
    }
    if (filters?.startDate) {
      conditions.push(gte(activityLogs.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(activityLogs.createdAt, filters.endDate));
    }
    if (filters?.actionType) {
      conditions.push(eq(activityLogs.actionType, filters.actionType));
    }
    
    const rows = conditions.length > 0
      ? await db.select().from(activityLogs).where(and(...conditions)).orderBy(desc(activityLogs.createdAt))
      : await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt));
    
    return rows.map(row => ({
      id: row.id,
      userId: row.userId,
      username: row.username,
      userRole: row.userRole ?? undefined,
      actionType: row.actionType,
      actionCategory: row.actionCategory,
      jobId: row.jobId ?? undefined,
      jobNumber: row.jobNumber ?? undefined,
      details: (row.details as Record<string, any>) ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
  }

  async getActivityLogsByUser(userId: string, limit: number = 100): Promise<ActivityLog[]> {
    const rows = await db.select().from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
    
    return rows.map(row => ({
      id: row.id,
      userId: row.userId,
      username: row.username,
      userRole: row.userRole ?? undefined,
      actionType: row.actionType,
      actionCategory: row.actionCategory,
      jobId: row.jobId ?? undefined,
      jobNumber: row.jobNumber ?? undefined,
      details: (row.details as Record<string, any>) ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
  }

  // User management methods
  async getAllUsers(): Promise<User[]> {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    return rows as User[];
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User | undefined> {
    const existing = await this.getUser(id);
    if (!existing) return undefined;
    
    const updateData: any = { updatedAt: new Date() };
    if (updates.username !== undefined) updateData.username = updates.username;
    if (updates.password !== undefined) updateData.password = updates.password;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.profileImageUrl !== undefined) updateData.profileImageUrl = updates.profileImageUrl;
    
    await db.update(users).set(updateData).where(eq(users.id, id));
    return this.getUser(id);
  }
  
  // Processed leads methods
  async isLeadProcessed(emailId: string): Promise<boolean> {
    const result = await db
      .select({ emailId: processedLeads.emailId })
      .from(processedLeads)
      .where(eq(processedLeads.emailId, emailId))
      .limit(1);
    return result.length > 0;
  }
  
  async markLeadProcessed(emailId: string, emailSubject?: string, customerEmail?: string): Promise<void> {
    try {
      await db.insert(processedLeads).values({
        emailId,
        emailSubject: emailSubject || null,
        customerEmail: customerEmail || null,
      });
    } catch (error) {
      // Ignore duplicate key errors - lead was already processed
    }
  }
  
  async getAllProcessedLeadIds(): Promise<string[]> {
    const result = await db.select({ emailId: processedLeads.emailId }).from(processedLeads);
    return result.map(r => r.emailId);
  }
}

export const storage = new DatabaseStorage();
