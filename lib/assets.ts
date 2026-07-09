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
  width: 235,
  height: 82,
} as const;

export const ZORINO_LOGO_VARIANTS = {
  "@1x": "/hero-z-logo.png",
  "@2x": "/logo/hero-z-logo@2x.png",
  "@3x": "/logo/hero-z-logo@3x.png",
  "@4x": "/logo/hero-z-logo@4x.png",
} as const;

export const ZORINO_LOGO_DISPLAY_HEIGHT = 54;

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

export const DEAL_PRODUCT_IMAGES = {
  iphone: "/products/deal-iphone.png",
  macbook: "/products/deal-macbook.png",
  ps5: "/products/deal-ps5.png",
  nike: "/products/deal-nike.png",
} as const;

export const STORE_LOGOS = {
  amazon: "/stores/amazon.png",
  bestBuy: "/stores/best-buy.png",
  walmart: "/stores/walmart.png",
  footLocker: "/stores/foot-locker.png",
  noon: "/stores/noon.png",
  aliExpress: "/stores/aliexpress.png",
  nike: "/stores/nike.png",
} as const;

export const MISSING_ASSETS = [] as const;
