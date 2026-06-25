#!/usr/bin/env node
/**
 * Verifies admin catalog data is readable by the public anon client (same as frontend).
 * Usage: node scripts/verify-catalog-connection.mjs
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

const checks = [
  {
    name: "active products (homepage)",
    run: () =>
      supabase.from("products").select("id, name", { count: "exact" }).eq("is_active", true).limit(1),
  },
  {
    name: "active stores (/stores)",
    run: () =>
      supabase.from("stores").select("id, name", { count: "exact" }).eq("is_active", true).limit(1),
  },
  {
    name: "active coupons (homepage)",
    run: () =>
      supabase.from("coupons").select("id, code", { count: "exact" }).eq("is_active", true).limit(1),
  },
  {
    name: "active deals (/deals)",
    run: () =>
      supabase
        .from("deals")
        .select("id, title", { count: "exact" })
        .eq("is_active", true)
        .gte("ends_at", new Date().toISOString())
        .limit(1),
  },
  {
    name: "active categories",
    run: () =>
      supabase
        .from("categories")
        .select("id, name", { count: "exact" })
        .eq("is_active", true)
        .limit(1),
  },
  {
    name: "current prices",
    run: () =>
      supabase.from("prices").select("id", { count: "exact" }).eq("is_current", true).limit(1),
  },
];

console.log("Zorino catalog connection verification (anon client)");
console.log("URL:", url);

let ok = true;

for (const check of checks) {
  const { count, error, data } = await check.run();
  if (error) {
    console.log(`✗ ${check.name}: ${error.message}`);
    ok = false;
  } else if ((count ?? 0) === 0) {
    console.log(`⚠ ${check.name}: 0 rows (empty catalog)`);
  } else {
    const sample = data?.[0];
    const label =
      sample?.name ?? sample?.title ?? sample?.code ?? sample?.id ?? "ok";
    console.log(`✓ ${check.name}: ${count} rows (sample: ${label})`);
  }
}

// Search query smoke test
const { data: searchData, error: searchError } = await supabase
  .from("products")
  .select("name")
  .eq("is_active", true)
  .ilike("name", "%iPhone%")
  .limit(3);

if (searchError) {
  console.log(`✗ product search: ${searchError.message}`);
  ok = false;
} else {
  console.log(`✓ product search: ${searchData?.length ?? 0} matches for "iPhone"`);
}

console.log(ok ? "\nAll catalog reads succeeded." : "\nSome checks failed.");
process.exit(ok ? 0 : 1);
