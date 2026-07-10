import type { AliExpressRawProduct } from "@/lib/integrations/aliexpress/types";
import type { AliExpressOpenApiProduct } from "@/lib/integrations/aliexpress/open-api-types";

function upgradeImageUrl(url: string): string {
  if (!url) return url;
  return url.replace(/_\d+x\d+\./, "_960x960.");
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
  const n = typeof volume === "number" ? volume : parseInt(String(volume), 10);
  return Number.isFinite(n) ? n : 0;
}

function parsePrice(...candidates: Array<string | undefined>): number {
  for (const candidate of candidates) {
    const n = parseFloat(candidate ?? "");
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export function formatAliExpressStoreName(raw: AliExpressRawProduct): string {
  const titled = raw.shop_title?.trim() || raw.shop_name?.trim();
  if (titled) return titled;
  if (raw.shop_id != null && String(raw.shop_id).trim()) {
    return `AliExpress Store ${String(raw.shop_id).trim()}`;
  }
  return "AliExpress";
}

export function formatAliExpressShipping(raw: AliExpressRawProduct): string {
  if (raw.shipping_info?.trim()) return raw.shipping_info.trim();
  if (raw.delivery_time?.trim()) return raw.delivery_time.trim();

  const days = raw.ship_to_days;
  if (days != null && String(days).trim()) {
    const value = String(days).trim();
    // API often returns prose like "ship to US in 7 days".
    if (/[a-zA-Z]/.test(value)) return value;
    return `${value} days shipping`;
  }

  const freight = raw.freight ?? raw.ship_cost;
  if (freight != null && String(freight).trim()) {
    const value = String(freight).trim();
    if (value === "0" || value.toLowerCase() === "free") return "Free shipping";
    return `Shipping: ${value}`;
  }

  return "Shipping varies by seller";
}

/**
 * Map Open Platform raw product → ZORINO product fields.
 * Requires a usable image and price; affiliate URL may be filled later via link.generate.
 */
export function mapAliExpressRawToOpenApiProduct(
  raw: AliExpressRawProduct,
  affiliateUrlOverride?: string,
): AliExpressOpenApiProduct | null {
  const productId = raw.product_id != null ? String(raw.product_id) : "";
  if (!productId || !raw.product_title?.trim()) return null;

  const currentPrice = parsePrice(raw.target_sale_price, raw.sale_price);
  if (!currentPrice) return null;

  const original = parsePrice(raw.target_original_price, raw.original_price);
  const originalPrice = original > currentPrice ? original : currentPrice;
  const discount =
    originalPrice > currentPrice
      ? Math.max(0, Math.round(((originalPrice - currentPrice) / originalPrice) * 100))
      : 0;

  const image = upgradeImageUrl(raw.product_main_image_url ?? "");
  if (!image.startsWith("http")) return null;

  const productUrl =
    raw.product_detail_url?.trim() ||
    raw.shop_url?.trim() ||
    `https://www.aliexpress.com/item/${productId}.html`;

  const affiliateUrl =
    affiliateUrlOverride?.trim() ||
    raw.promotion_link?.trim() ||
    productUrl;

  return {
    productId,
    title: raw.product_title.trim(),
    image,
    currentPrice,
    originalPrice,
    discount,
    rating: parseRating(raw.evaluate_rate),
    salesCount: parseSalesCount(raw.lastest_volume),
    storeName: formatAliExpressStoreName(raw),
    shipping: formatAliExpressShipping(raw),
    affiliateUrl,
    productUrl,
    currency:
      raw.target_sale_price_currency?.trim() ||
      raw.sale_price_currency?.trim() ||
      "USD",
    category: raw.first_level_category_name?.trim() || "General",
    inStock: true,
  };
}
