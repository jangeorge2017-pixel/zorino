import { fetchTextSafely } from "@/lib/integrations/egypt-stores/http";
import {
  cleanTitle,
  discountPercent,
  firstMatch,
  getAttribute,
  parseMoney,
  resolveUrl,
  stripTags,
} from "@/lib/integrations/egypt-stores/parse";
import { maxPagesFor, type StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import type { RawProviderListing } from "@/lib/search/types";

const BASE_URL = "https://2b.com.eg";
const STORE_NAME = "2B";

function parsePrices(block: string): { finalPrice: number; oldPrice: number } {
  let finalPrice = 0;
  let oldPrice = 0;
  const tagPattern = /<span\b[^>]*data-price-amount[^>]*>/gi;
  for (const match of block.matchAll(tagPattern)) {
    const tag = match[0];
    const amount = parseMoney(getAttribute(tag, "data-price-amount"));
    const type = getAttribute(tag, "data-price-type") ?? "";
    if (!amount) continue;
    if (type === "finalPrice") finalPrice = amount;
    else if (type === "oldPrice") oldPrice = amount;
    else if (!finalPrice) finalPrice = amount;
  }
  return { finalPrice, oldPrice };
}

export function parse2BHtml(html: string): RawProviderListing[] {
  const blocks = html.matchAll(
    /<li\b[^>]*class="[^"]*\bproduct-item\b[^"]*"[^>]*>[\s\S]*?<\/li>/gi,
  );
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();

  for (const match of blocks) {
    const block = match[0];
    const images = [...block.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    const imageTag =
      images.find((tag) => /\bproduct-image-photo\b/.test(tag)) ?? images[0] ?? "";
    const imageUrl =
      resolveUrl(
        getAttribute(imageTag, "src") ??
          getAttribute(imageTag, "data-src") ??
          getAttribute(imageTag, "data-original"),
        BASE_URL,
      ) ?? "";
    if (!imageUrl) continue;

    const anchorMatch = /<a\b[^>]*\bproduct-item-link\b[^>]*>[\s\S]*?<\/a>/i.exec(block);
    const anchorTag = anchorMatch?.[0] ?? "";
    const anchorOpen = /^<a\b[^>]*>/i.exec(anchorTag)?.[0] ?? "";
    const productUrl = resolveUrl(getAttribute(anchorOpen, "href"), BASE_URL);
    if (!productUrl) continue;

    const title = cleanTitle(
      stripTags(anchorTag ?? "") ||
        stripTags(block.match(/<strong\b[^>]*\bproduct-item-name\b[^>]*>[\s\S]*?<\/strong>/i)?.[0] ?? ""),
    );
    if (!title) continue;

    const { finalPrice, oldPrice } = parsePrices(block);
    if (!finalPrice) continue;

    const idFromUrl = (() => {
      try {
        return new URL(productUrl).pathname.split("/").filter(Boolean).pop() ?? "";
      } catch {
        return "";
      }
    })();
    const externalId =
      getAttribute(block, "data-product-id") ?? getAttribute(block, "data-id") ?? idFromUrl;
    if (!externalId || seen.has(externalId)) continue;
    seen.add(externalId);

    const originalPrice = oldPrice > finalPrice ? oldPrice : finalPrice;
    const category = firstMatch(block, /\bdata-product-category="([^"]*)"/i) ?? "";
    const inStock = !/\bout-of-stock\b|out of stock/i.test(block);

    results.push({
      providerId: "twob",
      externalId,
      title,
      imageUrl,
      price: finalPrice,
      originalPrice,
      discount: discountPercent(finalPrice, originalPrice),
      currency: "EGP",
      storeName: STORE_NAME,
      category,
      rating: 0,
      reviewCount: 0,
      inStock,
      productUrl,
      countryCode: "EG",
    });
  }

  return results;
}

export const twobAdapter: StoreSearchAdapter = {
  id: "twob",
  name: STORE_NAME,
  async search(query, options) {
    const pages = maxPagesFor(options, 2);
    const results: RawProviderListing[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= pages; page += 1) {
      const url =
        `${BASE_URL}/en/catalogsearch/result/?q=${encodeURIComponent(query)}` +
        (page > 1 ? `&p=${page}` : "");
      const html = await fetchTextSafely(url, { timeoutMs: 3_500 });
      if (!html) continue;
      for (const item of parse2BHtml(html)) {
        if (seen.has(item.externalId)) continue;
        seen.add(item.externalId);
        results.push(item);
      }
    }

    return results;
  },
};
