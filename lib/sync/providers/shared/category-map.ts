import { inferCategorySlug } from "@/lib/sync/providers/shared/product-utils";

/** Canonical Zorino category slugs. */
export type CategorySlug =
  | "phones"
  | "laptops"
  | "gaming"
  | "tvs"
  | "home"
  | "wearables"
  | "fashion";

const PROVIDER_CATEGORY_RULES: Array<{
  pattern: RegExp;
  slug: CategorySlug;
}> = [
  { pattern: /phone|mobile|smartphone|iphone|samsung|pixel|cell/i, slug: "phones" },
  { pattern: /laptop|notebook|macbook|chromebook|ultrabook/i, slug: "laptops" },
  { pattern: /game|gaming|playstation|xbox|nintendo|console|controller/i, slug: "gaming" },
  { pattern: /tv|television|monitor|display|projector/i, slug: "tvs" },
  { pattern: /watch|wearable|fitness|band|earbud|headphone|audio/i, slug: "wearables" },
  { pattern: /shoe|sneaker|jordan|nike|adidas|fashion|clothing|apparel|dress/i, slug: "fashion" },
  { pattern: /home|kitchen|decor|furniture|light|garden|pet|tool/i, slug: "home" },
];

/**
 * Map a provider-native category name to a Zorino category slug.
 * Falls back to title-based heuristics when no rule matches.
 */
export function mapProviderCategory(
  providerCategory: string | undefined | null,
  productTitle: string,
  fallback: CategorySlug = "home"
): CategorySlug {
  const source = (providerCategory ?? "").trim();
  if (source) {
    for (const rule of PROVIDER_CATEGORY_RULES) {
      if (rule.pattern.test(source)) return rule.slug;
    }
  }
  return inferCategorySlug(productTitle, fallback) as CategorySlug;
}
