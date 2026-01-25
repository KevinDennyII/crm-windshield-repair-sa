import { type User, type InsertUser, type Job, type InsertJob, type PipelineStage, type PaymentHistoryEntry } from "@shared/schema";
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
  addPaymentToJob(id: string, payment: PaymentHistoryEntry): Promise<Job | undefined>;
  deleteJob(id: string): Promise<boolean>;
  getNextJobNumber(): Promise<string>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private jobs: Map<string, Job>;
  private jobCounter: number;

  constructor() {
    this.users = new Map();
    this.jobs = new Map();
    this.jobCounter = 38;
    this.seedSampleData();
  }

  async getNextJobNumber(): Promise<string> {
    this.jobCounter++;
    return String(this.jobCounter).padStart(6, '0');
  }

  private seedSampleData() {
    const sampleJobs: Job[] = [
      {
        id: randomUUID(),
        jobNumber: "000032",
        isBusiness: false,
        businessName: "",
        firstName: "Michael",
        lastName: "Johnson",
        phone: "(555) 234-5678",
        email: "michael.j@email.com",
        streetAddress: "456 Oak Avenue",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
        vin: "1HGCV1F34NA012345",
        licensePlate: "ABC1234",
        mileage: "45000",
        vehicleYear: "2022",
        vehicleMake: "Honda",
        vehicleModel: "Accord",
        bodyStyle: "Sedan",
        nagsCarId: "HON22ACC",
        vehicleColor: "White",
        jobType: "windshield_replacement",
        pipelineStage: "quote",
        repairLocation: "mobile",
        installer: "",
        installDate: "",
        installTime: "",
        jobDuration: "2",
        glassPartNumber: "FW02345GTY",
        isAftermarket: true,
        nagsListPrice: 285,
        laborHours: 1.5,
        laborRate: 50,
        calibrationType: "none",
        calibrationLocation: "",
        calibrationPrice: 0,
        distributor: "Pilkington",
        glassOrderedDate: "",
        glassArrivalDate: "",
        urethaneKit: "Standard",
        urethaneKitPrice: 25,
        claimNumber: "",
        dispatchNumber: "",
        policyNumber: "",
        dateOfLoss: "",
        causeOfLoss: "rock_chip",
        insuranceCompany: "",
        glassPrice: 285,
        laborTotal: 75,
        subtotal: 385,
        taxRate: 0,
        taxAmount: 0,
        totalDue: 385,
        deductible: 100,
        rebate: 0,
        amountPaid: 0,
        balanceDue: 385,
        paymentStatus: "pending",
        paymentHistory: [],
        installNotes: "Customer prefers morning appointments",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        jobNumber: "000033",
        isBusiness: false,
        businessName: "",
        firstName: "Sarah",
        lastName: "Williams",
        phone: "(555) 345-6789",
        email: "sarah.w@email.com",
        streetAddress: "789 Pine Street",
        city: "Chicago",
        state: "IL",
        zipCode: "60601",
        vin: "4T1BF1FK5MU123456",
        licensePlate: "XYZ5678",
        mileage: "32000",
        vehicleYear: "2021",
        vehicleMake: "Toyota",
        vehicleModel: "Camry",
        bodyStyle: "Sedan",
        nagsCarId: "TOY21CAM",
        vehicleColor: "Silver",
        jobType: "windshield_replacement",
        pipelineStage: "glass_ordered",
        repairLocation: "in_shop",
        installer: "John",
        installDate: "",
        installTime: "",
        jobDuration: "2",
        glassPartNumber: "FW03456GTY",
        isAftermarket: false,
        nagsListPrice: 325,
        laborHours: 1.5,
        laborRate: 50,
        calibrationType: "static",
        calibrationLocation: "In-shop",
        calibrationPrice: 150,
        distributor: "AGC",
        glassOrderedDate: new Date().toISOString().split('T')[0],
        glassArrivalDate: "",
        urethaneKit: "Premium",
        urethaneKitPrice: 35,
        claimNumber: "CLM-2024-5678",
        dispatchNumber: "DSP-9012",
        policyNumber: "POL-123456",
        dateOfLoss: "2024-01-20",
        causeOfLoss: "rock_chip",
        insuranceCompany: "State Farm",
        glassPrice: 325,
        laborTotal: 75,
        subtotal: 585,
        taxRate: 0,
        taxAmount: 0,
        totalDue: 585,
        deductible: 150,
        rebate: 0,
        amountPaid: 0,
        balanceDue: 585,
        paymentStatus: "pending",
        paymentHistory: [],
        installNotes: "",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        jobNumber: "000034",
        isBusiness: true,
        businessName: "Chen Auto Sales",
        firstName: "David",
        lastName: "Chen",
        phone: "(555) 456-7890",
        email: "david.c@chenauto.com",
        streetAddress: "321 Elm Road",
        city: "Evanston",
        state: "IL",
        zipCode: "60201",
        vin: "1FTFW1E80NFA12345",
        licensePlate: "CHEN001",
        mileage: "15000",
        vehicleYear: "2023",
        vehicleMake: "Ford",
        vehicleModel: "F-150",
        bodyStyle: "Truck",
        nagsCarId: "FOR23F15",
        vehicleColor: "Blue",
        jobType: "door_glass",
        pipelineStage: "glass_arrived",
        repairLocation: "mobile",
        installer: "Mike",
        installDate: "",
        installTime: "",
        jobDuration: "1",
        glassPartNumber: "DW04567GTY",
        isAftermarket: true,
        nagsListPrice: 195,
        laborHours: 1,
        laborRate: 50,
        calibrationType: "none",
        calibrationLocation: "",
        calibrationPrice: 0,
        distributor: "Guardian",
        glassOrderedDate: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
        glassArrivalDate: new Date().toISOString().split('T')[0],
        urethaneKit: "",
        urethaneKitPrice: 0,
        claimNumber: "",
        dispatchNumber: "",
        policyNumber: "",
        dateOfLoss: "",
        causeOfLoss: undefined,
        insuranceCompany: "",
        glassPrice: 195,
        laborTotal: 50,
        subtotal: 245,
        taxRate: 0,
        taxAmount: 0,
        totalDue: 275,
        deductible: 0,
        rebate: 0,
        amountPaid: 0,
        balanceDue: 275,
        paymentStatus: "pending",
        paymentHistory: [],
        installNotes: "Large truck, need extra time",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        jobNumber: "000035",
        isBusiness: false,
        businessName: "",
        firstName: "Emily",
        lastName: "Rodriguez",
        phone: "(555) 567-8901",
        email: "emily.r@email.com",
        streetAddress: "654 Maple Lane",
        city: "Oak Park",
        state: "IL",
        zipCode: "60302",
        vin: "2GNAXUEV1L6123456",
        licensePlate: "EMR2020",
        mileage: "58000",
        vehicleYear: "2020",
        vehicleMake: "Chevrolet",
        vehicleModel: "Equinox",
        bodyStyle: "SUV",
        nagsCarId: "CHV20EQX",
        vehicleColor: "Black",
        jobType: "windshield_replacement",
        pipelineStage: "scheduled",
        repairLocation: "in_shop",
        installer: "John",
        installDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        installTime: "10:00",
        jobDuration: "2.5",
        glassPartNumber: "FW05678GTY",
        isAftermarket: true,
        nagsListPrice: 295,
        laborHours: 1.5,
        laborRate: 50,
        calibrationType: "dynamic",
        calibrationLocation: "In-shop",
        calibrationPrice: 200,
        distributor: "Pilkington",
        glassOrderedDate: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
        glassArrivalDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        urethaneKit: "Standard",
        urethaneKitPrice: 25,
        claimNumber: "CLM-2024-1234",
        dispatchNumber: "",
        policyNumber: "POL-789012",
        dateOfLoss: "2024-01-15",
        causeOfLoss: "crack",
        insuranceCompany: "Allstate",
        glassPrice: 295,
        laborTotal: 75,
        subtotal: 595,
        taxRate: 0,
        taxAmount: 0,
        totalDue: 595,
        deductible: 100,
        rebate: 0,
        amountPaid: 100,
        balanceDue: 495,
        paymentStatus: "partial",
        paymentHistory: [
          {
            id: randomUUID(),
            date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
            source: "credit_card",
            amount: 100,
            notes: "Deductible payment"
          }
        ],
        installNotes: "",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        jobNumber: "000036",
        isBusiness: false,
        businessName: "",
        firstName: "James",
        lastName: "Anderson",
        phone: "(555) 678-9012",
        email: "james.a@email.com",
        streetAddress: "987 Cedar Drive",
        city: "Naperville",
        state: "IL",
        zipCode: "60540",
        vin: "1N4BL4BV5KC123456",
        licensePlate: "JMA2019",
        mileage: "72000",
        vehicleYear: "2019",
        vehicleMake: "Nissan",
        vehicleModel: "Altima",
        bodyStyle: "Sedan",
        nagsCarId: "NIS19ALT",
        vehicleColor: "Red",
        jobType: "windshield_replacement",
        pipelineStage: "paid_completed",
        repairLocation: "in_shop",
        installer: "Mike",
        installDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        installTime: "14:00",
        jobDuration: "2",
        glassPartNumber: "FW06789GTY",
        isAftermarket: true,
        nagsListPrice: 265,
        laborHours: 1.5,
        laborRate: 50,
        calibrationType: "none",
        calibrationLocation: "",
        calibrationPrice: 0,
        distributor: "AGC",
        glassOrderedDate: new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0],
        glassArrivalDate: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
        urethaneKit: "Standard",
        urethaneKitPrice: 25,
        claimNumber: "",
        dispatchNumber: "",
        policyNumber: "",
        dateOfLoss: "",
        causeOfLoss: undefined,
        insuranceCompany: "",
        glassPrice: 265,
        laborTotal: 75,
        subtotal: 365,
        taxRate: 0,
        taxAmount: 0,
        totalDue: 350,
        deductible: 50,
        rebate: 0,
        amountPaid: 350,
        balanceDue: 0,
        paymentStatus: "paid",
        paymentHistory: [
          {
            id: randomUUID(),
            date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
            source: "cash",
            amount: 350,
            notes: "Full payment"
          }
        ],
        installNotes: "Completed successfully",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        jobNumber: "000037",
        isBusiness: false,
        businessName: "",
        firstName: "Lisa",
        lastName: "Thompson",
        phone: "(555) 789-0123",
        email: "lisa.t@email.com",
        streetAddress: "246 Birch Street",
        city: "Aurora",
        state: "IL",
        zipCode: "60502",
        vin: "5NPE34AF2MH123456",
        licensePlate: "LTH2021",
        mileage: "28000",
        vehicleYear: "2021",
        vehicleMake: "Hyundai",
        vehicleModel: "Sonata",
        bodyStyle: "Sedan",
        nagsCarId: "HYU21SON",
        vehicleColor: "Gray",
        jobType: "back_glass",
        pipelineStage: "paid_completed",
        repairLocation: "mobile",
        installer: "John",
        installDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        installTime: "09:00",
        jobDuration: "1.5",
        glassPartNumber: "BW07890GTY",
        isAftermarket: true,
        nagsListPrice: 425,
        laborHours: 1.5,
        laborRate: 50,
        calibrationType: "none",
        calibrationLocation: "",
        calibrationPrice: 0,
        distributor: "Guardian",
        glassOrderedDate: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
        glassArrivalDate: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0],
        urethaneKit: "Premium",
        urethaneKitPrice: 35,
        claimNumber: "CLM-2024-9999",
        dispatchNumber: "DSP-5555",
        policyNumber: "POL-555555",
        dateOfLoss: "2024-01-10",
        causeOfLoss: "vandalism",
        insuranceCompany: "Progressive",
        glassPrice: 425,
        laborTotal: 75,
        subtotal: 535,
        taxRate: 0,
        taxAmount: 0,
        totalDue: 525,
        deductible: 200,
        rebate: 0,
        amountPaid: 525,
        balanceDue: 0,
        paymentStatus: "paid",
        paymentHistory: [
          {
            id: randomUUID(),
            date: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
            source: "credit_card",
            amount: 200,
            notes: "Deductible"
          },
          {
            id: randomUUID(),
            date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
            source: "insurance",
            amount: 325,
            notes: "Insurance payment - Progressive"
          }
        ],
        installNotes: "",
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
