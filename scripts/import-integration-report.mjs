#!/usr/bin/env node
/**
 * Phase 1 import integration report — provider status, DB counts, missing credentials.
 * Usage: npm run import:report
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

const PHASE1 = [
  {
    id: "aliexpress",
    name: "AliExpress",
    required: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET"],
    optional: ["ALIEXPRESS_TRACKING_ID"],
  },
  {
    id: "ebay",
    name: "eBay",
    required: ["EBAY_APP_ID", "EBAY_CERT_ID"],
    optional: ["EBAY_CAMPAIGN_ID", "EBAY_OAUTH_TOKEN"],
  },
  {
    id: "cjdropshipping",
    name: "CJdropshipping",
    required: ["CJDROPSHIPPING_API_KEY"],
    optional: [],
  },
];

function isConfigured(provider) {
  if (provider.id === "ebay" && process.env.EBAY_OAUTH_TOKEN?.trim()) return true;
  return provider.required.every((k) => Boolean(process.env[k]?.trim()));
}

function missingKeys(keys) {
  return keys.filter((k) => !process.env[k]?.trim());
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

console.log("Zorino Phase 1 — Product Import Integration Report");
console.log(`Generated: ${new Date().toISOString()}`);
console.log("");

const credentialsRequired = new Set();

for (const provider of PHASE1) {
  const configured = isConfigured(provider);
  const missing = configured ? [] : missingKeys(provider.required);
  const optionalMissing = missingKeys(provider.optional);
  missing.forEach((k) => credentialsRequired.add(k));
  optionalMissing.forEach((k) => credentialsRequired.add(k));

  let externalCount = 0;
  let lastSync = null;

  if (supabase) {
    const { count } = await supabase
      .from("external_products")
      .select("*", { count: "exact", head: true })
      .eq("provider", provider.id);
    externalCount = count ?? 0;

    const { data: store } = await supabase
      .from("stores")
      .select("last_sync_at")
      .eq("integration_type", provider.id)
      .order("last_sync_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastSync = store?.last_sync_at ?? null;
  }

  console.log(`${provider.name} (${provider.id})`);
  console.log(`  Integration: live · mode=${configured ? "live API" : "mock fallback"}`);
  console.log(`  Configured: ${configured}`);
  console.log(`  External products in DB: ${externalCount}`);
  console.log(`  Last sync: ${lastSync ?? "never"}`);
  if (missing.length) console.log(`  Required credentials: ${missing.join(", ")}`);
  if (optionalMissing.length) console.log(`  Optional (affiliate): ${optionalMissing.join(", ")}`);
  console.log("");
}

if (supabase) {
  const [ext, prod, imgs] = await Promise.all([
    supabase.from("external_products").select("*", { count: "exact", head: true }).in("provider", PHASE1.map((p) => p.id)),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("product_images").select("*", { count: "exact", head: true }),
  ]);

  console.log("Totals:");
  console.log(`  External products (Phase 1): ${ext.count ?? 0}`);
  console.log(`  Canonical products: ${prod.count ?? 0}`);
  console.log(`  Product images: ${imgs.count ?? 0}`);
  console.log("");
}

if (credentialsRequired.size) {
  console.log("Credentials still needed:");
  for (const key of credentialsRequired) console.log(`  - ${key}`);
} else {
  console.log("All required credentials are configured.");
}

process.exit(0);
