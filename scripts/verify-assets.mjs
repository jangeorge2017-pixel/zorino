#!/usr/bin/env node
/** Verify referenced public assets exist on disk. */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const publicDir = join(root, "public");

const REQUIRED = [
  "/hero-background.png",
  "/hero-z-logo.png",
  "/hero-z-logo.svg",
  "/icons/card-1.png",
  "/icons/card-2.png",
  "/icons/card-3.png",
  "/icons/card-4.png",
  "/icons/flame.svg",
  "/icons/trustpilot-logo.svg",
  "/icons/feature-ai.svg",
  "/icons/feature-tracking.svg",
  "/icons/feature-coupons.svg",
  "/icons/feature-globe.svg",
  "/products/deal-iphone.png",
  "/products/deal-macbook.png",
  "/products/deal-ps5.png",
  "/products/deal-nike.png",
  "/stores/amazon.png",
  "/stores/best-buy.png",
  "/stores/walmart.png",
  "/stores/foot-locker.png",
  "/stores/noon.png",
  "/stores/aliexpress.png",
  "/stores/nike.png",
  "/stores/ebay.png",
  "/stores/cjdropshipping.png",
  "/stores/default.png",
  "/og-image.png",
];

const missing = REQUIRED.filter((p) => !existsSync(join(publicDir, p.replace(/^\//, ""))));

if (missing.length) {
  console.error("Missing assets:");
  missing.forEach((p) => console.error("  ", p));
  process.exit(1);
}

console.log(`All ${REQUIRED.length} required assets present.`);
