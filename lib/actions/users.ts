"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, projectUsers } from "@/db/schema";
import { assertRole } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";

const CreateUserSchema = z.object({
  name: z.string().min(1, "Họ tên không được rỗng"),
  email: z.email("Email không hợp lệ"),
  role: z.enum(["admin", "digital", "gdda"]),
});

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAIN ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export async function createUserAction(input: z.infer<typeof CreateUserSchema>) {
  await assertRole(["admin"]);

  const parsed = CreateUserSchema.parse(input);
  const email = parsed.email.toLowerCase();

  // Validate domain
  const domain = email.split("@")[1];
  if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
    throw new Error(
      `Email phải thuộc domain công ty: ${allowedDomains.join(", ")}`,
    );
  }

  // Check duplicate
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) throw new Error("Email đã tồn tại");

  await db.insert(users).values({
    name: parsed.name,
    email,
    role: parsed.role,
    active: true,
  });

  revalidatePath("/settings");
}

export async function deactivateUserAction(userId: string) {
  await assertRole(["admin"]);
  await db.update(users).set({ active: false }).where(eq(users.id, userId));
  revalidatePath("/settings");
}

export async function activateUserAction(userId: string) {
  await assertRole(["admin"]);
  await db.update(users).set({ active: true }).where(eq(users.id, userId));
  revalidatePath("/settings");
}

/**
 * Change user role (admin only).
 */
export async function changeRoleAction(
  userId: string,
  newRole: "admin" | "digital" | "gdda",
) {
  await assertRole(["admin"]);
  await db
    .update(users)
    .set({ role: newRole, updatedAt: new Date() })
    .where(eq(users.id, userId));
  revalidatePath("/settings");
}

const UpdateAccountSchema = z.object({
  name: z.string().min(1, "Họ tên không được rỗng").max(120),
  image: z
    .string()
    .url("Ảnh đại diện phải là URL hợp lệ")
    .max(500)
    .optional()
    .or(z.literal("")),
});

export async function updateAccountAction(
  input: z.infer<typeof UpdateAccountSchema>,
) {
  const session = await requireSession();
  const parsed = UpdateAccountSchema.parse(input);

  await db
    .update(users)
    .set({
      name: parsed.name,
      image: parsed.image ? parsed.image : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.id));

  revalidatePath("/settings");
  return { success: true as const };
}

const AssignSchema = z.object({
  userId: z.uuid(),
  assignments: z.array(
    z.object({
      projectId: z.uuid(),
      canView: z.boolean(),
      canEdit: z.boolean(),
      roleInProject: z.enum(["digital", "gdda"]),
    }),
  ),
});

export async function assignUserToProjectsAction(
  input: z.infer<typeof AssignSchema>,
) {
  await assertRole(["admin"]);
  const parsed = AssignSchema.parse(input);

  // Strategy: delete tất cả assignment cũ của user, insert lại
  // Đơn giản, idempotent. Volume nhỏ (vài chục project max).
  await db.delete(projectUsers).where(eq(projectUsers.userId, parsed.userId));

  // Bulk insert chỉ những row có view=true (không có view = no assignment)
  const toInsert = parsed.assignments
    .filter((a) => a.canView || a.canEdit)
    .map((a) => ({
      projectId: a.projectId,
      userId: parsed.userId,
      canView: a.canView,
      canEdit: a.canEdit,
      roleInProject: a.roleInProject,
    }));

  if (toInsert.length > 0) {
    await db.insert(projectUsers).values(toInsert);
  }

  revalidatePath("/settings");
}
