import { NextResponse } from "next/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";

/**
 * GET /api/notifications
 * Trả về notifications cho user hiện tại (mới nhất trước, limit 50).
 */
export async function GET() {
  const user = await requireSession();

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const [unreadResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, user.id),
        eq(notifications.read, false),
      ),
    );

  return NextResponse.json({
    notifications: rows,
    unreadCount: unreadResult?.count ?? 0,
  });
}
