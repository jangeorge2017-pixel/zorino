/**
 * Offline unit checks for relevance-first interleaved search ranking.
 * Usage: npx tsx scripts/test-production-pipeline.mjs
 */
import {
  assembleProductionSearchResults,
  MAX_CONSECUTIVE_SAME_MARKETPLACE,
} from "../lib/search/production-pipeline.ts";
import { analyzeSearchListing } from "../lib/search/relevance.ts";

function raw(providerId, id, title, price = 100, extras = {}) {
  return {
    providerId,
    externalId: id,
    title,
    imageUrl: "https://example.com/i.jpg",
    price,
    originalPrice: price + 20,
    discount: 10,
    currency: "USD",
    storeName: providerId,
    category: "Phones",
    rating: 4.5,
    reviewCount: 10,
    inStock: true,
    productUrl: `https://example.com/${providerId}/${id}`,
    affiliateUrl: `https://example.com/${providerId}/${id}?aff=1`,
    ...extras,
  };
}

const fixtures = [
  raw("aliexpress", "a1", "Sticker Ring For Magsafe Wireless Charging For iPhone 15"),
  raw("aliexpress", "a2", "Cute Soft Case Cover For iPhone 15 Pro Max"),
  raw("ebay", "e1", "Apple iPhone 15 Pro 256GB Unlocked Smartphone Blue"),
  raw("ebay", "e2", "Apple iPhone 15 128GB GSM Unlocked Black"),
  raw("aliexpress", "a3", "Apple iPhone 15 256GB Dual SIM Unlocked 5G Smartphone"),
];

// Many equally relevant devices on both marketplaces — first page must interleave.
const colors = ["Black", "Blue", "Pink", "Green", "White", "Gold", "Silver", "Purple", "Red", "Teal"];
const storages = [64, 128, 256, 512, 1024];
const conditions = ["New", "Refurbished", "Open Box", "Grade A", "Unlocked"];
const manyDevices = [];
for (let i = 0; i < 20; i++) {
  const color = colors[i % colors.length];
  const storage = storages[i % storages.length];
  const condition = conditions[i % conditions.length];
  manyDevices.push(
    raw(
      "ebay",
      `e-phone-${i}`,
      `Apple iPhone 15 Pro Max ${storage}GB ${color} ${condition} GSM Unlocked A2849 #${i}`,
      700 + i * 3,
      { rating: 4.6, reviewCount: 50 + i },
    ),
  );
  manyDevices.push(
    raw(
      "aliexpress",
      `a-phone-${i}`,
      `Apple iPhone 15 ${storage}GB Dual SIM ${color} ${condition} 5G Global Version Lot${i}`,
      650 + i * 3,
      { rating: 4.7, reviewCount: 80 + i, salesCount: 200 + i },
    ),
  );
}

const mixed = assembleProductionSearchResults(fixtures, "iPhone 15", 10);
const top = mixed.slice(0, 5).map((r) => r.name);

console.log("Top results (small fixture):");
top.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

const interleaved = assembleProductionSearchResults(manyDevices, "iPhone 15", 30);
const first30 = interleaved.slice(0, 30);
const slugs = first30.map((r) => r.storeSlug);

console.log("\nFirst 30 marketplace sequence:");
console.log(slugs.join(" "));

const failures = [];

if (!/iphone\s*15/i.test(top[0] || "") || /case|sticker|cover|charger/i.test(top[0] || "")) {
  failures.push(`#1 should be a real iPhone device, got: ${top[0]}`);
}

const stickerIdx = mixed.findIndex((r) => /sticker/i.test(r.name));
const phoneIdx = mixed.findIndex((r) => /unlocked/i.test(r.name));
if (stickerIdx !== -1 && phoneIdx !== -1 && stickerIdx < phoneIdx) {
  failures.push("Accessory appeared before a real phone");
}

const stores = new Set(mixed.map((r) => r.storeSlug));
if (!stores.has("ebay") || !stores.has("aliexpress")) {
  failures.push(`Expected both marketplaces, got: ${[...stores].join(",")}`);
}

// Max consecutive same marketplace when both have comparable stock.
let maxStreak = 1;
let streak = 1;
for (let i = 1; i < slugs.length; i++) {
  if (slugs[i] === slugs[i - 1]) streak += 1;
  else streak = 1;
  maxStreak = Math.max(maxStreak, streak);
}
if (maxStreak > MAX_CONSECUTIVE_SAME_MARKETPLACE) {
  failures.push(
    `Max consecutive marketplace streak ${maxStreak} exceeds cap ${MAX_CONSECUTIVE_SAME_MARKETPLACE}`,
  );
}

const aeCount = slugs.filter((s) => s === "aliexpress").length;
const ebayCount = slugs.filter((s) => s === "ebay").length;
if (aeCount < 8 || ebayCount < 8) {
  failures.push(
    `First 30 should be naturally mixed (need ~8+ each), got AE=${aeCount} eBay=${ebayCount}`,
  );
}

// Affiliate URLs preserved
if (first30.some((r) => !r.affiliateUrl || !r.affiliateUrl.includes("aff=1"))) {
  failures.push("Affiliate URLs were not preserved");
}

const sticker = analyzeSearchListing(
  "Sticker Ring For Magsafe Wireless Charging For iPhone 15",
  "iPhone 15",
);
if (sticker.isDevice || sticker.tier !== "accessory") {
  failures.push(`Sticker should be accessory, got tier=${sticker.tier} isDevice=${sticker.isDevice}`);
}

const phone = analyzeSearchListing(
  "Apple iPhone 15 Pro 256GB Unlocked Smartphone Blue",
  "iPhone 15",
);
if (!phone.isDevice) {
  failures.push("Real iPhone should be isDevice=true");
}

if (failures.length) {
  console.error("\nFAILED:");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log(`\nMix OK: AE=${aeCount} eBay=${ebayCount}, max streak=${maxStreak}`);
console.log("All production-pipeline checks passed.");
