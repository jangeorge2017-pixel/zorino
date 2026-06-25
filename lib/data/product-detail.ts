import { getCompareDataForProduct } from "@/lib/data/compare";
import { getCategoryBySlug } from "@/services/categories";
import { getProductById } from "@/services/products";
import { getPriceHistory } from "@/services/prices";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import type { CompareProductResult } from "@/services/compare";
import type { PriceHistoryPoint } from "@/lib/types/entities";
import type { ProductVariant } from "@/lib/marketplace-engine/types";

export type ProductDetail = {
  product: CompareProductResult["product"];
  categoryName: string;
  comparison: CompareProductResult;
  images: string[];
  specifications: Record<string, string>;
  variants: ProductVariant[];
  priceHistory: PriceHistoryPoint[];
};

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  const comparison = await getCompareDataForProduct(id);
  if (!comparison) return null;

  const [categoryResult, images, specifications, variants, priceHistory] = await Promise.all([
    comparison.product.categorySlug
      ? getCategoryBySlug(comparison.product.categorySlug)
      : Promise.resolve({ data: null, error: null }),
    getProductImages(id),
    getProductSpecifications(id),
    getProductVariants(id),
    getPriceHistory(id, { limit: 30 }),
  ]);

  return {
    product: comparison.product,
    categoryName: categoryResult.data?.name ?? comparison.product.categorySlug ?? "General",
    comparison,
    images,
    specifications,
    variants,
    priceHistory: priceHistory.data ?? [],
  };
}

/** Legacy helper for pages that only need product without comparison. */
export async function getProductDetailBasic(id: string) {
  const { data: product, error } = await getProductById(id);
  if (error || !product) return null;
  return product;
}

async function getProductImages(productId: string): Promise<string[]> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("product_images")
    .select("url, is_primary, sort_order")
    .eq("product_id", productId)
    .order("sort_order");

  return (data ?? []).map((row) => (row as { url: string }).url);
}

async function getProductSpecifications(productId: string): Promise<Record<string, string>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return {};

  const { data } = await supabase
    .from("products")
    .select("specifications")
    .eq("id", productId)
    .maybeSingle();

  const specs = (data as { specifications?: Record<string, string> | null } | null)?.specifications;
  return specs && typeof specs === "object" ? specs : {};
}

async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("price");

  return ((data ?? []) as {
    id: string;
    product_id: string;
    store_id: string | null;
    external_id: string | null;
    sku: string | null;
    name: string;
    attributes: Record<string, string>;
    price: number | null;
    original_price: number | null;
    currency: string;
    in_stock: boolean;
    image_url: string | null;
  }[]).map((row) => ({
    id: row.id,
    productId: row.product_id,
    storeId: row.store_id,
    externalId: row.external_id,
    sku: row.sku,
    name: row.name,
    attributes: row.attributes ?? {},
    price: row.price,
    originalPrice: row.original_price,
    currency: row.currency,
    inStock: row.in_stock,
    imageUrl: row.image_url,
  }));
}
