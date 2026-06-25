import type { ImportJobConfig } from "@/lib/sync/providers/shared/import-config";
import { fetchJson } from "@/lib/sync/providers/shared/http";

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

export class CJdropshippingClient {
  constructor(private apiKey: string) {}

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
          {
            headers: {
              "CJ-Access-Token": this.apiKey,
            },
          }
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
    const all: CJProduct[] = [];

    for (const pid of pids.slice(0, 20)) {
      try {
        const batch = await fetchJson<{ code?: number; data?: CJProduct }>(
          `${API_BASE}/product/query?pid=${encodeURIComponent(pid)}`,
          { headers: { "CJ-Access-Token": this.apiKey } }
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
