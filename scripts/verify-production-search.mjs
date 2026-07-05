/**
 * Production multi-marketplace search verification.
 * Usage: node scripts/verify-production-search.mjs [baseUrl]
 */
const baseUrl = (process.argv[2] ?? "https://www.zorino.org/en").replace(/\/$/, "");

const QUERIES = [
  "iPhone 15",
  "Samsung S24 Ultra",
  "PS5",
  "MacBook Air M3",
  "RTX 5090",
  "Nintendo Switch",
  "Dyson V15",
  "iPhone",
  "Galaxy A55",
];

function parseTitles(html) {
  return [...html.matchAll(/class="deal-name">([^<]+)/g)].map((m) =>
    m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim()
  );
}

function countStores(titles, html) {
  const stores = new Set();
  if (html.includes("AliExpress")) stores.add("aliexpress");
  if (html.includes("eBay")) stores.add("ebay");
  if (html.includes("Amazon")) stores.add("amazon");
  if (html.includes("Walmart")) stores.add("walmart");
  return stores;
}

console.log(`=== Production Search Report — ${baseUrl} ===\n`);

const summary = [];

for (const q of QUERIES) {
  const res = await fetch(`${baseUrl}/search?q=${encodeURIComponent(q)}`, {
    headers: { "Accept-Language": "en", Cookie: "NEXT_LOCALE=en" },
  });
  const html = await res.text();
  const titles = parseTitles(html);
  const stores = countStores(titles, html);

  summary.push({ q, count: titles.length, stores: [...stores] });
  console.log(`${q}: ${titles.length} results | stores: ${[...stores].join(", ") || "unknown"}`);
  if (titles[0]) console.log(`  #1: ${titles[0].slice(0, 90)}`);
}

console.log("\n--- Summary ---");
for (const row of summary) {
  console.log(`${row.q}: ${row.count} (${row.stores.join("+") || "?"})`);
}
