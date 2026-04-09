"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { matchConflicts } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";

const ResolveSchema = z.object({
  conflictId: z.uuid(),
  action: z.enum(["dismiss", "ignore"]),
});

/**
 * Phase 1: support 2 actions đơn giản:
 * - dismiss: đánh dấu resolved, không làm gì với data
 * - ignore: tương tự dismiss, semantic khác (skip lead này)
 *
 * Phase 4+: thêm action "merge-with-lead" cho phép admin chọn lead nào
 * trong candidates để merge với row CSV gây conflict.
 */
export async function resolveConflictAction(
  input: z.infer<typeof ResolveSchema>,
) {
  const user = await requireSession();
  const parsed = ResolveSchema.parse(input);

  await db
    .update(matchConflicts)
    .set({
      resolved: true,
      resolvedBy: user.id,
      resolvedAt: new Date(),
    })
    .where(eq(matchConflicts.id, parsed.conflictId));

  revalidatePath("/projects");
}
