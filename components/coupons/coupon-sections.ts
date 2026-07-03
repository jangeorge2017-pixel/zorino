import type { TopCouponCard } from "@/lib/types/entities";

export type CouponSectionId = "verified" | "popular" | "top_stores" | "fresh";

export type CouponSection = {
  id: CouponSectionId;
  coupons: TopCouponCard[];
};

const SECTION_LIMIT = 4;

function topCoupons(pool: TopCouponCard[], limit = SECTION_LIMIT): TopCouponCard[] {
  return pool.slice(0, limit);
}

export function buildCouponSections(coupons: TopCouponCard[]): CouponSection[] {
  const verified = topCoupons(
    [...coupons].filter((coupon) => coupon.verified).sort((a, b) => b.usedTimes - a.usedTimes),
  );

  const popular = topCoupons([...coupons].sort((a, b) => b.usedTimes - a.usedTimes));

  const topStores = topCoupons(
    [...coupons]
      .sort((a, b) => b.usedTimes - a.usedTimes)
      .filter(
        (coupon, index, list) =>
          list.findIndex((item) => item.store === coupon.store) === index,
      ),
  );

  const fresh = topCoupons(
    [...coupons].sort((a, b) => String(b.id).localeCompare(String(a.id))),
  );

  const sections: CouponSection[] = [
    { id: "verified", coupons: verified },
    { id: "popular", coupons: popular },
    { id: "top_stores", coupons: topStores },
    { id: "fresh", coupons: fresh },
  ];

  return sections.filter((section) => section.coupons.length > 0);
}
