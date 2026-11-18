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
const FALLBACK_BASE_URLS = ["https://jumia.com.eg", "https://www.jumia.com.eg/ar"];
const STORE_NAME = "Jumia";
const REQUEST_TIMEOUT_MS = 6_000;
const JUMIA_USER_AGENT =
  "Mozilla/5.0 (compatible; ZorinoBot/1.0; +https://zorino.com/bot; contact@zorino.com)";
const JUMIA_HEADERS: Record<string, string> = {
  "user-agent": JUMIA_USER_AGENT,
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-EG,en;q=0.9,ar-EG;q=0.8",
  referer: "https://www.jumia.com.eg/",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "same-origin",
  "upgrade-insecure-requests": "1",
};

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

async function fetchJumiaPages(
  baseUrl: string,
  query: string,
  pages: number,
  timeoutMs: number,
): Promise<RawProviderListing[]> {
  const urls = Array.from({ length: pages }, (_, index) => {
    const page = index + 1;
    return (
      `${baseUrl}/catalog/?q=${encodeURIComponent(query)}` +
      (page > 1 ? `&page=${page}` : "")
    );
  });
  const pagesHtml = await Promise.all(
    urls.map((url) =>
      fetchTextSafely(url, {
        timeoutMs,
        headers: JUMIA_HEADERS,
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
}

export const jumiaAdapter: StoreSearchAdapter = {
  id: "jumia",
  name: STORE_NAME,
  async search(query, options) {
    const pages = maxPagesFor(options, 2);
    const deadline = Date.now() + REQUEST_TIMEOUT_MS;

    for (const baseUrl of [BASE_URL, ...FALLBACK_BASE_URLS]) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const results = await fetchJumiaPages(baseUrl, query, pages, remaining);
      if (results.length > 0) return results;
    }

    return [];
  },
};


