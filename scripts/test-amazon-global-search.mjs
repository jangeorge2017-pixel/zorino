/**
 * Live Amazon + global search verification.
 * Loads credentials from .env.local and Supabase integration_settings.
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
    if (!process.env[key]) process.env[key] = val;
  }
}

async function hydrateFromSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return;

  const keys = [
    "ALIEXPRESS_APP_KEY",
    "ALIEXPRESS_APP_SECRET",
    "ALIEXPRESS_TRACKING_ID",
    "EBAY_APP_ID",
    "EBAY_CERT_ID",
    "EBAY_CAMPAIGN_ID",
    "AMAZON_PAAPI_ACCESS_KEY",
    "AMAZON_PAAPI_SECRET_KEY",
    "AMAZON_ASSOCIATE_TAG",
  ];

  const res = await fetch(
    `${url}/rest/v1/integration_settings?select=key,value&key=in.(${keys.join(",")})`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );
  if (!res.ok) return;
  const rows = await res.json();
  for (const row of rows) {
    if (row.value?.trim() && !process.env[row.key]?.trim()) {
      process.env[row.key] = row.value.trim();
    }
  }
}

loadEnv();
await hydrateFromSupabase();

const QUERIES = [
  "iPhone 16",
  "Samsung S25 Ultra",
  "MacBook Air M4",
  "PlayStation 5",
  "RTX 5090",
  "Dyson",
  "Nike Air Max",
];

const { executeGlobalSearch } = await import("../lib/search/engine.ts");
const { getRegisteredProviderCount, getActiveSearchConnectors } = await import(
  "../lib/search/connectors/registry.ts"
);

const active = await getActiveSearchConnectors();
console.log("Registered providers:", getRegisteredProviderCount());
console.log(
  "Active providers:",
  active.map((c) => c.id).join(", ") || "(none)"
);

const associateTag = process.env.AMAZON_ASSOCIATE_TAG?.trim() || "zorino-20";
let totalAmazon = 0;
let totalWithTag = 0;
let totalDupes = 0;

for (const query of QUERIES) {
  const started = Date.now();
  const result = await executeGlobalSearch(query, { limit: 50, skipCache: true });
  const elapsed = Date.now() - started;

  const amazonOffers = result.products.flatMap((p) =>
    p.offers.filter((o) => o.providerId === "amazon")
  );
  const amazonAffiliate = amazonOffers.filter((o) =>
    (o.affiliateUrl ?? o.productUrl).includes(associateTag)
  );

  const titles = result.products.map((p) => p.title.toLowerCase());
  const dupes = titles.length - new Set(titles).size;
  totalAmazon += amazonOffers.length;
  totalWithTag += amazonAffiliate.length;
  totalDupes += dupes;

  console.log(`\n=== ${query} (${elapsed}ms) ===`);
  console.log(
    "providers:",
    result.providers.map((p) => `${p.providerId}:${p.fetched}${p.error ? " ERR" : ""}`).join(", ")
  );
  console.log(
    `unified=${result.totalUnified} amazonOffers=${amazonOffers.length} tagOk=${amazonAffiliate.length} dupTitles=${dupes}`
  );
  if (amazonOffers[0]) {
    console.log("sample amazon:", amazonOffers[0].title.slice(0, 60));
    console.log("sample url:", (amazonOffers[0].affiliateUrl ?? "").slice(0, 120));
  }
}

console.log("\n=== SUMMARY ===");
console.log({
  associateTag,
  totalAmazonOffers: totalAmazon,
  affiliateTagMatches: totalWithTag,
  duplicateTitleGroups: totalDupes,
  amazonConfigured: Boolean(
    process.env.AMAZON_PAAPI_ACCESS_KEY && process.env.AMAZON_PAAPI_SECRET_KEY
  ),
});
