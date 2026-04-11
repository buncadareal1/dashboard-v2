/**
 * Setup: save FB credentials on Thấp Tầng, create Cao Tầng project.
 * Run: npx dotenv -e .env.local -- npx tsx scripts/setup-projects-with-fb.ts
 */
import { db } from "../db";
import { projects, projectUsers } from "../db/schema";
import { eq } from "drizzle-orm";

const FB_APP_ID = process.env.FB_APP_ID!;
const FB_APP_SECRET = process.env.FB_APP_SECRET!;
const FB_TOKEN = process.env.FB_SYSTEM_USER_TOKEN!;
const FB_AD_ACCOUNT = process.env.FB_AD_ACCOUNT_ID!;

async function main() {
  // 1. Update Thấp Tầng with FB credentials
  const thapTang = await db.query.projects.findFirst({
    where: eq(projects.slug, "sun-ha-nam-thap-tang"),
  });

  if (thapTang) {
    await db.update(projects).set({
      fbAppId: FB_APP_ID,
      fbAppSecret: FB_APP_SECRET,
      fbAccessToken: FB_TOKEN,
      fbAdAccountId: FB_AD_ACCOUNT,
    }).where(eq(projects.id, thapTang.id));
    console.log("✅ Updated Thấp Tầng with FB credentials");
  }

  // 2. Create Cao Tầng project (same ad account, different project)
  const existing = await db.query.projects.findFirst({
    where: eq(projects.slug, "sun-ha-nam-cao-tang"),
  });

  if (existing) {
    console.log("⚠️ Sun Hà Nam Cao Tầng already exists:", existing.id);
  } else {
    const [newProject] = await db.insert(projects).values({
      name: "Sun Hà Nam Cao Tầng",
      slug: "sun-ha-nam-cao-tang",
      location: "Hà Nam",
      status: "running",
      createdBy: thapTang?.createdBy ?? null,
      fbAppId: FB_APP_ID,
      fbAppSecret: FB_APP_SECRET,
      fbAccessToken: FB_TOKEN,
      fbAdAccountId: FB_AD_ACCOUNT,
    }).returning();

    console.log("✅ Created Sun Hà Nam Cao Tầng:", newProject.id);

    // Give admin access
    if (thapTang?.createdBy) {
      await db.insert(projectUsers).values({
        projectId: newProject.id,
        userId: thapTang.createdBy,
        canView: true,
        canEdit: true,
        roleInProject: "digital",
      }).onConflictDoNothing();
      console.log("✅ Admin assigned to Cao Tầng");
    }
  }

  // 3. List all projects
  const allProjects = await db.select({
    name: projects.name,
    slug: projects.slug,
    fbAdAccountId: projects.fbAdAccountId,
    hasFbToken: projects.fbAccessToken,
  }).from(projects);

  console.log("\n=== All Projects ===");
  for (const p of allProjects) {
    console.log(`  ${p.name} | Ad Account: ${p.fbAdAccountId ?? "—"} | Token: ${p.hasFbToken ? "✅" : "❌"}`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
