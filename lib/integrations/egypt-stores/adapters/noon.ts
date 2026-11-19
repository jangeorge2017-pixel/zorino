import { fetchTextSafely } from "@/lib/integrations/egypt-stores/http";
import {
  cleanTitle,
  discountPercent,
  getAttribute,
  parseMoney,
  resolveUrl,
  stripTags,
} from "@/lib/integrations/egypt-stores/parse";
import { maxPagesFor, type StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import type { RawProviderListing } from "@/lib/search/types";

const BASE_URL = "https://www.noon.com";
const STORE_NAME = "Noon";

function parseProductChunk(chunk: string): RawProviderListing | null {
  const linkTag = /<a\b[^>]*href="([^"]+)"[^>]*>/i.exec(chunk)?.[0] ?? "";
  const productUrl = resolveUrl(getAttribute(linkTag, "href"), BASE_URL);
  if (!productUrl) return null;

  const imageTags = [...chunk.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imageTag =
    imageTags.find((tag) => /\b_productImage_/.test(tag)) ??
    imageTags.find((tag) => /nooncdn\.com\/p\//.test(tag)) ??
    "";
  const imageUrl = resolveUrl(
    getAttribute(imageTag, "src") ?? getAttribute(imageTag, "data-src"),
    BASE_URL,
  );
  if (!imageUrl) return null;

  const title = cleanTitle(
    getAttribute(imageTag, "alt") ??
      stripTags(chunk.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/i)?.[0] ?? ""),
  );
  const price = parseMoney(
    chunk.match(/_sellingPrice_[\s\S]{0,500}?<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1],
  );
  if (!title || !price) return null;

  const originalPrice = parseMoney(chunk.match(/_oldPrice_[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
  const effectiveOriginal = originalPrice > price ? originalPrice : price;
  const identifier =
    /\/([A-Z0-9]{5,})\/p\//.exec(productUrl)?.[1] ??
    (() => {
      try {
        return new URL(productUrl).pathname.split("/").filter(Boolean).slice(-2)[0] ?? "";
      } catch {
        return "";
      }
    })();
  if (!identifier) return null;

  return {
    providerId: "noon",
    externalId: identifier,
    title,
    imageUrl,
    price,
    originalPrice: effectiveOriginal,
    discount: discountPercent(price, effectiveOriginal),
    currency: "EGP",
    storeName: STORE_NAME,
    category: "",
    rating: 0,
    reviewCount: 0,
    inStock: !/\bout of stock\b|currently unavailable/i.test(chunk),
    productUrl,
    countryCode: "EG",
  };
}

export function parseNoonHtml(html: string): RawProviderListing[] {
  const starts = [...html.matchAll(/data-qa="plp-product-box"/g)]
    .map((match) => match.index ?? -1)
    .filter((index) => index >= 0);
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = starts[i + 1] ?? Math.min(html.length, start + 25_000);
    const item = parseProductChunk(html.slice(start, end));
    if (!item || seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    results.push(item);
  }

  return results;
}

export const noonAdapter: StoreSearchAdapter = {
  id: "noon",
  name: STORE_NAME,
  async search(query, options) {
    const pages = maxPagesFor(options, 2);
    const results: RawProviderListing[] = [];
    const seen = new Set<string>();

    const htmlPages = await Promise.all(
      Array.from({ length: pages }, (_, index) => {
        const page = index + 1;
        const url =
          `${BASE_URL}/egypt-en/search/?q=${encodeURIComponent(query)}` +
          (page > 1 ? `&page=${page}` : "");
        return fetchTextSafely(url, { timeoutMs: 7_000 });
      }),
    );

    for (const html of htmlPages) {
      if (!html) continue;
      for (const item of parseNoonHtml(html)) {
        if (seen.has(item.externalId)) continue;
        seen.add(item.externalId);
        results.push(item);
      }
    }

    return results;
  },
};

