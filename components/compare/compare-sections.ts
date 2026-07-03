import type { CompareProductResult } from "@/services/compare";

export type CompareSectionId = "best_savings" | "lowest_prices" | "most_stores" | "trending";

export type CompareSection = {
  id: CompareSectionId;
  products: CompareProductResult[];
};

const SECTION_LIMIT = 3;

function topProducts(pool: CompareProductResult[], limit = SECTION_LIMIT): CompareProductResult[] {
  return pool.slice(0, limit);
}

export function buildCompareSections(products: CompareProductResult[]): CompareSection[] {
  const bestSavings = topProducts(
    [...products].sort((a, b) => b.savingsPercent - a.savingsPercent || b.savingsVsHighest - a.savingsVsHighest),
  );

  const lowestPrices = topProducts(
    [...products].sort((a, b) => a.lowestPrice - b.lowestPrice),
  );

  const mostStores = topProducts(
    [...products].sort((a, b) => b.providerCount - a.providerCount),
  );

  const trending = topProducts([...products]);

  const sections: CompareSection[] = [
    { id: "best_savings", products: bestSavings },
    { id: "lowest_prices", products: lowestPrices },
    { id: "most_stores", products: mostStores },
    { id: "trending", products: trending },
  ];

  return sections.filter((section) => section.products.length > 0);
}
