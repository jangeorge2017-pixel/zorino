import type { Category } from "@/lib/types/entities";

export type CategorySectionId = "trending" | "tech" | "lifestyle" | "explore";

export type CategorySection = {
  id: CategorySectionId;
  categories: Category[];
};

const SECTION_LIMIT = 4;

const TECH_SLUGS = new Set(["phones", "laptops", "gaming", "tvs", "wearables"]);
const LIFESTYLE_SLUGS = new Set(["home", "fashion"]);

function topCategories(pool: Category[], limit = SECTION_LIMIT): Category[] {
  return pool.slice(0, limit);
}

export function buildCategorySections(categories: Category[]): CategorySection[] {
  const active = categories.filter((category) => category.isActive);

  const trending = topCategories(
    [...active].sort((a, b) => b.productCount - a.productCount),
  );

  const tech = topCategories(
    [...active]
      .filter((category) => TECH_SLUGS.has(category.slug))
      .sort((a, b) => b.productCount - a.productCount),
  );

  const lifestyle = topCategories(
    [...active]
      .filter((category) => LIFESTYLE_SLUGS.has(category.slug))
      .sort((a, b) => b.productCount - a.productCount),
  );

  const explore = topCategories(
    [...active]
      .filter((category) => !TECH_SLUGS.has(category.slug) && !LIFESTYLE_SLUGS.has(category.slug))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  const sections: CategorySection[] = [
    { id: "trending", categories: trending },
    { id: "tech", categories: tech },
    { id: "lifestyle", categories: lifestyle },
    { id: "explore", categories: explore },
  ];

  return sections.filter((section) => section.categories.length > 0);
}
