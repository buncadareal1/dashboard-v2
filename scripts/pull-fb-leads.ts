/**
 * Pull ALL leads from Facebook Lead Ads via Ad-level /leads endpoint.
 * Upserts into leads table with campaign/ad linking.
 *
 * Run: npx dotenv -e .env.local -- npx tsx scripts/pull-fb-leads.ts
 */

import { db } from "../db";
import { leads, campaigns, ads, adsets, projects } from "../db/schema";
import { eq, sql, and, isNull } from "drizzle-orm";
import { normalizeName, normalizePhone } from "../lib/utils/unicode";

const TOKEN = process.env.FB_SYSTEM_USER_TOKEN!;
const AD_ACCOUNT = process.env.FB_AD_ACCOUNT_ID!;
const BASE = "https://graph.facebook.com/v21.0";

// Vietnamese field name mapping
const NAME_FIELDS = ["full_name", "tên_đầy_đủ", "họ_và_tên", "tên", "name"];
const PHONE_FIELDS = ["phone_number", "số_điện_thoại", "sdt", "phone"];
const EMAIL_FIELDS = ["email", "email_address"];

function extractField(fields: Map<string, string>, keys: string[]): string | null {
  for (const k of keys) {
    const v = fields.get(k);
    if (v?.trim()) return v.trim();
  }
  return null;
}

async function fetchAllPages<T>(url: string): Promise<T[]> {
  const all: T[] = [];
  let nextUrl: string | undefined = url;
  while (nextUrl) {
    const res: Response = await fetch(nextUrl);
    const body = await res.json() as { data?: T[]; paging?: { next?: string }; error?: { message: string } };
    if (body.error) throw new Error(body.error.message);
    all.push(...(body.data ?? []));
    nextUrl = body.paging?.next;
  }
  return all;
}

async function main() {
  // Get all projects with their campaigns
  const allProjects = await db.select({ id: projects.id, name: projects.name })
    .from(projects).where(isNull(projects.deletedAt));
  console.log(`Projects: ${allProjects.length}`);

  // Build campaign lookup: externalId → { campaignId, projectId }
  const allCampaigns = await db.select({
    id: campaigns.id,
    externalId: campaigns.externalId,
    projectId: campaigns.projectId,
    name: campaigns.name,
  }).from(campaigns).where(sql`${campaigns.externalId} IS NOT NULL`);

  const campaignByExtId = new Map<string, { id: string; projectId: string; name: string }>();
  for (const c of allCampaigns) {
    if (c.externalId) campaignByExtId.set(c.externalId, { id: c.id, projectId: c.projectId, name: c.name });
  }
  console.log(`Campaigns with externalId: ${campaignByExtId.size}`);

  // Get ALL ads from FB with their campaign_id
  console.log("\n=== Fetching ads from FB ===");
  const fbAds = await fetchAllPages<{
    id: string; name: string; campaign_id: string;
  }>(`${BASE}/${AD_ACCOUNT}/ads?fields=id,name,campaign_id&limit=100&access_token=${TOKEN}`);
  console.log(`Total FB ads: ${fbAds.length}`);

  // Filter to ads whose campaign we know
  const relevantAds = fbAds.filter(a => campaignByExtId.has(a.campaign_id));
  console.log(`Ads with known campaigns: ${relevantAds.length}`);

  // Pull leads from each ad
  console.log("\n=== Pulling leads ===");
  let totalLeads = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < relevantAds.length; i++) {
    const ad = relevantAds[i];
    const campaign = campaignByExtId.get(ad.campaign_id)!;

    try {
      const fbLeads = await fetchAllPages<{
        id: string;
        field_data: Array<{ name: string; values: string[] }>;
        created_time: string;
      }>(`${BASE}/${ad.id}/leads?fields=id,field_data,created_time&limit=100&access_token=${TOKEN}`);

      if (fbLeads.length === 0) continue;

      totalLeads += fbLeads.length;

      for (const fl of fbLeads) {
        const fields = new Map<string, string>();
        for (const f of fl.field_data ?? []) {
          if (f.values?.[0]) fields.set(f.name.toLowerCase(), f.values[0]);
        }

        const fullName = extractField(fields, NAME_FIELDS);
        const phone = extractField(fields, PHONE_FIELDS);
        const email = extractField(fields, EMAIL_FIELDS);

        if (!fullName && !phone) {
          skipped++;
          continue;
        }

        const normalizedName = normalizeName(fullName ?? "");
        const normalizedPhone = phone ? normalizePhone(phone) : null;

        // Build custom form answers (fields beyond name/phone/email)
        const formAnswers: Record<string, string> = {};
        const knownFields = new Set([...NAME_FIELDS, ...PHONE_FIELDS, ...EMAIL_FIELDS, "inbox_url"]);
        for (const [key, val] of fields) {
          if (!knownFields.has(key) && val) formAnswers[key] = val;
        }

        // Check if lead exists by fb_lead_id
        const existing = await db.query.leads.findFirst({
          where: eq(leads.fbLeadId, fl.id),
        });

        if (existing) {
          // Update with latest data
          await db.update(leads).set({
            fullName: fullName ?? existing.fullName,
            fullNameNormalized: normalizedName || existing.fullNameNormalized,
            phone: phone ?? existing.phone,
            phoneNormalized: normalizedPhone ?? existing.phoneNormalized,
            email: email ?? existing.email,
            campaignId: campaign.id,
            formAnswers,
            updatedAt: new Date(),
          }).where(eq(leads.id, existing.id));
          updated++;
        } else {
          // Also check by name+phone match (might exist from CSV)
          let matchedId: string | null = null;
          if (normalizedName) {
            const nameMatch = await db.query.leads.findFirst({
              where: and(
                eq(leads.projectId, campaign.projectId),
                eq(leads.fullNameNormalized, normalizedName),
                normalizedPhone ? eq(leads.phoneNormalized, normalizedPhone) : sql`true`,
              ),
            });
            if (nameMatch) matchedId = nameMatch.id;
          }

          if (matchedId) {
            // Update existing lead with FB data
            await db.update(leads).set({
              fbLeadId: fl.id,
              phone: phone ?? undefined,
              phoneNormalized: normalizedPhone ?? undefined,
              email: email ?? undefined,
              campaignId: campaign.id,
              formAnswers,
              fbCreatedAt: new Date(fl.created_time),
              updatedAt: new Date(),
            }).where(eq(leads.id, matchedId));
            updated++;
          } else {
            // Insert new lead
            await db.insert(leads).values({
              projectId: campaign.projectId,
              fullName: fullName ?? "(no name)",
              fullNameNormalized: normalizedName || "unknown",
              phone,
              phoneNormalized: normalizedPhone,
              email,
              fbLeadId: fl.id,
              campaignId: campaign.id,
              formAnswers,
              fbCreatedAt: new Date(fl.created_time),
            });
            created++;
          }
        }
      }

      if ((i + 1) % 20 === 0) {
        console.log(`  Progress: ${i + 1}/${relevantAds.length} ads | ${totalLeads} leads found | ${created} new | ${updated} updated`);
      }
    } catch (err) {
      errors++;
      // Rate limit or permission error — skip silently
    }
  }

  // Summary
  const [leadCount] = await db.select({ count: sql<number>`count(*)::int` }).from(leads);

  console.log(`\n=== DONE ===`);
  console.log(`FB leads found: ${totalLeads}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no name/phone): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total leads in DB: ${leadCount.count}`);

  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
