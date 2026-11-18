import { fetchJsonSafely } from "@/lib/integrations/egypt-stores/http";
import { cleanTitle, discountPercent, parseMoney, resolveUrl } from "@/lib/integrations/egypt-stores/parse";
import { maxPagesFor, type StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import type { RawProviderListing } from "@/lib/search/types";

const BASE_URL = "https://www.raneen.com";
const STORE_NAME = "Raneen";

type RaneenProduct = {
  id?: string;
  entityId?: string | number;
  title?: string;
  url?: string;
  imageUrl?: string;
  price?: number | string;
  originalPrice?: number | string;
  currencyCode?: string;
  availability?: string;
  brand?: string;
  variantSku?: string;
  ratingSummary?: number;
  reviewsCount?: number;
  category?: string;
};

type RaneenResponse = {
  products?: RaneenProduct[];
  nextPageToken?: string;
};

export function parseRaneenProducts(products: RaneenProduct[]): RawProviderListing[] {
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();

  for (const product of products) {
    const externalId = String(product.id ?? product.entityId ?? product.variantSku ?? "").trim();
    const title = cleanTitle(product.title);
    const productUrl = resolveUrl(product.url, BASE_URL);
    const imageUrl = resolveUrl(product.imageUrl, BASE_URL);
    const price = parseMoney(product.price);
    if (!externalId || !title || !productUrl || !imageUrl || !price) continue;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const originalPrice = parseMoney(product.originalPrice);
    const effectiveOriginal = originalPrice > price ? originalPrice : price;
    const availability = (product.availability ?? "").toUpperCase();

    results.push({
      providerId: "raneen",
      externalId,
      title,
      imageUrl,
      price,
      originalPrice: effectiveOriginal,
      discount: discountPercent(price, effectiveOriginal),
      currency: product.currencyCode?.trim() || "EGP",
      storeName: STORE_NAME,
      category: product.category?.trim() ?? "",
      rating: Number(product.ratingSummary) || 0,
      reviewCount: Number(product.reviewsCount) || 0,
      inStock: availability.includes("IN_STOCK") || availability.includes("AVAILABLE"),
      productUrl,
      countryCode: "EG",
    });
  }

  return results;
}

export const raneenAdapter: StoreSearchAdapter = {
  id: "raneen",
  name: STORE_NAME,
  async search(query, options) {
    const pages = maxPagesFor(options, 2);
    const results: RawProviderListing[] = [];
    const seen = new Set<string>();
    let token: string | undefined;

    for (let page = 0; page < pages; page += 1) {
      const params = new URLSearchParams({
        q: query,
        sort: "relevance",
        visitorId: "zorino-search",
        page: String(page),
      });
      if (token) params.set("pageToken", token);
      const data = await fetchJsonSafely<RaneenResponse>(
        `${BASE_URL}/en/vertex/search/query/?${params.toString()}`,
        { timeoutMs: 7_000 },
      );
      if (!data) break;

      const products = Array.isArray(data.products) ? data.products : [];
      for (const item of parseRaneenProducts(products)) {
        if (seen.has(item.externalId)) continue;
        seen.add(item.externalId);
        results.push(item);
      }

      token = data.nextPageToken;
      if (!token || products.length === 0) break;
    }

    return results;
  },
};


