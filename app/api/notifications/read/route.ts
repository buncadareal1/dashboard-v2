import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";

const BodySchema = z.object({
  notificationId: z.string().uuid().optional(),
  markAllRead: z.boolean().optional(),
});

/**
 * PATCH /api/notifications/read
 * Mark 1 notification as read, or mark all as read.
 */
export async function PATCH(req: Request) {
  const user = await requireSession();
  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.markAllRead) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.recipientId, user.id),
          eq(notifications.read, false),
        ),
      );
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.notificationId) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, parsed.data.notificationId),
          eq(notifications.recipientId, user.id),
        ),
      );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing notificationId or markAllRead" }, { status: 400 });
}
