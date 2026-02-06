import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;
import * as schema from "@shared/schema";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import { newDb } from "pg-mem";
import * as crypto from "crypto";
import { drizzle as drizzleProxy } from "drizzle-orm/pg-proxy";

export let db: any;

const USE_MOCK_DB = process.env.USE_MOCK_DB === "true";

if (USE_MOCK_DB) {
  console.log("Initializing in-memory database (pg-mem) for local development...");
  const memDb = newDb();

  // Register functions
  memDb.public.registerFunction({
    name: 'gen_random_uuid',
    args: [],
    returns: memDb.public.getType('text' as any),
    implementation: () => crypto.randomUUID()
  });
  
  memDb.public.registerFunction({
    name: 'now',
    args: [],
    returns: memDb.public.getType('timestamp' as any),
    implementation: () => new Date().toISOString()
  });

  // Basic schema for auth and critical tables
  memDb.public.none(`
    CREATE TABLE users (
        id VARCHAR PRIMARY KEY,
        username VARCHAR UNIQUE,
        password VARCHAR,
        email VARCHAR UNIQUE,
        first_name VARCHAR,
        last_name VARCHAR,
        profile_image_url VARCHAR,
        role VARCHAR DEFAULT 'technician',
        is_active VARCHAR DEFAULT 'true',
        created_at TIMESTAMP,
        updated_at TIMESTAMP
    );
    CREATE TABLE sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
    );
    CREATE TABLE jobs (
        id VARCHAR PRIMARY KEY,
        job_number VARCHAR NOT NULL,
        created_at TIMESTAMP,
        is_business BOOLEAN DEFAULT FALSE,
        business_name VARCHAR,
        customer_type VARCHAR DEFAULT 'retail',
        first_name VARCHAR,
        last_name VARCHAR,
        phone VARCHAR,
        email VARCHAR,
        street_address VARCHAR,
        city VARCHAR,
        state VARCHAR,
        zip_code VARCHAR,
        vehicles JSONB DEFAULT '[]',
        pipeline_stage VARCHAR DEFAULT 'quote',
        repair_location VARCHAR DEFAULT 'in_shop',
        installer VARCHAR,
        install_date VARCHAR,
        time_frame VARCHAR,
        install_time VARCHAR,
        install_end_time VARCHAR,
        job_duration VARCHAR,
        booked_by VARCHAR,
        installed_by VARCHAR,
        google_calendar_event_id VARCHAR,
        lead_source VARCHAR,
        claim_number VARCHAR,
        dispatch_number VARCHAR,
        policy_number VARCHAR,
        date_of_loss VARCHAR,
        cause_of_loss VARCHAR,
        insurance_company VARCHAR,
        subtotal NUMERIC DEFAULT '0',
        tax_amount NUMERIC DEFAULT '0',
        total_due NUMERIC DEFAULT '0',
        deductible NUMERIC DEFAULT '0',
        rebate NUMERIC DEFAULT '0',
        amount_paid NUMERIC DEFAULT '0',
        balance_due NUMERIC DEFAULT '0',
        payment_status VARCHAR DEFAULT 'pending',
        payment_method JSONB DEFAULT '[]',
        payment_history JSONB DEFAULT '[]',
        install_notes TEXT,
        repeat_customer_notes TEXT,
        calibration_declined BOOLEAN DEFAULT FALSE,
        signature_image TEXT,
        receipt_sent_at VARCHAR,
        receipt_pdf TEXT,
        completion_photos JSONB DEFAULT '{}'
    );
    CREATE TABLE customer_reminders (
        id VARCHAR PRIMARY KEY,
        customer_key VARCHAR NOT NULL UNIQUE,
        reminder_message TEXT NOT NULL,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
    );
    CREATE TABLE contacts (
        id VARCHAR PRIMARY KEY,
        first_name VARCHAR NOT NULL,
        last_name VARCHAR NOT NULL,
        phone VARCHAR NOT NULL,
        email VARCHAR,
        category VARCHAR DEFAULT 'customer',
        is_business BOOLEAN DEFAULT FALSE,
        business_name VARCHAR,
        notes TEXT,
        auto_synced BOOLEAN DEFAULT FALSE,
        street_address VARCHAR,
        city VARCHAR,
        state VARCHAR,
        zip_code VARCHAR,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
    );
    CREATE TABLE activity_logs (
        id VARCHAR PRIMARY KEY,
        user_id VARCHAR,
        user_name VARCHAR,
        user_role VARCHAR,
        action_type VARCHAR NOT NULL,
        entity_type VARCHAR NOT NULL,
        entity_id VARCHAR,
        job_id VARCHAR,
        job_number VARCHAR,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP
    );
    CREATE TABLE processed_leads (
        id VARCHAR PRIMARY KEY,
        email_id VARCHAR NOT NULL UNIQUE,
        email_subject VARCHAR,
        customer_email VARCHAR,
        processed_at TIMESTAMP
    );
  `);

  const { Pool: MemPool } = memDb.adapters.createPg();
  const memPool = new MemPool();

  db = drizzleProxy(async (sql, params, method) => {
    try {
        const result = await memPool.query(sql, params);
        
        // Generate fields metadata so Drizzle can map columns
        // Drizzle/pg-proxy expects rows to be arrays of values when fields are provided
        const fields = [];
        let rows = result.rows;

        if (result.rows.length > 0) {
            const firstRow = result.rows[0];
            const keys = Object.keys(firstRow);
            
            // Transform rows from objects to arrays of values
            rows = result.rows.map((row: any) => keys.map(k => row[k]));

            for (const key of keys) {
                const val = firstRow[key];
                let oid = 25; // text (default safe)
                if (typeof val === 'number') oid = 23; // int4
                else if (typeof val === 'boolean') oid = 16; // bool
                else if (val instanceof Date) oid = 1114; // timestamp
                
                fields.push({
                    name: key,
                    tableID: 0,
                    columnID: 0,
                    dataTypeID: oid,
                    dataTypeSize: -1,
                    dataTypeModifier: -1,
                    format: 'text'
                });
            }
        }

        return {
            rows: rows,
            rowCount: result.rowCount,
            command: result.command,
            fields: fields
        };
    } catch (e: any) {
        console.error("SQL Error:", e.message);
        throw e;
    }
  }, { schema, logger: true });
} else {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgres://localhost:5432/postgres",
  });
  db = drizzle(pool, { schema });
}

export async function seedSampleUsers() {
  const sampleUsers = [
    {
      id: "admin-001",
      username: "admin",
      password: "admin123",
      email: "admin@autoglasspro.com",
      firstName: "Admin",
      lastName: "User",
      role: "admin" as const,
      isActive: "true",
    },
    {
      id: "csr-001",
      username: "csr",
      password: "csr123",
      email: "csr@autoglasspro.com",
      firstName: "Customer",
      lastName: "Service Rep",
      role: "csr" as const,
      isActive: "true",
    },
    {
      id: "tech-001",
      username: "tech",
      password: "tech123",
      email: "tech@autoglasspro.com",
      firstName: "Field",
      lastName: "Technician",
      role: "technician" as const,
      isActive: "true",
    },
    {
      id: "reports-001",
      username: "reports",
      password: "reports123",
      email: "reports@autoglasspro.com",
      firstName: "Reports",
      lastName: "Viewer",
      role: "reports" as const,
      isActive: "true",
    },
  ];

  for (const user of sampleUsers) {
    const [existing] = await db.select().from(users).where(eq(users.id, user.id));
    if (!existing) {
      await db.insert(users).values(user);
    }
  }
}