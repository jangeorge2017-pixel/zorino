import {
  compareImportedProductPrices,
  compareProductsByIds,
  getComparableProducts,
  type CompareProductResult,
} from "@/services/compare";

export type { CompareProductResult };

/** Data layer for /compare — ready for UI wiring without changing components yet. */
export async function getComparePageProducts(limit = 6): Promise<CompareProductResult[]> {
  const { data, error } = await getComparableProducts({ limit });
  if (error || !data.length) return [];
  return data;
}

export async function getCompareDataForProduct(productId: string) {
  const { data, error } = await compareImportedProductPrices(productId);
  if (error) return null;
  return data;
}

export async function getCompareDataForProducts(productIds: string[]) {
  const { data, error } = await compareProductsByIds(productIds);
  if (error) return [];
  return data;
}
