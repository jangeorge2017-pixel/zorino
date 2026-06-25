import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { PRODUCT_IMAGE_REMOTE_PATTERNS } from "./lib/images/product-image";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: PRODUCT_IMAGE_REMOTE_PATTERNS,
  },
};

export default withNextIntl(nextConfig);
