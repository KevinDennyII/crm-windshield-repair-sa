import { type User, type UpsertUser, type Job, type InsertJob, type PipelineStage, type PaymentHistoryEntry, type Vehicle, type Part, jobs } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

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
  
  return row;
}

export class DatabaseStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getNextJobNumber(): Promise<string> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(jobs);
    const count = Number(result[0]?.count) || 0;
    return String(count + 1).padStart(6, '0');
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(upsertUser: UpsertUser): Promise<User> {
    const id = randomUUID();
    const user = { ...upsertUser, id } as User;
    this.users.set(id, user);
    return user;
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
}

export const storage = new DatabaseStorage();
