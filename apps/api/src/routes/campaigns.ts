/**
 * Campaign action plan CRUD + FB sync trigger.
 *
 * Routes:
 *   GET  /api/campaigns/:id/action  — get campaign action plan
 *   PUT  /api/campaigns/:id/action  — upsert campaign action plan
 *   POST /api/fb/sync               — manual FB sync trigger (admin only)
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "@dashboard/db";
import { campaigns, campaignActions } from "@dashboard/db/schema";
import { FacebookGraphClient } from "../services/fb/client.js";
import { syncCampaigns } from "../services/fb/sync-campaigns.js";
import { syncCampaignInsights } from "../services/fb/sync-insights.js";
import { syncAds } from "../services/fb/sync-ads.js";
import type { AuthUser } from "../middleware/auth.js";

type Env = { Variables: { user: AuthUser } };

// --- Campaign action routes ---

const campaignApp = new Hono<Env>();

/**
 * GET /api/campaigns/:id/action
 * Returns the action plan for a campaign, or null if none yet.
 */
campaignApp.get("/:id/action", async (c) => {
  const user = c.get("user");
  const campaignId = c.req.param("id");

  // Verify campaign exists and user has access to its project
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });
  if (!campaign) return c.json({ error: "Not found" }, 404);

  // RBAC: check user can access this project
  if (user.role !== "admin") {
    const { getAccessibleProjectIds } = await import("../middleware/rbac.js");
    const accessible = await getAccessibleProjectIds(user.id, user.role);
    if (accessible !== null && !accessible.includes(campaign.projectId)) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const row = await db.query.campaignActions.findFirst({
    where: eq(campaignActions.campaignId, campaignId),
  });

  return c.json({ data: row ?? null });
});

const actionSchema = z.object({
  priority: z.enum(["urgent", "today", "week", "none"]).optional(),
  plan: z.string().max(2000).optional(),
  contentNote: z.string().max(2000).optional(),
  todayAction: z.string().max(2000).optional(),
  actionDetail: z.string().max(5000).optional(),
  assignee: z.string().max(200).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * PUT /api/campaigns/:id/action
 * Upsert the action plan for a campaign.
 * Body: { priority?, plan?, contentNote?, todayAction?, actionDetail?, assignee?, deadline? }
 */
campaignApp.put("/:id/action", async (c) => {
  const user = c.get("user");
  const campaignId = c.req.param("id");

  // Verify campaign exists
  const campaign = await db.query.campaigns.findFirst({
    where: eq(campaigns.id, campaignId),
  });
  if (!campaign) {
    return c.json({ error: "Campaign not found" }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
  }

  const values = parsed.data;

  await db
    .insert(campaignActions)
    .values({
      campaignId,
      priority: values.priority ?? "none",
      plan: values.plan ?? null,
      contentNote: values.contentNote ?? null,
      todayAction: values.todayAction ?? null,
      actionDetail: values.actionDetail ?? null,
      assignee: values.assignee ?? null,
      deadline: values.deadline ?? null,
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [campaignActions.campaignId],
      set: {
        ...(values.priority !== undefined && { priority: values.priority }),
        ...(values.plan !== undefined && { plan: values.plan }),
        ...(values.contentNote !== undefined && { contentNote: values.contentNote }),
        ...(values.todayAction !== undefined && { todayAction: values.todayAction }),
        ...(values.actionDetail !== undefined && { actionDetail: values.actionDetail }),
        ...(values.assignee !== undefined && { assignee: values.assignee }),
        ...(values.deadline !== undefined && { deadline: values.deadline }),
        updatedBy: user.id,
        updatedAt: new Date(),
      },
    });

  const updated = await db.query.campaignActions.findFirst({
    where: eq(campaignActions.campaignId, campaignId),
  });

  return c.json({ data: updated });
});

export { campaignApp };

// --- FB sync routes ---

const fbApp = new Hono<Env>();

const syncBodySchema = z.object({
  adAccountId: z.string().min(1).regex(/^[\da-z_]+$/i, "Invalid ad account ID format"),
  projectId: z.string().uuid(),
  datePreset: z.enum(["today", "yesterday", "last_7d", "last_14d", "last_30d"]).optional(),
});

/**
 * POST /api/fb/sync
 * Manually trigger a FB sync for an ad account + project.
 * Admin only.
 */
fbApp.post("/sync", async (c) => {
  const user = c.get("user");

  if (user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const fbToken = process.env.FB_SYSTEM_USER_TOKEN;
  if (!fbToken) {
    return c.json({ error: "FB_SYSTEM_USER_TOKEN not configured" }, 500);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = syncBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
  }

  const { adAccountId, projectId, datePreset = "today" } = parsed.data;
  const client = new FacebookGraphClient(fbToken);

  try {
    const [campaignResult, insightResult, adResult] = await Promise.all([
      syncCampaigns(client, adAccountId, projectId),
      syncCampaignInsights(client, adAccountId, datePreset),
      syncAds(client, adAccountId, projectId, datePreset),
    ]);

    return c.json({
      data: {
        campaigns: campaignResult,
        insights: insightResult,
        ads: adResult,
      },
    });
  } catch (err) {
    // Log full error server-side but never expose FB API details to client
    console.error("[fb/sync] Error:", err);
    return c.json({ error: "FB sync failed. Check server logs for details." }, 502);
  }
});

export { fbApp };
