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
  // Use empty string to indicate no real merchant expiry data is available.
  // Fabricated urgency ("Ends in 7 days") is intentionally removed — only
  // real merchant expiry data should drive urgency labels.
  const endsAt = options.endsInDays
    ? new Date(Date.now() + options.endsInDays * 86_400_000).toISOString()
    : "";
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
      affiliateUrl: card.affiliateUrl ?? null,
    },
    affiliateUrl: card.affiliateUrl ?? null,
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

export function dealEndsInDaysRemaining(endsAt: string): number {
  const diff = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function formatDealEndsInLabel(
  endsAt: string,
  labels?: {
    today: string;
    oneDay: string;
    days: (count: number) => string;
  },
): string {
  if (!endsAt) return "";
  const days = dealEndsInDaysRemaining(endsAt);
  if (labels) {
    if (days === 0) return labels.today;
    if (days === 1) return labels.oneDay;
    return labels.days(days);
  }
  if (days === 0) return "Ends today";
  if (days === 1) return "Ends in 1 day";
  return `Ends in ${days} days`;
}

export function trendingDealEndsInDays(card: TrendingDealCard): number {
  return dealEndsInDaysRemaining(trendingDealToDeal(card).endsAt);
}

export function trendingDealEndsInLabel(
  card: TrendingDealCard,
  labels?: {
    today: string;
    oneDay: string;
    days: (count: number) => string;
  },
): string {
  const deal = trendingDealToDeal(card);
  if (!deal.endsAt) return "";
  return formatDealEndsInLabel(deal.endsAt, labels);
}
