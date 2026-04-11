/**
 * Facebook Graph API v21.0 client.
 * Pure HTTP wrapper — no DB access. Sync services handle persistence.
 */

const BASE_URL = "https://graph.facebook.com/v21.0";

// Threshold before FB's 200 calls/hr window
const RATE_LIMIT_WARNING_THRESHOLD = 180;

export class FacebookApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "FacebookApiError";
    this.statusCode = statusCode;
  }
}

// --- FB API response shapes ---

export interface FbCampaign {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
}

export interface FbAction {
  action_type: string;
  value: string;
}

export interface FbCampaignInsight {
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpm: string;
  frequency: string;
  actions?: FbAction[];
  date_start: string;
  date_stop: string;
}

export interface FbAd {
  id: string;
  name: string;
  creative?: {
    thumbnail_url?: string;
  };
}

export interface FbAdInsight {
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpm: string;
  actions?: FbAction[];
  date_start: string;
  date_stop: string;
}

export interface FbLeadFieldData {
  name: string;
  values: string[];
}

export interface FbLeadgenData {
  field_data: FbLeadFieldData[];
  id: string;
}

interface FbPaging {
  cursors?: { before: string; after: string };
  next?: string;
}

interface FbPaginatedResponse<T> {
  data: T[];
  paging?: FbPaging;
}

interface FbInsightResponse<T> {
  data: T[];
  paging?: FbPaging;
}

export class FacebookGraphClient {
  private readonly accessToken: string;
  private callCount = 0;
  private windowStart = Date.now();

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // --- Rate limit tracking ---

  private trackCall(): void {
    const now = Date.now();
    // Reset counter every hour
    if (now - this.windowStart > 60 * 60 * 1000) {
      this.callCount = 0;
      this.windowStart = now;
    }
    this.callCount += 1;
    if (this.callCount >= RATE_LIMIT_WARNING_THRESHOLD) {
      console.warn(
        `[fb-client] Approaching FB rate limit: ${this.callCount} calls in current window`,
      );
    }
  }

  // --- Core fetch helper ---

  private async fetchJson<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T> {
    this.trackCall();

    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set("access_token", this.accessToken);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString());
    const body = await res.json() as Record<string, unknown>;

    if (!res.ok || "error" in body) {
      const err = body["error"] as { message?: string; code?: number } | undefined;
      throw new FacebookApiError(
        err?.message ?? `FB API error (HTTP ${res.status})`,
        err?.code ?? res.status,
      );
    }

    return body as T;
  }

  // --- Pagination helper: collect all pages ---

  private async fetchAllPages<T>(
    path: string,
    params: Record<string, string> = {},
  ): Promise<T[]> {
    const results: T[] = [];

    const first = await this.fetchJson<FbPaginatedResponse<T>>(path, params);
    results.push(...first.data);

    let nextUrl = first.paging?.next;
    while (nextUrl) {
      this.trackCall();
      const res = await fetch(nextUrl);
      const body = await res.json() as Record<string, unknown>;

      if (!res.ok || "error" in body) {
        const err = body["error"] as { message?: string; code?: number } | undefined;
        throw new FacebookApiError(
          err?.message ?? `FB API pagination error (HTTP ${res.status})`,
          err?.code ?? res.status,
        );
      }

      const page = body as unknown as FbPaginatedResponse<T>;
      results.push(...page.data);
      nextUrl = page.paging?.next;
    }

    return results;
  }

  // --- Public API methods ---

  /**
   * Fetch all campaigns for an ad account.
   * Returns id, name, status, effective_status, objective.
   */
  async getCampaigns(adAccountId: string): Promise<FbCampaign[]> {
    return this.fetchAllPages<FbCampaign>(
      `/act_${adAccountId}/campaigns`,
      { fields: "id,name,status,effective_status,objective" },
    );
  }

  /**
   * Fetch insights for a single campaign.
   * @param datePreset FB date preset e.g. "today", "last_7d", "last_30d". Defaults to "today".
   */
  async getCampaignInsights(
    campaignId: string,
    datePreset = "today",
  ): Promise<FbCampaignInsight[]> {
    const response = await this.fetchJson<FbInsightResponse<FbCampaignInsight>>(
      `/${campaignId}/insights`,
      {
        fields: "spend,impressions,clicks,ctr,cpm,frequency,actions",
        date_preset: datePreset,
      },
    );
    return response.data;
  }

  /**
   * Fetch all ads for an ad account with creative thumbnail.
   */
  async getAds(adAccountId: string): Promise<FbAd[]> {
    return this.fetchAllPages<FbAd>(
      `/act_${adAccountId}/ads`,
      { fields: "id,name,creative{thumbnail_url}" },
    );
  }

  /**
   * Fetch insights for a single ad.
   */
  async getAdInsights(adId: string, datePreset = "today"): Promise<FbAdInsight[]> {
    const response = await this.fetchJson<FbInsightResponse<FbAdInsight>>(
      `/${adId}/insights`,
      {
        fields: "spend,impressions,clicks,ctr,cpm,actions",
        date_preset: datePreset,
      },
    );
    return response.data;
  }

  /**
   * Fetch lead gen form submission data by leadgen_id.
   */
  async getLeadgenData(leadgenId: string): Promise<FbLeadgenData> {
    return this.fetchJson<FbLeadgenData>(`/${leadgenId}`, {
      fields: "field_data",
    });
  }
}
