import { ZH_CATEGORIES, ZH_POPULAR_SEARCHES } from "@/lib/zorino-home/content";
import type { HomepageSectionProducts } from "@/lib/data/homepage";
import type {
  FloatingProductCard,
  FooterStatItem,
  HeroStatItem,
  HomepageCategoryItem,
  TopCouponCard,
  TrendingDealCard,
} from "@/lib/types/entities";

export function withFallbackCategories(
  categories: HomepageCategoryItem[]
): HomepageCategoryItem[] {
  // Canonical shortcuts in fixed order — never a “More” tile.
  const bySlug = new Map(
    categories
      .filter((item) => item.slug !== "more")
      .map((item) => [item.slug, item]),
  );

  const ordered = ZH_CATEGORIES.map((category) => {
    const match = bySlug.get(category.slug);
    bySlug.delete(category.slug);
    return {
      slug: category.slug,
      label: match?.label || category.label,
      active: Boolean(category.highlighted) || category.slug === "home",
      accent: category.accent ?? match?.accent ?? null,
    };
  });

  // Any extra live categories that used to sit behind More
  for (const item of bySlug.values()) {
    ordered.push({
      slug: item.slug,
      label: item.label,
      active: Boolean(item.active),
      accent: item.accent ?? null,
    });
  }

  return ordered;
}

export function withFallbackPopularSearches(searches: string[]): string[] {
  return searches.length > 0 ? searches : ZH_POPULAR_SEARCHES;
}

export function withFallbackFloatingProducts(
  products: FloatingProductCard[]
): FloatingProductCard[] {
  // No fabricated fallback cards. The hero shows real product cards only;
  // when none are available it renders nothing rather than invented prices.
  return products;
}

export function withFallbackDeals(deals: TrendingDealCard[]): TrendingDealCard[] {
  // No fabricated fallback deals. Real, data-backed deals only.
  return deals;
}

/**
 * Zorino never fabricates data to make a surface look populated. These
 * "fallback" helpers used to inject hardcoded coupon/stat content; instead they
 * now pass the real, data-backed values through unchanged. When there are no
 * real coupons, products, or stats, the UI honestly renders nothing/0 rather
 * than fake offers or inflated counts.
 */
export function withFallbackCoupons(coupons: TopCouponCard[]): TopCouponCard[] {
  return coupons;
}

export function withFallbackHeroStats(stats: HeroStatItem[]): HeroStatItem[] {
  return stats;
}

export function withFallbackFooterStats(stats: FooterStatItem[]): FooterStatItem[] {
  return stats;
}

/**
 * Zorino never fabricates data to make a surface look populated. Section
 * products are real, data-backed items only; when none are available the
 * sections honestly render empty rather than invented products.
 */
export function withFallbackSectionProducts(
  sections: HomepageSectionProducts,
): HomepageSectionProducts {
  return sections;
}
