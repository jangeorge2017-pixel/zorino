import { createAliExpressClientFromEnv } from "@/lib/integrations/aliexpress";
import type { AliExpressRawProduct } from "@/lib/integrations/aliexpress/types";
import type { SearchResultItem } from "@/lib/data/homepage";
import { loadAliExpressCredentials } from "@/services/aliexpress/credentials";

function upgradeImageUrl(url: string): string {
  if (!url) return url;
  return url.replace(/_\d+x\d+\./, "_960x960.");
}

function parseRating(evaluateRate?: string): number {
  if (!evaluateRate) return 4.5;
  const numeric = parseFloat(evaluateRate.replace("%", ""));
  if (!Number.isFinite(numeric)) return 4.5;
  // AliExpress evaluate_rate is typically a percentage (e.g. 94.8 → 4.74 stars).
  if (numeric > 5) return Math.min(5, Math.round((numeric / 20) * 10) / 10);
  return Math.min(5, Math.round(numeric * 10) / 10);
}

function parseSalesCount(volume?: string | number): number {
  if (volume == null) return 0;
  const n = typeof volume === "number" ? volume : parseInt(volume, 10);
  return Number.isFinite(n) ? n : 0;
}

function mapRawToSearchItem(raw: AliExpressRawProduct): SearchResultItem | null {
  if (!raw.product_id || !raw.product_title) return null;

  const price = parseFloat(raw.target_sale_price ?? "0");
  if (!price || price <= 0) return null;

  const original = parseFloat(raw.target_original_price ?? "0");
  const originalPrice = original > price ? original : price;
  const discount =
    originalPrice > price
      ? Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100))
      : 0;

  const affiliateLink =
    raw.promotion_link?.trim() ||
    raw.product_detail_url?.trim() ||
    raw.shop_url?.trim() ||
    "";
  if (!affiliateLink) return null;

  const imageSrc = upgradeImageUrl(raw.product_main_image_url ?? "");
  const salesCount = parseSalesCount(raw.lastest_volume);
  const storeName = raw.shop_title?.trim() || "AliExpress";

  return {
    id: `aliexpress-${raw.product_id}`,
    name: raw.product_title.trim(),
    imageSrc: imageSrc || "/products/placeholder.svg",
    emoji: "🛍️",
    price,
    originalPrice,
    discount,
    store: storeName,
    storeSlug: "aliexpress",
    rating: parseRating(raw.evaluate_rate),
    reviewCount: salesCount,
    salesCount,
    inStock: true,
    category: raw.first_level_category_name?.trim() || "General",
    affiliateUrl: affiliateLink,
  };
}

/**
 * Live AliExpress Affiliates product search.
 * Returns [] when credentials are missing or the API fails (caller falls back).
 */
export async function searchAliExpressLive(
  query: string,
  limit = 24
): Promise<SearchResultItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    await loadAliExpressCredentials();
    const client = createAliExpressClientFromEnv();
    if (!client) return [];

    const products = await client.searchByKeyword(trimmed, {
      pageSize: limit,
      pageNo: 1,
      currency: "USD",
    });

    return products
      .map(mapRawToSearchItem)
      .filter((item): item is SearchResultItem => item !== null)
      .slice(0, limit);
  } catch (err) {
    console.error(
      "[aliexpress-search]",
      err instanceof Error ? err.message : "AliExpress search failed"
    );
    return [];
  }
}
