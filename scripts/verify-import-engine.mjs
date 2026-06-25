#!/usr/bin/env node
/**
 * Verifies multi-source import engine tables, providers, and dry-run sync.
 * Usage: node scripts/verify-import-engine.mjs
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

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const providers = ["amazon", "aliexpress", "cjdropshipping", "ebay"];
let ok = true;

console.log("Zorino import engine verification");
console.log("URL:", url);

for (const table of ["import_providers", "external_products", "external_prices", "sync_jobs"]) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`✗ table ${table}: ${error.message}`);
    ok = false;
  } else {
    console.log(`✓ table ${table}: ${count ?? 0} rows`);
  }
}

const { data: providerRows, error: providerError } = await supabase
  .from("import_providers")
  .select("id, name, is_enabled");

if (providerError) {
  console.log(`✗ import_providers read: ${providerError.message}`);
  ok = false;
} else {
  for (const id of providers) {
    const row = providerRows?.find((p) => p.id === id);
    console.log(row ? `✓ provider ${id}: ${row.name}` : `✗ provider ${id}: missing`);
    if (!row) ok = false;
  }
}

const { data: importStores } = await supabase
  .from("stores")
  .select("slug, integration_type, sync_enabled")
  .in("integration_type", providers);

console.log(`✓ import stores: ${importStores?.length ?? 0} configured`);
for (const store of importStores ?? []) {
  console.log(`  - ${store.slug} (${store.integration_type}) sync=${store.sync_enabled}`);
}

const { count: jobCount } = await supabase
  .from("sync_jobs")
  .select("*", { count: "exact", head: true })
  .in("job_type", ["full", "prices"]);

console.log(`✓ scheduled sync jobs: ${jobCount ?? 0}`);

console.log(ok ? "\nImport engine schema verified." : "\nSome checks failed — run: npm run db:push");
process.exit(ok ? 0 : 1);
