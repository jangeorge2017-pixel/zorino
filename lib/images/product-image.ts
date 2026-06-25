/** Local placeholder when an imported product image fails to load. */
export const PRODUCT_IMAGE_PLACEHOLDER = "/products/placeholder.svg";

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
  // eBay
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
  // Avatars / misc already used in app
  { protocol: "https" as const, hostname: "i.pravatar.cc", pathname: "/**" },
];

/** Normalize product image URL — empty values use the local placeholder. */
export function normalizeProductImageUrl(url?: string | null): string {
  const trimmed = url?.trim();
  if (!trimmed) return PRODUCT_IMAGE_PLACEHOLDER;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return trimmed;
  } catch {
    // invalid URL
  }
  return PRODUCT_IMAGE_PLACEHOLDER;
}

/** True when URL is a same-origin or configured remote asset safe for next/image. */
export function isLocalProductImage(url: string): boolean {
  return url.startsWith("/");
}
