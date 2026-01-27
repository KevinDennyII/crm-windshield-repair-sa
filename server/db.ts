import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!, { fullResults: true });
export const db = drizzle({ client: sql, schema });
