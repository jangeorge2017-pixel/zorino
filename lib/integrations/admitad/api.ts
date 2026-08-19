/**
 * Admitad Publisher API client.
 *
 * Discovers connected programs, ad spaces (websites), product feeds,
 * and generates deeplinks. All methods require a valid access_token
 * obtained via ./auth.
 *
 * Rate-limit: 100 requests/min. We use a simple in-flight counter
 * with a sliding window and sleep when approaching the limit.
 */

import { getAccessToken, invalidateToken } from "./auth";

const API_BASE = "https://api.admitad.com";

const MAX_RETRIES = 3;
const RATE_LIMIT_PER_MIN = 90; // stay below 100 hard limit
const RATE_WINDOW_MS = 60_000;

const requestTimestamps: number[] = [];

async function throttle(): Promise<void> {
  const now = Date.now();
  // Evict timestamps outside the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_PER_MIN) {
    const waitMs = requestTimestamps[0] + RATE_WINDOW_MS - now + 100;
    if (waitMs > 0) {
      console.log(`[admitad-api] rate-limit: sleeping ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  requestTimestamps.push(Date.now());
}

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(2000 * 2 ** (attempt - 1), 10_000);
      console.log(`[admitad-api] retry ${attempt}/${MAX_RETRIES} after ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }

    await throttle();

    const token = await getAccessToken();
    const url = new URL(path, API_BASE);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });

    if (resp.status === 401) {
      invalidateToken();
      lastError = new Error(`Admitad API 401 on ${path}`);
      continue;
    }

    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get("Retry-After") ?? "5", 10);
      console.log(`[admitad-api] 429 rate-limited, waiting ${retryAfter}s`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      lastError = new Error(`Admitad API 429 on ${path}`);
      continue;
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`Admitad API ${resp.status} on ${path}: ${body}`);
    }

    return resp.json() as Promise<T>;
  }

  throw lastError ?? new Error(`Admitad API failed after ${MAX_RETRIES} retries: ${path}`);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AdmitadWebsite = {
  id: number;
  name: string;
  url: string;
  status: string;
};

export type AdmitadCampaign = {
  id: number;
  name: string;
  status: string;
  connection_status?: string;
  site_url: string;
  currency: string;
  allow_deeplink: boolean;
  show_products_links: boolean;
  products_xml_link?: string;
  products_csv_link?: string;
  feeds_info?: AdmitadFeedInfo[];
  gotolink?: string;
  categories?: { id: number; name: string }[];
  regions?: { region: string }[];
};

export type AdmitadFeedInfo = {
  name: string;
  xml_link: string;
  csv_link: string;
  feed_id?: string;
  admitad_last_update?: string;
  advertiser_last_update?: string;
};

type PaginatedResponse<T> = {
  results: T[];
  _meta: { count: number; limit: number; offset: number };
};

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * List the publisher's ad spaces (websites).
 */
export async function listWebsites(): Promise<AdmitadWebsite[]> {
  const all: AdmitadWebsite[] = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const data = await apiGet<PaginatedResponse<AdmitadWebsite>>("/websites/", {
      offset: String(offset),
      limit: String(limit),
    });
    all.push(...data.results);
    if (all.length >= data._meta.count || data.results.length === 0) break;
    offset += limit;
  }

  console.log(`[admitad-api] found ${all.length} websites/ad-spaces`);
  return all;
}

/**
 * List all affiliate programs in the Admitad catalog.
 * Use `hasTool` to filter by capability (e.g. "products" for feeds).
 */
export async function listAllCampaigns(hasTool?: string): Promise<AdmitadCampaign[]> {
  const all: AdmitadCampaign[] = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const params: Record<string, string> = {
      offset: String(offset),
      limit: String(limit),
    };
    if (hasTool) params.has_tool = hasTool;

    const data = await apiGet<PaginatedResponse<AdmitadCampaign>>("/advcampaigns/", params);
    all.push(...data.results);
    if (all.length >= data._meta.count || data.results.length === 0) break;
    offset += limit;
  }

  console.log(`[admitad-api] found ${all.length} campaigns in catalog`);
  return all;
}

/**
 * List affiliate programs connected to a specific ad space.
 * Returns programs with connection_status, gotolink, feeds_info, etc.
 */
export async function listCampaignsForWebsite(
  websiteId: number,
  hasTool?: string,
): Promise<AdmitadCampaign[]> {
  const all: AdmitadCampaign[] = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const params: Record<string, string> = {
      offset: String(offset),
      limit: String(limit),
    };
    if (hasTool) params.has_tool = hasTool;

    const data = await apiGet<PaginatedResponse<AdmitadCampaign>>(
      `/advcampaigns/website/${websiteId}/`,
      params,
    );
    all.push(...data.results);
    if (all.length >= data._meta.count || data.results.length === 0) break;
    offset += limit;
  }

  console.log(
    `[admitad-api] found ${all.length} campaigns connected to website ${websiteId}`,
  );
  return all;
}

/**
 * Get a single campaign's details (including feeds_info).
 */
export async function getCampaign(
  campaignId: number,
  websiteId?: number,
): Promise<AdmitadCampaign> {
  if (websiteId) {
    return apiGet<AdmitadCampaign>(
      `/advcampaigns/${campaignId}/website/${websiteId}/`,
    );
  }
  return apiGet<AdmitadCampaign>(`/advcampaigns/${campaignId}/`);
}

/**
 * Generate a deeplink for a given campaign + destination URL.
 */
export async function generateDeeplink(
  websiteId: number,
  campaignId: number,
  targetUrl: string,
  subids?: Record<string, string>,
): Promise<{ link: string; is_affiliate_product: boolean | null }> {
  const params: Record<string, string> = { ulp: targetUrl };
  if (subids?.subid) params.subid = subids.subid;
  if (subids?.subid1) params.subid1 = subids.subid1;
  if (subids?.subid2) params.subid2 = subids.subid2;
  if (subids?.subid3) params.subid3 = subids.subid3;
  if (subids?.subid4) params.subid4 = subids.subid4;

  return apiGet(`/deeplink/${websiteId}/advcampaign/${campaignId}/`, params);
}
