import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Fallback URL placeholder để tránh crash lúc next build trước khi env được set
// (Vercel build sẽ có env thật từ Marketplace integration; fallback chỉ phục vụ build local).
const sql = neon(
  process.env.DATABASE_URL ??
    "postgresql://placeholder:placeholder@localhost:5432/placeholder",
);

export const db = drizzle(sql, { schema, casing: "snake_case" });

export type DB = typeof db;
