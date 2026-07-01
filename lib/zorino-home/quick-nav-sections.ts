export type ZorinoQuickNavItem = {
  id: string;
  emoji: string;
  label: string;
  /** DOM id to scroll to and observe for active state */
  targetId: string;
  /** External route — scroll is skipped */
  href?: string;
};

export const ZORINO_QUICK_NAV_ITEMS: readonly ZorinoQuickNavItem[] = [
  {
    id: "trending-deals",
    emoji: "🔥",
    label: "Trending Deals",
    targetId: "zh-section-trending-deals",
  },
  {
    id: "coupons",
    emoji: "🎟️",
    label: "Coupons",
    targetId: "zh-section-coupons",
  },
  {
    id: "flash-deals",
    emoji: "⚡",
    label: "Flash Deals",
    targetId: "zh-section-trending-deals",
  },
  {
    id: "price-drops",
    emoji: "📉",
    label: "Price Drops",
    targetId: "zh-section-trending-deals",
  },
  {
    id: "new-arrivals",
    emoji: "🆕",
    label: "New Arrivals",
    targetId: "zh-section-trending-deals",
  },
  {
    id: "top-rated",
    emoji: "⭐",
    label: "Top Rated",
    targetId: "zh-section-features",
  },
  {
    id: "editors-picks",
    emoji: "❤️",
    label: "Editor's Picks",
    targetId: "zh-section-features",
  },
  {
    id: "stores",
    emoji: "🏪",
    label: "Stores",
    targetId: "zh-section-stores",
  },
  {
    id: "categories",
    emoji: "📱",
    label: "Categories",
    targetId: "zh-section-categories",
  },
  {
    id: "blog",
    emoji: "📰",
    label: "Blog",
    targetId: "zh-section-blog",
    href: "/blog",
  },
] as const;

/** Unique section roots observed for scroll-spy */
export const ZORINO_QUICK_NAV_TARGETS = [
  "zh-section-trending-deals",
  "zh-section-coupons",
  "zh-section-features",
  "zh-section-stores",
  "zh-section-categories",
] as const;

export const ZORINO_QUICK_NAV_STICKY_TOP = 72;
export const ZORINO_QUICK_NAV_SCROLL_PADDING = 16;
