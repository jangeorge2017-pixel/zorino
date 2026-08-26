/**
 * Maps category slugs to search keywords used by the search engine.
 * Each category maps to keywords that will retrieve relevant products.
 */
export const CATEGORY_SEARCH_KEYWORDS: Record<string, string[]> = {
  phones: ["phone", "smartphone", "mobile"],
  laptops: ["laptop", "notebook", "chromebook"],
  gaming: ["gaming", "game controller", "console"],
  tvs: ["television", "tv", "monitor"],
  home: ["home", "kitchen", "furniture"],
  wearables: ["smartwatch", "watch", "fitness tracker"],
  fashion: ["fashion", "shoes", "clothing"],
  electronics: ["electronics", "gadget"],
  audio: ["headphones", "earbuds", "speaker"],
  beauty: ["beauty", "skincare", "cosmetics"],
  sports: ["sports", "fitness", "gym"],
};

/**
 * Get the primary search keyword for a category slug.
 * Returns the first keyword from the mapping, or the slug itself as fallback.
 */
export function getCategorySearchKeyword(slug: string): string {
  const keywords = CATEGORY_SEARCH_KEYWORDS[slug];
  return keywords?.[0] ?? slug.replace(/-/g, " ");
}

/**
 * Check if a product's category field matches a given category slug.
 * Uses fuzzy matching to handle marketplace-specific category naming.
 */
export function productMatchesCategory(
  productCategory: string,
  categorySlug: string,
): boolean {
  const pc = (productCategory || "").toLowerCase();
  const slug = categorySlug.toLowerCase();

  // Direct match
  if (pc === slug) return true;

  // Slug contains the product category or vice versa
  if (pc.includes(slug) || slug.includes(pc)) return true;

  // Check keyword variants
  const keywords = CATEGORY_SEARCH_KEYWORDS[slug];
  if (keywords) {
    return keywords.some((kw) => pc.includes(kw));
  }

  return false;
}
