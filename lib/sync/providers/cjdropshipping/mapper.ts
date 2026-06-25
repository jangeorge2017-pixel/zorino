import type { ExternalProduct } from "@/lib/sync/types";
import type { SyncContext } from "@/lib/sync/types";
import { finalizeExternalProduct, slugifyTitle } from "@/lib/sync/providers/shared/product-utils";
import { mapProviderCategory } from "@/lib/sync/providers/shared/category-map";

type CJProduct = {
  pid?: string;
  productNameEn?: string;
  productName?: string;
  productImage?: string;
  productImageSet?: string[];
  sellPrice?: number;
  suggestSellPrice?: number;
  categoryName?: string;
  description?: string;
  remark?: string;
  status?: number;
  listedNum?: number;
};

export function mapCJProduct(
  ctx: SyncContext,
  raw: CJProduct,
  defaultCategory?: string
): ExternalProduct | null {
  const title = (raw.productNameEn ?? raw.productName ?? "").trim();
  if (!raw.pid || !title) return null;

  const price = Number(raw.sellPrice ?? raw.suggestSellPrice ?? 0);
  if (!price || price <= 0) return null;

  const productUrl = `https://cjdropshipping.com/product/${raw.pid}.html`;
  const gallery = [
    raw.productImage,
    ...(raw.productImageSet ?? []),
  ].filter(Boolean) as string[];

  const imageUrl = gallery[0] ?? "";
  if (!imageUrl) return null;

  const description =
    raw.description?.trim() ||
    raw.remark?.trim() ||
    `${title}${raw.categoryName ? ` — ${raw.categoryName}` : ""}`;

  const inStock = raw.status === undefined || raw.status === 1;

  return finalizeExternalProduct(ctx, {
    externalId: String(raw.pid),
    title,
    slug: slugifyTitle(title),
    description,
    categorySlug: defaultCategory ?? mapProviderCategory(raw.categoryName, title, "home"),
    imageUrl,
    imageUrls: gallery,
    price,
    originalPrice: raw.suggestSellPrice && raw.suggestSellPrice > price ? raw.suggestSellPrice : price,
    inStock,
    productUrl,
    tags: raw.categoryName ? [raw.categoryName] : [],
  });
}
