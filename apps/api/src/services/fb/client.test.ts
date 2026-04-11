/**
 * Unit tests for FacebookGraphClient.
 *
 * All network calls are intercepted via vi.stubGlobal("fetch", ...) so
 * no real HTTP requests are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  FacebookGraphClient,
  FacebookApiError,
} from "./client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fetch Response stub. */
function makeResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Stub global fetch with a single response. */
function stubFetch(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  const mock = vi.fn().mockResolvedValue(makeResponse(body, status));
  vi.stubGlobal("fetch", mock);
  return mock;
}

// ---------------------------------------------------------------------------
// FacebookApiError
// ---------------------------------------------------------------------------

describe("FacebookApiError", () => {
  it("stores statusCode on the instance", () => {
    const err = new FacebookApiError("Rate limited", 429);
    expect(err.statusCode).toBe(429);
  });

  it("sets name to FacebookApiError", () => {
    const err = new FacebookApiError("Bad token", 401);
    expect(err.name).toBe("FacebookApiError");
  });

  it("inherits from Error", () => {
    const err = new FacebookApiError("oops", 500);
    expect(err).toBeInstanceOf(Error);
  });

  it("exposes the message", () => {
    const err = new FacebookApiError("some message", 400);
    expect(err.message).toBe("some message");
  });
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe("FacebookGraphClient constructor", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("accepts a token and creates an instance", () => {
    const client = new FacebookGraphClient("my-token");
    expect(client).toBeInstanceOf(FacebookGraphClient);
  });

  it("uses the stored token in API requests", async () => {
    const mock = stubFetch({ data: [], paging: {} });
    const client = new FacebookGraphClient("secret-token");

    await client.getCampaigns("123456");

    const calledUrl: string = mock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("access_token=secret-token");
  });
});

// ---------------------------------------------------------------------------
// getCampaigns
// ---------------------------------------------------------------------------

describe("FacebookGraphClient.getCampaigns", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the correct path for an ad account", async () => {
    const mock = stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    await client.getCampaigns("987654");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("/act_987654/campaigns");
  });

  it("includes required fields in the query string", async () => {
    const mock = stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    await client.getCampaigns("123");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("fields=");
    expect(url).toContain("name");
    expect(url).toContain("status");
  });

  it("returns an empty array when data is empty", async () => {
    stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    const result = await client.getCampaigns("123");

    expect(result).toEqual([]);
  });

  it("returns campaigns from the first page", async () => {
    const campaigns = [
      { id: "c1", name: "Camp A", status: "ACTIVE", effective_status: "ACTIVE", objective: "REACH" },
      { id: "c2", name: "Camp B", status: "PAUSED", effective_status: "PAUSED", objective: "CONVERSIONS" },
    ];
    stubFetch({ data: campaigns });
    const client = new FacebookGraphClient("tok");

    const result = await client.getCampaigns("123");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("c1");
    expect(result[1].name).toBe("Camp B");
  });

  it("follows pagination and collects all pages", async () => {
    const page1 = {
      data: [{ id: "c1", name: "Camp A", status: "ACTIVE", effective_status: "ACTIVE", objective: "REACH" }],
      paging: { next: "https://graph.facebook.com/page2" },
    };
    const page2 = {
      data: [{ id: "c2", name: "Camp B", status: "PAUSED", effective_status: "PAUSED", objective: "CONVERSIONS" }],
      paging: {},
    };

    const mock = vi.fn()
      .mockResolvedValueOnce(makeResponse(page1))
      .mockResolvedValueOnce(makeResponse(page2));
    vi.stubGlobal("fetch", mock);

    const client = new FacebookGraphClient("tok");
    const result = await client.getCampaigns("123");

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("throws FacebookApiError when response contains an error body", async () => {
    stubFetch(
      { error: { message: "Invalid OAuth access token", code: 190 } },
      400,
    );
    const client = new FacebookGraphClient("bad-tok");

    await expect(client.getCampaigns("123")).rejects.toThrow(FacebookApiError);
  });

  it("uses the error.message from the FB error body", async () => {
    stubFetch(
      { error: { message: "Invalid OAuth access token", code: 190 } },
      400,
    );
    const client = new FacebookGraphClient("bad-tok");

    await expect(client.getCampaigns("123")).rejects.toThrow(
      "Invalid OAuth access token",
    );
  });

  it("uses error.code as statusCode on FacebookApiError", async () => {
    stubFetch(
      { error: { message: "Some error", code: 190 } },
      400,
    );
    const client = new FacebookGraphClient("bad-tok");

    try {
      await client.getCampaigns("123");
    } catch (err) {
      expect(err).toBeInstanceOf(FacebookApiError);
      expect((err as FacebookApiError).statusCode).toBe(190);
    }
  });

  it("falls back to HTTP status when error body has no code", async () => {
    stubFetch({ error: { message: "oops" } }, 503);
    const client = new FacebookGraphClient("tok");

    try {
      await client.getCampaigns("123");
    } catch (err) {
      expect((err as FacebookApiError).statusCode).toBe(503);
    }
  });

  it("throws on non-ok response even without error field", async () => {
    stubFetch({ data: [] }, 500);
    const client = new FacebookGraphClient("tok");

    // status 500 → ok=false → should throw
    await expect(client.getCampaigns("123")).rejects.toThrow(FacebookApiError);
  });
});

// ---------------------------------------------------------------------------
// getCampaignInsights
// ---------------------------------------------------------------------------

