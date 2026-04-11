import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { serve } from "@hono/node-server";
import { authMiddleware } from "./middleware/auth.js";
import projectRoutes from "./routes/projects.js";
import leadRoutes from "./routes/leads.js";
import uploadRoutes from "./routes/upload.js";
import chatRoutes from "./routes/chat.js";
import webhookRoutes from "./routes/webhooks.js";
import uploadStatusRoutes from "./routes/upload-status.js";
import conflictRoutes from "./routes/conflicts.js";
import { campaignApp, fbApp } from "./routes/campaigns.js";

// Workers — import để khởi tạo (side-effect)
import "./jobs/process-csv.js";
import "./jobs/nightly-snapshot.js";
import "./jobs/sync-fb-insights.js";
import { setupScheduledJobs } from "./jobs/scheduler.js";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Global error handler — never leak internal details
app.onError((err, c) => {
  console.error("[unhandled]", err);
  return c.json({ error: "Internal server error" }, 500);
});

// Health check — no auth
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Webhooks — no auth (Facebook verifies via signature)
app.route("/api/webhooks", webhookRoutes);

// Authenticated routes
app.use("/api/*", authMiddleware);
app.route("/api/projects", projectRoutes);
app.route("/api/leads", leadRoutes);
app.route("/api/upload", uploadRoutes);
app.route("/api/uploads", uploadStatusRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/conflicts", conflictRoutes);
app.route("/api/campaigns", campaignApp);
app.route("/api/fb", fbApp);

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, async (info) => {
  console.log(`Hono API listening on http://localhost:${info.port}`);
  await setupScheduledJobs().catch((err) =>
    console.warn("[scheduler] Failed to setup jobs (Redis down?):", err.message),
  );
});

export default app;
