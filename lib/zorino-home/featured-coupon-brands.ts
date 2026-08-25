import { STORE_LOGOS } from "@/lib/assets";
import type { TopCouponCard } from "@/lib/types/entities";

export type FeaturedCouponBrand = {
  id: string;
  slug: string;
  name: string;
  logoSrc: string;
  logoInitial: string;
  offer: string;
  code: string;
  verified: boolean;
  brandColor: string;
  brandGlow: string;
  textTone: "light" | "dark";
};

export const ZH_FEATURED_COUPON_BRANDS: readonly FeaturedCouponBrand[] = [
  {
    id: "amazon",
    slug: "amazon",
    name: "Amazon",
    logoSrc: STORE_LOGOS.amazon,
    logoInitial: "a",
    offer: "10% OFF Sitewide",
    code: "SAVE10",
    verified: true,
    brandColor: "#ff9900",
    brandGlow: "rgba(255, 153, 0, 0.35)",
    textTone: "dark",
  },
  {
    id: "aliexpress",
    slug: "aliexpress",
    name: "AliExpress",
    logoSrc: STORE_LOGOS.aliExpress,
    logoInitial: "AE",
    offer: "20% OFF First Order",
    code: "AE20",
    verified: true,
    brandColor: "#e62e04",
    brandGlow: "rgba(230, 46, 4, 0.35)",
    textTone: "light",
  },
  {
    id: "noon",
    slug: "noon",
    name: "Noon",
    logoSrc: STORE_LOGOS.noon,
    logoInitial: "N",
    offer: "15% OFF Electronics",
    code: "NOON15",
    verified: true,
    brandColor: "#feee00",
    brandGlow: "rgba(254, 238, 0, 0.28)",
    textTone: "dark",
  },
  {
    id: "ebay",
    slug: "ebay",
    name: "eBay",
    logoSrc: STORE_LOGOS.ebay,
    logoInitial: "e",
    offer: "12% OFF Selected Items",
    code: "EBAY12",
    verified: true,
    brandColor: "#e53238",
    brandGlow: "rgba(229, 50, 56, 0.35)",
    textTone: "light",
  },
  {
    id: "temu",
    slug: "temu",
    name: "Temu",
    logoSrc: STORE_LOGOS.temu,
    logoInitial: "T",
    offer: "30% OFF New Users",
    code: "TEMU30",
    verified: true,
    brandColor: "#fb7701",
    brandGlow: "rgba(251, 119, 1, 0.35)",
    textTone: "light",
  },
  {
    id: "shein",
    slug: "shein",
    name: "SHEIN",
    logoSrc: STORE_LOGOS.shein,
    logoInitial: "S",
    offer: "25% OFF Fashion",
    code: "SHEIN25",
    verified: true,
    brandColor: "#000000",
    brandGlow: "rgba(236, 72, 153, 0.35)",
    textTone: "light",
  },
  {
    id: "nike",
    slug: "nike",
    name: "Nike",
    logoSrc: STORE_LOGOS.nike,
    logoInitial: "N",
    offer: "25% OFF Sportswear",
    code: "NIKE25",
    verified: true,
    brandColor: "#111111",
    brandGlow: "rgba(255, 255, 255, 0.12)",
    textTone: "light",
  },
  {
    id: "adidas",
    slug: "adidas",
    name: "Adidas",
    logoSrc: STORE_LOGOS.adidas,
    logoInitial: "A",
    offer: "20% OFF Outlet",
    code: "ADI20",
    verified: true,
    brandColor: "#000000",
    brandGlow: "rgba(0, 119, 200, 0.35)",
    textTone: "light",
  },
  {
    id: "walmart",
    slug: "walmart",
    name: "Walmart",
    logoSrc: STORE_LOGOS.walmart,
    logoInitial: "W",
    offer: "8% OFF Groceries",
    code: "WMT8",
    verified: true,
    brandColor: "#0071ce",
    brandGlow: "rgba(0, 113, 206, 0.35)",
    textTone: "light",
  },
  {
    id: "cjdropshipping",
    slug: "cjdropshipping",
    name: "CJdropshipping",
    logoSrc: STORE_LOGOS.cjDropshipping,
    logoInitial: "CJ",
    offer: "15% OFF First Order",
    code: "CJ15",
    verified: true,
    brandColor: "#6c5ce7",
    brandGlow: "rgba(108, 92, 231, 0.35)",
    textTone: "light",
  },
] as const;

/**
 * Visual styling only (brand colors/glows keyed by store slug) — reused for
 * live DB coupons so cards keep their per-brand look. Offers/codes always come
 * from the database, never from this list.
 */
const BRAND_VISUAL_CONFIG: ReadonlyMap<
  string,
  Pick<FeaturedCouponBrand, "brandColor" | "brandGlow" | "textTone">
> = new Map(
  ZH_FEATURED_COUPON_BRANDS.map((brand) => [
    brand.slug,
    {
      brandColor: brand.brandColor,
      brandGlow: brand.brandGlow,
      textTone: brand.textTone,
    },
  ]),
);

export function couponToFeaturedBrand(
  coupon: TopCouponCard,
): FeaturedCouponBrand {
  const slug =
    coupon.storeSlug ??
    coupon.store.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const visuals = BRAND_VISUAL_CONFIG.get(slug);
  return {
    id: String(coupon.id),
    slug,
    name: coupon.store,
    logoSrc: coupon.storeLogoSrc,
    logoInitial: coupon.storeInitial,
    offer: coupon.offer,
    code: coupon.code,
    verified: coupon.verified,
    brandColor: visuals?.brandColor ?? "#7c3aed",
    brandGlow: visuals?.brandGlow ?? "rgba(124, 58, 237, 0.35)",
    textTone: visuals?.textTone ?? "light",
  };
}
