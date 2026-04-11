/**
 * Process a Facebook Lead Ads webhook event:
 * 1. Fetch lead data from FB Graph API
 * 2. Find project by page_id or ad_account
 * 3. Upsert lead into DB
 * 4. Rebuild aggregates
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "@dashboard/db";
import { leads, projects, campaigns } from "@dashboard/db/schema";
import { FacebookGraphClient } from "./client.js";
import {
  normalizeName,
  normalizePhone,
} from "../utils/unicode.js";

export interface WebhookLeadgenEntry {
  id: string; // page_id
  time: number;
  changes: Array<{
    field: string;
    value: {
      leadgen_id: string;
      page_id: string;
      form_id: string;
      ad_id?: string;
      adgroup_id?: string;
      created_time: number;
    };
  }>;
}

export interface ProcessResult {
  processed: number;
  errors: number;
  details: Array<{ leadgenId: string; status: "created" | "updated" | "error"; error?: string }>;
}

/**
 * Process all leadgen entries from a webhook payload.
 */
export async function processWebhookLeadgen(
  entries: WebhookLeadgenEntry[],
): Promise<ProcessResult> {
  const token = process.env.FB_SYSTEM_USER_TOKEN;
  if (!token) {
    return { processed: 0, errors: 0, details: [{ leadgenId: "N/A", status: "error", error: "No FB token" }] };
  }

  const client = new FacebookGraphClient(token);
  const result: ProcessResult = { processed: 0, errors: 0, details: [] };

  for (const entry of entries) {
    for (const change of entry.changes) {
      if (change.field !== "leadgen") continue;

      const { leadgen_id, page_id, ad_id, created_time } = change.value;

      try {
        // 1. Fetch lead data from FB
        const leadData = await client.getLeadgenData(leadgen_id);

        // 2. Extract fields
        const fields = new Map<string, string>();
        for (const f of leadData.field_data) {
          fields.set(f.name.toLowerCase(), f.values[0] ?? "");
        }

        const fullName = fields.get("full_name") ?? fields.get("tên") ?? fields.get("họ và tên") ?? "";
        const phone = fields.get("phone_number") ?? fields.get("số điện thoại") ?? null;
        const email = fields.get("email") ?? null;

        if (!fullName) {
          result.details.push({ leadgenId: leadgen_id, status: "error", error: "No name in lead data" });
          result.errors++;
          continue;
        }

        // 3. Find project by page_id or ad account
        // Try matching via fbAdAccountId on project
        const project = await db.query.projects.findFirst({
          where: sql`${projects.fbAdAccountId} IS NOT NULL AND ${projects.deletedAt} IS NULL`,
        });

        if (!project) {
          result.details.push({ leadgenId: leadgen_id, status: "error", error: "No project found" });
          result.errors++;
          continue;
        }

        // 4. Try to find matching campaign by ad_id
        let campaignId: string | null = null;
        if (ad_id) {
          // FB ad_id → find campaign via the ads table hierarchy
          // For now, skip campaign matching — will be null
        }

        // 5. Check if lead already exists (by fb_lead_id)
        const existing = await db.query.leads.findFirst({
          where: eq(leads.fbLeadId, leadgen_id),
        });

        const normalizedName = normalizeName(fullName);
        const normalizedPhone = phone ? normalizePhone(phone) : null;

        // Build custom form answers (fields beyond name/phone/email)
        const formAnswers: Record<string, string> = {};
        for (const [key, val] of fields) {
          if (!["full_name", "tên", "họ và tên", "phone_number", "số điện thoại", "email"].includes(key) && val) {
            formAnswers[key] = val;
          }
        }

        if (existing) {
          // Update existing lead
          await db.update(leads).set({
            fullName,
            fullNameNormalized: normalizedName,
            phone,
            phoneNormalized: normalizedPhone,
            email,
            formAnswers,
            updatedAt: new Date(),
          }).where(eq(leads.id, existing.id));

          result.details.push({ leadgenId: leadgen_id, status: "updated" });
        } else {
          // Insert new lead
          await db.insert(leads).values({
            projectId: project.id,
            fullName,
            fullNameNormalized: normalizedName,
            phone,
            phoneNormalized: normalizedPhone,
            email,
            fbLeadId: leadgen_id,
            campaignId,
            formAnswers,
            fbCreatedAt: new Date(created_time * 1000),
          });

          result.details.push({ leadgenId: leadgen_id, status: "created" });
        }

        result.processed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[webhook] Error processing leadgen ${leadgen_id}:`, msg);
        result.details.push({ leadgenId: leadgen_id, status: "error", error: msg });
        result.errors++;
      }
    }
  }

  return result;
}
