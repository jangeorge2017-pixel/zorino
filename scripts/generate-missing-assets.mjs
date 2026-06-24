#!/usr/bin/env node
/**
 * Create missing public assets (placeholders + copies from comparison/).
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(process.cwd(), "public");

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeSvg(relativePath, svg) {
  const full = join(root, relativePath);
  if (existsSync(full)) return false;
  ensureDir(full);
  writeFileSync(full, svg.trim() + "\n", "utf8");
  return true;
}

function copyAsset(fromRelative, toRelative) {
  const from = join(root, fromRelative);
  const to = join(root, toRelative);
  if (!existsSync(from)) {
    console.warn(`  skip copy (source missing): ${fromRelative}`);
    return false;
  }
  if (existsSync(to)) return false;
  ensureDir(to);
  copyFileSync(from, to);
  return true;
}

function svgIcon(label, emoji, color = "#8b5cf6") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" role="img" aria-label="${label}">
  <rect width="48" height="48" rx="12" fill="${color}" fill-opacity="0.12"/>
  <text x="24" y="30" text-anchor="middle" font-size="20">${emoji}</text>
</svg>`;
}

function svgStoreLogo(name, bg, fg = "#ffffff") {
  const initial = name.slice(0, 2).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72" role="img" aria-label="${name}">
  <rect width="72" height="72" rx="16" fill="${bg}"/>
  <text x="36" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="${fg}">${initial}</text>
</svg>`;
}

const svgAssets = [
  ["icons/flame.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 2C9 7 6 8 6 12a6 6 0 1 0 12 0c0-2-1-3.5-3-5.5C13 9 12 6 12 2Z" fill="#f97316"/>
  <path d="M12 22c3-2 5-4 5-7a5 5 0 1 0-10 0c0 3 2 5 5 7Z" fill="#fb923c" opacity=".85"/>
</svg>`],
  ["icons/trustpilot-logo.svg", `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="28" viewBox="0 0 120 28" role="img" aria-label="Trustpilot">
  <rect width="120" height="28" rx="6" fill="#00b67a"/>
  <text x="60" y="19" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#fff">Trustpilot</text>
</svg>`],
  ["icons/feature-ai.svg", svgIcon("AI Recommendations", "🤖", "#7c3aed")],
  ["icons/feature-tracking.svg", svgIcon("Price Tracking", "📈", "#6366f1")],
  ["icons/feature-coupons.svg", svgIcon("Verified Coupons", "🏷", "#16a34a")],
  ["icons/feature-globe.svg", svgIcon("Global Coverage", "🌍", "#2563eb")],
];

const productCopies = [
  ["comparison/product-phone-trim.png", "products/deal-iphone.png"],
  ["comparison/product-laptop-trim.png", "products/deal-macbook.png"],
  ["comparison/prod-controller.png", "products/deal-ps5.png"],
  ["comparison/prod-headphones.png", "products/deal-nike.png"],
];

const pngFallbackCopies = [
  ["icons/card-1.png", "products/deal-iphone.png"],
  ["icons/card-2.png", "products/deal-macbook.png"],
  ["icons/card-4.png", "products/deal-ps5.png"],
  ["icons/card-3.png", "products/deal-nike.png"],
];

const storeCopies = [
  ["icons/card-1.png", "stores/amazon.png"],
  ["icons/card-2.png", "stores/best-buy.png"],
  ["icons/card-3.png", "stores/walmart.png"],
  ["icons/card-4.png", "stores/foot-locker.png"],
  ["icons/card-1.png", "stores/noon.png"],
  ["icons/card-2.png", "stores/aliexpress.png"],
  ["icons/card-3.png", "stores/nike.png"],
  ["icons/card-4.png", "stores/default.png"],
];

const storeSvgs = [
  ["stores/amazon.svg", svgStoreLogo("Amazon", "#ff9900", "#111")],
  ["stores/best-buy.svg", svgStoreLogo("Best Buy", "#0046be")],
  ["stores/walmart.svg", svgStoreLogo("Walmart", "#0071dc")],
  ["stores/foot-locker.svg", svgStoreLogo("Foot Locker", "#d71920")],
  ["stores/noon.svg", svgStoreLogo("Noon", "#feee00", "#111")],
  ["stores/aliexpress.svg", svgStoreLogo("AliExpress", "#e62e04")],
  ["stores/nike.svg", svgStoreLogo("Nike", "#111111")],
  ["stores/default.svg", svgStoreLogo("Store", "#64748b")],
];

const miscCopies = [
  ["hero-background.png", "og-image.png"],
];

let created = 0;

console.log("Generating missing assets…\n");

for (const [rel, svg] of svgAssets) {
  if (writeSvg(rel, svg)) {
    console.log(`✓ ${rel}`);
    created++;
  }
}

for (const [from, to] of productCopies) {
  if (copyAsset(from, to)) {
    console.log(`✓ ${to} (from ${from})`);
    created++;
  } else if (!existsSync(join(root, to))) {
    const fb = pngFallbackCopies.find(([, t]) => t === to);
    if (fb && copyAsset(fb[0], to)) {
      console.log(`✓ ${to} (fallback ${fb[0]})`);
      created++;
    }
  }
}

for (const [from, to] of storeCopies) {
  if (copyAsset(from, to)) {
    console.log(`✓ ${to}`);
    created++;
  }
}

for (const [rel, svg] of storeSvgs) {
  if (writeSvg(rel, svg)) {
    console.log(`✓ ${rel}`);
    created++;
  }
}

for (const [from, to] of miscCopies) {
  if (copyAsset(from, to)) {
    console.log(`✓ ${to}`);
    created++;
  }
}

console.log(`\nDone. ${created} asset(s) created.`);