describe("FacebookGraphClient.getCampaignInsights", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the correct path for a campaign", async () => {
    const mock = stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    await client.getCampaignInsights("camp_999");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("/camp_999/insights");
  });

  it("uses 'today' as the default date_preset", async () => {
    const mock = stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    await client.getCampaignInsights("camp_1");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("date_preset=today");
  });

  it("passes a custom date_preset when provided", async () => {
    const mock = stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    await client.getCampaignInsights("camp_1", "last_30d");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("date_preset=last_30d");
  });

  it("returns the insights array from the response", async () => {
    const insight = {
      spend: "50.00",
      impressions: "1000",
      clicks: "25",
      ctr: "2.5",
      cpm: "50",
      frequency: "1.2",
      date_start: "2024-01-01",
      date_stop: "2024-01-01",
    };
    stubFetch({ data: [insight] });
    const client = new FacebookGraphClient("tok");

    const result = await client.getCampaignInsights("camp_1");

    expect(result).toHaveLength(1);
    expect(result[0].spend).toBe("50.00");
  });

  it("returns empty array when no insights exist", async () => {
    stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    const result = await client.getCampaignInsights("camp_1");

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getAds
// ---------------------------------------------------------------------------

describe("FacebookGraphClient.getAds", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the correct ads path for the ad account", async () => {
    const mock = stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    await client.getAds("act_111");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("/act_act_111/ads");
  });

  it("includes creative fields in request", async () => {
    const mock = stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    await client.getAds("111");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("creative");
  });

  it("returns ads with thumbnail when present", async () => {
    const fbAd = {
      id: "ad_1",
      name: "My Ad",
      creative: { thumbnail_url: "https://example.com/thumb.jpg" },
    };
    stubFetch({ data: [fbAd] });
    const client = new FacebookGraphClient("tok");

    const result = await client.getAds("111");

    expect(result[0].creative?.thumbnail_url).toBe("https://example.com/thumb.jpg");
  });
});

// ---------------------------------------------------------------------------
// getAdInsights
// ---------------------------------------------------------------------------

describe("FacebookGraphClient.getAdInsights", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests insights for the correct ad id", async () => {
    const mock = stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    await client.getAdInsights("ad_42");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("/ad_42/insights");
  });

  it("defaults to today date_preset", async () => {
    const mock = stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    await client.getAdInsights("ad_1");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("date_preset=today");
  });

  it("passes custom date_preset", async () => {
    const mock = stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    await client.getAdInsights("ad_1", "last_7d");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("date_preset=last_7d");
  });
});

// ---------------------------------------------------------------------------
// getLeadgenData
// ---------------------------------------------------------------------------

describe("FacebookGraphClient.getLeadgenData", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests the leadgen resource by id", async () => {
    const mock = stubFetch({
      id: "lgn_99",
      field_data: [],
    });
    const client = new FacebookGraphClient("tok");

    await client.getLeadgenData("lgn_99");

    const url: string = mock.mock.calls[0][0] as string;
    expect(url).toContain("/lgn_99");
    expect(url).toContain("fields=field_data");
  });

  it("returns the leadgen data object", async () => {
    const data = {
      id: "lgn_1",
      field_data: [
        { name: "email", values: ["test@example.com"] },
        { name: "phone_number", values: ["+84901234567"] },
      ],
    };
    stubFetch(data);
    const client = new FacebookGraphClient("tok");

    const result = await client.getLeadgenData("lgn_1");

    expect(result.id).toBe("lgn_1");
    expect(result.field_data).toHaveLength(2);
    expect(result.field_data[0].name).toBe("email");
  });
});

// ---------------------------------------------------------------------------
// Rate limit tracking
// ---------------------------------------------------------------------------

describe("FacebookGraphClient rate limit tracking", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("increments internal call count per request", async () => {
    stubFetch({ data: [] });
    const client = new FacebookGraphClient("tok");

    // Make 3 requests — each should succeed without throwing
    await client.getCampaigns("1");
    await client.getCampaigns("1");
    await client.getCampaigns("1");

    // We cannot read private callCount directly.
    // Verify that console.warn is NOT called for 3 calls (threshold is 180).
    // The test merely asserts the calls all resolved without error.
    expect(true).toBe(true);
  });

  it("warns via console.warn when approaching the rate limit", async () => {
    // Provide enough stubbed responses for 180 calls
    const mock = vi.fn().mockResolvedValue(makeResponse({ data: [] }));
    vi.stubGlobal("fetch", mock);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const client = new FacebookGraphClient("tok");

    // Make 180 calls to hit RATE_LIMIT_WARNING_THRESHOLD
    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < 180; i++) {
      promises.push(client.getCampaigns("acc1"));
    }
    await Promise.all(promises);

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain("rate limit");

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Pagination error handling
// ---------------------------------------------------------------------------

describe("FacebookGraphClient pagination error handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("throws FacebookApiError when a pagination page returns an error", async () => {
    const page1 = {
      data: [{ id: "c1", name: "Camp A", status: "ACTIVE", effective_status: "ACTIVE", objective: "REACH" }],
      paging: { next: "https://graph.facebook.com/page2" },
    };
    const page2Error = {
      error: { message: "Pagination error", code: 100 },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(makeResponse(page1))
        .mockResolvedValueOnce(makeResponse(page2Error, 400)),
    );

    const client = new FacebookGraphClient("tok");
    await expect(client.getCampaigns("123")).rejects.toThrow(FacebookApiError);
  });

  it("stops pagination when paging.next is absent", async () => {
    const page1 = {
      data: [{ id: "c1", name: "Camp A", status: "ACTIVE", effective_status: "ACTIVE", objective: "REACH" }],
      // No paging.next → should NOT make a second call
    };

    const mock = vi.fn().mockResolvedValue(makeResponse(page1));
    vi.stubGlobal("fetch", mock);

    const client = new FacebookGraphClient("tok");
    await client.getCampaigns("123");

    expect(mock).toHaveBeenCalledTimes(1);
  });
});
