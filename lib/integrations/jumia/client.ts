import type { JumiaConfig } from "./config";
import type { JumiaRawProduct } from "./types";

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function productFromEntry(entry: Record<string, unknown>): JumiaRawProduct | null {
  const id = entry.externalId ?? entry.id ?? entry.sku ?? entry.productId;
  const title = entry.title ?? entry.name;
  if (!id || !title) return null;

  const price = toNumber(entry.price ?? entry.salePrice ?? entry.sale_price);
  if (!price) return null;

  const image =
    entry.imageUrl ??
    entry.image ??
    (Array.isArray(entry.images) ? entry.images[0] : undefined);
  const productUrl = entry.productUrl ?? entry.url ?? entry.affiliateUrl;
  const rating = toNumber(entry.rating);
  const reviewCount = toNumber(entry.reviewCount ?? entry.reviews_count);

  return {
    externalId: String(id),
    title: String(title),
    imageUrl: typeof image === "string" ? image : undefined,
    price,
    originalPrice: toNumber(entry.originalPrice ?? entry.original_price) ?? price,
    currency: typeof entry.currency === "string" ? entry.currency : undefined,
    countryCode: typeof entry.countryCode === "string" ? entry.countryCode : undefined,
    productUrl: typeof productUrl === "string" ? productUrl : undefined,
    rating: rating ?? undefined,
    reviewCount: reviewCount ?? undefined,
    category: typeof entry.category === "string" ? entry.category : undefined,
  };
}

function extractProductList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null,
    );
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "products", "items", "result", "results"]) {
      const value = obj[key];
      if (Array.isArray(value)) {
        return value.filter(
          (entry): entry is Record<string, unknown> =>
            typeof entry === "object" && entry !== null,
        );
      }
      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        for (const k of ["items", "products", "results"]) {
          const v = nested[k];
          if (Array.isArray(v)) {
            return v.filter(
              (entry): entry is Record<string, unknown> =>
                typeof entry === "object" && entry !== null,
            );
          }
        }
      }
    }
  }
  return [];
}

/**
 * Minimal Jumia client. Talks ONLY to the configured JUMIA_API_BASE/ENDPOINT;
 * with no endpoint configured it returns [] without touching the network, so a
 * credential-only environment can never advertise fake inventory.
 */
export class JumiaClient {
  constructor(private config: JumiaConfig) {}

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-Jumia-Api-Key": this.config.apiKey,
    };
  }

  async searchProducts(
    keywords: string[],
    opts: { maxPages?: number; pageSize?: number } = {},
  ): Promise<JumiaRawProduct[]> {
    if (!this.config.apiBase || !this.config.endpoint) return [];
    const { maxPages = 1, pageSize = 20 } = opts;

    const all: JumiaRawProduct[] = [];
    const seen = new Set<string>();

    for (const keyword of keywords) {
      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams({
          q: keyword,
          page: String(page),
          pageSize: String(pageSize),
          country: this.config.country,
          affiliate_id: this.config.affiliateId,
        });

        let list: JumiaRawProduct[];
        try {
          const res = await fetch(
            `${this.config.apiBase}${this.config.endpoint}?${params.toString()}`,
            {
              headers: this.headers(),
              signal: AbortSignal.timeout(15_000),
            },
          );
          if (!res.ok) {
            console.warn(
              `[jumia-api] keyword "${keyword}" page ${page}: HTTP ${res.status}`,
            );
            break;
          }
          const payload: unknown = await res.json();
          list = extractProductList(payload)
            .map(productFromEntry)
            .filter((p): p is JumiaRawProduct => p !== null);
        } catch (err) {
          console.warn(
            `[jumia-api] keyword "${keyword}" page ${page} failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          break;
        }

        let listCount = 0;
        for (const product of list) {
          if (!product.externalId || seen.has(product.externalId)) continue;
          seen.add(product.externalId);
          all.push(product);
          listCount++;
        }
        if (listCount < pageSize) break;
      }
    }

    return all;
  }
}