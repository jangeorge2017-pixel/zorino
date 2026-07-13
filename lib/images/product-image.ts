/** Local placeholder when an imported product image fails to load. */
export const PRODUCT_IMAGE_PLACEHOLDER = "/products/placeholder.svg";

const LEGACY_BROKEN_IMAGE_URLS: Record<string, string> = {
  "https://images.unsplash.com/photo-1695048133142-1c204c703e24?w=1200&auto=format&fit=crop&q=80":
    "https://images.unsplash.com/photo-1718223483120-8131e57f948b?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1606813907293-d86efa9b94ea?w=1200&auto=format&fit=crop&q=80":
    "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1592840496694-26d19506d992?w=1200&auto=format&fit=crop&q=80":
    "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=1200&auto=format&fit=crop&q=80",
};

/** Remote image host patterns allowed for next/image (import pipeline + CDNs). */
export const PRODUCT_IMAGE_REMOTE_PATTERNS = [
  // Unsplash (dev/mock catalog)
  { protocol: "https" as const, hostname: "images.unsplash.com", pathname: "/**" },
  // Supabase storage
  { protocol: "https" as const, hostname: "**.supabase.co", pathname: "/**" },
  // AliExpress / Alibaba CDN
  { protocol: "https" as const, hostname: "**.alicdn.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.aliexpress-media.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.aliexpress.com", pathname: "/**" },
  // eBay (explicit + wildcard so i.ebayimg.com always matches)
  { protocol: "https" as const, hostname: "i.ebayimg.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.ebayimg.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.ebaystatic.com", pathname: "/**" },
  // CJdropshipping
  { protocol: "https" as const, hostname: "**.cjdropshipping.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "cjdropshipping.com", pathname: "/**" },
  // Common import/CDN hosts
  { protocol: "https" as const, hostname: "**.amazonaws.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.cloudfront.net", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.shopify.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.shopifycdn.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.walmartimages.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.media-amazon.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.ssl-images-amazon.com", pathname: "/**" },
  // Temu
  { protocol: "https" as const, hostname: "**.temu.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.kwcdn.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "**.temuapi.com", pathname: "/**" },
  // Amazon (direct product images)
  { protocol: "https" as const, hostname: "m.media-amazon.com", pathname: "/**" },
  { protocol: "https" as const, hostname: "images-na.ssl-images-amazon.com", pathname: "/**" },
  // Avatars / misc already used in app
  { protocol: "https" as const, hostname: "i.pravatar.cc", pathname: "/**" },
];

/** Normalize product image URL — empty/invalid/sandbox values use the local placeholder. */
export function normalizeProductImageUrl(url?: string | null): string {
  const trimmed = url?.trim();
  if (!trimmed) return PRODUCT_IMAGE_PLACEHOLDER;
  const legacyReplacement = LEGACY_BROKEN_IMAGE_URLS[trimmed];
  if (legacyReplacement) return legacyReplacement;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    // next/image in production only allows https remotes from the allowlist.
    if (parsed.protocol !== "https:") return PRODUCT_IMAGE_PLACEHOLDER;
    const host = parsed.hostname.toLowerCase();
    // Only rewrite when the host itself is unusable as an <img> CDN —
    // production Browse still serves photos from i.ebayimg.com.
    if (host.includes("ebayimg.sandbox") || host === "api.sandbox.ebay.com") {
      return PRODUCT_IMAGE_PLACEHOLDER;
    }
    return trimmed;
  } catch {
    // invalid URL
  }
  return PRODUCT_IMAGE_PLACEHOLDER;
}

/** True when URL is a same-origin or configured remote asset safe for next/image. */
export function isLocalProductImage(url: string): boolean {
  return url.startsWith("/");
}
