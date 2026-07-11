/**
 * Offline checks for marketplace-agnostic balancing + device-first ranking.
 * Usage: npx tsx scripts/test-production-pipeline.mjs
 */
import {
  assembleProductionSearchResults,
  MAX_CONSECUTIVE_SAME_MARKETPLACE,
} from "../lib/search/production-pipeline.ts";
import { balanceFlatMarketplaceList } from "../lib/search/marketplace-balance.ts";
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
  // Third marketplace — proves balancer adapts without hardcoded shares.
  manyDevices.push(
    raw(
      "amazon",
      `amz-phone-${i}`,
      `Apple iPhone 15 ${storage}GB ${color} ${condition} Amazon Renewed Unit ${i}`,
      680 + i * 3,
      { rating: 4.5, reviewCount: 40 + i },
    ),
  );
}

const interleaved = assembleProductionSearchResults(manyDevices, "iPhone 15", 30);
const slugs = interleaved.slice(0, 30).map((r) => r.storeSlug);

console.log("First 30 marketplace sequence:");
console.log(slugs.join(" "));

const failures = [];

let maxStreak = 1;
let streak = 1;
for (let i = 1; i < slugs.length; i++) {
  if (slugs[i] === slugs[i - 1]) streak += 1;
  else streak = 1;
  maxStreak = Math.max(maxStreak, streak);
}
if (maxStreak > MAX_CONSECUTIVE_SAME_MARKETPLACE) {
  failures.push(`Max streak ${maxStreak} exceeds ${MAX_CONSECUTIVE_SAME_MARKETPLACE}`);
}

const counts = {};
for (const s of slugs) counts[s] = (counts[s] || 0) + 1;
const providers = Object.keys(counts);
if (providers.length < 3) {
  failures.push(`Expected 3 marketplaces in first 30, got ${providers.join(",")}`);
}
for (const [id, n] of Object.entries(counts)) {
  if (n < 6) failures.push(`${id} under-represented in first 30: ${n}`);
}

if (interleaved.some((r) => !r.affiliateUrl?.includes("aff=1"))) {
  failures.push("Affiliate URLs not preserved");
}

// Flat homepage balancer adapts to N marketplaces.
const flat = balanceFlatMarketplaceList(
  [
    { providerId: "ebay", score: 1 },
    { providerId: "ebay", score: 2 },
    { providerId: "ebay", score: 3 },
    { providerId: "temu", score: 1 },
    { providerId: "temu", score: 2 },
    { providerId: "walmart", score: 1 },
  ],
  (row) => row.providerId,
  6,
  (a, b) => b.score - a.score,
);
const flatIds = flat.map((r) => r.providerId);
if (!flatIds.includes("temu") || !flatIds.includes("walmart") || !flatIds.includes("ebay")) {
  failures.push(`Flat balancer missed a marketplace: ${flatIds.join(",")}`);
}

const phone = analyzeSearchListing(
  "Apple iPhone 15 Pro 256GB Unlocked Smartphone Blue",
  "iPhone 15",
);
if (!phone.isDevice) failures.push("Real iPhone should be isDevice=true");

if (failures.length) {
  console.error("\nFAILED:");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
}

console.log(`Mix OK: ${JSON.stringify(counts)}, max streak=${maxStreak}`);
console.log(`Flat balancer: ${flatIds.join(" ")}`);
console.log("All marketplace-balance checks passed.");
