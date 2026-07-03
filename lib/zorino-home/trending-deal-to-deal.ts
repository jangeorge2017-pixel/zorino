import type { Deal, TrendingDealCard } from "@/lib/types/entities";

type TrendingDealToDealOptions = {
  featured?: boolean;
  endsInDays?: number;
};

export function trendingDealToDeal(
  card: TrendingDealCard,
  options: TrendingDealToDealOptions = {},
): Deal {
  const id = String(card.id);
  const productId = card.productId ?? id;
  const endsInDays =
    options.endsInDays ??
    (card.updatedMins <= 60 ? 2 : card.updatedMins <= 360 ? 5 : 9);
  const endsAt = new Date(Date.now() + endsInDays * 86_400_000).toISOString();
  const startsAt = new Date(Date.now() - card.updatedMins * 60_000).toISOString();

  return {
    id,
    productId,
    title: card.name,
    discount: card.discount,
    discountType: "percentage",
    price: card.price,
    originalPrice: card.originalPrice,
    currency: "USD",
    isFeatured:
      options.featured ??
      (card.badge === "hot" ||
        card.badge === "bestseller" ||
        card.discount >= 20),
    isActive: true,
    sortOrder: 0,
    startsAt,
    endsAt,
    product: {
      id: productId,
      name: card.name,
      slug: productId,
      imageUrl: card.imageSrc,
      emoji: card.emoji,
      rating: card.rating,
      reviewCount: card.reviews,
      currency: "USD",
      inStock: true,
      tags: [],
      isActive: true,
    },
    store: {
      id: card.store.toLowerCase().replace(/\s+/g, "-"),
      name: card.store,
      slug: card.store.toLowerCase().replace(/\s+/g, "-"),
      logoUrl: card.storeLogoSrc,
      logoInitial: card.storeInitial,
      website: "",
      integrationType: "partner",
      commissionRate: 0,
      supportedRegions: ["US"],
      supportedCurrencies: ["USD"],
      isActive: true,
    },
  };
}

export function formatDealEndsInLabel(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diff / 86_400_000));
  if (days === 0) return "Ends today";
  if (days === 1) return "Ends in 1 day";
  return `Ends in ${days} days`;
}

export function trendingDealEndsInLabel(card: TrendingDealCard): string {
  return formatDealEndsInLabel(trendingDealToDeal(card).endsAt);
}
