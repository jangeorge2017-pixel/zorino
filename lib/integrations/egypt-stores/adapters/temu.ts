import { fetchText } from "@/lib/integrations/egypt-stores/http";
import { cleanTitle, discountPercent, parseMoney, resolveUrl } from "@/lib/integrations/egypt-stores/parse";
import type { StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import type { RawProviderListing } from "@/lib/search/types";

const BASE_URL = "https://www.temu.com";
const STORE_NAME = "Temu";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractJsonObject(html: string, marker: string): unknown {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf("{", markerIndex + marker.length);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function collectProducts(root: unknown): RawProviderListing[] {
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();
  const stack: Array<{ value: unknown; depth: number }> = [{ value: root, depth: 0 }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || current.depth > 12) continue;
    const value = current.value;

    if (Array.isArray(value)) {
      for (const child of value) stack.push({ value: child, depth: current.depth + 1 });
      continue;
    }
    if (!isRecord(value)) continue;

    const goodsId = value.goodsId ?? value.goods_id ?? value.productId;
    const rawTitle = value.goodsName ?? value.goods_name ?? value.title;
    const priceInfo = isRecord(value.priceInfo) ? value.priceInfo : {};
    const price = parseMoney(
      (priceInfo.price as string | number | undefined) ??
        (priceInfo.salePrice as string | number | undefined) ??
        (value.price as string | number | undefined),
    );
    const externalId = String(goodsId ?? "").trim();

    if (externalId && typeof rawTitle === "string" && price > 0) {
      const title = cleanTitle(rawTitle);
      const imageUrl = resolveUrl(
        (value.hdThumbUrl as string | undefined) ??
          (value.thumbUrl as string | undefined) ??
          (value.imageUrl as string | undefined) ??
          (value.image as string | undefined),
        BASE_URL,
      );
      const productUrl = resolveUrl(
        (value.linkUrl as string | undefined) ??
          (value.productUrl as string | undefined) ??
          (value.url as string | undefined),
        BASE_URL,
      );
      if (title && imageUrl && productUrl && !seen.has(externalId)) {
        seen.add(externalId);
        const originalPrice = parseMoney(
          (priceInfo.marketPrice as string | number | undefined) ??
            (priceInfo.originalPrice as string | number | undefined),
        );
        const effectiveOriginal = originalPrice > price ? originalPrice : price;
        results.push({
          providerId: "temu",
          externalId,
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
          inStock: value.isSoldOut !== true && value.soldOut !== true,
          productUrl,
          countryCode: "EG",
        });
      }
    }

    for (const child of Object.values(value)) {
      if (typeof child === "object" && child !== null) {
        stack.push({ value: child, depth: current.depth + 1 });
      }
    }
  }

  return results;
}

export function parseTemuHtml(html: string): RawProviderListing[] {
  for (const marker of ["window.rawData=", "window.rawData =", "__NEXT_DATA__"]) {
    const data = extractJsonObject(html, marker);
    const results = data ? collectProducts(data) : [];
    if (results.length > 0) return results;
  }
  return [];
}

export const temuAdapter: StoreSearchAdapter = {
  id: "temu",
  name: STORE_NAME,
  async search(query) {
    const url = `${BASE_URL}/eg-en/search_result.html?search_key=${encodeURIComponent(query)}`;
    const html = await fetchText(url, { timeoutMs: 5_000 });
    const results = parseTemuHtml(html);
    if (results.length === 0) {
      const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
      throw new Error(
        `temu-search-unavailable title="${title}" bytes=${html.length} challenge=${html.toLowerCase().includes("challenge")}`,
      );
    }
    return results;
  },
};
