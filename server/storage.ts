import { type User, type InsertUser, type Job, type InsertJob, type PipelineStage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllJobs(): Promise<Job[]>;
  getJob(id: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  updateJobStage(id: string, stage: PipelineStage): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private jobs: Map<string, Job>;

  constructor() {
    this.users = new Map();
    this.jobs = new Map();
    this.seedSampleData();
  }

  private seedSampleData() {
    const sampleJobs: Job[] = [
      {
        id: randomUUID(),
        customerName: "Michael Johnson",
        customerPhone: "(555) 234-5678",
        customerEmail: "michael.j@email.com",
        customerAddress: "456 Oak Avenue, Springfield, IL 62701",
        vehicleYear: "2022",
        vehicleMake: "Honda",
        vehicleModel: "Accord",
        vehicleVin: "1HGCV1F34NA012345",
        vehicleColor: "White",
        glassType: "Windshield",
        glassPartNumber: "FW02345GTY",
        glassSupplier: "Pilkington",
        installDate: "",
        installTime: "",
        installLocation: "Mobile",
        installNotes: "Customer prefers morning appointments",
        totalDue: 385.00,
        deductible: 100.00,
        paymentStatus: "pending",
        pipelineStage: "quote",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        customerName: "Sarah Williams",
        customerPhone: "(555) 345-6789",
        customerEmail: "sarah.w@email.com",
        customerAddress: "789 Pine Street, Chicago, IL 60601",
        vehicleYear: "2021",
        vehicleMake: "Toyota",
        vehicleModel: "Camry",
        vehicleVin: "4T1BF1FK5MU123456",
        vehicleColor: "Silver",
        glassType: "Windshield",
        glassPartNumber: "FW03456GTY",
        glassSupplier: "AGC",
        installDate: "",
        installTime: "",
        installLocation: "Shop",
        installNotes: "",
        totalDue: 425.00,
        deductible: 150.00,
        paymentStatus: "pending",
        pipelineStage: "glass_ordered",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        customerName: "David Chen",
        customerPhone: "(555) 456-7890",
        customerEmail: "david.c@email.com",
        customerAddress: "321 Elm Road, Evanston, IL 60201",
        vehicleYear: "2023",
        vehicleMake: "Ford",
        vehicleModel: "F-150",
        vehicleVin: "1FTFW1E80NFA12345",
        vehicleColor: "Blue",
        glassType: "Front Door Left",
        glassPartNumber: "DW04567GTY",
        glassSupplier: "Guardian",
        installDate: "",
        installTime: "",
        installLocation: "Mobile",
        installNotes: "Large truck, need extra time",
        totalDue: 275.00,
        deductible: 0,
        paymentStatus: "pending",
        pipelineStage: "glass_arrived",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        customerName: "Emily Rodriguez",
        customerPhone: "(555) 567-8901",
        customerEmail: "emily.r@email.com",
        customerAddress: "654 Maple Lane, Oak Park, IL 60302",
        vehicleYear: "2020",
        vehicleMake: "Chevrolet",
        vehicleModel: "Equinox",
        vehicleVin: "2GNAXUEV1L6123456",
        vehicleColor: "Black",
        glassType: "Windshield",
        glassPartNumber: "FW05678GTY",
        glassSupplier: "Pilkington",
        installDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        installTime: "10:00",
        installLocation: "Shop",
        installNotes: "",
        totalDue: 395.00,
        deductible: 100.00,
        paymentStatus: "partial",
        pipelineStage: "scheduled",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        customerName: "James Anderson",
        customerPhone: "(555) 678-9012",
        customerEmail: "james.a@email.com",
        customerAddress: "987 Cedar Drive, Naperville, IL 60540",
        vehicleYear: "2019",
        vehicleMake: "Nissan",
        vehicleModel: "Altima",
        vehicleVin: "1N4BL4BV5KC123456",
        vehicleColor: "Red",
        glassType: "Windshield",
        glassPartNumber: "FW06789GTY",
        glassSupplier: "AGC",
        installDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        installTime: "14:00",
        installLocation: "Shop",
        installNotes: "Completed successfully",
        totalDue: 350.00,
        deductible: 50.00,
        paymentStatus: "paid",
        pipelineStage: "paid_completed",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        customerName: "Lisa Thompson",
        customerPhone: "(555) 789-0123",
        customerEmail: "lisa.t@email.com",
        customerAddress: "246 Birch Street, Aurora, IL 60502",
        vehicleYear: "2021",
        vehicleMake: "Hyundai",
        vehicleModel: "Sonata",
        vehicleVin: "5NPE34AF2MH123456",
        vehicleColor: "Gray",
        glassType: "Back Glass",
        glassPartNumber: "BW07890GTY",
        glassSupplier: "Guardian",
        installDate: new Date(Date.now() - 172800000).toISOString().split('T')[0],
        installTime: "09:00",
        installLocation: "Mobile",
        installNotes: "",
        totalDue: 525.00,
        deductible: 200.00,
        paymentStatus: "paid",
        pipelineStage: "paid_completed",
        createdAt: new Date().toISOString(),
      },
    ];

    sampleJobs.forEach((job) => {
      this.jobs.set(job.id, job);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
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
    const job: Job = {
      ...insertJob,
      id,
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

  async deleteJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }
}

export const storage = new MemStorage();
