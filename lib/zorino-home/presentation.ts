import {
  ZH_CATEGORIES,
  ZH_FOOTER_STATS,
  ZH_HERO_STATS,
  ZH_ORBIT_CARDS,
  ZH_POPULAR_SEARCHES,
  ZH_TOP_COUPONS,
  ZH_TRENDING_DEALS,
} from "@/lib/zorino-home/content";
import type { HomepageSectionProducts } from "@/lib/data/homepage";
import type {
  FloatingProductCard,
  FooterStatItem,
  HeroStatItem,
  HomepageCategoryItem,
  TopCouponCard,
  TrendingDealCard,
} from "@/lib/types/entities";

const SECTION_LIMIT = 4;

function mapStaticDeal(deal: (typeof ZH_TRENDING_DEALS)[number]): TrendingDealCard {
  return {
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
  };
}

function fallbackSectionSlice(
  offset: number,
  prefix: string,
): TrendingDealCard[] {
  const base = ZH_TRENDING_DEALS.map(mapStaticDeal);
  const rotated = [...base.slice(offset), ...base.slice(0, offset)];
  return rotated.slice(0, SECTION_LIMIT).map((card) => ({
    ...card,
    id: `${prefix}-${card.id}`,
  }));
}

const ORBIT_SLOT_TO_POSITION: Record<string, string> = {
  top: "orbit-top",
  left: "orbit-upper-left",
  "upper-right": "orbit-upper-right",
  right: "orbit-lower-right",
};

const HERO_ORBIT_COMPOSITION = [
  "orbit-top",
  "orbit-upper-left",
  "orbit-upper-right",
  "orbit-lower-right",
] as const;

export function withFallbackCategories(
  categories: HomepageCategoryItem[]
): HomepageCategoryItem[] {
  // Always render the canonical 8 homepage shortcuts in fixed order.
  return ZH_CATEGORIES.map((category) => {
    const match = categories.find((item) => item.slug === category.slug);
    return {
      slug: category.slug,
      label: match?.label || category.label,
      active: Boolean(category.highlighted) || category.slug === "home",
      accent: category.accent ?? match?.accent ?? null,
    };
  });
}

export function withFallbackPopularSearches(searches: string[]): string[] {
  return searches.length > 0 ? searches : ZH_POPULAR_SEARCHES;
}

export function withFallbackFloatingProducts(
  products: FloatingProductCard[]
): FloatingProductCard[] {
  const compositionCards = products
    .filter((product) =>
      HERO_ORBIT_COMPOSITION.includes(
        product.position as (typeof HERO_ORBIT_COMPOSITION)[number],
      ),
    )
    .filter((product) => product.imageSrc && product.discount);

  if (compositionCards.length >= 4) {
    return HERO_ORBIT_COMPOSITION.map((position) => {
      const match = compositionCards.find((card) => card.position === position);
      return (
        match ?? {
          ...compositionCards[0],
          position,
        }
      );
    });
  }

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

  const badgeByIndex: Array<TrendingDealCard["badge"] | undefined> = [
    undefined,
    "hot",
    "bestseller",
    "popular",
    "hot",
    undefined,
    undefined,
    undefined,
  ];

  return ZH_TRENDING_DEALS.map((deal, index) => ({
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
    badge: badgeByIndex[index],
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

function hasSectionProducts(sections: HomepageSectionProducts): boolean {
  return Object.values(sections).some((items) => items.length > 0);
}

export function withFallbackSectionProducts(
  sections: HomepageSectionProducts,
): HomepageSectionProducts {
  if (hasSectionProducts(sections)) return sections;

  return {
    flash: fallbackSectionSlice(0, "flash"),
    priceDrops: fallbackSectionSlice(1, "drop"),
    newArrivals: fallbackSectionSlice(2, "new"),
    topRated: fallbackSectionSlice(3, "rated"),
    editorsPicks: fallbackSectionSlice(0, "pick"),
  };
}
