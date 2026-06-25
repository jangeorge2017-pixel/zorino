#!/usr/bin/env node
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

console.log("Zorino lowest prices verification");

for (const name of [
  "lowest_prices_today",
  "lowest_price_history",
  "lowest_price_refresh_jobs",
]) {
  const { count, error } = await supabase.from(name).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`✗ ${name}: ${error.message}`);
    ok = false;
  } else {
    console.log(`✓ ${name}: ${count ?? 0} rows`);
  }
}

for (const view of ["product_prices", "providers", "trending_products"]) {
  const { error } = await supabase.from(view).select("*").limit(1);
  if (error) {
    console.log(`✗ view ${view}: ${error.message}`);
    ok = false;
  } else {
    console.log(`✓ view ${view}: readable`);
  }
}

const { count: productCount } = await supabase
  .from("products")
  .select("*", { count: "exact", head: true });
console.log(`✓ products preserved: ${productCount ?? 0} rows`);

console.log(ok ? "\nLowest prices schema OK." : "\nRun: npm run db:push");
process.exit(ok ? 0 : 1);
