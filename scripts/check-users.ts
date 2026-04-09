import { db } from "../db";
import { users } from "../db/schema";

async function main() {
  const allUsers = await db.select().from(users);
  console.log("Total users:", allUsers.length);
  for (const u of allUsers) {
    console.log("  ", u.role, "|", u.email, "|", u.active ? "active" : "INACTIVE");
  }

  const allowed = (process.env.ALLOWED_EMAIL_DOMAIN ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  console.log("\nAllowed domains:", allowed);
  for (const u of allUsers) {
    const domain = u.email.split("@")[1];
    const ok = allowed.includes(domain);
    console.log("  ", u.email, "→", ok ? "✅ login OK" : "❌ domain không whitelist");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
