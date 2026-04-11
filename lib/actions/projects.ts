"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  projectUsers,
  projectFanpages,
  projectAdAccounts,
  fanpages,
} from "@/db/schema";
import { requireSession } from "@/lib/auth/session";
import { assertRole, assertCanEditProject } from "@/lib/auth/guards";

const CreateProjectSchema = z.object({
  name: z.string().min(2, "Tên dự án phải có ít nhất 2 ký tự"),
  location: z.string().optional(),
  fbAdAccountId: z.string().optional(),
  googleAdsId: z.string().optional(),
  fbAppId: z.string().optional(),
  fbAppSecret: z.string().optional(),
  fbAccessToken: z.string().optional(),
  fanpageNames: z.array(z.string()).optional(), // sẽ tạo fanpage nếu chưa có
  digitalUserIds: z.array(z.string().uuid()).optional(),
  gddaUserIds: z.array(z.string().uuid()).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

const UpdateProjectSchema = z.object({
  name: z.string().min(2, "Tên dự án phải có ít nhất 2 ký tự"),
  location: z.string().optional(),
  fbAdAccountId: z.string().optional(),
  googleAdsId: z.string().optional(),
  fbAppId: z.string().optional(),
  fbAppSecret: z.string().optional(),
  fbAccessToken: z.string().optional(),
  fanpageNames: z.array(z.string()).optional(),
  digitalUserIds: z.array(z.string().uuid()).optional(),
  gddaUserIds: z.array(z.string().uuid()).optional(),
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createProjectAction(input: CreateProjectInput) {
  const user = await requireSession();
  await assertRole(["admin", "digital"]);

  const parsed = CreateProjectSchema.parse(input);

  // Generate unique slug
  let slug = slugify(parsed.name);
  let suffix = 0;
  while (true) {
    const existing = await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
    });
    if (!existing) break;
    suffix += 1;
    slug = `${slugify(parsed.name)}-${suffix}`;
  }

  // Insert project
  const [project] = await db
    .insert(projects)
    .values({
      name: parsed.name,
      slug,
      location: parsed.location ?? null,
      fbAdAccountId: parsed.fbAdAccountId ?? null,
      googleAdsId: parsed.googleAdsId ?? null,
      fbAppId: parsed.fbAppId ?? null,
      fbAppSecret: parsed.fbAppSecret ?? null,
      fbAccessToken: parsed.fbAccessToken ?? null,
      status: "running",
      createdBy: user.id,
    })
    .returning();

  // Creator auto can_edit
  await db.insert(projectUsers).values({
    projectId: project.id,
    userId: user.id,
    canView: true,
    canEdit: true,
    roleInProject: "digital",
  });

  // Bulk insert digital users
  if (parsed.digitalUserIds && parsed.digitalUserIds.length > 0) {
    const rows = parsed.digitalUserIds
      .filter((uid) => uid !== user.id)
      .map((uid) => ({
        projectId: project.id,
        userId: uid,
        canView: true,
        canEdit: true,
        roleInProject: "digital" as const,
      }));
    if (rows.length > 0) {
      await db.insert(projectUsers).values(rows).onConflictDoNothing();
    }
  }

  // GDDA users — view only
  if (parsed.gddaUserIds && parsed.gddaUserIds.length > 0) {
    const rows = parsed.gddaUserIds.map((uid) => ({
      projectId: project.id,
      userId: uid,
      canView: true,
      canEdit: false,
      roleInProject: "gdda" as const,
    }));
    await db.insert(projectUsers).values(rows).onConflictDoNothing();
  }

  // Fanpages — upsert by name
  if (parsed.fanpageNames && parsed.fanpageNames.length > 0) {
    for (const fpName of parsed.fanpageNames) {
      let fp = await db.query.fanpages.findFirst({
        where: eq(fanpages.name, fpName),
      });
      if (!fp) {
        const [created] = await db
          .insert(fanpages)
          .values({ name: fpName })
          .returning();
        fp = created;
      }
      await db
        .insert(projectFanpages)
        .values({ projectId: project.id, fanpageId: fp.id })
        .onConflictDoNothing();
    }
  }

  // Ad accounts
  if (parsed.fbAdAccountId) {
    await db.insert(projectAdAccounts).values({
      projectId: project.id,
      adAccountExternalId: parsed.fbAdAccountId,
      platform: "facebook",
    });
  }
  if (parsed.googleAdsId) {
    await db.insert(projectAdAccounts).values({
      projectId: project.id,
      adAccountExternalId: parsed.googleAdsId,
      platform: "google",
    });
  }

  redirect(`/projects/${slug}`);
}

/**
 * Update project metadata + reassign digital/gdda users.
 * Admin assignments untouched (chỉ delete các row có role digital/gdda).
 */
export async function updateProjectAction(
  slug: string,
  input: UpdateProjectInput,
) {
  const user = await requireSession();

  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });
  if (!project) throw new Error("Không tìm thấy dự án");

  await assertCanEditProject(user.id, user.role, project.id);

  const parsed = UpdateProjectSchema.parse(input);

  await db
    .update(projects)
    .set({
      name: parsed.name,
      location: parsed.location ?? null,
      fbAdAccountId: parsed.fbAdAccountId ?? null,
      googleAdsId: parsed.googleAdsId ?? null,
      fbAppId: parsed.fbAppId ?? null,
      fbAppSecret: parsed.fbAppSecret ?? null,
      fbAccessToken: parsed.fbAccessToken ?? null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, project.id));

  // Reassign digital/gdda users — keep admin rows intact
  await db
    .delete(projectUsers)
    .where(
      and(
        eq(projectUsers.projectId, project.id),
        inArray(projectUsers.roleInProject, ["digital", "gdda"]),
      ),
    );

  const digitalRows = (parsed.digitalUserIds ?? []).map((uid) => ({
    projectId: project.id,
    userId: uid,
    canView: true,
    canEdit: true,
    roleInProject: "digital" as const,
  }));
  if (digitalRows.length > 0) {
    await db.insert(projectUsers).values(digitalRows).onConflictDoNothing();
  }

  const gddaRows = (parsed.gddaUserIds ?? []).map((uid) => ({
    projectId: project.id,
    userId: uid,
    canView: true,
    canEdit: false,
    roleInProject: "gdda" as const,
  }));
  if (gddaRows.length > 0) {
    await db.insert(projectUsers).values(gddaRows).onConflictDoNothing();
  }

  // Fanpages — upsert then link (không xoá link cũ để tránh mất history)
  if (parsed.fanpageNames && parsed.fanpageNames.length > 0) {
    for (const fpName of parsed.fanpageNames) {
      let fp = await db.query.fanpages.findFirst({
        where: eq(fanpages.name, fpName),
      });
      if (!fp) {
        const [created] = await db
          .insert(fanpages)
          .values({ name: fpName })
          .returning();
        fp = created;
      }
      await db
        .insert(projectFanpages)
        .values({ projectId: project.id, fanpageId: fp.id })
        .onConflictDoNothing();
    }
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${slug}`);

  return { success: true as const };
}

const StatusSchema = z.enum(["running", "warning", "paused"]);

export async function setProjectStatusAction(
  slug: string,
  status: "running" | "warning" | "paused",
) {
  const user = await requireSession();

  const project = await db.query.projects.findFirst({
    where: eq(projects.slug, slug),
  });
  if (!project) throw new Error("Không tìm thấy dự án");

  await assertCanEditProject(user.id, user.role, project.id);

  const parsed = StatusSchema.parse(status);

  await db
    .update(projects)
    .set({ status: parsed, updatedAt: new Date() })
    .where(eq(projects.id, project.id));

  revalidatePath("/projects");
  revalidatePath(`/projects/${slug}`);

  return { success: true as const };
}
