/**
 * Sync Facebook campaigns into the local `campaigns` table.
 */

import { db } from "@dashboard/db";
import { campaigns } from "@dashboard/db/schema";
import { eq, and } from "drizzle-orm";
import type { FacebookGraphClient } from "./client.js";

export interface SyncCampaignsResult {
  synced: number;
  created: number;
}

/**
 * Fetch all campaigns from FB for `adAccountId` and upsert into the
 * `campaigns` table scoped to `projectId`.
 *
 * Match strategy:
 * 1. Try to find an existing row by externalId.
 * 2. Fall back to name match (normalised by DB unique index).
 * 3. Insert if neither matches.
 */
export async function syncCampaigns(
  client: FacebookGraphClient,
  adAccountId: string,
  projectId: string,
): Promise<SyncCampaignsResult> {
  const fbCampaigns = await client.getCampaigns(adAccountId);

  let synced = 0;
  let created = 0;

  for (const fb of fbCampaigns) {
    const statusLabel =
      fb.effective_status === "ACTIVE" ? ("on" as const) : ("off" as const);

    // Try match by externalId first
    const byExternalId = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.projectId, projectId),
        eq(campaigns.externalId, fb.id),
      ),
    });

    if (byExternalId) {
      await db
        .update(campaigns)
        .set({ statusLabel, externalId: fb.id })
        .where(eq(campaigns.id, byExternalId.id));
      synced += 1;
      continue;
    }

    // Fall back: match by name within project
    const byName = await db.query.campaigns.findFirst({
      where: and(
        eq(campaigns.projectId, projectId),
        eq(campaigns.name, fb.name),
      ),
    });

    if (byName) {
      await db
        .update(campaigns)
        .set({ statusLabel, externalId: fb.id })
        .where(eq(campaigns.id, byName.id));
      synced += 1;
      continue;
    }

    // Insert new campaign
    await db.insert(campaigns).values({
      projectId,
      externalId: fb.id,
      name: fb.name,
      statusLabel,
    });
    created += 1;
  }

  return { synced, created };
}
