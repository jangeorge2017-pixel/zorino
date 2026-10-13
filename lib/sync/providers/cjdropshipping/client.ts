import type { ImportJobConfig } from "@/lib/sync/providers/shared/import-config";
import { fetchJson } from "@/lib/sync/providers/shared/http";

const API_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

/** Text CJ returns when an account's API access was disabled on the dashboard. */
const DISABLED_MARKER = "API access has been disabled";
const DISABLED_REACTIVATE_URL =
  "https://www.cjdropshipping.com/my.html#/authorize/APIStores";

function isAccountDisabled(message: string): boolean {
  return (
    message.includes(DISABLED_MARKER) ||
    /(disabled|blocked|banned).{0,40}(api|access)/i.test(message)
  );
}

function disabledHint(detail: string): string {
  return `CJ API access has been disabled — reactivate at ${DISABLED_REACTIVATE_URL}: ${detail}`;
}

type CJProduct = {
  pid?: string;
  productNameEn?: string;
  productName?: string;
  productImage?: string;
  productImageSet?: string[];
  sellPrice?: number;
  suggestSellPrice?: number;
  categoryName?: string;
  description?: string;
  remark?: string;
  status?: number;
  listedNum?: number;
};

type ListResponse = {
  code?: number;
  result?: boolean;
  message?: string;
  data?: {
    list?: CJProduct[];
    total?: number;
  };
};

type AuthResponse = {
  code?: number;
  result?: boolean;
  message?: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  };
};

type TokenCacheEntry = {
  token: string;
  expiresAt: number;
};

/**
 * Access-token cache keyed by API key, so different API keys never share a
 * token and one key's expiry never kicks out another's (previously a single
 * module-level token was shared across every CJ instance in the cold start).
 */
const tokenCacheByKey = new Map<string, TokenCacheEntry>();

const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Structured result of a live connection probe (see verifyConnection). */
export type CJConnectionStatus = {
  configured: boolean;
  authenticated: boolean;
  canListProducts: boolean;
  message: string;
  sampleProductCount: number;
};

export class CJdropshippingClient {
  constructor(private apiKey: string) {}

