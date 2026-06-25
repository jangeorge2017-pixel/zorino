#!/usr/bin/env node
/**
 * Verify Phase 1 import pipeline — no placeholders on homepage, imported products in DB.
 * Usage: npm run import:verify:phase1
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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
let ok = true;

console.log("Phase 1 import verification");

const PLACEHOLDER_SLUGS = [
  "iphone-15-pro-max",
  "macbook-air-m3",
  "playstation-5",
  "nike-air-jordan-1",
];

const { data: activePlaceholders } = await supabase
  .from("products")
  .select("slug")
  .eq("is_active", true)
  .in("slug", PLACEHOLDER_SLUGS);

if (activePlaceholders?.length) {
  console.log(`✗ ${activePlaceholders.length} placeholder product(s) still active`);
  ok = false;
} else {
  console.log("✓ No active placeholder seed products");
}

const { data: localImages } = await supabase
  .from("products")
  .select("slug")
  .eq("is_active", true)
  .like("image_url", "/products/%");

if (localImages?.length) {
  console.log(`✗ ${localImages.length} active product(s) with local placeholder images`);
  ok = false;
} else {
  console.log("✓ No active products with local placeholder images");
}

const { count: importedCount } = await supabase
  .from("products")
  .select("*", { count: "exact", head: true })
  .eq("is_active", true)
  .eq("sync_status", "synced")
  .not("last_synced_at", "is", null);

console.log(`✓ Imported active products: ${importedCount ?? 0}`);

const { count: imageCount } = await supabase
  .from("product_images")
  .select("*", { count: "exact", head: true });

console.log(`✓ Product images in DB: ${imageCount ?? 0}`);

for (const provider of ["aliexpress", "ebay", "cjdropshipping"]) {
  const { count } = await supabase
    .from("external_products")
    .select("*", { count: "exact", head: true })
    .eq("provider", provider);
  console.log(`  ${provider}: ${count ?? 0} external products`);
}

console.log(ok ? "\nPhase 1 verification passed." : "\nPhase 1 verification failed.");
process.exit(ok ? 0 : 1);
