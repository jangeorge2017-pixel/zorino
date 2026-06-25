import { buildAffiliateUrl } from "@/lib/affiliate/generate";
import type { ExternalProduct } from "@/lib/sync/types";
import type { SyncContext } from "@/lib/sync/types";

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function inferCategorySlug(title: string, fallback = "phones"): string {
  const t = title.toLowerCase();
  if (/iphone|phone|samsung galaxy|pixel|smartphone/.test(t)) return "phones";
  if (/macbook|laptop|notebook|chromebook/.test(t)) return "laptops";
  if (/playstation|xbox|nintendo|gaming/.test(t)) return "gaming";
  if (/nike|jordan|shoe|sneaker|fashion/.test(t)) return "fashion";
  if (/watch|wearable|fitness tracker/.test(t)) return "wearables";
  if (/tv|television|monitor/.test(t)) return "tvs";
  if (/home|kitchen|decor/.test(t)) return "home";
  return fallback;
}

export function finalizeExternalProduct(
  ctx: SyncContext,
  partial: Omit<ExternalProduct, "currency" | "countryCode"> & {
    currency?: string;
    countryCode?: string;
  }
): ExternalProduct {
  const productUrl = partial.productUrl;
  const affiliateUrl =
    partial.affiliateUrl ??
    buildAffiliateUrl({
      destinationUrl: productUrl,
      storeSlug: ctx.storeSlug,
    });

  return {
    ...partial,
    currency: partial.currency ?? ctx.currency,
    countryCode: partial.countryCode ?? ctx.countryCode,
    affiliateUrl,
    categorySlug: partial.categorySlug || inferCategorySlug(partial.title),
    slug: partial.slug || slugifyTitle(partial.title),
    imageUrls: partial.imageUrls?.length
      ? partial.imageUrls
      : partial.imageUrl
        ? [partial.imageUrl]
        : [],
  };
}
