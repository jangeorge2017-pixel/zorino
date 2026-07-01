export type ZhHomeProductSection = {
  key: "flash" | "priceDrops" | "newArrivals" | "topRated" | "editorsPicks";
  targetId: string;
  icon: string;
  title: string;
  viewAllHref: string;
  viewAllLabel: string;
};

export const ZH_HOME_PRODUCT_SECTIONS: readonly ZhHomeProductSection[] = [
  {
    key: "flash",
    targetId: "zh-section-flash-deals",
    icon: "⚡",
    title: "Flash Deals",
    viewAllHref: "/deals",
    viewAllLabel: "View all deals",
  },
  {
    key: "priceDrops",
    targetId: "zh-section-price-drops",
    icon: "📉",
    title: "Price Drops",
    viewAllHref: "/deals",
    viewAllLabel: "View all deals",
  },
  {
    key: "newArrivals",
    targetId: "zh-section-new-arrivals",
    icon: "🆕",
    title: "New Arrivals",
    viewAllHref: "/products",
    viewAllLabel: "View all products",
  },
  {
    key: "topRated",
    targetId: "zh-section-top-rated",
    icon: "⭐",
    title: "Top Rated",
    viewAllHref: "/products",
    viewAllLabel: "View all products",
  },
  {
    key: "editorsPicks",
    targetId: "zh-section-editors-picks",
    icon: "❤️",
    title: "Editor's Picks",
    viewAllHref: "/products",
    viewAllLabel: "View all products",
  },
] as const;
