import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@dashboard/db";
import { csvUploads } from "@dashboard/db/schema";
import type { AuthUser } from "../middleware/auth.js";

type Env = { Variables: { user: AuthUser } };
const app = new Hono<Env>();

/**
 * GET /api/uploads/:id — poll upload status
 */
app.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  // Validate UUID format to avoid DB errors
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    return c.json({ error: "Invalid ID format" }, 400);
  }

  const upload = await db.query.csvUploads.findFirst({
    where: eq(csvUploads.id, id),
  });
  if (!upload) return c.json({ error: "Not found" }, 404);

  if (user.role !== "admin" && upload.uploadedBy !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json({
    data: {
      id: upload.id,
      status: upload.status,
      type: upload.type,
      filename: upload.filename,
      parsedCount: upload.parsedCount,
      errorCount: upload.errorCount,
      errorLog: upload.errorLog,
      createdAt: upload.createdAt,
      finishedAt: upload.finishedAt,
    },
  });
});

export default app;
