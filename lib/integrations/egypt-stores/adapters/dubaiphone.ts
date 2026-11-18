import { fetchTextSafely } from "@/lib/integrations/egypt-stores/http";
import {
  cleanTitle,
  getAttribute,
  parseMoney,
  resolveUrl,
  stripTags,
} from "@/lib/integrations/egypt-stores/parse";
import type { StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import type { RawProviderListing } from "@/lib/search/types";

const BASE_URL = "https://www.dubaiphone.net";
const STORE_NAME = "Dubai Phone";

function resolveImage(rawSrc: string | null): string | null {
  if (!rawSrc) return null;
  if (rawSrc.startsWith("/_next/image?")) {
    try {
      const remote = new URL(rawSrc, BASE_URL).searchParams.get("url");
      if (remote) return resolveUrl(remote, BASE_URL);
    } catch {
      return null;
    }
  }
  return resolveUrl(rawSrc, BASE_URL);
}

export function parseDubaiPhoneHtml(html: string): RawProviderListing[] {
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a\b[^>]*href="([^"]*\/shop\/[^"]+)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1];
    const start = match.index ?? 0;
    const chunk = html.slice(start, start + 8_000);
    const productUrl = resolveUrl(href, BASE_URL);
    if (!productUrl) continue;

    const imageTags = [...chunk.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    const imageTag = imageTags.find((tag) => Boolean(getAttribute(tag, "alt"))) ?? imageTags[0] ?? "";
    const imageUrl = resolveImage(getAttribute(imageTag, "src") ?? getAttribute(imageTag, "data-src"));
    const title = cleanTitle(getAttribute(imageTag, "alt"));
    if (!imageUrl || !title) continue;

    const text = stripTags(chunk);
    const priceMatch = /\b(\d[\d,.]*)\s*EGP\b/i.exec(text);
    const price = parseMoney(priceMatch?.[1]);
    if (!price) continue;

    const externalId =
      (() => {
        try {
          return new URL(productUrl).pathname.split("/").filter(Boolean).pop() ?? "";
        } catch {
          return "";
        }
      })() || title;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    results.push({
      providerId: "dubaiphone",
      externalId,
      title,
      imageUrl,
      price,
      originalPrice: price,
      discount: 0,
      currency: "EGP",
      storeName: STORE_NAME,
      category: "",
      rating: 0,
      reviewCount: 0,
      inStock: !/\bout of stock\b|not available/i.test(text),
      productUrl,
      countryCode: "EG",
    });
  }

  return results;
}

export const dubaiphoneAdapter: StoreSearchAdapter = {
  id: "dubaiphone",
  name: STORE_NAME,
  async search(query) {
    const html = await fetchTextSafely(
      `${BASE_URL}/en/search-results?q=${encodeURIComponent(query)}`,
      { timeoutMs: 4_000 },
    );
    return html ? parseDubaiPhoneHtml(html) : [];
  },
};
