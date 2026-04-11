import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@dashboard/db";
import { csvUploads } from "@dashboard/db/schema";
import { assertCanEditProject } from "../middleware/rbac.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { csvQueue } from "../jobs/queue.js";
import type { AuthUser } from "../middleware/auth.js";

type Env = { Variables: { user: AuthUser } };
const app = new Hono<Env>();

const QuerySchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(["facebook", "bitrix", "cost"]),
});

const MAX_SIZE = 10 * 1024 * 1024; // 10MB — VPS không có Vercel 4MB limit

/**
 * POST /api/upload/csv — multipart upload
 * BullMQ xử lý async (thay Inngest).
 * Fallback inline nếu Redis unavailable.
 */
app.post("/csv", async (c) => {
  const user = c.get("user");

  const { ok } = rateLimit(`upload:${user.id}`, 10, 3600000);
  if (!ok) {
    return c.json({ error: "Bạn đã gửi quá nhiều file. Vui lòng thử lại sau." }, 429);
  }

  const formData = await c.req.formData();
  const file = formData.get("file");
  const projectId = formData.get("projectId");
  const type = formData.get("type");

  const parsed = QuerySchema.safeParse({ projectId, type });
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  if (!(file instanceof File)) {
    return c.json({ error: "Missing file" }, 400);
  }

  if (file.size > MAX_SIZE) {
    return c.json({ error: `File quá lớn (max ${MAX_SIZE / 1024 / 1024}MB)` }, 413);
  }

  try {
    await assertCanEditProject(user.id, user.role, parsed.data.projectId);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("FORBIDDEN")) {
      return c.json({ error: "Forbidden" }, 403);
    }
    throw err;
  }

  // Validate MIME type
  const allowedMimes = new Set(["text/csv", "text/plain", "application/csv", "application/vnd.ms-excel"]);
  if (file.type && !allowedMimes.has(file.type)) {
    return c.json({ error: "Invalid file type. Chỉ chấp nhận file CSV." }, 400);
  }

  // Sanitize filename
  const safeName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, "_").slice(0, 255);

  const content = await file.text();

  // Header signature check
  const firstLine = content.split("\n", 1)[0]?.trim();
  if (parsed.data.type === "facebook" && !firstLine?.includes("Lead ID")) {
    return c.json({ error: "File không phải định dạng Facebook (thiếu cột Lead ID)" }, 400);
  }
  if (parsed.data.type === "bitrix" && !firstLine?.toLowerCase().includes("stage")) {
    return c.json({ error: "File không phải định dạng Bitrix (thiếu cột Stage)" }, 400);
  }
  if (parsed.data.type === "cost" && !firstLine?.toUpperCase().includes("CHI TIÊU")) {
    return c.json({ error: "File không phải định dạng Chi phí (thiếu cột CHI TIÊU)" }, 400);
  }

  // Insert audit row
  const [upload] = await db
    .insert(csvUploads)
    .values({
      uploadedBy: user.id,
      projectId: parsed.data.projectId,
      type: parsed.data.type,
      filename: safeName,
      status: "pending",
    })
    .returning({ id: csvUploads.id });

  // Enqueue BullMQ job
  try {
    await csvQueue.add("process-csv", {
      uploadId: upload.id,
      projectId: parsed.data.projectId,
      type: parsed.data.type,
      fileContent: content,
    });
    return c.json({ uploadId: upload.id, status: "pending" });
  } catch (err) {
    // Redis down → update status to failed
    console.error("[upload] Failed to enqueue job:", err);
    await db
      .update(csvUploads)
      .set({ status: "failed", errorLog: { error: "Queue unavailable" }, finishedAt: new Date() })
      .where(eq(csvUploads.id, upload.id));
    return c.json({ error: "Job queue unavailable. Vui lòng thử lại sau.", uploadId: upload.id }, 503);
  }
});

export default app;
