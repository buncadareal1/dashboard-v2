import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@dashboard/db";
import { matchConflicts, csvUploads, projects } from "@dashboard/db/schema";
import type { AuthUser } from "../middleware/auth.js";

type Env = { Variables: { user: AuthUser } };
const app = new Hono<Env>();

/**
 * GET /api/conflicts — unresolved match conflicts
 * Query: ?projectId=uuid (optional)
 */
app.get("/", async (c) => {
  const projectId = c.req.query("projectId");

  const where = projectId
    ? and(
        eq(matchConflicts.resolved, false),
        eq(csvUploads.projectId, projectId),
      )
    : eq(matchConflicts.resolved, false);

  const rows = await db
    .select({
      id: matchConflicts.id,
      reason: matchConflicts.reason,
      candidates: matchConflicts.candidates,
      csvUploadId: matchConflicts.csvUploadId,
      csvFilename: csvUploads.filename,
      csvType: csvUploads.type,
      projectName: projects.name,
      createdAt: matchConflicts.createdAt,
    })
    .from(matchConflicts)
    .innerJoin(csvUploads, eq(matchConflicts.csvUploadId, csvUploads.id))
    .innerJoin(projects, eq(csvUploads.projectId, projects.id))
    .where(where)
    .orderBy(desc(matchConflicts.createdAt))
    .limit(50);

  return c.json({ data: rows });
});

export default app;
