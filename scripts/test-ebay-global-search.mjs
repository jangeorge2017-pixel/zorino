/**
 * Live eBay Browse API + global search verification.
 * Usage: npx tsx scripts/test-ebay-global-search.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = val;
  }
}

loadEnv();

console.log(
  "Env keys loaded:",
  ["EBAY_APP_ID", "EBAY_CERT_ID", "ALIEXPRESS_APP_KEY"].map((k) => `${k}=${Boolean(process.env[k]?.trim())}`).join(", ")
);

const QUERIES = [
  "iPhone 16",
  "Samsung Galaxy",
  "PlayStation 5",
  "MacBook Air",
  "Nike Air Max",
  "Dyson",
];

const { isEbayConfigured, isEbaySandboxMode, getEbayBrowseApiBase } = await import(
  "@/lib/integrations/ebay/config"
);
const { createEbayClientFromEnv } = await import("@/lib/integrations/ebay");
const { executeGlobalSearch } = await import("@/lib/search/engine");

console.log("eBay configured:", isEbayConfigured());
console.log("eBay sandbox mode:", isEbaySandboxMode());
console.log("Browse API:", getEbayBrowseApiBase());

const client = createEbayClientFromEnv();
if (client) {
  const validation = await client.validateCredentials();
  console.log("OAuth validation:", validation.ok ? "OK" : "FAIL", validation.message);
} else {
  console.log("eBay client not created — check EBAY_APP_ID and EBAY_CERT_ID");
  process.exit(1);
}

console.log("\n=== Per-provider fetch counts ===");
for (const query of QUERIES.slice(0, 3)) {
  const ebayOnly = await client.searchByKeyword(query, { pageSize: 20, maxPages: 2 });
  console.log(`${query}: eBay raw=${ebayOnly.length}`);
}

console.log("\n=== Normalization check (iPhone 16) ===");
const iphoneRaw = await client.searchByKeyword("iPhone 16", { pageSize: 10, maxPages: 1 });
const { normalizeEbayRaw } = await import("@/lib/search/normalization");
let normOk = 0;
for (const raw of iphoneRaw) {
  if (normalizeEbayRaw(raw)) normOk++;
}
console.log(`iPhone 16: raw=${iphoneRaw.length} normalized=${normOk}`);

console.log("\n=== Global search (eBay + AliExpress + others) ===");
for (const query of QUERIES) {
  const started = Date.now();
  const result = await executeGlobalSearch(query, { limit: 40, skipCache: true });
  const ms = Date.now() - started;
  const byProvider = Object.fromEntries(
    result.providers.map((p) => [p.providerId, p.fetched])
  );
  const ebayOffers = result.products.flatMap((p) =>
    p.offers.filter((o) => o.providerId === "ebay")
  ).length;
  console.log(
    `${query}: ${result.totalUnified} unified in ${ms}ms | fetched=${JSON.stringify(byProvider)} | ebayOffers=${ebayOffers}`
  );
}
