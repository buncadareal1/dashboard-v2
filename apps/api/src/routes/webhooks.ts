import { Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  processWebhookLeadgen,
  type WebhookLeadgenEntry,
} from "../services/fb/process-webhook-lead.js";

const app = new Hono();

/**
 * GET /api/webhooks/facebook — verify webhook (challenge response)
 */
app.get("/facebook", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");
  const expected = process.env.FB_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    expected &&
    token &&
    token.length === expected.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  ) {
    return c.text(challenge ?? "", 200);
  }
  return c.json({ error: "Forbidden" }, 403);
});

/**
 * POST /api/webhooks/facebook — receive leadgen events
 *
 * Flow:
 * 1. Verify X-Hub-Signature-256
 * 2. Extract leadgen entries
 * 3. For each: fetch lead data from FB API → upsert into DB
 * 4. Return 200 (FB requires response within 20s)
 */
app.post("/facebook", async (c) => {
  const secret = process.env.FB_APP_SECRET;
  if (!secret) {
    return c.json({ error: "Webhook not configured" }, 503);
  }

  const rawBody = await c.req.text();
  const sig = c.req.header("X-Hub-Signature-256") ?? "";
  const expected =
    "sha256=" +
    createHmac("sha256", secret).update(rawBody).digest("hex");

  if (
    !sig ||
    sig.length !== expected.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return c.json({ error: "Invalid signature" }, 403);
  }

  const body = JSON.parse(rawBody) as {
    object: string;
    entry?: WebhookLeadgenEntry[];
  };

  console.log("[webhook/facebook] Received:", {
    object: body.object,
    entryCount: body.entry?.length ?? 0,
  });

  if (body.object !== "page" || !body.entry?.length) {
    return c.json({ received: true });
  }

  // Process leads — FB expects 200 within 20 seconds
  const result = await processWebhookLeadgen(body.entry);

  console.log("[webhook/facebook] Processed:", {
    processed: result.processed,
    errors: result.errors,
  });

  return c.json({ received: true, ...result });
});

export default app;
