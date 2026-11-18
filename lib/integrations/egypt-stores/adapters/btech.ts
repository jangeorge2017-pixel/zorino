import { fetchTextSafely } from "@/lib/integrations/egypt-stores/http";
import { cleanTitle, discountPercent, parseMoney } from "@/lib/integrations/egypt-stores/parse";
import type { StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import type { RawProviderListing } from "@/lib/search/types";

const BASE_URL = "https://btech.com";
const STORE_NAME = "B.TECH";

type BtechPrice = {
  final_price?: number | string;
  base_price?: number | string;
};

type BtechItem = {
  variant_id?: string;
  product_id?: string;
  offer_id?: string;
  sku?: string;
  name?: string;
  brand?: string;
  thumbnail_url?: string;
  slug?: string;
  is_in_stock?: boolean;
  price?: BtechPrice;
  parent_category?: string;
  categories?: { l2?: { name?: string; slug?: string } };
};

function findEscapedArray(html: string, marker: string): string | null {
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const markerIndex = html.indexOf(marker, searchFrom);
    if (markerIndex < 0) return null;
    const start = markerIndex + marker.length - 1;
    let depth = 0;
    let escaped = false;
    let end = -1;

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
      if (char === "[") depth += 1;
      else if (char === "]") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end > start) {
      const raw = html.slice(start, end + 1);
      if (raw.includes("variant_id")) return raw;
    }

    searchFrom = markerIndex + marker.length;
  }

  return null;
}

export function parseBtechHtml(html: string): RawProviderListing[] {
  const marker = `${String.fromCharCode(92)}"items${String.fromCharCode(92)}":[`;
  const raw = findEscapedArray(html, marker);
  if (!raw) return [];

  let items: BtechItem[];
  try {
    const unescaped = raw.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    const parsed = JSON.parse(unescaped) as unknown;
    if (!Array.isArray(parsed)) return [];
    items = parsed as BtechItem[];
  } catch {
    return [];
  }

  const results: RawProviderListing[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const title = cleanTitle(item.name);
    const price = parseMoney(item.price?.final_price);
    const originalPrice = parseMoney(item.price?.base_price);
    const slug = item.slug?.trim();
    if (!title || !price || !slug) continue;

    const externalId = String(item.variant_id ?? item.sku ?? item.product_id ?? "").trim();
    if (!externalId || seen.has(externalId)) continue;
    seen.add(externalId);

    const thumbnail = item.thumbnail_url?.trim();
    const imageUrl = thumbnail
      ? thumbnail.startsWith("http")
        ? thumbnail
        : `https://media.btech.com/catalogs/${thumbnail.replace(/^\/+/, "")}`
      : "";
    if (!imageUrl) continue;

    const url = new URL(`${BASE_URL}/en/p/${slug}`);
    if (item.offer_id) url.searchParams.set("offering_id", item.offer_id);
    const effectiveOriginal = originalPrice > price ? originalPrice : price;

    results.push({
      providerId: "btech",
      externalId,
      title,
      imageUrl,
      price,
      originalPrice: effectiveOriginal,
      discount: discountPercent(price, effectiveOriginal),
      currency: "EGP",
      storeName: STORE_NAME,
      category: item.categories?.l2?.name?.trim() ?? item.parent_category?.trim() ?? "",
      rating: 0,
      reviewCount: 0,
      inStock: item.is_in_stock !== false,
      productUrl: url.toString(),
      countryCode: "EG",
    });
  }

  return results;
}

export const btechAdapter: StoreSearchAdapter = {
  id: "btech",
  name: STORE_NAME,
  async search(query) {
    const url = `${BASE_URL}/en/s?q=${encodeURIComponent(query)}`;
    const html = await fetchTextSafely(url, { timeoutMs: 5_000 });
    return html ? parseBtechHtml(html) : [];
  },
};