  /** Obtain a CJ access token via the official V2 auth flow. Cached per key. */
  private async getAccessToken(): Promise<string> {
    const cached = tokenCacheByKey.get(this.apiKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.token;
    }

    // Auth also goes through the 429-aware retry: CJ rate-limits aggressively
    // and a transient 429 on the (single) auth endpoint must not fail a run.
    let authRes: AuthResponse;
    try {
      authRes = await this.fetchWithRetry<AuthResponse>(
        `${API_BASE}/authentication/getAccessToken`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: this.apiKey }),
        },
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        isAccountDisabled(detail) ? disabledHint(detail) : `CJ auth network failed: ${detail}`,
      );
    }

    if (authRes.code !== 200 || authRes.result === false || !authRes.data?.accessToken) {
      const detail = authRes.message ?? "unknown error";
      console.error(`[cjdropshipping-api] auth rejected: ${detail}`);
      throw new Error(isAccountDisabled(detail) ? disabledHint(detail) : `CJ auth failed: ${detail}`);
    }

    const expiresInMs = (authRes.data.expiresIn ?? DEFAULT_TOKEN_TTL_MS / 1000) * 1000;
    tokenCacheByKey.set(this.apiKey, {
      token: authRes.data.accessToken,
      expiresAt: Date.now() + expiresInMs - TOKEN_SAFETY_MARGIN_MS,
    });

    return tokenCacheByKey.get(this.apiKey)!.token;
  }

  /** Fetch with retry for CJ's 1 QPS rate limit. Waits and retries on 429. */
  private async fetchWithRetry<T>(url: string, init?: RequestInit, retries = 3): Promise<T> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fetchJson<T>(url, init);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const is429 = msg.includes("429") || msg.toLowerCase().includes("too many requests");
        if (is429 && attempt < retries) {
          const delayMs = 1100 * (attempt + 1);
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw err;
      }
    }
    throw new Error("CJfetchWithRetry: exhausted retries");
  }

  /**
   * Live connection probe. Returns a structured verdict instead of throwing,
   * so diagnostics can prove exactly where an account stands — auth ok but
   * remote API disabled, auth failed outright, or fully operational.
   */
  async verifyConnection(): Promise<CJConnectionStatus> {
    if (!this.apiKey.trim()) {
      return {
        configured: false,
        authenticated: false,
        canListProducts: false,
        message: "CJDROPSHIPPING_API_KEY is not set",
        sampleProductCount: 0,
      };
    }

    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err) {
      return {
        configured: true,
        authenticated: false,
        canListProducts: false,
        message: err instanceof Error ? err.message : String(err),
        sampleProductCount: 0,
      };
    }

    // Probe one minimal list call to prove products can actually be listed.
    try {
      const params = new URLSearchParams({
        pageNum: "1",
        pageSize: "5",
        productNameEn: "phone",
      });
      const batch = await this.fetchWithRetry<ListResponse>(
        `${API_BASE}/product/list?${params}`,
        { headers: { "CJ-Access-Token": token } },
      );
      if (batch.code !== 200 || batch.result === false) {
        const detail = batch.message ?? "CJdropshipping API error";
        return {
          configured: true,
          authenticated: true,
          canListProducts: false,
          message: isAccountDisabled(detail) ? disabledHint(detail) : `product/list rejected: ${detail}`,
          sampleProductCount: 0,
        };
      }
      const count = batch.data?.list?.length ?? 0;
      return {
        configured: true,
        authenticated: true,
        canListProducts: true,
        message: `product/list OK (${count} sample products on page 1)`,
        sampleProductCount: count,
      };
    } catch (err) {
      return {
        configured: true,
        authenticated: true,
        canListProducts: false,
        message: err instanceof Error ? err.message : String(err),
        sampleProductCount: 0,
      };
    }
  }

  /**
   * Keyword/pagination fan-out with partial-result resilience.
   *
   * Auth is resolved once up-front: an auth failure (bad credentials, disabled
   * account) is fatal for the whole run because every keyword shares the same
   * session — fail loud, don't blast N keywords into a dead API. Page-level
   * failures after a valid token are transient: log them, keep the products
   * already collected, and move to the next keyword. This turns a single 429 /
   * hiccup page into a partial result instead of an all-or-nothing throw.
   */
  async searchProducts(config: ImportJobConfig): Promise<CJProduct[]> {
    const keywords = config.keywords ?? ["phone"];
    const maxPages = config.maxPages ?? 2;
    const pageSize = config.pageSize ?? 20;

    const token = await this.getAccessToken();

    const all: CJProduct[] = [];
    const seen = new Set<string>();

    for (const keyword of keywords) {
      let keywordPaged = false;
      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams({
          pageNum: String(page),
          pageSize: String(pageSize),
          productNameEn: keyword,
        });

        let batch: ListResponse;
        try {
          batch = await this.fetchWithRetry<ListResponse>(
            `${API_BASE}/product/list?${params}`,
            { headers: { "CJ-Access-Token": token } },
          );
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          console.error(
            `[cjdropshipping-api] keyword "${keyword}" page ${page} failed: ${detail}`,
          );
          break;
        }

        if (batch.code !== 200 || batch.result === false) {
          const detail = batch.message ?? "CJdropshipping API error";
          if (isAccountDisabled(detail)) {
            console.error(`[cjdropshipping-api] account disabled: ${disabledHint(detail)}`);
            break;
          }
          console.warn(
            `[cjdropshipping-api] keyword "${keyword}" page ${page} response code=${batch.code}: ${detail}`,
          );
          break;
        }

        const list = batch.data?.list ?? [];
        for (const product of list) {
          const id = product.pid ?? product.productNameEn ?? "";
          if (id && !seen.has(id)) {
            seen.add(id);
            all.push(product);
          }
        }
        keywordPaged = true;
        if (list.length < pageSize) break;
      }
      if (!keywordPaged) {
        console.warn(`[cjdropshipping-api] keyword "${keyword}" returned no usable pages`);
      }
    }

    return all;
  }

  async getProductsByIds(pids: string[]): Promise<CJProduct[]> {
    if (pids.length === 0) return [];
    const token = await this.getAccessToken();

    const all: CJProduct[] = [];
    // Keep bounded: per-product queries are 1 QPS each; 20 keeps a price-sync
    // run inside the scheduler window.
    for (const pid of pids.slice(0, 20)) {
      try {
        const batch = await this.fetchWithRetry<{
          code?: number;
          result?: boolean;
          message?: string;
          data?: CJProduct;
        }>(`${API_BASE}/product/query?pid=${encodeURIComponent(pid)}`, {
          headers: { "CJ-Access-Token": token },
        });
        if (batch.data?.pid) all.push(batch.data);
      } catch {
        // skip unavailable products
      }
    }

    return all;
  }
}