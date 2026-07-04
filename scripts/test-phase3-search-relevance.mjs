/**
 * Phase 3 search quality verification (offline fixtures + optional live API).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Inline mirror of lib/search/relevance.ts for node without tsx
const ACCESSORY_TERMS = [
  "screen protector", "tempered glass", "phone case", "case", "cover", "charger", "cable",
  "protector", "holder", "mount", "keyboard", "replacement", "microphone",
];
const REPAIR_AND_PARTS_TERMS = [
  "screen separator", "lcd separator", "repair tool", "spudger", "flex cable",
  "digitizer", "display assembly", "repair kit", "parts only",
];
const OFFICIAL_DEVICE_BRANDS = [
  "apple", "samsung", "xiaomi", "google", "pixel", "oneplus", "sony", "playstation",
];

function queryTokens(query) {
  return query.toLowerCase().replace(/[^a-z0-9\s.+-]/g, " ").split(/\s+/).filter((t) => t.length >= 2);
}

function queryWantsAccessory(query) {
  const p = query.trim().toLowerCase();
  return ACCESSORY_TERMS.some((t) => p.includes(t)) || REPAIR_AND_PARTS_TERMS.some((t) => p.includes(t));
}

function isRepairOrPartsListing(hay) {
  return REPAIR_AND_PARTS_TERMS.some((t) => hay.includes(t));
}

function requiredBrandsForQuery(query) {
  const q = query.trim().toLowerCase();
  if (/\b(iphone|ipad|macbook)\b/.test(q)) return ["apple", "iphone", "ipad", "macbook"];
  if (/\b(galaxy|samsung|fold)\b/.test(q)) return ["samsung"];
  if (/\b(ps5|playstation)\b/.test(q)) return ["sony", "playstation", "ps5"];
  return null;
}

function titleMatchesQuery(title, query) {
  const tokens = queryTokens(query);
  if (!tokens.length) return false;
  const hay = title.toLowerCase();
  if (tokens.every((t) => hay.includes(t))) return true;
  if (tokens.includes("galaxy")) {
    const model = tokens.filter((t) => t !== "galaxy");
    if (model.length && /\bsamsung\b/.test(hay) && model.every((t) => hay.includes(t))) return true;
  }
  if (tokens.includes("macbook") && tokens.includes("air") && /\bmacbook\b/.test(hay) && /\bair\b/.test(hay)) return true;
  if (tokens.length === 1 && tokens[0] === "ps5") return /\b(ps5|playstation\s*5)\b/.test(hay);
  return false;
}

function isAccessoryDominant(hay) {
  if (isRepairOrPartsListing(hay)) return true;
  if (/\b\d+\s*(gb|tb)\b/.test(hay) && /\b(includes|with)\b/.test(hay)) return false;
  return ACCESSORY_TERMS.some((t) => hay.includes(t));
}

function looksLikeDevice(title, category) {
  const hay = title.toLowerCase();
  if (isRepairOrPartsListing(hay)) return false;
  if (isAccessoryDominant(hay)) {
    const strong = /\b\d+\s*(gb|tb)\b/i.test(title) && (/\bunlocked\b/.test(hay) || /\b5g\b/.test(hay) || /\bsmartphone\b/.test(hay));
    if (!strong) return false;
  }
  if (/\b\d+\s*(gb|tb)\b/i.test(title) && /\b(iphone|galaxy|macbook|ipad)\b/.test(hay)) return true;
  if (/\bmacbook\s+(air|pro)\b/.test(hay) && /\b(m1|m2|m3|\d+\s*(gb|tb))\b/i.test(title)) return true;
  if (/\b(ps5|playstation\s*5)\b/.test(hay) && (/\bsony\b/.test(hay) || /\bconsole\b/.test(hay))) return true;
  if (/\b(fold|flip)\b/.test(hay) && /\bsamsung\b/.test(hay) && /\b\d+\s*(gb|tb)\b/i.test(title)) return true;
  if (!isAccessoryDominant(hay)) {
    if (/^(apple\s+)?iphone\s+\d/.test(hay)) return true;
    if (/^samsung\s+galaxy/i.test(title.trim())) return true;
    if (/^apple\s+macbook/i.test(title.trim())) return true;
  }
  return false;
}

function isAccessoryListing(title) {
  if (looksLikeDevice(title)) return false;
  const hay = title.toLowerCase();
  if (isRepairOrPartsListing(hay)) return true;
  if (/\bfor\s+(iphone|samsung|galaxy|macbook|ps5|playstation)\b/.test(hay)) return true;
  return ACCESSORY_TERMS.some((t) => hay.includes(t));
}

function scoreSearchRelevance(title, query) {
  const hay = title.toLowerCase();
  if (!titleMatchesQuery(title, query)) return -1;
  if (!queryWantsAccessory(query)) {
    if (isRepairOrPartsListing(hay)) return -1;
    if (isAccessoryListing(title)) return -1;
    if (!looksLikeDevice(title)) return -1;
    const brands = requiredBrandsForQuery(query);
    if (brands && !brands.some((b) => hay.includes(b))) return -1;
  }
  let score = queryTokens(query).length * 10;
  if (looksLikeDevice(title)) score += 60;
  if (OFFICIAL_DEVICE_BRANDS.some((b) => hay.includes(b))) score += 25;
  return score;
}

function rankTitles(titles, query) {
  return titles
    .map((title) => ({ title, score: scoreSearchRelevance(title, query) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score);
}

const FIXTURES = {
  "iPhone 15": [
    "Apple iPhone 15 Pro Max 256GB Unlocked Smartphone",
    "Luxury Case for iPhone 15 Pro Max",
    "LCD Screen Separator Machine for iPhone 15 Repair",
    "iPhone 15 Charging Cable USB-C 2m",
    "Refurbished Apple iPhone 15 128GB",
  ],
  "Samsung S24": [
    "Samsung Galaxy S24 Ultra 512GB 5G Unlocked",
    "Samsung S24 Tempered Glass Screen Protector 3 Pack",
    "Galaxy S24 Ultra Display Assembly Replacement",
    "Samsung Galaxy S24 Ultra 256GB Dual SIM",
  ],
  "Galaxy Fold": [
    "Samsung Galaxy Z Fold 5 512GB Unlocked 5G",
    "Samsung Galaxy Fold Screen Protector Film",
    "Galaxy Z Fold 5 Case Cover with S Pen",
    "Samsung Galaxy Z Fold6 256GB Global Version",
  ],
  "MacBook Air": [
    "Apple MacBook Air 13 M2 256GB Space Gray",
    "MacBook Air M3 15 inch 512GB Apple Laptop",
    "Hard Shell Case for MacBook Air 13 M2",
    "MacBook Air Keyboard Cover Silicone",
  ],
  PS5: [
    "Sony PlayStation 5 PS5 Console Disc Edition",
    "Sony PS5 Digital Edition Console",
    "PS5 Controller Skin Cover Silicone",
    "PS5 HDMI Cable 8K",
    "PlayStation 5 Slim Console 1TB",
  ],
};

let allPass = true;
console.log("=== Phase 3 offline fixtures ===\n");

for (const [query, titles] of Object.entries(FIXTURES)) {
  const ranked = rankTitles(titles, query);
  const top = ranked[0]?.title ?? "(none)";
  const badInTop = ranked.slice(0, 3).filter((r) => isAccessoryListing(r.title) || isRepairOrPartsListing(r.title.toLowerCase())).length;
  const pass = ranked.length > 0 && badInTop === 0 && looksLikeDevice(top);
  if (!pass) allPass = false;
  console.log(`Query: "${query}" → ${pass ? "PASS" : "FAIL"}`);
  console.log(`  Top: ${top}`);
  for (const r of ranked) console.log(`    [${r.score}] ${r.title}`);
  console.log();
}

console.log(allPass ? "ALL PASS" : "SOME FAILED");
process.exit(allPass ? 0 : 1);
