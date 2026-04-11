import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import webhookApp from "./webhooks.js";

const VERIFY_TOKEN = "test-verify-token-123";
const APP_SECRET = "test-app-secret-456";

function signPayload(body: string): string {
  return "sha256=" + createHmac("sha256", APP_SECRET).update(body).digest("hex");
}

describe("webhooks routes", () => {
  beforeEach(() => {
    process.env.FB_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;
    process.env.FB_APP_SECRET = APP_SECRET;
  });

  afterEach(() => {
    delete process.env.FB_WEBHOOK_VERIFY_TOKEN;
    delete process.env.FB_APP_SECRET;
  });

  describe("GET /facebook — webhook verification", () => {
    it("returns 200 with challenge when token and mode are correct", async () => {
      const res = await webhookApp.request(
        `/facebook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=challenge_abc`,
      );
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("challenge_abc");
    });

    it("returns 403 when verify token is wrong", async () => {
      const res = await webhookApp.request(
        `/facebook?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=challenge_abc`,
      );
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json).toHaveProperty("error");
    });

    it("returns 403 when mode is not subscribe", async () => {
      const res = await webhookApp.request(
        `/facebook?hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=challenge_abc`,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 when hub.mode is missing", async () => {
      const res = await webhookApp.request(
        `/facebook?hub.verify_token=${VERIFY_TOKEN}&hub.challenge=challenge_abc`,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 when hub.verify_token is missing", async () => {
      const res = await webhookApp.request(
        `/facebook?hub.mode=subscribe&hub.challenge=challenge_abc`,
      );
      expect(res.status).toBe(403);
    });

    it("returns 403 when FB_WEBHOOK_VERIFY_TOKEN env var is not set", async () => {
      delete process.env.FB_WEBHOOK_VERIFY_TOKEN;
      const res = await webhookApp.request(
        `/facebook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=challenge_abc`,
      );
      expect(res.status).toBe(403);
    });

    it("echoes back the exact challenge string", async () => {
      const challenge = "my_unique_challenge_xyz_789";
      const res = await webhookApp.request(
        `/facebook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${challenge}`,
      );
      const text = await res.text();
      expect(text).toBe(challenge);
    });

    it("returns empty string as challenge when hub.challenge is missing", async () => {
      const res = await webhookApp.request(
        `/facebook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}`,
      );
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("");
    });
  });

  describe("POST /facebook — receive webhook event", () => {
    it("returns 200 with valid signature", async () => {
      const body = JSON.stringify({ object: "page", entry: [] });
      const res = await webhookApp.request("/facebook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": signPayload(body),
        },
        body,
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ received: true });
    });

    it("returns 403 with invalid signature", async () => {
      const body = JSON.stringify({ object: "page", entry: [] });
      const res = await webhookApp.request("/facebook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": "sha256=invalid",
        },
        body,
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when signature header is missing", async () => {
      const body = JSON.stringify({ object: "page", entry: [] });
      const res = await webhookApp.request("/facebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      expect(res.status).toBe(403);
    });

    it("returns 503 when FB_APP_SECRET is not configured", async () => {
      delete process.env.FB_APP_SECRET;
      const body = JSON.stringify({ object: "page", entry: [] });
      const res = await webhookApp.request("/facebook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": signPayload(body),
        },
        body,
      });
      expect(res.status).toBe(503);
    });

    it("returns JSON content-type with valid signature", async () => {
      const body = JSON.stringify({});
      const res = await webhookApp.request("/facebook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hub-Signature-256": signPayload(body),
        },
        body,
      });
      const ct = res.headers.get("content-type");
      expect(ct).toContain("application/json");
    });
  });
});
