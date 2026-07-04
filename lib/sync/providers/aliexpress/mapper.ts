import type { ExternalProduct } from "@/lib/sync/types";
import type { SyncContext } from "@/lib/sync/types";
import { finalizeExternalProduct, slugifyTitle } from "@/lib/sync/providers/shared/product-utils";
import { mapProviderCategory } from "@/lib/sync/providers/shared/category-map";
import type { AliExpressRawProduct } from "@/lib/integrations/aliexpress/types";

export function mapAliExpressProduct(
  ctx: SyncContext,
  raw: AliExpressRawProduct,
  defaultCategory?: string
): ExternalProduct | null {
  if (raw.product_id == null || !raw.product_title) return null;

  const price = parseFloat(raw.target_sale_price ?? "0");
  if (!price || price <= 0) return null;

  const original = parseFloat(raw.target_original_price ?? "0");
  const productUrl = raw.promotion_link ?? raw.product_detail_url ?? raw.shop_url ?? "";
  if (!productUrl) return null;

  const imageUrl = upgradeImageUrl(raw.product_main_image_url ?? "");
  const smallImages = Array.isArray(raw.product_small_image_urls)
    ? raw.product_small_image_urls
    : (raw.product_small_image_urls?.string ?? []);
  const gallery = smallImages.map(upgradeImageUrl).filter(Boolean);

  const rating = raw.evaluate_rate ? parseFloat(raw.evaluate_rate) / 20 : undefined;
  const reviews = raw.lastest_volume != null ? parseInt(String(raw.lastest_volume), 10) : 0;
  const stockQty = raw.sku_available_stock ? parseInt(raw.sku_available_stock, 10) : null;
  const inStock = stockQty !== null ? stockQty > 0 : true;

  return finalizeExternalProduct(ctx, {
    externalId: String(raw.product_id),
    title: raw.product_title.trim(),
    slug: slugifyTitle(raw.product_title),
    description: raw.product_title,
    categorySlug: defaultCategory ?? mapProviderCategory(raw.first_level_category_name, raw.product_title),
    imageUrl,
    imageUrls: gallery.length > 0 ? gallery : [imageUrl],
    price,
    originalPrice: original > price ? original : price,
    inStock,
    productUrl,
    affiliateUrl: raw.promotion_link ?? undefined,
    rating,
    reviewCount: Number.isFinite(reviews) ? reviews : 0,
    tags: raw.first_level_category_name ? [raw.first_level_category_name] : [],
  });
}

function upgradeImageUrl(url: string): string {
  if (!url) return url;
  return url.replace(/_\d+x\d+\./, "_960x960.");
}
