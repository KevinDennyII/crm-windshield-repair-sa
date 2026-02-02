import { db } from "../../db";
import { users, type User, type UpsertUser } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

export const authStorage: IAuthStorage = {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [existing] = await db.select().from(users).where(eq(users.id, userData.id));
    
    if (existing) {
      const [updated] = await db
        .update(users)
        .set({
          ...userData,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id))
        .returning();
      return updated;
    }
    
    const [inserted] = await db.insert(users).values(userData).returning();
    return inserted;
  },
};
