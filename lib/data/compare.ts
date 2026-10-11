import {
  compareImportedProductPrices,
  compareProductsByIds,
  getComparableProducts,
  type CompareProductResult,
} from "@/services/compare";
import { getServerIntlPreferences } from "@/lib/international/preferences";

export type { CompareProductResult };

/** Data layer for /compare page. */
export async function getComparePageProducts(limit = 6): Promise<CompareProductResult[]> {
  const { currencyCode } = await getServerIntlPreferences("en");
  const { data, error } = await getComparableProducts({ limit, displayCurrency: currencyCode });
  if (!error && data.length > 0) return data;

  const { getProducts } = await import("@/services/products");
  const { data: products } = await getProducts({ limit: limit * 2 });
  const results: CompareProductResult[] = [];

  for (const product of products) {
    const { data: comparison } = await compareImportedProductPrices(product.id, {
      displayCurrency: currencyCode,
    });
    if (comparison && comparison.offers.length > 0) {
      results.push(comparison);
    }
    if (results.length >= limit) break;
  }

  return results;
}

export async function getCompareDataForProduct(productId: string) {
  const { currencyCode } = await getServerIntlPreferences("en");
  const { data, error } = await compareImportedProductPrices(productId, {
    displayCurrency: currencyCode,
  });
  if (error) return null;
  return data;
}

export async function getCompareDataForProducts(productIds: string[]) {
  const { currencyCode } = await getServerIntlPreferences("en");
  const { data, error } = await compareProductsByIds(productIds, {
    displayCurrency: currencyCode,
  });
  if (error) return [];
  return data;
}