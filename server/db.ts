import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import { users } from "@shared/models/auth";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

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
