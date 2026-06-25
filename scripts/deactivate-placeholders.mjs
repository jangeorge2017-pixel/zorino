#!/usr/bin/env node
/** Deactivate placeholder products in Supabase. Usage: node scripts/deactivate-placeholders.mjs */
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
const SLUGS = ["iphone-15-pro-max", "macbook-air-m3", "playstation-5", "nike-air-jordan-1"];

const { data: rows } = await supabase
  .from("products")
  .select("id, slug")
  .or(
    `slug.in.(${SLUGS.join(",")}),and(sync_status.eq.idle,image_url.like./products/%)`
  );

const ids = (rows ?? []).map((r) => r.id);
if (ids.length === 0) {
  console.log("No placeholder products to deactivate.");
  process.exit(0);
}

await supabase.from("deals").update({ is_active: false }).in("product_id", ids);
await supabase.from("products").update({ is_active: false }).in("id", ids);
console.log(`Deactivated ${ids.length} placeholder product(s).`);
