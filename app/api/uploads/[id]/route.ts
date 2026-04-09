import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { csvUploads } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";

/**
 * GET /api/uploads/:id
 * Poll status của 1 upload. Chỉ uploader hoặc admin xem được.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSession();
  const { id } = await params;

  const upload = await db.query.csvUploads.findFirst({
    where: eq(csvUploads.id, id),
  });
  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.role !== "admin" && upload.uploadedBy !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: upload.id,
    status: upload.status,
    type: upload.type,
    filename: upload.filename,
    parsedCount: upload.parsedCount,
    errorCount: upload.errorCount,
    errorLog: upload.errorLog,
    createdAt: upload.createdAt,
    finishedAt: upload.finishedAt,
  });
}
