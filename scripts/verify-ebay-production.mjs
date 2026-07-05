/**
 * Production eBay verification — confirms live PRD search (not sandbox).
 */
const QUERIES = [
  "iPhone 16",
  "Samsung Galaxy S24",
  "PlayStation 5",
  "MacBook Air",
  "Nike Air Max",
  "Dyson",
];

const base = process.argv[2] ?? "https://www.zorino.org/en/search?q=";

function parseStoreCounts(html) {
  const counts = { ebay: 0, aliexpress: 0, amazon: 0, other: 0 };
  for (const m of html.matchAll(/class="trending-card-store">([^<]+)/g)) {
    const text = m[1].toLowerCase();
    if (text.includes("ebay")) counts.ebay++;
    else if (text.includes("aliexpress")) counts.aliexpress++;
    else if (text.includes("amazon")) counts.amazon++;
    else counts.other++;
  }
  return counts;
}

function parseEbayRedirectHosts(html) {
  const hosts = new Set();
  for (const m of html.matchAll(/api\/affiliate\/go\?[^"']+/g)) {
    const link = m[0];
    if (!link.includes("store=ebay")) continue;
    const toMatch = link.match(/(?:^|[?&])to=([^&"']+)/);
    if (!toMatch) continue;
    try {
      const url = decodeURIComponent(toMatch[1]);
      hosts.add(new URL(url).hostname.toLowerCase());
    } catch {
      // skip malformed
    }
  }
  return [...hosts];
}

console.log("=== eBay Production Verification ===\n");

let totalEbayCards = 0;
let sandboxHosts = 0;
let productionHosts = 0;

for (const q of QUERIES) {
  const started = Date.now();
  const res = await fetch(`${base}${encodeURIComponent(q)}`, {
    headers: { "Accept-Language": "en", Cookie: "NEXT_LOCALE=en" },
  });
  const html = await res.text();
  const ms = Date.now() - started;
  const stores = parseStoreCounts(html);
  const ebayHosts = parseEbayRedirectHosts(html);
  totalEbayCards += stores.ebay;

  for (const host of ebayHosts) {
    if (host.includes("sandbox")) sandboxHosts++;
    else if (host.includes("ebay.")) productionHosts++;
  }

  console.log(
    `${q}: ${ms}ms | eBay cards=${stores.ebay} AliExpress=${stores.aliexpress} Amazon=${stores.amazon} | ebayHosts=${ebayHosts.join(",") || "none"}`
  );
}

console.log("\n--- Credential mode ---");
if (sandboxHosts > 0) {
  console.log("FAIL: sandbox.ebay.com detected in affiliate URLs");
} else if (productionHosts > 0) {
  console.log("OK: production eBay hosts in affiliate URLs (www.ebay.com / ebay.com)");
} else if (totalEbayCards > 10) {
  console.log("OK: substantial eBay results — production Browse API likely active");
} else if (totalEbayCards > 0) {
  console.log("WARN: few eBay results — verify EBAY_APP_ID is PRD (not SBX)");
} else {
  console.log("FAIL: no eBay product cards found — check Vercel EBAY_* env vars");
}

console.log("\n--- Summary ---");
console.log({
  totalEbayProductCards: totalEbayCards,
  productionEbayHosts: productionHosts,
  sandboxEbayHosts: sandboxHosts,
  queries: QUERIES.length,
});
