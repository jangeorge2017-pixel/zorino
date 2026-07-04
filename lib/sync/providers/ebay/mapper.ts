import type { ExternalProduct } from "@/lib/sync/types";
import type { SyncContext } from "@/lib/sync/types";
import type { EbayRawProduct } from "@/lib/integrations/ebay/types";
import { finalizeExternalProduct, slugifyTitle } from "@/lib/sync/providers/shared/product-utils";
import { mapProviderCategory } from "@/lib/sync/providers/shared/category-map";

export function mapEbayProduct(
  ctx: SyncContext,
  raw: EbayRawProduct,
  defaultCategory?: string
): ExternalProduct | null {
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

  const gallery = [
    raw.image?.imageUrl,
    ...(raw.additionalImages?.map((img) => img.imageUrl) ?? []),
  ].filter(Boolean) as string[];

  const imageUrl = upgradeEbayImage(gallery[0] ?? "");
  const qty = raw.estimatedAvailabilities?.[0]?.estimatedAvailableQuantity;
  const inStock =
    qty !== undefined ? qty > 0 : (raw.buyingOptions ?? []).includes("FIXED_PRICE");

  const description =
    raw.shortDescription?.trim() ||
    `${raw.title}${raw.condition ? ` — ${raw.condition}` : ""}${raw.seller?.username ? ` · Seller: ${raw.seller.username}` : ""}`;

  return finalizeExternalProduct(ctx, {
    externalId: raw.itemId,
    title: raw.title.trim(),
    slug: slugifyTitle(raw.title),
    description,
    brand: raw.seller?.username,
    categorySlug: defaultCategory ?? mapProviderCategory(raw.condition, raw.title),
    imageUrl,
    imageUrls: gallery.length > 0 ? gallery.map(upgradeEbayImage) : [imageUrl],
    price,
    originalPrice,
    discount: discount > 0 ? discount : undefined,
    discountType: discount > 0 ? "percentage" : undefined,
    currency: raw.price?.currency ?? ctx.currency,
    inStock,
    productUrl,
    affiliateUrl: raw.itemAffiliateWebUrl ?? undefined,
  });
}

function upgradeEbayImage(url: string): string {
  if (!url) return url;
  return url.replace(/s-l\d+\./, "s-l1600.");
}
