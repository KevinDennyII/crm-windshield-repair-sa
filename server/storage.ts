import { type User, type UpsertUser, type Job, type InsertJob, type PipelineStage, type PaymentHistoryEntry, type Vehicle, type Part } from "@shared/schema";
import { randomUUID } from "crypto";

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

// Helper function to create a default part
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

// Helper function to create a default vehicle
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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private jobs: Map<string, Job>;
  private jobCounter: number;

  constructor() {
    this.users = new Map();
    this.jobs = new Map();
    this.jobCounter = 0;
    // Sample data seeding removed - production app starts with empty database
    // Users create their own jobs through the CRM interface
  }

  async getNextJobNumber(): Promise<string> {
    this.jobCounter++;
    return String(this.jobCounter).padStart(6, '0');
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
    return Array.from(this.jobs.values());
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = randomUUID();
    const jobNumber = await this.getNextJobNumber();
    const job: Job = {
      ...insertJob,
      id,
      jobNumber,
      createdAt: new Date().toISOString(),
    };
    this.jobs.set(id, job);
    return job;
  }

  async updateJob(id: string, updates: Partial<InsertJob>): Promise<Job | undefined> {
    const existingJob = this.jobs.get(id);
    if (!existingJob) {
      return undefined;
    }
    const updatedJob: Job = {
      ...existingJob,
      ...updates,
    };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async updateJobStage(id: string, stage: PipelineStage): Promise<Job | undefined> {
    const existingJob = this.jobs.get(id);
    if (!existingJob) {
      return undefined;
    }
    const updatedJob: Job = {
      ...existingJob,
      pipelineStage: stage,
    };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async addPaymentToJob(id: string, payment: PaymentHistoryEntry): Promise<Job | undefined> {
    const existingJob = this.jobs.get(id);
    if (!existingJob) {
      return undefined;
    }
    const newPaymentHistory = [...existingJob.paymentHistory, payment];
    const newAmountPaid = newPaymentHistory.reduce((sum, p) => sum + p.amount, 0);
    const newBalanceDue = existingJob.totalDue - newAmountPaid;
    const newPaymentStatus = newBalanceDue <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : "pending";
    
    const updatedJob: Job = {
      ...existingJob,
      paymentHistory: newPaymentHistory,
      amountPaid: newAmountPaid,
      balanceDue: Math.max(0, newBalanceDue),
      paymentStatus: newPaymentStatus,
    };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async deleteJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }
}

export const storage = new MemStorage();
