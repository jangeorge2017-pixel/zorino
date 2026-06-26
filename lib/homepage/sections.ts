import type { LucideIcon } from "lucide-react";
import {
  BadgePercent,
  Flame,
  Sparkles,
  Tag,
  TrendingUp,
  UserRound,
} from "lucide-react";

export type HomeSectionVariant =
  | "lowest-price"
  | "trending-products"
  | "recommended-products"
  | "recommended-for-you"
  | "trending-deals"
  | "top-coupons";

export type HomeSectionConfig = {
  variant: HomeSectionVariant;
  sectionId: string;
  badge: string;
  icon: LucideIcon;
  navTitle: string;
  navTitleMobile: string;
  navSubtitle: string;
};

export const HOME_SECTIONS: Record<HomeSectionVariant, HomeSectionConfig> = {
  "lowest-price": {
    variant: "lowest-price",
    sectionId: "section-lowest-prices",
    badge: "Best Value",
    icon: Tag,
    navTitle: "Lowest Price",
    navTitleMobile: "Lowest Price",
    navSubtitle: "Today’s cheapest picks",
  },
  "trending-products": {
    variant: "trending-products",
    sectionId: "section-trending-products",
    badge: "Hot Now",
    icon: Flame,
    navTitle: "Trending Products",
    navTitleMobile: "Trending",
    navSubtitle: "What shoppers love",
  },
  "recommended-products": {
    variant: "recommended-products",
    sectionId: "section-recommended-products",
    badge: "Editor's Pick",
    icon: Sparkles,
    navTitle: "Recommended Products",
    navTitleMobile: "Recommended",
    navSubtitle: "Top-rated across stores",
  },
  "recommended-for-you": {
    variant: "recommended-for-you",
    sectionId: "section-recommended-for-you",
    badge: "For You",
    icon: UserRound,
    navTitle: "Recommended For You",
    navTitleMobile: "For You",
    navSubtitle: "Personalized matches",
  },
  "trending-deals": {
    variant: "trending-deals",
    sectionId: "section-trending-deals",
    badge: "Live Deals",
    icon: TrendingUp,
    navTitle: "Trending Deals",
    navTitleMobile: "Deals",
    navSubtitle: "Dropping prices now",
  },
  "top-coupons": {
    variant: "top-coupons",
    sectionId: "section-top-coupons",
    badge: "Verified Codes",
    icon: BadgePercent,
    navTitle: "Top Coupons",
    navTitleMobile: "Coupons",
    navSubtitle: "Verified codes",
  },
};

export const HOME_QUICK_NAV_ITEMS = [
  HOME_SECTIONS["lowest-price"],
  HOME_SECTIONS["trending-products"],
  HOME_SECTIONS["recommended-products"],
  HOME_SECTIONS["recommended-for-you"],
  HOME_SECTIONS["trending-deals"],
  HOME_SECTIONS["top-coupons"],
] as const;
