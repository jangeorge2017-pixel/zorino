/**
 * Official UI assets
 *
 * Hero: public/hero-background.png only (CSS on .hero-zone — includes Z + platform scene)
 * Navbar: public/hero-z-logo.png via ZorinoLogo (separate from hero visual)
 *
 * Regenerate SVG/variants: npm run generate:logo
 * Process logo transparency: npm run process:hero-z-logo
 */
export const ZORINO_LOGO_SOURCE = "/hero-z-logo.png";
export const ZORINO_LOGO_SVG = "/hero-z-logo.svg";

export const ZORINO_LOGO_INTRINSIC = {
  width: 230,
  height: 82,
} as const;

export const ZORINO_LOGO_VARIANTS = {
  "@1x": "/hero-z-logo.png",
  "@2x": "/logo/hero-z-logo@2x.png",
  "@3x": "/logo/hero-z-logo@3x.png",
  "@4x": "/logo/hero-z-logo@4x.png",
} as const;

export const ZORINO_LOGO_DISPLAY_HEIGHT = 40;

/** @deprecated Use ZORINO_LOGO_SVG */
export const ZORINO_LOGO = ZORINO_LOGO_SVG;

/** @deprecated Use ZORINO_LOGO_SOURCE */
export const NAVBAR_LOGO = ZORINO_LOGO_SVG;

export const FLAME_ICON = "/icons/flame.svg";
export const TRUSTPILOT_LOGO = "/icons/trustpilot-logo.svg";
export const FEATURE_AI_ICON = "/icons/feature-ai.svg";
export const FEATURE_TRACKING_ICON = "/icons/feature-tracking.svg";
export const FEATURE_COUPONS_ICON = "/icons/feature-coupons.svg";
export const FEATURE_GLOBE_ICON = "/icons/feature-globe.svg";

export const FLOATING_CARD_IMAGES = {
  headphones: "/icons/card-1.png",
  laptop: "/icons/card-2.png",
  phone: "/icons/card-3.png",
  controller: "/icons/card-4.png",
} as const;

/** @deprecated Use FLOATING_CARD_IMAGES — full cards copied from reference */
export const FLOATING_PRODUCT_IMAGES = FLOATING_CARD_IMAGES;

/** High-res Unsplash product photos — local deal-*.png crops were near-black and unreadable. */
export const DEAL_PRODUCT_IMAGES = {
  iphone:
    "https://images.unsplash.com/photo-1718223483120-8131e57f948b?w=1200&auto=format&fit=crop&q=80",
  macbook:
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200&auto=format&fit=crop&q=80",
  ps5: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1200&auto=format&fit=crop&q=80",
  nike: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&auto=format&fit=crop&q=80",
  headphones:
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop&q=80",
  controller:
    "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=1200&auto=format&fit=crop&q=80",
  laptop:
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200&auto=format&fit=crop&q=80",
  phone:
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&auto=format&fit=crop&q=80",
} as const;

export const STORE_LOGOS = {
  amazon: "/stores/amazon.svg",
  bestBuy: "/stores/best-buy.svg",
  walmart: "/stores/walmart.svg",
  footLocker: "/stores/foot-locker.svg",
  noon: "/stores/noon.svg",
  aliExpress: "/stores/aliexpress.svg",
  nike: "/stores/nike.svg",
} as const;

export const MISSING_ASSETS = [] as const;
