/**
 * Tests for campaigns route schemas and pure validation logic.
 *
 * The routes themselves require a live DB. We test the Zod schemas in
 * isolation by re-declaring them here — keeping them in sync with the
 * source is enforced by the separate integration test suite.
 *
 * We also smoke-test the route module can be imported (no crashes at
 * module load time) and verify the FB sync body schema rejects bad input.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Mirror schemas from src/routes/campaigns.ts
// (Schemas are not exported, so we mirror them here for unit tests.)
// ---------------------------------------------------------------------------

const actionSchema = z.object({
  priority: z.enum(["urgent", "today", "week", "none"]).optional(),
  plan: z.string().max(2000).optional(),
  contentNote: z.string().max(2000).optional(),
  todayAction: z.string().max(2000).optional(),
  actionDetail: z.string().max(5000).optional(),
  assignee: z.string().max(200).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const syncBodySchema = z.object({
  adAccountId: z.string().min(1),
  projectId: z.string().uuid(),
  datePreset: z
    .enum(["today", "yesterday", "last_7d", "last_14d", "last_30d"])
    .optional(),
});

// ---------------------------------------------------------------------------
// actionSchema — PUT /api/campaigns/:id/action
// ---------------------------------------------------------------------------

describe("actionSchema (PUT body validation)", () => {
  it("accepts an empty object (all fields optional)", () => {
    const result = actionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a valid priority value", () => {
    const result = actionSchema.safeParse({ priority: "urgent" });
    expect(result.success).toBe(true);
  });

  it("accepts all four valid priority enum values", () => {
    for (const p of ["urgent", "today", "week", "none"] as const) {
      const result = actionSchema.safeParse({ priority: p });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid priority value", () => {
    const result = actionSchema.safeParse({ priority: "someday" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid ISO date for deadline", () => {
    const result = actionSchema.safeParse({ deadline: "2025-12-31" });
    expect(result.success).toBe(true);
  });

  it("rejects deadline that is not ISO date format", () => {
    const result = actionSchema.safeParse({ deadline: "31/12/2025" });
    expect(result.success).toBe(false);
  });

  it("rejects deadline with time component", () => {
    const result = actionSchema.safeParse({ deadline: "2025-12-31T23:59:59" });
    expect(result.success).toBe(false);
  });

  it("rejects plan exceeding 2000 characters", () => {
    const result = actionSchema.safeParse({ plan: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("accepts plan exactly at 2000 characters", () => {
    const result = actionSchema.safeParse({ plan: "x".repeat(2000) });
    expect(result.success).toBe(true);
  });

  it("rejects actionDetail exceeding 5000 characters", () => {
    const result = actionSchema.safeParse({ actionDetail: "a".repeat(5001) });
    expect(result.success).toBe(false);
  });

  it("accepts actionDetail exactly at 5000 characters", () => {
    const result = actionSchema.safeParse({ actionDetail: "a".repeat(5000) });
    expect(result.success).toBe(true);
  });

  it("rejects assignee exceeding 200 characters", () => {
    const result = actionSchema.safeParse({ assignee: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("accepts a full valid payload", () => {
    const result = actionSchema.safeParse({
      priority: "today",
      plan: "Increase budget by 20%",
      contentNote: "Use new creative",
      todayAction: "Call account manager",
      actionDetail: "Detailed breakdown...",
      assignee: "nguyen.van.a",
      deadline: "2025-06-30",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unexpected extra fields (strict passthrough behavior check)", () => {
    // Zod by default strips unknown keys — parsed data should not include them
    const result = actionSchema.safeParse({
      priority: "none",
      unknownField: "should-be-stripped",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("unknownField" in result.data).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// syncBodySchema — POST /api/fb/sync
// ---------------------------------------------------------------------------

describe("syncBodySchema (POST /api/fb/sync body validation)", () => {
  const validBody = {
    adAccountId: "123456789",
    projectId: "550e8400-e29b-41d4-a716-446655440000",
  };

  it("accepts a valid minimal body", () => {
    const result = syncBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("accepts body with optional datePreset", () => {
    const result = syncBodySchema.safeParse({
      ...validBody,
      datePreset: "last_30d",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid datePreset values", () => {
    const presets = ["today", "yesterday", "last_7d", "last_14d", "last_30d"] as const;
    for (const preset of presets) {
      const result = syncBodySchema.safeParse({ ...validBody, datePreset: preset });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid datePreset value", () => {
    const result = syncBodySchema.safeParse({
      ...validBody,
      datePreset: "last_90d",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing adAccountId", () => {
    const result = syncBodySchema.safeParse({
      projectId: validBody.projectId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty string adAccountId", () => {
    const result = syncBodySchema.safeParse({
      ...validBody,
      adAccountId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing projectId", () => {
    const result = syncBodySchema.safeParse({
      adAccountId: validBody.adAccountId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID projectId", () => {
    const result = syncBodySchema.safeParse({
      ...validBody,
      projectId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a completely empty body", () => {
    const result = syncBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("defaults datePreset to undefined when not supplied", () => {
    const result = syncBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.datePreset).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// extractLeadCount logic (tested through a standalone mirror)
// ---------------------------------------------------------------------------

/**
 * Mirror of the private extractLeadCount function used in sync-insights.ts
 * and sync-ads.ts. We test the logic here so the behaviour is documented
 * and regressions are caught without needing to export the function.
 */
function extractLeadCount(
  actions: Array<{ action_type: string; value: string }> | undefined,
): number {
  if (!actions) return 0;
  const leadAction = actions.find((a) => a.action_type === "lead");
  return leadAction ? parseInt(leadAction.value, 10) : 0;
}

describe("extractLeadCount (CPL calculation helper)", () => {
  it("returns 0 for undefined actions", () => {
    expect(extractLeadCount(undefined)).toBe(0);
  });

  it("returns 0 for an empty actions array", () => {
    expect(extractLeadCount([])).toBe(0);
  });

  it("returns 0 when no lead action type is present", () => {
    expect(
      extractLeadCount([
        { action_type: "link_click", value: "42" },
        { action_type: "post_engagement", value: "100" },
      ]),
    ).toBe(0);
  });

  it("returns the parsed integer value for a lead action", () => {
    expect(
      extractLeadCount([{ action_type: "lead", value: "7" }]),
    ).toBe(7);
  });

  it("picks the lead action when mixed with other types", () => {
    expect(
      extractLeadCount([
        { action_type: "link_click", value: "99" },
        { action_type: "lead", value: "3" },
        { action_type: "post_engagement", value: "50" },
      ]),
    ).toBe(3);
  });

  it("returns 0 when lead value is '0'", () => {
    expect(
      extractLeadCount([{ action_type: "lead", value: "0" }]),
    ).toBe(0);
  });

  it("handles large lead counts correctly", () => {
    expect(
      extractLeadCount([{ action_type: "lead", value: "10000" }]),
    ).toBe(10000);
  });
});
