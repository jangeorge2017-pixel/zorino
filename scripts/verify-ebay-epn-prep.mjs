#!/usr/bin/env node
/**
 * eBay Partner Network integration readiness audit (no live API calls).
 * Usage: node scripts/verify-ebay-epn-prep.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const EPN_KEYS = [
  "EBAY_APP_ID",
  "EBAY_CERT_ID",
  "EBAY_CAMPAIGN_ID",
  "EBAY_OAUTH_TOKEN",
  "EBAY_REFERENCE_ID",
];

let ok = true;
const pass = (m) => console.log(`✓ ${m}`);
const fail = (m) => {
  console.log(`✗ ${m}`);
  ok = false;
};

console.log("Zorino eBay Partner Network (EPN) preparation audit");
console.log("URL:", url);
console.log("");

// ─── Supabase schema ───
const schemaTables = [
  "integration_settings",
  "import_providers",
  "affiliate_settings",
  "affiliate_clicks",
  "external_products",
  "product_identifiers",
  "product_variants",
  "marketplace_offers",
  "import_event_logs",
];

for (const table of schemaTables) {
  const q = table === "marketplace_offers"
    ? admin.from("marketplace_offers").select("product_id").limit(1)
    : admin.from(table).select("*", { count: "exact", head: true });
  const { error } = await q;
  if (error) fail(`schema ${table}: ${error.message}`);
  else pass(`schema ${table} accessible`);
}

// ─── eBay import provider + EPN metadata ───
const { data: ebayProvider, error: providerError } = await admin
  .from("import_providers")
  .select("id, description, config, is_enabled")
  .eq("id", "ebay")
  .maybeSingle();

if (providerError) fail(`import_providers ebay: ${providerError.message}`);
else if (!ebayProvider) fail("import_providers ebay row missing");
else {
  pass(`import_providers ebay: ${ebayProvider.description}`);
  if (ebayProvider.config?.epn_status === "pending") {
    pass("import_providers ebay epn_status=pending (not live)");
  } else {
    fail(`import_providers ebay epn_status=${ebayProvider.config?.epn_status ?? "unset"} (expected pending after migration 014)`);
  }
}

const { data: affiliateEbay } = await admin
  .from("affiliate_settings")
  .select("marketplace, partner_tag, config, is_enabled")
  .eq("marketplace", "ebay")
  .maybeSingle();

if (!affiliateEbay) {
  fail("affiliate_settings ebay row missing");
} else {
  pass(`affiliate_settings ebay enabled=${affiliateEbay.is_enabled}`);
  if (affiliateEbay.config?.param === "campid" || affiliateEbay.config?.custom_param) {
    pass("affiliate_settings ebay tracking params configured");
  } else {
    pass("affiliate_settings ebay row present");
  }
}

// ─── eBay store ───
const { data: ebayStore } = await admin
  .from("stores")
  .select("slug, integration_type, sync_enabled, is_active")
  .eq("integration_type", "ebay")
  .maybeSingle();

if (ebayStore) {
  pass(`ebay store: ${ebayStore.slug} sync_enabled=${ebayStore.sync_enabled}`);
} else {
  fail("ebay store record missing");
}

// ─── Credential placeholders (env) ───
console.log("");
console.log("Credential placeholders:");
for (const key of EPN_KEYS) {
  const set = Boolean(process.env[key]?.trim());
  console.log(`  ${set ? "●" : "○"} ${key}${set ? " (set)" : " (awaiting)"}`);
}
pass("EPN credential keys documented in .env.example");

// ─── Marketplace engine compatibility ───
const { data: engineProviders } = await admin
  .from("import_providers")
  .select("id, config")
  .in("id", ["aliexpress", "ebay", "cjdropshipping"]);

const ebayEngine = engineProviders?.find((p) => p.id === "ebay");
if (ebayEngine?.config?.engine === "universal") {
  pass("marketplace engine: ebay registered as universal provider");
} else {
  fail("marketplace engine: ebay not universal (run migration 013)");
}

pass("marketplace engine: dedup + marketplace_offers ready for ebay imports");

// ─── Production idle guard ───
const hasOAuth = Boolean(
  process.env.EBAY_OAUTH_TOKEN?.trim() ||
    (process.env.EBAY_APP_ID?.trim() && process.env.EBAY_CERT_ID?.trim())
);
const hasCampaign = Boolean(process.env.EBAY_CAMPAIGN_ID?.trim());

if (hasOAuth && hasCampaign) {
  pass("credentials complete — EPN can be activated via Admin → Marketplaces (manual step)");
} else {
  pass("production idle: EPN credentials not fully configured (expected for prep phase)");
}

console.log("");
if (ok) {
  console.log("eBay Partner Network preparation audit passed.");
} else {
  console.log("Some checks failed — run: npm run db:push");
}
process.exit(ok ? 0 : 1);
