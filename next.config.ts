import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { PRODUCT_IMAGE_REMOTE_PATTERNS } from "./lib/images/product-image";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
];

const isProduction = process.env.NODE_ENV === "production";

// Sandbox marketplace image hosts (e.g. eBay Sandbox) are only encountered when
// running locally against sandbox credentials. They are never served in
// production, so we only whitelist them outside of production builds.
const devOnlyImagePatterns = isProduction
  ? []
  : [
      { protocol: "http" as const, hostname: "**.ebay.com", pathname: "/**" },
      { protocol: "https" as const, hostname: "**.ebay.com", pathname: "/**" },
    ];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [...PRODUCT_IMAGE_REMOTE_PATTERNS, ...devOnlyImagePatterns],
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85, 92],
  },
  poweredByHeader: false,
  compress: true,
  async headers() {
    const headers = [...securityHeaders];
    if (isProduction) {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }
    return [
      {
        source: "/(.*)",
        headers,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
