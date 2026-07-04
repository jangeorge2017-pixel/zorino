/**
 * Phase 2 relevance verification for device search queries.
 * Runs offline title tests; optionally hits live AliExpress when creds exist.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// Mirror lib/search/relevance.ts (plain JS for node without tsx)
const ACCESSORY_TERMS = [
  "screen protector", "tempered glass", "phone case", "phone cover", "phone holder",
  "phone mount", "car mount", "car charger", "wireless charger", "charging dock",
  "charging cable", "usb cable", "camera lens", "replacement part", "replacement screen",
  "leather case", "soft case", "hard case", "magnetic case", "silicone case",
  "swimming bag", "lavalier microphone", "lavalier mic", "case", "cover", "charger",
  "cable", "protector", "tempered", "film", "sticker", "holder", "adapter", "stand",
  "mount", "skin", "shell", "pouch", "bag", "replacement", "silicone", "lens",
  "earphone", "earbud", "headphone", "microphone", "airbag",
];

const DEVICE_CATEGORY_HINTS = ["phones", "telecommunication", "tablet", "computer", "laptop"];

function queryTokens(query) {
  return query.toLowerCase().replace(/[^a-z0-9\s.+-]/g, " ").split(/\s+/)
    .filter((t) => t.length >= 2);
}

function queryWantsAccessory(query) {
  const phrase = query.trim().toLowerCase();
  return ACCESSORY_TERMS.some((term) => phrase.includes(term));
}

function categorySuggestsDevice(category) {
  if (!category?.trim()) return false;
  const hay = category.toLowerCase();
  return DEVICE_CATEGORY_HINTS.some((h) => hay.includes(h));
}

function looksLikeDevice(title, category) {
  const hay = title.toLowerCase();
  const isAccessoryDominant = () => {
    if (/\b\d+\s*(gb|tb)\b/.test(hay) && /\b(includes|with)\b/.test(hay) && /\b(cable|charger|adapter)\b/.test(hay)) return false;
    return ACCESSORY_TERMS.some((t) => hay.includes(t));
  };
  if (isAccessoryDominant()) {
    const strong = /\b\d+\s*(gb|tb)\b/i.test(title) && (/\bunlocked\b/.test(hay) || /\bsmartphone\b/.test(hay) || /\b5g\b/.test(hay) || /\bdual\s+sim\b/.test(hay) || categorySuggestsDevice(category));
    if (!strong) return false;
  }
  if (/\b\d+\s*(gb|tb)\b/i.test(title)) {
    if (/\b(iphone|galaxy|xiaomi|ipad|redmi)\b/.test(hay)) return true;
    if (categorySuggestsDevice(category)) return true;
    if (/\b(unlocked|smartphone|dual\s+sim|5g)\b/.test(hay)) return true;
  }
  if (/\bunlocked\b/.test(hay) && /\b(iphone|galaxy|xiaomi|ipad)\b/.test(hay)) return true;
  if (/\bsmartphone\b/.test(hay)) return true;
  if (/\bipad\b/.test(hay) && /\b(pro|air|mini)\b/.test(hay) && /\b\d+\s*(gb|tb)\b/i.test(title)) return true;
  if (!isAccessoryDominant()) {
    if (/^(apple\s+)?iphone\s+\d/.test(hay)) return true;
    if (/^samsung\s+galaxy\s+[a-z]?\d+/i.test(title)) return true;
    if (/^xiaomi\s+\d+/i.test(title)) return true;
  }
  return false;
}

function isAccessoryListing(title, query) {
  if (looksLikeDevice(title)) return false;
  const hay = title.toLowerCase();
  const tokens = queryTokens(query);
  if (/\bfor\s+/.test(hay)) {
    if (tokens.some((t) => hay.includes(`for ${t}`))) return true;
    if (/\bfor\s+(apple\s+)?iphone\b/.test(hay)) return true;
    if (/\bfor\s+samsung\b/.test(hay)) return true;
    if (/\bfor\s+galaxy\b/.test(hay)) return true;
    if (/\bfor\s+ipad\b/.test(hay)) return true;
    if (/\bfor\s+xiaomi\b/.test(hay)) return true;
    if (/\bcompatible\s+with\b/.test(hay)) return true;
  }
  return ACCESSORY_TERMS.some((term) => hay.includes(term));
}

function scoreSearchRelevance(title, query, category) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return -1;
  const hay = title.toLowerCase();
  if (!tokens.every((t) => hay.includes(t))) return -1;
  if (!queryWantsAccessory(query) && isAccessoryListing(title, query)) return -1;
  let score = tokens.length * 10;
  const phrase = query.trim().toLowerCase();
  if (phrase.length >= 2 && hay.includes(phrase)) score += 25;
  if (looksLikeDevice(title, category)) score += 60;
  return score;
}

function rankTitles(titles, query) {
  return titles
    .map((title) => ({ title, score: scoreSearchRelevance(title, query) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score);
}

const FIXTURES = {
  iphone: [
    "New Floating Airbag Waterproof Swimming Bag Phone Case For iPhone Samsung",
    "Magnetic Car Phone Mount For iPhone",
    "Apple / iPhone 14 Plus / A2632 / 256GB / Black / GSM Unlocked",
    "Wireless Lavalier Microphone for iPhone 17/16/15",
    "Apple iPhone 15 Pro Max 256GB Unlocked Smartphone",
    "Cute Phone USB Cable Protector For Apple iPhone",
  ],
  "samsung s24": [
    "Samsung Galaxy S24 Ultra 512GB 5G Smartphone Unlocked",
    "Samsung S24 Clear Case Tempered Glass Screen Protector",
    "Samsung Galaxy S24 Ultra Case Cover",
    "Samsung Galaxy A54 128GB",
    "Car Mount for Samsung S24",
  ],
  "galaxy a55": [
    "Samsung Galaxy A55 5G 256GB Dual SIM Unlocked",
    "Galaxy A55 Case Cover Silicone",
    "Samsung Galaxy A55 Screen Protector Tempered Glass",
    "For Samsung Galaxy A55 Leather Case",
    "Samsung Galaxy A54 128GB",
  ],
  "xiaomi 14": [
    "Xiaomi 14 512GB 5G Smartphone Global Version",
    "Xiaomi 14 Pro Leather Case Cover",
    "Tempered Glass for Xiaomi 14 Screen Protector",
    "Xiaomi Redmi Note 13 128GB",
    "USB Cable Charger for Xiaomi 14",
  ],
  ipad: [
    "Apple iPad Pro 11 256GB WiFi Tablet",
    "iPad Air 5 64GB WiFi",
    "Case for iPad Pro 11 Magnetic Cover",
    "Screen Protector Tempered Glass for iPad",
    "iPad Stand Holder Adjustable",
  ],
};

console.log("=== Offline relevance fixtures ===\n");
let allPass = true;

for (const [query, titles] of Object.entries(FIXTURES)) {
  const ranked = rankTitles(titles, query);
  const top = ranked[0]?.title ?? "(none)";
  const accessoryInTop3 = ranked.slice(0, 3).filter((r) => isAccessoryListing(r.title, query)).length;
  const deviceInTop3 = ranked.slice(0, 3).filter((r) => looksLikeDevice(r.title)).length;
  const pass = ranked.length > 0 && deviceInTop3 >= 1 && accessoryInTop3 === 0;
  if (!pass) allPass = false;

  console.log(`Query: "${query}"`);
  console.log(`  Top result: ${top}`);
  console.log(`  Ranked (${ranked.length}):`);
  for (const r of ranked) {
    const kind = looksLikeDevice(r.title) ? "device" : isAccessoryListing(r.title, query) ? "accessory" : "other";
    console.log(`    [${r.score}] (${kind}) ${r.title}`);
  }
  console.log(`  PASS: ${pass}\n`);
}

// Live API (optional)
const APP_KEY = process.env.ALIEXPRESS_APP_KEY?.trim();
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET?.trim();
const API_URL = "https://api-sg.aliexpress.com/sync";

function formatTimestamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")}`;
}

function sign(params, secret) {
  const sorted = Object.keys(params).filter((k) => k !== "sign" && params[k]).sort();
  let base = secret;
  for (const key of sorted) base += key + params[key];
  base += secret;
  return createHash("md5").update(base, "utf8").digest("hex").toUpperCase();
}

async function liveSearch(query) {
  const biz = { keywords: query, page_no: "1", page_size: "50", target_currency: "USD", target_language: "EN" };
  const params = { method: "aliexpress.affiliate.product.query", app_key: APP_KEY, sign_method: "md5", timestamp: formatTimestamp(), format: "json", v: "2.0", ...biz };
  params.sign = sign(params, APP_SECRET);
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body: new URLSearchParams(params).toString() });
  const json = await res.json();
  const node = json.aliexpress_affiliate_product_query_response?.resp_result?.result?.products;
  const raw = Array.isArray(node) ? node : node?.product ?? [];
  const ranked = raw
    .map((p) => ({
      title: p.product_title ?? "",
      category: p.first_level_category_name,
      score: scoreSearchRelevance(p.product_title ?? "", query, p.first_level_category_name),
    }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score);
  const top5 = ranked.slice(0, 5);
  const devices = top5.filter((r) => looksLikeDevice(r.title, r.category)).length;
  return { rawCount: raw.length, relevantCount: ranked.length, top5, devicesInTop5: devices };
}

if (APP_KEY && APP_SECRET) {
  console.log("=== Live AliExpress API (page 1) ===\n");
  for (const q of ["iphone", "samsung s24", "galaxy a55", "xiaomi 14", "ipad"]) {
    const r = await liveSearch(q);
    console.log(`"${q}": raw=${r.rawCount} relevant=${r.relevantCount} devicesInTop5=${r.devicesInTop5}`);
    for (const item of r.top5) {
      const kind = looksLikeDevice(item.title, item.category) ? "device" : "other";
      console.log(`  [${item.score}] (${kind}) ${item.title.slice(0, 90)}`);
    }
    console.log();
  }
} else {
  console.log("=== Live API skipped (no local AliExpress creds) ===\n");
}

console.log(allPass ? "OFFLINE FIXTURES: ALL PASS" : "OFFLINE FIXTURES: SOME FAILED");
process.exit(allPass ? 0 : 1);
