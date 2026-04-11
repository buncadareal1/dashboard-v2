/**
 * Re-sync FB campaigns: assign to correct project based on name pattern.
 * - "sun.*hà.*nam.*thấp|SUN.*HN.*TT|SUN.*THAP" → Thấp Tầng
 * - "sun.*hà.*nam.*cao|sun.*cao.*tầng|park.*residence" → Cao Tầng
 * - Others → Cao Tầng (default for new campaigns)
 *
 * Also re-imports campaigns from FB that were deleted earlier.
 *
 * Run: npx dotenv -e .env.local -- npx tsx scripts/resync-fb-by-project.ts
 */
import { db } from "../db";
import { projects, campaigns, campaignInsights } from "../db/schema";
import { eq, sql, isNull } from "drizzle-orm";

const TOKEN = process.env.FB_SYSTEM_USER_TOKEN!;
const AD_ACCOUNT = process.env.FB_AD_ACCOUNT_ID!;
const BASE = "https://graph.facebook.com/v21.0";

const THAP_TANG_PATTERN = /sun.*h[àa].*nam.*th[aấ]p|SUN.*HN.*TT|SUN.*THAP|_LF_.*DUYEN|_LF_.*LINH|_LF_.*BAO|lead.*sun.*h[àa].*nam/i;
const CAO_TANG_PATTERN = /cao.*t[aầ]ng|park.*residence|_CM_/i;

async function fbFetchAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  let all: T[] = [];
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", TOKEN);
  url.searchParams.set("limit", "100");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let nextUrl: string | undefined = url.toString();
  while (nextUrl) {
    const res: Response = await fetch(nextUrl);
    const body = await res.json() as { error?: { message: string }; data?: T[]; paging?: { next?: string } };
    if (body.error) throw new Error(body.error.message);
    all = all.concat(body.data || []);
    nextUrl = body.paging?.next;
  }
  return all;
}

function classifyProject(name: string): "thap" | "cao" | "other" {
  if (THAP_TANG_PATTERN.test(name)) return "thap";
  if (CAO_TANG_PATTERN.test(name)) return "cao";
  return "other";
}

async function main() {
  const [thapTang, caoTang] = await Promise.all([
    db.query.projects.findFirst({ where: eq(projects.slug, "sun-ha-nam-thap-tang") }),
    db.query.projects.findFirst({ where: eq(projects.slug, "sun-ha-nam-cao-tang") }),
  ]);

  if (!thapTang || !caoTang) {
    console.error("Missing projects");
    process.exit(1);
  }

  console.log(`Thấp Tầng: ${thapTang.id}`);
  console.log(`Cao Tầng: ${caoTang.id}\n`);

  // Fetch ALL campaigns from FB
  const fbCampaigns = await fbFetchAll<{
    id: string; name: string; status: string; effective_status: string; objective: string;
  }>(`/${AD_ACCOUNT}/campaigns`, { fields: "id,name,status,effective_status,objective" });

  console.log(`FB campaigns total: ${fbCampaigns.length}\n`);

  let thapCount = 0, caoCount = 0, otherCount = 0;
  let created = 0, updated = 0;

  for (const fc of fbCampaigns) {
    const type = classifyProject(fc.name);
    const projectId = type === "thap" ? thapTang.id : caoTang.id;
    const statusLabel = fc.effective_status === "ACTIVE" ? "on" as const : "off" as const;

    if (type === "thap") thapCount++;
    else if (type === "cao") caoCount++;
    else otherCount++;

    // Check if campaign exists (by externalId)
    let existing = await db.query.campaigns.findFirst({
      where: eq(campaigns.externalId, fc.id),
    });

    if (existing) {
      // If already in correct project, just update status
      if (existing.projectId === projectId) {
        await db.update(campaigns).set({ statusLabel, externalId: fc.id })
          .where(eq(campaigns.id, existing.id));
        updated++;
      } else {
        // Moving to different project — delete insights, then delete + re-create
        await db.delete(campaignInsights).where(eq(campaignInsights.campaignId, existing.id));
        await db.delete(campaigns).where(eq(campaigns.id, existing.id));
        await db.insert(campaigns).values({
          projectId,
          externalId: fc.id,
          name: fc.name,
          statusLabel,
        }).onConflictDoNothing();
        updated++;
      }
    } else {
      // Create new campaign
      await db.insert(campaigns).values({
        projectId,
        externalId: fc.id,
        name: fc.name,
        statusLabel,
      }).onConflictDoNothing();
      created++;
    }
  }

  console.log(`Classification:`);
  console.log(`  Thấp Tầng: ${thapCount}`);
  console.log(`  Cao Tầng: ${caoCount}`);
  console.log(`  Other → Cao Tầng: ${otherCount}`);
  console.log(`\nDB: ${created} created, ${updated} updated`);

  // Re-sync insights for new campaigns
  console.log("\nSyncing insights for newly assigned campaigns...");
  const allCampaigns = await db.select({
    id: campaigns.id,
    externalId: campaigns.externalId,
    projectId: campaigns.projectId,
  }).from(campaigns).where(sql`${campaigns.externalId} IS NOT NULL`);

  let insightRows = 0;
  for (const camp of allCampaigns) {
    if (!camp.externalId) continue;

    // Check if already has insights
    const existing = await db.query.campaignInsights.findFirst({
      where: eq(campaignInsights.campaignId, camp.id),
    });
    if (existing) continue; // Already synced

    try {
      const url = new URL(`${BASE}/${camp.externalId}/insights`);
      url.searchParams.set("access_token", TOKEN);
      url.searchParams.set("fields", "spend,impressions,clicks,ctr,cpm,frequency,actions");
      url.searchParams.set("date_preset", "maximum");
      const res = await fetch(url.toString());
      const body = await res.json();

      for (const ins of body.data || []) {
        const leads = ins.actions?.find((a: { action_type: string }) => a.action_type === "lead");
        const leadCount = leads ? parseInt(leads.value, 10) : 0;
        const spend = parseFloat(ins.spend || "0");
        const cpl = leadCount > 0 ? spend / leadCount : 0;

        await db.insert(campaignInsights).values({
          campaignId: camp.id,
          date: ins.date_start,
          spend: spend.toFixed(2),
          impressions: parseInt(ins.impressions || "0", 10),
          clicks: parseInt(ins.clicks || "0", 10),
          leads: leadCount,
          ctr: parseFloat(ins.ctr || "0").toFixed(4),
          cpm: parseFloat(ins.cpm || "0").toFixed(2),
          frequency: parseFloat(ins.frequency || "0").toFixed(4),
          cpl: cpl.toFixed(2),
          fetchedAt: new Date(),
        }).onConflictDoNothing();
        insightRows++;
      }
    } catch {
      // Skip silently
    }
  }

  console.log(`Insights: ${insightRows} new rows synced`);

  // Summary
  const summary = await db.select({
    projectName: projects.name,
    campaignCount: sql<number>`count(${campaigns.id})::int`,
  }).from(campaigns)
    .innerJoin(projects, eq(campaigns.projectId, projects.id))
    .where(isNull(projects.deletedAt))
    .groupBy(projects.name);

  console.log("\n=== FINAL ===");
  for (const r of summary) {
    console.log(`  ${r.projectName}: ${r.campaignCount} campaigns`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
