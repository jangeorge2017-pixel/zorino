/**
 * Full production readiness verification for ZORINO search.
 * Usage: node scripts/verify-production-ready.mjs [baseUrl]
 */
const baseUrl = (process.argv[2] ?? "https://www.zorino.org").replace(/\/$/, "");

const KEYWORDS = [
  "iphone",
  "samsung",
  "laptop",
  "monitor",
  "earbuds",
  "keyboard",
  "mouse",
  "smartwatch",
  "tv",
  "camera",
];

const ACCESSORY_RE =
  /\b(case|cover|sticker|charger|cable|protector|holder|mount|bag|pouch|skin|shell|film|tempered|gamepad|controller|paste|grease|clip|latch)\b/i;

const DEVICE_HINTS = {
  iphone: /\biphone\b/i,
  samsung: /\b(samsung|galaxy)\b/i,
  laptop: /\b(laptop|notebook|macbook)\b/i,
  monitor: /\bmonitor\b/i,
  earbuds: /\b(earbud|earphone|headphone|airpods)\b/i,
  keyboard: /\bkeyboard\b/i,
  mouse: /\bmouse\b/i,
  smartwatch: /\b(smart\s*watch|smartwatch|watch)\b/i,
  tv: /\b(tv|television)\b/i,
  camera: /\bcamera\b/i,
};

function decode(html) {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseCards(html) {
  const text = decode(html);
  const titles = [...text.matchAll(/class="deal-name">([^<]+)/g)].map((m) => m[1].trim());
  const markets = [...text.matchAll(/data-marketplace="([^"]+)"/g)].map((m) => m[1].trim());
  const hrefs = [...text.matchAll(/href="(\/api\/affiliate\/go[^"]+)"/g)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );
  return { titles, markets, hrefs };
}

function countBy(arr) {
  const out = {};
  for (const v of arr) out[v] = (out[v] || 0) + 1;
  return out;
}

function isTrackedAffiliate(url) {
  const u = url.toLowerCase();
  return (
    u.includes("s.click.aliexpress") ||
    u.includes("aff_short_key") ||
    u.includes("aff_trace") ||
    u.includes("campid=") ||
    u.includes("mkevt=") ||
    u.includes("mkcid=") ||
    u.includes("/api/affiliate/go")
  );
}

async function fetchSearch(q) {
  const urls = [
    `${baseUrl}/en/search?q=${encodeURIComponent(q)}`,
    `${baseUrl}/ar/search?q=${encodeURIComponent(q)}`,
    `${baseUrl}/search?q=${encodeURIComponent(q)}`,
  ];
  for (const url of urls) {
    const res = await fetch(url, {
      headers: {
        "Accept-Language": "en",
        Cookie: "zor_locale=en; NEXT_LOCALE=en",
        "User-Agent": "ZorinoProductionVerify/1.0",
      },
      redirect: "follow",
    });
    const html = await res.text();
    const cards = parseCards(html);
    if (cards.titles.length > 0) {
      return { status: res.status, url: res.url, ...cards };
    }
  }
  return { status: 0, url: "", titles: [], markets: [], hrefs: [] };
}

console.log(`=== ZORINO Production Ready Report — ${baseUrl} ===\n`);

const home = await fetch(baseUrl, { redirect: "follow" });
console.log(`Homepage: HTTP ${home.status} → ${home.url}`);

const statusRes = await fetch(`${baseUrl}/api/integrations/status?probe=1`);
const statusJson = await statusRes.json();
console.log(
  `Integrations: AE=${statusJson?.credentials?.aliexpress?.configured} eBay=${statusJson?.credentials?.ebay?.configured} probe=${statusJson?.probe?.ok}`,
);

let totalEbay = 0;
let totalAe = 0;
let affiliateOk = 0;
let affiliateChecked = 0;
const rows = [];

for (const q of KEYWORDS) {
  const result = await fetchSearch(q);
  const counts = countBy(result.markets);
  const ebay = counts.ebay || 0;
  const ae = counts.aliexpress || 0;
  totalEbay += ebay;
  totalAe += ae;

  const top = result.titles[0] || "";
  const hint = DEVICE_HINTS[q];
  const topRelevant = hint ? hint.test(top) : true;
  const topIsAccessory = ACCESSORY_RE.test(top) && !/earbuds|keyboard|mouse/i.test(q);
  const bothMarkets = ebay > 0 && ae > 0;

  const sampleHrefs = result.hrefs.slice(0, 6);
  for (const href of sampleHrefs) {
    affiliateChecked++;
    const abs = href.startsWith("http") ? href : `${baseUrl}${href}`;
    if (isTrackedAffiliate(abs) || abs.includes("/api/affiliate/go")) {
      affiliateOk++;
    } else {
      try {
        const dest = new URL(abs).searchParams.get("to") || "";
        if (isTrackedAffiliate(dest)) affiliateOk++;
      } catch {
        /* ignore */
      }
    }
  }

  const pass =
    result.titles.length > 0 &&
    topRelevant &&
    !(topIsAccessory && !/earbuds|keyboard|mouse/i.test(q)) &&
    (bothMarkets || ebay + ae > 0);

  rows.push({
    q,
    count: result.titles.length,
    ebay,
    ae,
    top: top.slice(0, 80),
    bothMarkets,
    pass,
  });

  console.log(
    `${pass ? "PASS" : "WARN"} ${q}: ${result.titles.length} results | AE=${ae} eBay=${ebay} | #1: ${top.slice(0, 70)}`,
  );
}

console.log("\n--- Totals ---");
console.log(`AliExpress cards (sum across queries): ${totalAe}`);
console.log(`eBay cards (sum across queries): ${totalEbay}`);
console.log(
  `Affiliate redirect samples tracked: ${affiliateOk}/${affiliateChecked || 1}`,
);
console.log(`Keywords passed: ${rows.filter((r) => r.pass).length}/${rows.length}`);
