import { getCompareDataForProduct } from "@/lib/data/compare";
import { getCategoryBySlug } from "@/services/categories";
import { getProductById } from "@/services/products";
import type { CompareProductResult } from "@/services/compare";

export type ProductDetail = {
  product: CompareProductResult["product"];
  categoryName: string;
  comparison: CompareProductResult;
};

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  const comparison = await getCompareDataForProduct(id);
  if (!comparison) return null;

  const categoryResult = comparison.product.categorySlug
    ? await getCategoryBySlug(comparison.product.categorySlug)
    : { data: null, error: null };

  return {
    product: comparison.product,
    categoryName: categoryResult.data?.name ?? comparison.product.categorySlug ?? "General",
    comparison,
  };
}

/** Legacy helper for pages that only need product without comparison. */
export async function getProductDetailBasic(id: string) {
  const { data: product, error } = await getProductById(id);
  if (error || !product) return null;
  return product;
}
