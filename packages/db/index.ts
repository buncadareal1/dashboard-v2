import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // VPS 4GB RAM: 20 connections phù hợp cho 2 PM2 instances (10 mỗi instance)
  max: 20,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema, casing: "snake_case" });

export { pool };
export type DB = typeof db;
