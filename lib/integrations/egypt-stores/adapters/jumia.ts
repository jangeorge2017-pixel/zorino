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

const BASE_URL = "https://www.jumia.com.eg";
const STORE_NAME = "Jumia";

function parseArticle(block: string): RawProviderListing | null {
  const linkMatch = /<a\b[^>]*class="[^"]*\bcore\b[^"]*"[^>]*>/i.exec(block);
  const linkTag = linkMatch?.[0] ?? "";
  const href = getAttribute(linkTag, "href");
  const productUrl = resolveUrl(href, BASE_URL);
  if (!productUrl) return null;

  const externalId = (
    getAttribute(linkTag, "data-gtm-id") ??
    getAttribute(block, "data-sku") ??
    getAttribute(block, "data-gtm-id") ??
    ""
  ).trim();
  const title = cleanTitle(
    getAttribute(linkTag, "data-gtm-name") ??
      getAttribute(block, "data-gtm-name") ??
      stripTags(block.match(/<h3\b[^>]*class="[^"]*\bname\b[^"]*"[^>]*>[\s\S]*?<\/h3>/i)?.[0] ?? ""),
  );
  const price = parseMoney(
    getAttribute(linkTag, "data-gtm-price") ?? getAttribute(block, "data-gtm-price"),
  );
  if (!externalId || !title || !price) return null;

  const imageUrl = resolveUrl(getAttribute(block, "data-moengage-product_image"), BASE_URL);
  if (!imageUrl) return null;

  const discountValue = parseMoney(
    getAttribute(linkTag, "data-ga4-discount") ?? getAttribute(block, "data-ga4-discount"),
  );
  const originalPrice = discountValue > 0 ? price + discountValue : price;
  const category = (
    getAttribute(linkTag, "data-gtm-category") ??
    getAttribute(block, "data-gtm-category") ??
    ""
  )
    .split("/")[0]
    ?.trim();

  return {
    providerId: "jumia",
    externalId,
    title,
    imageUrl,
    price,
    originalPrice,
    discount: discountPercent(price, originalPrice),
    currency: "EGP",
    storeName: STORE_NAME,
    category: category ?? "",
    rating: 0,
    reviewCount: 0,
    inStock: !/\bout of stock\b|not available/i.test(block),
    productUrl,
    countryCode: "EG",
  };
}

export function parseJumiaHtml(html: string): RawProviderListing[] {
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();
  const articlePattern = /<article\b[^>]*class="[^"]*\bprd\b[^"]*"[^>]*>[\s\S]*?<\/article>/gi;

  for (const match of html.matchAll(articlePattern)) {
    const item = parseArticle(match[0]);
    if (!item || seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    results.push(item);
  }

  return results;
}

export const jumiaAdapter: StoreSearchAdapter = {
  id: "jumia",
  name: STORE_NAME,
  async search(query, options) {
    const pages = maxPagesFor(options, 2);
    const urls = Array.from({ length: pages }, (_, index) => {
      const page = index + 1;
      return (
        `${BASE_URL}/catalog/?q=${encodeURIComponent(query)}` +
        (page > 1 ? `&page=${page}` : "")
      );
    });
    const pagesHtml = await Promise.all(
      urls.map((url) =>
        fetchTextSafely(url, {
          timeoutMs: 7_000,
          headers: { "user-agent": "Mozilla/5.0" },
        }),
      ),
    );

    const results: RawProviderListing[] = [];
    const seen = new Set<string>();
    for (const html of pagesHtml) {
      if (!html) continue;
      for (const item of parseJumiaHtml(html)) {
        if (seen.has(item.externalId)) continue;
        seen.add(item.externalId);
        results.push(item);
      }
    }

    return results;
  },
};


