/**
 * Production verification for Amazon integration deploy.
 */
const QUERIES = [
  "iPhone 16",
  "Samsung S25 Ultra",
  "MacBook Air M4",
  "PlayStation 5",
  "RTX 5090",
  "Dyson",
  "Nike Air Max",
];

const baseUrl = (process.argv[2] ?? "https://www.zorino.org/en/search?q=").replace(/\/$/, "");
const searchBase = baseUrl.includes("search?q=")
  ? baseUrl
  : `${baseUrl.replace(/\/search.*$/, "")}/en/search?q=`;

function parseTitles(html) {
  return [...html.matchAll(/class="deal-name">([^<]+)/g)].map((m) =>
    m[1].replace(/&amp;/g, "&").trim()
  );
}

function parseStores(html) {
  const stores = new Set();
  if (/Amazon/i.test(html)) stores.add("amazon");
  if (/AliExpress/i.test(html)) stores.add("aliexpress");
  if (/eBay/i.test(html)) stores.add("ebay");
  if (/Walmart/i.test(html)) stores.add("walmart");
  return [...stores];
}

console.log("=== Production Amazon Search Verification ===\n");

const rows = [];
for (const q of QUERIES) {
  const started = Date.now();
  const res = await fetch(`${searchBase}${encodeURIComponent(q)}`, {
    headers: { "Accept-Language": "en", Cookie: "NEXT_LOCALE=en" },
  });
  const html = await res.text();
  const ms = Date.now() - started;
  const titles = parseTitles(html);
  const stores = parseStores(html);
  const hasTag = html.includes("zorino-20");
  const dupes = titles.length - new Set(titles.map((t) => t.toLowerCase())).size;

  rows.push({ q, status: res.status, count: titles.length, ms, stores, hasTag, dupes });
  console.log(
    `${q}: ${titles.length} results in ${ms}ms | stores: ${stores.join("+") || "none"} | zorino-20 in HTML: ${hasTag} | dupTitles: ${dupes}`
  );
  if (titles[0]) console.log(`  #1: ${titles[0].slice(0, 80)}`);
}

console.log("\n--- Summary ---");
const amazonHits = rows.filter((r) => r.stores.includes("amazon")).length;
console.log({
  queries: rows.length,
  queriesWithAmazon: amazonHits,
  avgMs: Math.round(rows.reduce((s, r) => s + r.ms, 0) / rows.length),
  totalDupTitles: rows.reduce((s, r) => s + r.dupes, 0),
});
