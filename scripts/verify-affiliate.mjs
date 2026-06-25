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

console.log("Zorino affiliate system verification");

for (const table of ["affiliate_settings", "affiliate_clicks", "affiliate_daily_stats"]) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) {
    console.log(`✗ ${table}: ${error.message}`);
    ok = false;
  } else {
    console.log(`✓ ${table}: ${count ?? 0} rows`);
  }
}

const marketplaces = ["amazon", "aliexpress", "ebay", "walmart", "temu"];
const { data: settings } = await supabase.from("affiliate_settings").select("marketplace");
const configured = new Set((settings ?? []).map((r) => r.marketplace));
for (const m of marketplaces) {
  console.log(configured.has(m) ? `✓ setting ${m}` : `✗ missing setting ${m}`);
  if (!configured.has(m)) ok = false;
}

console.log(ok ? "\nAffiliate schema OK." : "\nRun: npm run db:push");
process.exit(ok ? 0 : 1);
