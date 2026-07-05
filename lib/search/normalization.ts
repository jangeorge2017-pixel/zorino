import type { AliExpressRawProduct } from "@/lib/integrations/aliexpress/types";
import type { EbayRawProduct } from "@/lib/integrations/ebay/types";
import type {
  NormalizedSearchListing,
  RawProviderListing,
  SearchProviderId,
} from "@/lib/search/types";
import type { ProductMatchTier } from "@/lib/search/relevance";

function upgradeAliExpressImage(url: string): string {
  if (!url) return url;
  return url.replace(/_\d+x\d+\./, "_960x960.");
}

function upgradeEbayImage(url: string): string {
  if (!url) return url;
  return url.replace(/s-l\d+\./, "s-l1600.");
}

function parseRating(evaluateRate?: string): number {
  if (!evaluateRate) return 0;
  const numeric = parseFloat(evaluateRate.replace("%", ""));
  if (!Number.isFinite(numeric)) return 0;
  if (numeric > 5) return Math.min(5, Math.round((numeric / 20) * 10) / 10);
  return Math.min(5, Math.round(numeric * 10) / 10);
}

function parseSalesCount(volume?: string | number): number {
  if (volume == null) return 0;
  const n = typeof volume === "number" ? volume : parseInt(volume, 10);
  return Number.isFinite(n) ? n : 0;
}

/** AliExpress Affiliates API → raw provider listing. */
export function normalizeAliExpressRaw(raw: AliExpressRawProduct): RawProviderListing | null {
  const externalId = raw.product_id != null ? String(raw.product_id) : "";
  if (!externalId || !raw.product_title) return null;

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

  const imageUrl = upgradeAliExpressImage(raw.product_main_image_url ?? "");
  if (!imageUrl.startsWith("http")) return null;

  const salesCount = parseSalesCount(raw.lastest_volume);

  return {
    providerId: "aliexpress",
    externalId,
    title: raw.product_title.trim(),
    imageUrl,
    price,
    originalPrice,
    discount,
    currency: raw.target_sale_price_currency?.trim() || "USD",
    storeName: raw.shop_title?.trim() || "AliExpress",
    category: raw.first_level_category_name?.trim() || "General",
    rating: parseRating(raw.evaluate_rate),
    reviewCount: salesCount,
    salesCount,
    inStock: true,
    productUrl: affiliateLink,
    affiliateUrl: affiliateLink,
  };
}

/** eBay Browse API → raw provider listing. */
export function normalizeEbayRaw(raw: EbayRawProduct): RawProviderListing | null {
  if (!raw.itemId || !raw.title) return null;

  const price = parseFloat(raw.price?.value ?? "0");
  if (!price || price <= 0) return null;

  const marketingOriginal = parseFloat(raw.marketingPrice?.originalPrice?.value ?? "0");
  const originalPrice = marketingOriginal > price ? marketingOriginal : price;
  const discountFromApi = raw.marketingPrice?.discountPercentage
    ? Math.round(parseFloat(raw.marketingPrice.discountPercentage))
    : 0;
  const discount =
    discountFromApi > 0
      ? discountFromApi
      : originalPrice > price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0;

  const productUrl = raw.itemAffiliateWebUrl ?? raw.itemWebUrl ?? "";
  if (!productUrl) return null;

  const imageUrl = upgradeEbayImage(raw.image?.imageUrl ?? "");
  if (!imageUrl.startsWith("http")) return null;

  const qty = raw.estimatedAvailabilities?.[0]?.estimatedAvailableQuantity;
  const inStock =
    qty !== undefined ? qty > 0 : (raw.buyingOptions ?? []).includes("FIXED_PRICE");

  return {
    providerId: "ebay",
    externalId: raw.itemId,
    title: raw.title.trim(),
    imageUrl,
    price,
    originalPrice,
    discount,
    currency: raw.price?.currency ?? "USD",
    storeName: raw.seller?.username?.trim() || "eBay",
    category: raw.condition?.trim() || "General",
    rating: 0,
    reviewCount: 0,
    inStock,
    productUrl,
    affiliateUrl: raw.itemAffiliateWebUrl ?? productUrl,
  };
}

export function toNormalizedListing(
  raw: RawProviderListing,
  analysis: { score: number; tier: ProductMatchTier; isDevice: boolean }
): NormalizedSearchListing {
  return {
    ...raw,
    id: `${raw.providerId}-${raw.externalId}`,
    storeSlug: raw.providerId,
    relevanceScore: analysis.score,
    matchTier: analysis.tier,
    isDevice: analysis.isDevice,
  };
}

/** Normalize any raw provider listing with optional provider-specific upgrade. */
export function normalizeRawListing(
  raw: RawProviderListing,
  analysis: { score: number; tier: ProductMatchTier; isDevice: boolean }
): NormalizedSearchListing {
  return toNormalizedListing(raw, analysis);
}
