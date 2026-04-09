/**
 * Tạo 2 test user (digital + GDDA) và gán vào project test.
 * Run: npx dotenv -e .env.local -- npx tsx scripts/seed-test-users.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, projects, projectUsers } from "../db/schema";

async function main() {
  console.log("🌱 Seeding test users...\n");

  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAIN ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  const domain = allowedDomains[0] ?? "smartland.vn";

  const testUsers = [
    {
      name: "Digital Test (Vinh)",
      email: `digital.test@${domain}`,
      role: "digital" as const,
    },
    {
      name: "GDDA Test (Linh)",
      email: `gdda.test@${domain}`,
      role: "gdda" as const,
    },
  ];

  // Insert (idempotent)
  for (const u of testUsers) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, u.email),
    });
    if (existing) {
      console.log(`  ⤳ exists: ${u.email}`);
      continue;
    }
    await db.insert(users).values({
      name: u.name,
      email: u.email,
      role: u.role,
      active: true,
    });
    console.log(`  ✓ created: ${u.email} (${u.role})`);
  }

  // Find project test
  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, "sun-ha-nam-thap-tang-test"),
  });
  if (!project) {
    console.log("\n⚠ Project test chưa tồn tại — chạy `npm run db:test-pipeline` trước");
    process.exit(0);
  }

  // Gán cả 2 user vào project test
  const digitalUser = await db.query.users.findFirst({
    where: eq(users.email, `digital.test@${domain}`),
  });
  const gddaUser = await db.query.users.findFirst({
    where: eq(users.email, `gdda.test@${domain}`),
  });

  if (digitalUser) {
    await db
      .insert(projectUsers)
      .values({
        projectId: project.id,
        userId: digitalUser.id,
        canView: true,
        canEdit: true,
        roleInProject: "digital",
      })
      .onConflictDoNothing();
    console.log(`  ✓ assigned digital user → ${project.name}`);
  }

  if (gddaUser) {
    await db
      .insert(projectUsers)
      .values({
        projectId: project.id,
        userId: gddaUser.id,
        canView: true,
        canEdit: false,
        roleInProject: "gdda",
      })
      .onConflictDoNothing();
    console.log(`  ✓ assigned gdda user → ${project.name}`);
  }

  console.log("\n✅ Done. Now you can switch users via dev widget.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
