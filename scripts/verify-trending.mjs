#!/usr/bin/env node
/**
 * Verify trending products schema.
 * Usage: node scripts/verify-trending.mjs
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

console.log("Zorino trending system verification");

for (const table of [
  "product_engagement_events",
  "product_engagement_daily",
  "trending_rankings",
  "trending_refresh_jobs",
]) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`✗ ${table}: ${error.message}`);
    ok = false;
  } else {
    console.log(`✓ ${table}: ${count ?? 0} rows`);
  }
}

const rankingTypes = [
  "trending_today",
  "best_sellers",
  "hot_deals",
  "biggest_drops",
  "popular_country",
];

for (const type of rankingTypes) {
  const { count } = await supabase
    .from("trending_rankings")
    .select("*", { count: "exact", head: true })
    .eq("ranking_type", type)
    .eq("country_code", "US");
  console.log(`  ${type}: ${count ?? 0} US rankings`);
}

console.log(ok ? "\nTrending schema OK." : "\nRun: npm run db:push");
process.exit(ok ? 0 : 1);
