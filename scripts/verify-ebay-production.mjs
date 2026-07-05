/**
 * Production multi-provider search verification (eBay + AliExpress + Amazon).
 */
const QUERIES = [
  "iPhone 16",
  "Samsung Galaxy",
  "PlayStation 5",
  "MacBook Air",
  "Nike Air Max",
  "Dyson",
];

const base = (process.argv[2] ?? "https://www.zorino.org/en/search?q=").replace(/\/$/, "");
const searchBase = base.includes("search?q=")
  ? base
  : `${base.replace(/\/search.*$/, "")}/en/search?q=`;

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
  return [...stores];
}

console.log(`=== Production Search — ${searchBase} ===\n`);

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
  const dupes = titles.length - new Set(titles.map((t) => t.toLowerCase())).size;
  rows.push({ q, status: res.status, count: titles.length, ms, stores, dupes });
  console.log(
    `${q}: ${titles.length} results in ${ms}ms | stores: ${stores.join("+") || "none"} | dupTitles: ${dupes}`
  );
}

console.log("\n--- Summary ---");
console.log({
  healthy: rows.every((r) => r.status === 200),
  withEbay: rows.filter((r) => r.stores.includes("ebay")).length,
  withAliExpress: rows.filter((r) => r.stores.includes("aliexpress")).length,
  avgMs: Math.round(rows.reduce((s, r) => s + r.ms, 0) / rows.length),
});
