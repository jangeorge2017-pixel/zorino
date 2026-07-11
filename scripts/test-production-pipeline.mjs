/**
 * Offline unit checks for device-first fair mix + relevance.
 * Usage: node --experimental-strip-types scripts/test-production-pipeline.mjs
 *    or: npx tsx scripts/test-production-pipeline.mjs
 */
import { assembleProductionSearchResults } from "../lib/search/production-pipeline.ts";
import { analyzeSearchListing } from "../lib/search/relevance.ts";

function raw(providerId, id, title, price = 100) {
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
  };
}

const fixtures = [
  raw("aliexpress", "a1", "Sticker Ring For Magsafe Wireless Charging For iPhone 15"),
  raw("aliexpress", "a2", "Cute Soft Case Cover For iPhone 15 Pro Max"),
  raw("ebay", "e1", "Apple iPhone 15 Pro 256GB Unlocked Smartphone Blue"),
  raw("ebay", "e2", "Apple iPhone 15 128GB GSM Unlocked Black"),
  raw("aliexpress", "a3", "Apple iPhone 15 256GB Dual SIM Unlocked 5G Smartphone"),
];

const mixed = assembleProductionSearchResults(fixtures, "iPhone 15", 10);
const top = mixed.slice(0, 5).map((r) => r.name);

console.log("Top results:");
top.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

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

const paste = analyzeSearchListing(
  "12.4W/mK High Thermal Conductivity Paste Grease for CPU GPU Laptop PS5",
  "PS5",
);
if (paste.tier !== "repair" && paste.isDevice) {
  failures.push(`Thermal paste should not be a device, got tier=${paste.tier}`);
}

if (failures.length) {
  console.error("\nFAILED:");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log("\nAll production-pipeline checks passed.");
