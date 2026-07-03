import type { Deal } from "@/lib/types/entities";

export type DealSectionId = "trending" | "flash" | "best" | "recent";

export type DealSection = {
  id: DealSectionId;
  deals: Deal[];
};

const SECTION_LIMIT = 4;

function daysLeft(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function reviewScore(deal: Deal): number {
  return deal.product?.reviewCount ?? 0;
}

function recentScore(deal: Deal): number {
  return new Date(deal.startsAt).getTime() + deal.sortOrder;
}

function topDeals(pool: Deal[], limit = SECTION_LIMIT): Deal[] {
  return pool.slice(0, limit);
}

export function buildDealSections(deals: Deal[]): DealSection[] {
  const active = deals.filter((deal) => deal.isActive);

  const trending = topDeals(
    [...active].sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return reviewScore(b) - reviewScore(a);
    }),
  );

  const flash = topDeals(
    [...active].sort(
      (a, b) => daysLeft(a.endsAt) - daysLeft(b.endsAt) || b.discount - a.discount,
    ),
  );

  const best = topDeals(
    [...active].sort((a, b) => b.discount - a.discount || a.price - b.price),
  );

  const recent = topDeals(
    [...active].sort((a, b) => recentScore(b) - recentScore(a)),
  );

  const sections: DealSection[] = [
    { id: "trending", deals: trending },
    { id: "flash", deals: flash },
    { id: "best", deals: best },
    { id: "recent", deals: recent },
  ];

  return sections.filter((section) => section.deals.length > 0);
}
