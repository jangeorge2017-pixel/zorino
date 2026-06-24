#!/usr/bin/env node
/** HTTP check for required assets against running dev server. */
const base = process.env.ASSET_BASE_URL || "http://127.0.0.1:3000";

const paths = [
  "/",
  "/icons/flame.svg",
  "/icons/trustpilot-logo.svg",
  "/icons/feature-ai.svg",
  "/products/deal-iphone.png",
  "/products/deal-macbook.png",
  "/products/deal-ps5.png",
  "/products/deal-nike.png",
  "/stores/amazon.png",
  "/stores/walmart.png",
  "/stores/nike.png",
  "/hero-background.png",
  "/hero-z-logo.png",
];

let failed = 0;

for (const path of paths) {
  try {
    const res = await fetch(base + path, { redirect: "follow" });
    const ok = res.status === 200;
    console.log(`${ok ? "OK" : "FAIL"} ${res.status} ${path}`);
    if (!ok) failed++;
  } catch (err) {
    console.log(`FAIL --- ${path} (${err.message})`);
    failed++;
  }
}

process.exit(failed ? 1 : 0);
