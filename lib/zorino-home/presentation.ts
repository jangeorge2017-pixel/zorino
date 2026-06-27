import {
  ZH_CATEGORIES,
  ZH_FOOTER_STATS,
  ZH_HERO_STATS,
  ZH_ORBIT_CARDS,
  ZH_POPULAR_SEARCHES,
  ZH_TOP_COUPONS,
  ZH_TRENDING_DEALS,
} from "@/lib/zorino-home/content";
import type {
  FloatingProductCard,
  FooterStatItem,
  HeroStatItem,
  HomepageCategoryItem,
  TopCouponCard,
  TrendingDealCard,
} from "@/lib/types/entities";

const ORBIT_SLOT_TO_POSITION: Record<string, string> = {
  top: "orbit-top",
  "upper-left": "orbit-upper-left",
  "upper-right": "orbit-upper-right",
  "lower-left": "orbit-lower-left",
};

export function withFallbackCategories(
  categories: HomepageCategoryItem[]
): HomepageCategoryItem[] {
  if (categories.length > 0) return categories;

  return ZH_CATEGORIES.map((category) => ({
    slug: category.slug,
    label: category.label,
    active: category.slug === "home",
    accent: category.accent ?? null,
  }));
}

export function withFallbackPopularSearches(searches: string[]): string[] {
  return searches.length > 0 ? searches : ZH_POPULAR_SEARCHES;
}

export function withFallbackFloatingProducts(
  products: FloatingProductCard[]
): FloatingProductCard[] {
  const visible = products.filter(
    (product) => product.imageSrc && product.discount
  );
  if (visible.length >= 4) return products;

  return ZH_ORBIT_CARDS.map((card) => ({
    imageSrc: card.imageSrc,
    discount: card.discount,
    price: card.price,
    original: card.original,
    position: ORBIT_SLOT_TO_POSITION[card.slot] ?? "orbit-top",
  }));
}

export function withFallbackDeals(deals: TrendingDealCard[]): TrendingDealCard[] {
  if (deals.length > 0) return deals;

  return ZH_TRENDING_DEALS.map((deal) => ({
    id: deal.id,
    name: deal.name,
    imageSrc: deal.imageSrc,
    emoji: "🛍️",
    discount: deal.discount,
    rating: deal.rating,
    reviews: deal.reviews,
    price: deal.price,
    originalPrice: deal.originalPrice,
    store: deal.store,
    storeLogoSrc: deal.storeLogoSrc,
    storeInitial: deal.storeInitial,
    updatedMins: deal.updatedMins,
    priceHistory: deal.priceHistory,
  }));
}

export function withFallbackCoupons(coupons: TopCouponCard[]): TopCouponCard[] {
  if (coupons.length > 0) return coupons;
  return ZH_TOP_COUPONS;
}

export function withFallbackHeroStats(stats: HeroStatItem[]): HeroStatItem[] {
  const hasLiveCounts = stats.some(
    (stat) => stat.key !== "tracking" && stat.value !== "0"
  );
  if (hasLiveCounts) return stats;

  return ZH_HERO_STATS.map((stat) => ({
    key: stat.icon,
    value: stat.value,
    label: stat.label,
    tone: stat.tone,
  }));
}

export function withFallbackFooterStats(stats: FooterStatItem[]): FooterStatItem[] {
  const hasLiveCounts = stats.some((stat) => stat.value !== "0");
  if (hasLiveCounts) return stats;

  return ZH_FOOTER_STATS.map((stat) => ({
    key: stat.icon,
    value: stat.value,
    label: stat.label,
  }));
}
