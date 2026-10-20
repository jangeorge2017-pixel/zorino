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

const cspValue = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://static.cloudflareinsights.com https://*.cloudflareinsights.com",
  "media-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

securityHeaders.push({ key: "Content-Security-Policy", value: cspValue });

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
  // TEMPORARY: type-checking during `next build` is skipped because Render's
  // free tier OOMs on it. Types are still enforced by `npm run typecheck`
  // locally and in CI (see .github/workflows/ci-cd.yml). Remove this once the
  // service is on a paid plan.
  // Note: `eslint.ignoreDuringBuilds` no longer exists in Next 16 — ESLint is
  // not part of `next build`, so nothing is needed there.
  typescript: {
    ignoreBuildErrors: true,
  },
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
