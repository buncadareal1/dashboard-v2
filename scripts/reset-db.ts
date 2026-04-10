import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  console.log("🗑 Dropping schema...");
  await sql`DROP SCHEMA public CASCADE`;
  await sql`CREATE SCHEMA public`;
  console.log("✓ Database dropped and recreated");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
