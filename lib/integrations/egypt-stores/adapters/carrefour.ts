import { fetchTextSafely } from "@/lib/integrations/egypt-stores/http";
import {
  cleanTitle,
  discountPercent,
  parseMoney,
  resolveUrl,
} from "@/lib/integrations/egypt-stores/parse";
import { maxPagesFor, type StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import type { RawProviderListing } from "@/lib/search/types";

const BASE_URL = "https://www.carrefouregypt.com";
const STORE_NAME = "Carrefour";

const PRODUCT_PATTERN =
  /\\"imageUrl\\":\\"([^"\\]+)\\".{0,500}?\\"productId\\":\\"([^"\\]+)\\",\\"productName\\":\\"([^"\\]+)\\".{0,1800}?\\"sellingPrice\\":([0-9.]+),\\"markedPrice\\":([0-9.]+),\\"currency\\":\\"([^"\\]+)\\".{0,1800}?\\"productUrl\\":\\"([^"\\]+)\\"/g;

export function parseCarrefourHtml(html: string): RawProviderListing[] {
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(PRODUCT_PATTERN)) {
    const [, rawImage, productId, rawName, rawSelling, rawMarked, rawCurrency, rawPath] = match;
    const title = cleanTitle(rawName);
    const price = parseMoney(rawSelling);
    const productUrl = resolveUrl(rawPath, BASE_URL);
    const imageUrl = resolveUrl(rawImage, BASE_URL);
    if (!productId || !title || !price || !productUrl || !imageUrl) continue;
    if (seen.has(productId)) continue;
    seen.add(productId);

    const markedPrice = parseMoney(rawMarked);
    const originalPrice = markedPrice > price ? markedPrice : price;

    results.push({
      providerId: "carrefour",
      externalId: productId,
      title,
      imageUrl,
      price,
      originalPrice,
      discount: discountPercent(price, originalPrice),
      currency: (rawCurrency || "EGP").trim(),
      storeName: STORE_NAME,
      category: "",
      rating: 0,
      reviewCount: 0,
      inStock: true,
      productUrl,
      countryCode: "EG",
    });
  }

  return results;
}

export const carrefourAdapter: StoreSearchAdapter = {
  id: "carrefour",
  name: STORE_NAME,
  async search(query, options) {
    const pages = maxPagesFor(options, 2);
    const results: RawProviderListing[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= pages; page += 1) {
      const url =
        `${BASE_URL}/mafegy/en/search?keyword=${encodeURIComponent(query)}` +
        (page > 1 ? `&currentPage=${page}` : "");
      const html = await fetchTextSafely(url, { timeoutMs: 3_500 });
      if (!html) continue;
      for (const item of parseCarrefourHtml(html)) {
        if (seen.has(item.externalId)) continue;
        seen.add(item.externalId);
        results.push(item);
      }
    }

    return results;
  },
};

