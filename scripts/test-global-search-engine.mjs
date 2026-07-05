/**
 * ZORINO Global Search Engine — offline verification.
 * Usage: node scripts/test-global-search-engine.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load relevance + ranking offline (no live API)
const relevancePath = resolve(root, "lib/search/relevance.ts");
const relevanceSrc = readFileSync(relevancePath, "utf8");

// Minimal inline test using dynamic import
const { analyzeSearchListing, rankBySearchRelevance, hasSameModel, hasSameSeries } =
  await import(`file:///${relevancePath.replace(/\\/g, "/")}`);

const FIXTURES = {
  iPhone: [
    "Apple iPhone 15 Pro Max 256GB Unlocked",
    "Luxury Case for iPhone 15 Pro Max",
    "Refurbished Apple iPhone 14 128GB",
    "LCD Screen Separator for iPhone Repair",
  ],
  "iPhone 15": [
    "Apple iPhone 15 Pro Max 256GB Unlocked Smartphone",
    "Refurbished Apple iPhone 15 128GB",
    "iPhone 15 Tempered Glass Screen Protector",
    "iPhone 14 Pro 256GB Unlocked",
  ],
  "Samsung S24": [
    "Samsung Galaxy S24 Ultra 512GB 5G Unlocked",
    "Samsung S24 Screen Protector 3 Pack",
    "Samsung Galaxy S23 Ultra 256GB",
  ],
  "Galaxy A55": [
    "Samsung Galaxy A55 5G 256GB Dual SIM Unlocked",
    "Samsung Galaxy A55 Case Cover",
    "Samsung Galaxy A54 128GB",
  ],
  "MacBook Air": [
    "Apple MacBook Air 13 M2 256GB Space Gray",
    "Hard Shell Case for MacBook Air 13 M2",
    "Original Map A1466 Mother for MacBook Air",
  ],
  PS5: [
    "Sony PlayStation 5 PS5 Console Disc Edition",
    "PS5 Controller Skin Silicone Cover",
    "PlayStation 5 Slim Console 1TB",
  ],
};

let allPass = true;
const report = [];

console.log("=== ZORINO Global Search Engine — Offline Quality Report ===\n");

for (const [query, titles] of Object.entries(FIXTURES)) {
  const ranked = rankBySearchRelevance(
    titles.map((t) => ({ title: t })),
    query,
    (x) => x.title
  );

  const top = ranked[0]?.title ?? "(none)";
  const topAnalysis = top !== "(none)" ? analyzeSearchListing(top, query) : null;
  const devices = ranked.filter((item) => {
    const a = analyzeSearchListing(item.title, query);
    return a.isDevice && a.tier !== "accessory";
  });
  const accessories = ranked.filter((item) => {
    const a = analyzeSearchListing(item.title, query);
    return a.tier === "accessory";
  });

  const devicesFirst =
    accessories.length === 0 ||
    devices.length === 0 ||
    ranked.findIndex((item) => analyzeSearchListing(item.title, query).tier === "accessory") >=
      devices.length;

  const noRepair = !ranked.some((item) =>
    analyzeSearchListing(item.title, query).tier === "repair"
  );
  const hasResults = ranked.length > 0;
  const pass = hasResults && noRepair && devicesFirst;

  if (!pass) allPass = false;

  const entry = {
    query,
    pass,
    resultCount: ranked.length,
    deviceCount: devices.length,
    topResult: top,
    topTier: topAnalysis?.tier ?? "none",
    topIsDevice: topAnalysis?.isDevice ?? false,
  };
  report.push(entry);

  console.log(`${pass ? "PASS" : "FAIL"} — "${query}" (${ranked.length} results, ${devices.length} devices)`);
  console.log(`  Top: [${topAnalysis?.tier}] ${top}`);
  for (const item of ranked.slice(0, 4)) {
    const a = analyzeSearchListing(item.title, query);
    console.log(`    [${a.tier}|${a.score}] ${a.isDevice ? "device" : "other"} — ${item.title}`);
  }
  console.log();
}

console.log(allPass ? "ALL QUERIES PASS" : "SOME QUERIES FAILED");
console.log("\n--- Summary ---");
for (const row of report) {
  console.log(
    `${row.pass ? "✓" : "✗"} ${row.query}: ${row.resultCount} results, top=${row.topTier}${row.topIsDevice ? " (device)" : ""}`
  );
}

process.exit(allPass ? 0 : 1);
