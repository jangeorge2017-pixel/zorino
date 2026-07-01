import type { Category } from "@/lib/types/entities";
import { countryCategoryPriority, type CountryCode } from "@/lib/international/config";

/** Reorder categories with country-specific priority slugs first. */
export function sortCategoriesForCountry(
  categories: Category[],
  countryCode: CountryCode
): Category[] {
  const priority = countryCategoryPriority[countryCode];
  if (!priority?.length) return categories;

  const rank = new Map(priority.map((slug, index) => [slug, index]));

  return [...categories].sort((a, b) => {
    const aRank = rank.get(a.slug) ?? 999;
    const bRank = rank.get(b.slug) ?? 999;
    if (aRank !== bRank) return aRank - bRank;
    return a.sortOrder - b.sortOrder;
  });
}
