import type { NextConfig } from "next";
import path from "node:path";
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

/**
 * Next.js blocks cross-origin requests to `/_next/*` in development.
 * Real Android phones load the LAN IP (e.g. http://192.168.8.4:3000) and send
 * `Origin: http://192.168.8.4:3000` on module/CORS fetches — those get 403 while
 * desktop localhost / DevTools emulation keep working. Production is unaffected.
 *
 * Allow private LAN hosts used for `npm run dev:lan` phone testing.
 * Override/extend with ALLOWED_DEV_ORIGINS=host1,host2
 */
const lanDevOrigins = [
  "192.168.8.4",
  "192.168.*.*",
  "10.*.*.*",
  "172.*.*.*",
  "127.0.0.1",
];
const envDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  allowedDevOrigins: [...lanDevOrigins, ...envDevOrigins],
  turbopack: {
    // Pin Turbopack root so dev resolves `next` from this app, not a nested lockfile/root.
    root: path.resolve(__dirname),
  },
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
