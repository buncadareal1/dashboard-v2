"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { campaignActions, campaigns, projects } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { assertRole } from "@/lib/auth/guards";

/**
 * Toggle campaign status ON ↔ OFF.
 * Admin and digital roles only.
 */
export async function toggleCampaignStatusAction(
  campaignId: string,
): Promise<ActionResult> {
  try {
    await requireSession();
    await assertRole(["admin", "digital"]);

    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, campaignId),
    });
    if (!campaign) {
      return { success: false, error: "Không tìm thấy chiến dịch" };
    }

    const newStatus = campaign.statusLabel === "on" ? "off" : "on";
    await db
      .update(campaigns)
      .set({ statusLabel: newStatus })
      .where(eq(campaigns.id, campaignId));

    // Revalidate all related pages
    revalidatePath("/projects");
    revalidatePath("/report/campaigns");
    // Also revalidate the specific project detail page
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, campaign.projectId),
    });
    if (project) {
      revalidatePath(`/projects/${project.slug}`);
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Lỗi không xác định",
    };
  }
}

const UpsertCampaignActionSchema = z.object({
  campaignId: z.string().uuid(),
  priority: z.enum(["urgent", "today", "week", "none"]).default("none"),
  plan: z.string().max(500).nullable().optional(),
  contentNote: z.string().max(500).nullable().optional(),
  todayAction: z.string().max(500).nullable().optional(),
  actionDetail: z.string().max(500).nullable().optional(),
  assignee: z.string().max(100).nullable().optional(),
  deadline: z.string().nullable().optional(), // ISO date string
});

export type UpsertCampaignActionInput = z.infer<typeof UpsertCampaignActionSchema>;

export type ActionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Upsert campaign action plan (1:1 per campaign).
 * Only admin and digital roles can edit.
 */
export async function upsertCampaignActionAction(
  input: UpsertCampaignActionInput,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await assertRole(["admin", "digital"]);

    const parsed = UpsertCampaignActionSchema.parse(input);

    // Verify campaign exists
    const campaign = await db.query.campaigns.findFirst({
      where: eq(campaigns.id, parsed.campaignId),
    });
    if (!campaign) {
      return { success: false, error: "Không tìm thấy chiến dịch" };
    }

    // Upsert using ON CONFLICT DO UPDATE
    await db
      .insert(campaignActions)
      .values({
        campaignId: parsed.campaignId,
        priority: parsed.priority ?? "none",
        plan: parsed.plan ?? null,
        contentNote: parsed.contentNote ?? null,
        todayAction: parsed.todayAction ?? null,
        actionDetail: parsed.actionDetail ?? null,
        assignee: parsed.assignee ?? null,
        deadline: parsed.deadline ?? null,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: campaignActions.campaignId,
        set: {
          priority: parsed.priority ?? "none",
          plan: parsed.plan ?? null,
          contentNote: parsed.contentNote ?? null,
          todayAction: parsed.todayAction ?? null,
          actionDetail: parsed.actionDetail ?? null,
          assignee: parsed.assignee ?? null,
          deadline: parsed.deadline ?? null,
          updatedBy: user.id,
          updatedAt: new Date(),
        },
      });

    revalidatePath("/report/campaigns");

    return { success: true };
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      const issues = err.issues;
      return { success: false, error: issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Lỗi không xác định",
    };
  }
}
