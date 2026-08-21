import type { ImportJobConfig } from "@/lib/sync/providers/shared/import-config";
import { fetchJson, postJson } from "@/lib/sync/providers/shared/http";

const API_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

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

/** Cached access token shared across instances within the same serverless cold start. */
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export class CJdropshippingClient {
  constructor(private apiKey: string) {}

  /** Obtain a CJ access token via the official V2 auth flow. Cached until expiry. */
  private async getAccessToken(): Promise<string> {
    if (cachedAccessToken && Date.now() < tokenExpiresAt) {
      return cachedAccessToken;
    }

    const authRes = await postJson<AuthResponse>(
      `${API_BASE}/authentication/getAccessToken`,
      { apiKey: this.apiKey },
    );

    if (authRes.code !== 200 || authRes.result === false || !authRes.data?.accessToken) {
      throw new Error(`CJ auth failed: ${authRes.message ?? "unknown error"}`);
    }

    cachedAccessToken = authRes.data.accessToken;
    const expiresInMs = (authRes.data.expiresIn ?? 86400) * 1000;
    tokenExpiresAt = Date.now() + expiresInMs - TOKEN_SAFETY_MARGIN_MS;

    return cachedAccessToken;
  }

  /** Get headers with a valid CJ access token. */
  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return { "CJ-Access-Token": token };
  }

  async searchProducts(config: ImportJobConfig): Promise<CJProduct[]> {
    const keywords = config.keywords ?? ["phone"];
    const maxPages = config.maxPages ?? 2;
    const pageSize = config.pageSize ?? 20;
    const all: CJProduct[] = [];

    for (const keyword of keywords) {
      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams({
          pageNum: String(page),
          pageSize: String(pageSize),
          productNameEn: keyword,
        });

        const batch = await fetchJson<ListResponse>(
          `${API_BASE}/product/list?${params}`,
          { headers: await this.authHeaders() },
        );

        if (batch.code !== 200 || batch.result === false) {
          throw new Error(batch.message ?? "CJdropshipping API error");
        }

        const list = batch.data?.list ?? [];
        all.push(...list);
        if (list.length < pageSize) break;
      }
    }

    return dedupeById(all);
  }

  async getProductsByIds(pids: string[]): Promise<CJProduct[]> {
    if (pids.length === 0) return [];
    const headers = await this.authHeaders();
    const all: CJProduct[] = [];

    for (const pid of pids.slice(0, 20)) {
      try {
        const batch = await fetchJson<{ code?: number; data?: CJProduct }>(
          `${API_BASE}/product/query?pid=${encodeURIComponent(pid)}`,
          { headers },
        );
        if (batch.data?.pid) all.push(batch.data);
      } catch {
        // skip unavailable products
      }
    }

    return all;
  }
}

function dedupeById(products: CJProduct[]): CJProduct[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    const id = p.pid ?? p.productNameEn ?? "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
